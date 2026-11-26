/**
 * Kamera — harita gibi gezilen, döndürülebilen ortografik kamera.
 *
 *   Sürükle: kaydır · Tekerlek / iki parmak: yakınlaş (imlecin olduğu yere)
 *   Sağ tık + sürükle / iki parmakla çevir / Q ve E: kamerayı döndür · Ok tuşları: kaydır
 *   Uzaktayken tepeden bakar, yakınlaştıkça eğilir (diorama görünümü); eğim yakınlığa bağlı kalır,
 *   döndürme yalnızca pusula yönünü değiştirir.
 *   Bölgeye ve karaktere yumuşak uçuş; "hareketi azalt" tercihinde anında geçiş.
 *   İzleme modu: hedefe uçar ve kullanıcı dokunana kadar etrafında yavaşça döner (canlı akın).
 *
 * Dışarıdan (HUD, filtreler) ref üzerinden yönetilir.
 */
import { MapControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useImperativeHandle, useLayoutEffect, useRef, type Ref, type RefObject } from "react";
import type { OrthographicCamera } from "three";
import type { MapControls as MapControlsImpl } from "three-stdlib";
import { MAX_FOCUS_ZOOM, focusForBounds } from "../lib/clustering";
import { clamp } from "../lib/geometry";
import { WORLD_SIZE } from "../types";
import type { Bounds, Coordinates } from "../types";
import { MAX_WORLD_ZOOM, MIN_OVERVIEW_FACTOR, cameraZoomFor, detailCameraZoom, overviewCameraZoom, tiltForZoom, worldZoomOf } from "./worldScale";

export interface CameraRigHandle {
  zoomBy: (factor: number) => void;
  flyTo: (center: Coordinates, worldZoom: number) => void;
  flyToBounds: (bounds: Bounds) => void;
  reset: () => void;
  /** Kamerayı verilen açı kadar döndürür (radyan; pozitif = saat yönünün tersi). */
  rotateBy: (angle: number) => void;
  /** Kuzeyi yukarı alır. */
  faceNorth: () => void;
  /**
   * Hedefe uçar ve kullanıcı dokunana kadar etrafında yavaşça döner. `fitRadius` verilirse (dünya birimi) kamera dönerken o
   * yarıçaptaki her şey ekranın dar kenarına sığacak kadar uzak durur (dikey telefonda boss kadrajdan çıkmasın).
   */
  watch: (center: Coordinates, worldZoom: number, yaw?: number, fitRadius?: number) => void;
  stopWatch: () => void;
}

interface Pose {
  x: number;
  z: number;
  zoom: number;
  yaw: number;
  /** Hedefin yüksekliği: kamera zemine bakar, yüksek yerler de ekranın ortasına gelir. */
  y: number;
}

interface Flight {
  from: Pose;
  to: Pose;
  elapsed: number;
  duration: number;
}

/** Kameranın hedefe uzaklığı (ortografik olduğu için yalnızca kırpma düzlemleri için önemli). */
const DISTANCE = 1500;
/** Genel görünümün merkezi: biraz kuzeyde, çünkü üst arayüz şeridi alttakinden kalın. */
const CENTER = { x: WORLD_SIZE.width / 2, z: WORLD_SIZE.height / 2 - 40 };
/** İzleme modunda dönüş hızı (OrbitControls birimi; 2 = dakikada bir tur). */
const WATCH_SPEED = 0.55;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** İki açı arasındaki en kısa fark (−π…π). */
const angleDelta = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

interface CameraRigProps {
  ref?: Ref<CameraRigHandle>;
  reducedMotion: boolean;
  /** Kameranın yönünü gösteren pusula iğnesi (her karede döndürülür). */
  compassRef?: RefObject<HTMLElement | null>;
  /** İzleme modu kullanıcı dokunduğu için bittiğinde. */
  onWatchEnd?: () => void;
  /** Zeminin yüksekliği (Three.js y); verilirse uçuşlar hedefi zemine oturtur. */
  groundAt?: (point: Coordinates) => number;
}

export function CameraRig({ ref, reducedMotion, compassRef, onWatchEnd, groundAt }: CameraRigProps) {
  const controlsRef = useRef<MapControlsImpl>(null);
  const flight = useRef<Flight | null>(null);
  const watching = useRef(false);
  // NaN değil: NaN ile karşılaştırma hiç doğru çıkmaz, pusula ilk karede güncellenmezdi.
  const lastCompass = useRef(Number.POSITIVE_INFINITY);
  const onWatchEndRef = useRef(onWatchEnd);
  const { camera, size, gl } = useThree();
  const cam = camera as OrthographicCamera;
  const overview = overviewCameraZoom(size);
  const minZoom = overview * MIN_OVERVIEW_FACTOR;
  const maxZoom = detailCameraZoom(size) * MAX_WORLD_ZOOM;

  useEffect(() => {
    onWatchEndRef.current = onWatchEnd;
  }, [onWatchEnd]);

  /** Hedefi, zoom'u ve (istenirse) yönü ayarlar; kamera hedefle birlikte kayar, eğim zoom'a uyar. */
  const setView = (x: number, z: number, zoom: number, yaw?: number, y?: number) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const dx = x - controls.target.x;
    const dz = z - controls.target.z;
    const dy = y === undefined ? 0 : y - controls.target.y;
    controls.target.x += dx;
    controls.target.y += dy;
    controls.target.z += dz;
    cam.position.x += dx;
    cam.position.y += dy;
    cam.position.z += dz;
    cam.zoom = clamp(zoom, minZoom, maxZoom);
    cam.updateProjectionMatrix();
    const tilt = tiltForZoom(worldZoomOf(cam.zoom, size));
    controls.minPolarAngle = tilt;
    controls.maxPolarAngle = tilt;
    controls.update();
    if (yaw !== undefined) controls.setAzimuthalAngle(yaw);
  };

  const startFlight = (target: Partial<Pose>, duration: number) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const from: Pose = { x: controls.target.x, z: controls.target.z, zoom: cam.zoom, yaw: controls.getAzimuthalAngle(), y: controls.target.y };
    const x = target.x ?? from.x;
    const z = target.z ?? from.z;
    const to: Pose = {
      x,
      z,
      y: target.y ?? (target.x !== undefined && groundAt ? groundAt({ x, y: z }) : from.y),
      zoom: clamp(target.zoom ?? from.zoom, minZoom, maxZoom),
      // En kısa yoldan dön
      yaw: target.yaw === undefined ? from.yaw : from.yaw + angleDelta(from.yaw, target.yaw),
    };
    if (reducedMotion) {
      flight.current = null;
      setView(to.x, to.z, to.zoom, to.yaw, to.y);
      return;
    }
    flight.current = { from, to, elapsed: 0, duration };
  };

  const stopWatching = (notify: boolean) => {
    const controls = controlsRef.current;
    if (!watching.current) return;
    watching.current = false;
    if (controls) controls.autoRotate = false;
    if (notify) onWatchEndRef.current?.();
  };

  // İlk yerleşim: bütün adalar, tepeden.
  useLayoutEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.target.set(CENTER.x, 0, CENTER.z);
    cam.position.set(CENTER.x, DISTANCE, CENTER.z + 0.01);
    cam.near = 10;
    cam.far = DISTANCE * 2.7;
    cam.zoom = overviewCameraZoom(size);
    cam.updateProjectionMatrix();
    controls.update();
    // Yalnızca ilk açılışta; sonraki boyut değişikliklerinde kullanıcının görünümü korunur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Klavye: ok tuşları kaydırır, Q ve E döndürür (tuvale odaklanınca; arama kutusunu etkilemez).
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const canvas = gl.domElement;
    canvas.tabIndex = 0;
    controls.listenToKeyEvents(canvas);
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLocaleLowerCase("tr");
      if (key !== "q" && key !== "e") return;
      event.preventDefault();
      stopWatching(true);
      startFlight({ yaw: controls.getAzimuthalAngle() + (key === "q" ? Math.PI / 4 : -Math.PI / 4) }, 0.4);
    };
    canvas.addEventListener("keydown", onKey);
    // Kullanıcı kamerayı tuttuğu an izleme modu biter.
    const onStart = () => stopWatching(true);
    controls.addEventListener("start", onStart);
    return () => {
      controls.stopListenToKeyEvents();
      canvas.removeEventListener("keydown", onKey);
      controls.removeEventListener("start", onStart);
    };
    // startFlight ve stopWatching her çizimde yeniden oluşur ama yalnızca ref'leri okur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    // Pusula: kuzey her zaman iğnenin gösterdiği yönde.
    const azimuth = controls.getAzimuthalAngle();
    if (compassRef?.current && Math.abs(azimuth - lastCompass.current) > 0.001) {
      compassRef.current.style.transform = `rotate(${azimuth.toFixed(3)}rad)`;
      lastCompass.current = azimuth;
    }

    const current = flight.current;
    if (current) {
      current.elapsed += delta;
      const p = Math.min(1, current.elapsed / current.duration);
      const e = easeInOutCubic(p);
      const zoom = Math.exp(Math.log(current.from.zoom) + (Math.log(current.to.zoom) - Math.log(current.from.zoom)) * e);
      setView(
        current.from.x + (current.to.x - current.from.x) * e,
        current.from.z + (current.to.z - current.from.z) * e,
        zoom,
        current.from.yaw + (current.to.yaw - current.from.yaw) * e,
        current.from.y + (current.to.y - current.from.y) * e,
      );
      if (p >= 1) {
        flight.current = null;
        if (watching.current) controls.autoRotate = true;
      }
      return;
    }

    // Kullanıcı tekerlekle yakınlaştıysa eğimi zoom'a uydur.
    const tilt = tiltForZoom(worldZoomOf(cam.zoom, size));
    if (Math.abs(controls.getPolarAngle() - tilt) > 0.002) {
      controls.minPolarAngle = tilt;
      controls.maxPolarAngle = tilt;
      controls.update();
    }

    // Adaların çok dışına kaydırmayı engelle.
    const x = clamp(controls.target.x, -60, WORLD_SIZE.width + 60);
    const z = clamp(controls.target.z, -60, WORLD_SIZE.height + 60);
    if (x !== controls.target.x || z !== controls.target.z) setView(x, z, cam.zoom);
  });

  useImperativeHandle(ref, () => ({
    zoomBy: (factor) => startFlight({ zoom: cam.zoom * factor }, 0.35),
    flyTo: (center, worldZoom) => startFlight({ x: center.x, z: center.y, zoom: cameraZoomFor(worldZoom, size) }, 0.9),
    flyToBounds: (bounds) => {
      // focusForBounds bütün dünyaya göre zoom verir (1 = bütün adalar); en fazla yakın bölge görünümü kadar.
      const focus = focusForBounds(bounds, size, MAX_FOCUS_ZOOM * 2);
      startFlight({ x: focus.center.x, z: focus.center.y, zoom: Math.min(overviewCameraZoom(size) * focus.zoom, cameraZoomFor(MAX_FOCUS_ZOOM, size)) }, 0.9);
    },
    reset: () => {
      stopWatching(false);
      startFlight({ x: CENTER.x, z: CENTER.z, zoom: overviewCameraZoom(size), yaw: 0, y: 0 }, 0.9);
    },
    rotateBy: (angle) => {
      const controls = controlsRef.current;
      if (!controls) return;
      stopWatching(true);
      startFlight({ yaw: controls.getAzimuthalAngle() + angle }, 0.4);
    },
    faceNorth: () => {
      stopWatching(true);
      startFlight({ yaw: 0 }, 0.5);
    },
    watch: (center, worldZoom, yaw, fitRadius) => {
      const controls = controlsRef.current;
      if (!controls) return;
      watching.current = !reducedMotion;
      controls.autoRotateSpeed = WATCH_SPEED;
      let zoom = cameraZoomFor(worldZoom, size);
      if (fitRadius) {
        // Üst bant ve alt şeritler için dikeyde 200 piksel pay. Kamera eğik baktığı için ekranın dikeyi zeminde yaklaşık
        // 1,5 kat daha uzun bir yolu gösterir. Savaş efektleri dursun diye dünya zoom'u 3'ün altına inmez.
        const narrow = Math.min(size.width, (size.height - 200) * 1.5);
        zoom = Math.min(zoom, Math.max(cameraZoomFor(3, size), narrow / (2 * fitRadius)));
      }
      startFlight({ x: center.x, z: center.y, zoom, yaw }, 1.4);
    },
    stopWatch: () => stopWatching(false),
  }));

  return (
    <MapControls
      ref={controlsRef}
      makeDefault
      enableRotate
      rotateSpeed={0.6}
      enableDamping
      dampingFactor={0.15}
      screenSpacePanning={false}
      zoomToCursor
      minZoom={minZoom}
      maxZoom={maxZoom}
      zoomSpeed={1.1}
    />
  );
}

/**
 * GÜN VE GECE — adaların ışıkları saate göre değişir (living/sky.ts).
 *
 *   · Güneş doğudan doğar, güneyden geçer, batıda batar; gece yerini mavi ay ışığına bırakır.
 *   · Akşam olunca obaların ortasında, şenlik ocağında ve Günözü Tapınağı'nda sıcak ışıklar yanar.
 *   · Açılmamış bölgelerin sisi de, deniz de saatin rengini alır.
 *
 * Paylaşılan "gökyüzü" nesnesi (SkyRuntime) her karede güncellenir; fenerler, deniz ve son işlem onu okur.
 *
 * Gölge haritası kameranın baktığı yeri izler: uzaktayken bütün dünyayı, yakındayken yalnızca görünen
 * alanı kaplar. Böylece büyük dünyada da yakın görünümde gölgeler keskin kalır. Merkez gölge pikseline
 * oturtulur ki kamera kayarken gölge kenarları titremesin.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Color, DirectionalLight, HemisphereLight, OrthographicCamera, PointLight, SRGBColorSpace, Vector3 } from "three";
import type { Terrain } from "../../game/terrain";
import { readWorldHour } from "../../state/useWorldTime";
import type { Coordinates } from "../../types";
import { MONUMENTS } from "../../content/sites";
import { LANDMARKS, VILLAGES } from "../layout";
import type { FogUniforms } from "../shaders/fog";
import { groundY, worldZoomOf } from "../worldScale";
import { skyAt, type Rgb, type SkyRuntime } from "./sky";

const LIGHT_DISTANCE = 900;
const SHADOW_MAP_SIZE = 4096;
/** Aynı anda yanan gerçek ışık sayısı (uzaktaki ocaklar yalnızca kendi alevleriyle parlar). */
const LAMP_POOL = 6;
/** Bu dünya zoom'undan yakında gölgeler her karede güncellenir. */
const SHADOW_EVERY_FRAME_ZOOM = 1;
/** Gölge alanının yarı genişliği sınırları (dünya birimi). */
const SHADOW_EXTENT = { min: 110, max: 1700 };

/** Gece yanan sıcak ışıklar: oba ocakları, şenlik ocağı, tapınak, fenerler, gözcü kuleleri. */
const LAMP_SPOTS: readonly { at: Coordinates; color: string; power: number }[] = [
  ...VILLAGES.map((v) => ({ at: v.center, color: "#ffb45c", power: 1 })),
  { at: LANDMARKS.tapinak, color: "#ffd77a", power: 0.8 },
  { at: LANDMARKS.fener, color: "#ffe2a0", power: 0.6 },
  { at: MONUMENTS.uckardesFeneri, color: "#ffe2a0", power: 0.6 },
  { at: MONUMENTS.firtinaFeneri, color: "#ffe2a0", power: 0.6 },
  { at: LANDMARKS.kutKapisi, color: "#9fe8ff", power: 1.3 },
  ...MONUMENTS.gozcuKuleleri.map((at) => ({ at, color: "#ffc070", power: 0.45 })),
];

const setColor = (target: Color, rgb: Rgb) => target.setRGB(rgb[0], rgb[1], rgb[2], SRGBColorSpace);

interface DayNightProps {
  terrain: Terrain;
  sky: SkyRuntime;
  fogUniforms: FogUniforms;
}

export function DayNight({ terrain, sky, fogUniforms }: DayNightProps) {
  const { sun, hemi, lamps, spots } = useMemo(() => {
    const light = new DirectionalLight("#fff0d8", 2.6);
    light.castShadow = true;
    light.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
    Object.assign(light.shadow.camera, { left: -660, right: 660, top: 660, bottom: -660, near: 1, far: 2400 });
    light.shadow.bias = -0.0006;
    light.shadow.normalBias = 0.6;

    const hemisphere = new HemisphereLight("#dbeeff", "#4a5a6a", 1.5);
    // Işık havuzu: sayısı hiç değişmez (gündüz gücü 0), böylece malzemeler yeniden derlenmez.
    // Her ışık, kameranın baktığı yere en yakın ocaklardan birine taşınır.
    const points = Array.from({ length: LAMP_POOL }, () => ({ lamp: new PointLight("#ffb45c", 0, 95, 1.2), power: 0 }));
    const spots = LAMP_SPOTS.map((spot) => ({ ...spot, y: groundY(terrain, spot.at) + 7 }));
    return { sun: light, hemi: hemisphere, lamps: points, spots };
  }, [terrain]);

  const { camera, gl, size } = useThree();
  // Gölge haritası elle güncellenir: yakında her karede, uzakta (gölgeler zaten seçilemez) birkaç karede bir.
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);
  const work = useMemo(() => ({ dir: new Vector3(), look: new Vector3(), right: new Vector3(), up: new Vector3(), extent: 0, lampX: Infinity, lampZ: Infinity, frame: 0 }), []);

  useFrame(() => {
    const hour = readWorldHour();
    const state = skyAt(hour);
    const [dx, dy, dz] = state.lightDirection;

    // Kameranın baktığı yer (bakış ışınının zeminle kesiştiği nokta) ve görünen alanın yarıçapı.
    const cam = camera as OrthographicCamera;
    cam.getWorldDirection(work.look);
    const down = Math.max(0.25, -work.look.y);
    const t = (cam.position.y - 10) / down;
    const cx = cam.position.x + work.look.x * t;
    const cz = cam.position.z + work.look.z * t;
    const halfW = (cam.right - cam.left) / (2 * cam.zoom);
    const halfH = (cam.top - cam.bottom) / (2 * cam.zoom) / down;
    const wanted = Math.min(SHADOW_EXTENT.max, Math.max(SHADOW_EXTENT.min, Math.hypot(halfW, halfH) * 1.1 + 30));
    // Alan %12'den fazla değişince yenilenir (her karede izdüşüm matrisi kurulmasın).
    if (Math.abs(wanted - work.extent) > work.extent * 0.12 || wanted === SHADOW_EXTENT.max) {
      if (wanted !== work.extent) {
        work.extent = wanted;
        Object.assign(sun.shadow.camera, { left: -wanted, right: wanted, top: wanted, bottom: -wanted });
        sun.shadow.camera.updateProjectionMatrix();
      }
    }
    // Merkezi ışığın bakış düzleminde gölge pikseline oturt.
    work.dir.set(dx, dy, dz).normalize();
    work.right.set(0, 1, 0).cross(work.dir);
    if (work.right.lengthSq() < 1e-6) work.right.set(1, 0, 0);
    work.right.normalize();
    work.up.copy(work.dir).cross(work.right);
    const texel = (2 * work.extent) / SHADOW_MAP_SIZE;
    const center = work.look.set(cx, 0, cz);
    const r = Math.round(center.dot(work.right) / texel) * texel;
    const u = Math.round(center.dot(work.up) / texel) * texel;
    const f = center.dot(work.dir);
    center.copy(work.right).multiplyScalar(r).addScaledVector(work.up, u).addScaledVector(work.dir, f);
    sun.target.position.copy(center);
    sun.position.copy(center).addScaledVector(work.dir, LIGHT_DISTANCE);
    work.frame++;
    if (worldZoomOf(cam.zoom, size) >= SHADOW_EVERY_FRAME_ZOOM || work.frame % 8 === 0) gl.shadowMap.needsUpdate = true;
    setColor(sun.color, state.lightColor);
    sun.intensity = state.lightIntensity;
    setColor(hemi.color, state.skyColor);
    setColor(hemi.groundColor, state.groundColor);
    hemi.intensity = state.hemiIntensity;
    // Ocak ışıkları: bakılan yer 20 birimden fazla kayınca en yakın ocaklar yeniden seçilir.
    if (Math.hypot(cx - work.lampX, cz - work.lampZ) > 20) {
      work.lampX = cx;
      work.lampZ = cz;
      const nearest = [...spots].sort((a, b) => Math.hypot(a.at.x - cx, a.at.y - cz) - Math.hypot(b.at.x - cx, b.at.y - cz));
      lamps.forEach((slot, k) => {
        const spot = nearest[k];
        if (!spot) return;
        slot.lamp.position.set(spot.at.x, spot.y, spot.at.y);
        slot.lamp.color.set(spot.color);
        slot.power = spot.power;
      });
    }
    for (const { lamp, power } of lamps) lamp.intensity = state.lamp * 55 * power;
    setColor(fogUniforms.uMist.value, state.mist);

    sky.hour = hour;
    sky.lamp = state.lamp;
    sky.saturation = state.saturation;
    sky.sea = state.sea;
  });

  return (
    <>
      <primitive object={hemi} />
      <primitive object={sun} />
      <primitive object={sun.target} />
      {lamps.map(({ lamp }, i) => (
        <primitive key={i} object={lamp} />
      ))}
    </>
  );
}

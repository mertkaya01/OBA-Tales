/**
 * Piksel diorama çizim hattı.
 *
 *   1. Sahne, ekranın `pixelSize` kat küçüğü bir dokuya (renk + derinlik) çizilir.
 *   2. Tam ekran bir dörtgen, bu dokuyu shaders/pixelPost.ts ile ekrana büyütür:
 *      keskin pikseller, mürekkep kontur, düzenli titremeyle renk basamakları ve kar.
 *
 * useFrame önceliği 1 olduğu için React Three Fiber kendi çizimini yapmaz; çizimi bu bileşen üstlenir.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  Color,
  DepthTexture,
  LinearSRGBColorSpace,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from "three";
import type { SkyRuntime } from "./living/sky";
import { PIXEL_POST_FRAGMENT, PIXEL_POST_VERTEX } from "./shaders/pixelPost";
import { worldZoomOf } from "./worldScale";

export interface SnowSettings {
  /** 0 = kar yok, 1 = tipi. */
  amount: number;
  /** Yatay sürüklenme (düşüş hızına oran). */
  wind: number;
}

interface PixelPipelineProps {
  /** Bir piksel kaç ekran pikseline büyütülsün? */
  pixelSize?: number;
  /** Kanal başına renk basamağı (azaldıkça daha "retro"). */
  levels?: number;
  sky: SkyRuntime;
  snow: SnowSettings;
  /** Karın zamanı (saniye); hareket azaltılınca durur. */
  clock: { value: number };
}

/** Son işlem gama uzayında çalışır: renkler dönüştürülmeden, olduğu gibi yazılır. */
const gammaColor = (hex: number) => new Color().setRGB(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255, LinearSRGBColorSpace);
const SNOW_DAY = gammaColor(0xf4f8ff);
const SNOW_NIGHT = gammaColor(0xa9b8dc);

// levels 16: yumuşak renk geçişleri, hafif titreme (12 daha "retro", 24 neredeyse düz). docs/gorsel-rehber.md
export function PixelPipeline({ pixelSize = 2, levels = 16, sky, snow, clock }: PixelPipelineProps) {
  const { gl, scene, camera, size } = useThree();

  const target = useMemo(() => {
    const rt = new WebGLRenderTarget(1, 1, { minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: true });
    rt.depthTexture = new DepthTexture(1, 1);
    return rt;
  }, []);

  const post = useMemo(() => {
    const material = new ShaderMaterial({
      vertexShader: PIXEL_POST_VERTEX,
      fragmentShader: PIXEL_POST_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        tColor: { value: target.texture },
        tDepth: { value: target.depthTexture },
        uLowRes: { value: new Vector2(1, 1) },
        uNear: { value: 1 },
        uFar: { value: 5000 },
        uLevels: { value: levels },
        uInkThreshold: { value: 1.2 },
        uInkStrength: { value: 0.85 },
        uInk: { value: new Color("#1b1424") },
        uSaturation: { value: 1.12 },
        uTime: { value: 0 },
        uSnow: { value: 0 },
        uWind: { value: 0 },
        uSnowShift: { value: new Vector2() },
        uSnowColor: { value: SNOW_DAY.clone() },
      },
    });
    const quad = new Mesh(new PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    const postScene = new Scene();
    postScene.add(quad);
    return { material, quad, scene: postScene, camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1) };
  }, [target, levels]);

  useEffect(() => {
    const width = Math.max(1, Math.ceil(size.width / pixelSize));
    const height = Math.max(1, Math.ceil(size.height / pixelSize));
    target.setSize(width, height);
    post.material.uniforms.uLowRes.value.set(width, height);
  }, [size, pixelSize, target, post]);

  useEffect(
    () => () => {
      target.dispose();
      post.material.dispose();
      post.quad.geometry.dispose();
    },
    [target, post],
  );

  const origin = useMemo(() => new Vector3(), []);

  useFrame(() => {
    const cam = camera as OrthographicCamera;
    const uniforms = post.material.uniforms;
    uniforms.uNear.value = cam.near;
    uniforms.uFar.value = cam.far;
    // Uzaktayken bir piksel birçok dünya birimini kapsar: kontur eşiği ona göre büyür ve kontur hafifler,
    // yoksa küçük ağaçlar kara noktalara dönüşür. Yaklaştıkça kontur belirginleşir.
    const worldZoom = worldZoomOf(cam.zoom, size);
    const near = Math.min(1, Math.max(0, (worldZoom - 1.2) / 3));
    uniforms.uInkThreshold.value = Math.max(0.9, (pixelSize / cam.zoom) * 0.8);
    uniforms.uInkStrength.value = 0.3 + 0.55 * near * near * (3 - 2 * near);
    uniforms.uSaturation.value = sky.saturation;

    // Kar: dünyanın başlangıç noktasının ekrandaki yeri, karın dünyayla birlikte kaymasını sağlar.
    uniforms.uSnow.value = snow.amount;
    uniforms.uWind.value = snow.wind;
    uniforms.uTime.value = clock.value;
    if (snow.amount > 0) {
      const low = uniforms.uLowRes.value as Vector2;
      origin.set(0, 0, 0).project(cam);
      (uniforms.uSnowShift.value as Vector2).set((origin.x * 0.5 + 0.5) * low.x, (origin.y * 0.5 + 0.5) * low.y);
      (uniforms.uSnowColor.value as Color).lerpColors(SNOW_NIGHT, SNOW_DAY, 1 - sky.lamp);
    }

    gl.setRenderTarget(target);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    gl.render(post.scene, post.camera);
  }, 1);

  return null;
}

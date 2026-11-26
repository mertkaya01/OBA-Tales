/**
 * 3D PORTRE — karakterin oyundaki 3D parçalarından küçük bir portre çizer (kart, kadro, çekmece).
 *
 *   · Ekran dışındaki tek bir WebGL tuvali kullanılır; her portre bir kez çizilir, çağıran saklar.
 *   · Önden-çapraz, hafif yukarıdan bakan dik (ortografik) kamera; tüm beden kareye sığar.
 *   · Kenar yumuşatması yok, çevresine 1 piksellik koyu çizgi çekilir: küçük boyda da okunur, oyundaki piksel
 *     görünüme uyar.
 *   · WebGL yoksa null döner; çağıran eski piksel portreyi gösterir.
 */
import {
  AmbientLight,
  Box3,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Material,
} from "three";
import { resolveLook } from "../../game/sprites/composeSprite";
import type { Character } from "../../types";
import { PARTS } from "./characterKit";

export interface PortraitImage {
  width: number;
  height: number;
  /** RGBA, üst satır önce. */
  data: Uint8ClampedArray<ArrayBuffer>;
}

/** Dış çizgi rengi (piksel portrelerin "o" rengiyle aynı ton). */
const OUTLINE = [20, 18, 28] as const;
/** Kamera açısı: hafif sağdan (yaw) ve yukarıdan (pitch). */
const YAW = 0.42;
const PITCH = 0.16;

let renderer: WebGLRenderer | null | undefined;

function getRenderer(): WebGLRenderer | null {
  if (renderer !== undefined) return renderer;
  try {
    const canvas = document.createElement("canvas");
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
  } catch {
    renderer = null;
  }
  return renderer;
}

const scene = new Scene();
scene.add(new AmbientLight("#ffffff", 1.25));
const sun = new DirectionalLight("#fff4e0", 1.9);
sun.position.set(-3, 6, 8);
scene.add(sun);
const rim = new DirectionalLight("#9fc6ff", 0.7);
rim.position.set(5, 3, -6);
scene.add(rim);
const camera = new OrthographicCamera();
const bounds = new Box3();
const size = new Vector3();
const center = new Vector3();

/** Saydam piksellerin dolu komşusu varsa koyu çizgi rengine boyar. */
function outline(data: Uint8ClampedArray, width: number, height: number): void {
  const solid = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) solid[i] = data[i * 4 + 3] > 40 ? 1 : 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (solid[i]) continue;
      const near =
        (x > 0 && solid[i - 1]) || (x < width - 1 && solid[i + 1]) || (y > 0 && solid[i - width]) || (y < height - 1 && solid[i + width]);
      if (!near) continue;
      data.set([OUTLINE[0], OUTLINE[1], OUTLINE[2], 255], i * 4);
    }
}

/** Karakterin 3D portresini çizer; WebGL yoksa null. */
export function renderPortrait(character: Character, width: number, height: number): PortraitImage | null {
  const r = getRenderer();
  if (!r) return null;
  const look = resolveLook(character);
  const group = new Group();
  const materials: Material[] = [];
  for (const part of PARTS) {
    if (part.far || !part.applies(character, look, { inRaid: false })) continue;
    const color = part.color(look, character);
    const material = part.glow ? new MeshBasicMaterial({ color }) : new MeshLambertMaterial({ color, flatShading: true });
    materials.push(material);
    group.add(new Mesh(part.geometry, material));
  }
  if (!group.children.length) return null;
  scene.add(group);

  // Çerçeve bedenin boyuna göre: karakter hep ortada ve büyük durur; yana uzanan yay ya da kılıç gerekirse taşar.
  bounds.setFromObject(group);
  bounds.getSize(size);
  bounds.getCenter(center);
  center.x = 0;
  center.z = 0;
  const aspect = width / height;
  const view = size.y * 1.05;
  camera.left = (-view * aspect) / 2;
  camera.right = (view * aspect) / 2;
  camera.top = view / 2;
  camera.bottom = -view / 2;
  camera.near = 0.1;
  camera.far = 200;
  camera.position.set(center.x + Math.sin(YAW) * Math.cos(PITCH) * 40, center.y + Math.sin(PITCH) * 40, center.z + Math.cos(YAW) * Math.cos(PITCH) * 40);
  camera.lookAt(center);
  camera.updateProjectionMatrix();

  r.setSize(width, height, false);
  r.render(scene, camera);
  const pixels = new Uint8Array(width * height * 4);
  const gl = r.getContext();
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  scene.remove(group);
  for (const m of materials) m.dispose();

  // WebGL alttan başlar: satırları ters çevir.
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) data.set(pixels.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4);
  outline(data, width, height);
  return { width, height, data };
}

/** Portreyi PNG adresine çevirir. */
export function renderPortraitUrl(character: Character, width: number, height: number): string | null {
  const image = renderPortrait(character, width, height);
  if (!image) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.putImageData(new ImageData(image.data, width, height), 0, 0);
  return canvas.toDataURL("image/png");
}

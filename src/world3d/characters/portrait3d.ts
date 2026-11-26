/**
 * 3D PORTRE — karakterin oyundaki 3D parçalarından tam boy portre çizer (kart, kadro, çekmece).
 *
 *   · Ekran dışındaki tek bir WebGL tuvali kullanılır; her portre bir kez çizilir, çağıran saklar.
 *   · Önden-çapraz, hafif yukarıdan bakan dik (ortografik) kamera. Kadraj karakterin bütün parçalarına göre
 *     kurulur: şapka, hale, yay ve kılıç dahil karakterin tamamı görünür.
 *   · Piksel değil: ekran çözünürlüğünde (devicePixelRatio) ve onun iki katında çizilip yumuşakça küçültülür;
 *     kenarlar pürüzsüz, ince koyu dış çizgi ve ayak altında yumuşak bir gölge vardır.
 *   · Işık: gökyüzü/toprak yarım küre ışığı, sıcak ana ışık ve karakteri arka plandan ayıran soğuk kenar ışığı.
 *   · WebGL yoksa null döner; çağıran eski piksel portreyi gösterir.
 */
import {
  DirectionalLight,
  Group,
  HemisphereLight,
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

export interface PortraitOptions {
  /** Çıktı pikseli / istenen boy birimi (ör. window.devicePixelRatio). 1–8 arası; varsayılan 1. */
  density?: number;
}

/** İç çizim, çıktının bu kadar katı büyüklükte yapılıp küçültülür (kenar yumuşatma). */
const SUPERSAMPLE = 2;
/** Dış çizgi rengi ve kalınlığı (CSS pikseli). */
const OUTLINE = [22, 19, 30] as const;
const OUTLINE_WIDTH = 1.1;
/** Kamera açısı: hafif sağdan (yaw) ve yukarıdan (pitch). */
const YAW = 0.38;
const PITCH = 0.14;
/** Kadrajda karakterin çevresinde bırakılan pay (oran) ve ayak gölgesine ayrılan yer (dünya birimi). */
const MARGIN = 0.05;
const SHADOW_ROOM = 0.18;

let renderer: WebGLRenderer | null | undefined;

function getRenderer(): WebGLRenderer | null {
  if (renderer !== undefined) return renderer;
  try {
    const canvas = document.createElement("canvas");
    // Kenar yumuşatmayı büyük çizip küçülterek kendimiz yapıyoruz; MSAA kapalı kalınca dış çizgi için alfa net olur.
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
scene.add(new HemisphereLight("#eef4ff", "#6b5846", 1.15));
const key = new DirectionalLight("#fff1dc", 2.1);
key.position.set(-3, 6, 8);
const fill = new DirectionalLight("#dfe8ff", 0.45);
fill.position.set(6, 1, 5);
const rim = new DirectionalLight("#a9cfff", 1.35);
rim.position.set(4, 4, -7);
scene.add(key, fill, rim);
const camera = new OrthographicCamera();
const direction = new Vector3(Math.sin(YAW) * Math.cos(PITCH), Math.sin(PITCH), Math.cos(YAW) * Math.cos(PITCH));
const point = new Vector3();

let sampleCanvas: HTMLCanvasElement | null = null;
let outputCanvas: HTMLCanvasElement | null = null;

function canvas2d(existing: HTMLCanvasElement | null, width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = existing ?? document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext("2d", { willReadFrequently: true })!];
}

/**
 * Saydam pikselleri, `radius` uzaklıkta dolu piksel varsa dış çizgi rengine boyar (yuvarlak fırça). İki geçiş:
 * önce her satırda en yakın dolu pikselin yatay uzaklığı, sonra dikeyde (dx² + dy² ≤ r²) denetimi.
 */
function outline(data: Uint8ClampedArray, width: number, height: number, radius: number): void {
  const far = radius + 1;
  const across = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let last = -far;
    for (let x = 0; x < width; x++) {
      if (data[(row + x) * 4 + 3] > 0) last = x;
      across[row + x] = Math.min(far, x - last);
    }
    last = width + far;
    for (let x = width - 1; x >= 0; x--) {
      if (data[(row + x) * 4 + 3] > 0) last = x;
      across[row + x] = Math.min(across[row + x], far, last - x);
    }
  }
  const reach = radius * radius + radius * 0.5;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (across[i] === 0) continue; // dolu piksel
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        const dx = across[ny * width + x];
        if (dx > radius || dx * dx + dy * dy > reach) continue;
        data[i * 4] = OUTLINE[0];
        data[i * 4 + 1] = OUTLINE[1];
        data[i * 4 + 2] = OUTLINE[2];
        data[i * 4 + 3] = 255;
        break;
      }
    }
}

/** Karakterin parçalarından sahne grubu. */
function buildCharacter(character: Character): { group: Group; materials: Material[] } {
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
  return { group, materials };
}

/** Kamerayı karakterin bütün köşelerini görecek şekilde kurar; ayak noktasının çıktıdaki yerini ve ölçeği döner. */
function frame(group: Group, aspect: number): { feet: Vector3; unitsHigh: number } {
  camera.position.copy(direction).multiplyScalar(60);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const child of group.children) {
    const position = (child as Mesh).geometry.getAttribute("position");
    for (let v = 0; v < position.count; v++) {
      point.fromBufferAttribute(position, v).applyMatrix4(camera.matrixWorldInverse);
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
  }
  minY -= SHADOW_ROOM;
  const contentW = (maxX - minX) * (1 + 2 * MARGIN);
  const contentH = (maxY - minY) * (1 + 2 * MARGIN);
  const viewH = Math.max(contentH, contentW / aspect);
  const viewW = viewH * aspect;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  camera.left = cx - viewW / 2;
  camera.right = cx + viewW / 2;
  camera.top = cy + viewH / 2;
  camera.bottom = cy - viewH / 2;
  camera.near = 1;
  camera.far = 200;
  camera.updateProjectionMatrix();
  return { feet: new Vector3(0, 0, 0).project(camera), unitsHigh: viewH };
}

/** Portreyi çıktı tuvaline çizer; WebGL yoksa null. */
function draw(character: Character, width: number, height: number, options: PortraitOptions): HTMLCanvasElement | null {
  const r = getRenderer();
  if (!r) return null;
  const density = Math.min(8, Math.max(1, options.density ?? 1));
  const outW = Math.max(1, Math.round(width * density));
  const outH = Math.max(1, Math.round(height * density));
  const bigW = outW * SUPERSAMPLE;
  const bigH = outH * SUPERSAMPLE;

  const { group, materials } = buildCharacter(character);
  if (!group.children.length) return null;
  scene.add(group);
  const { feet, unitsHigh } = frame(group, width / height);
  r.setSize(bigW, bigH, false);
  r.render(scene, camera);
  const pixels = new Uint8Array(bigW * bigH * 4);
  const gl = r.getContext();
  gl.readPixels(0, 0, bigW, bigH, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  scene.remove(group);
  for (const m of materials) m.dispose();

  // WebGL alttan başlar: satırları ters çevir; sonra dış çizgi.
  const [big, bigCtx] = canvas2d(sampleCanvas, bigW, bigH);
  sampleCanvas = big;
  const image = bigCtx.createImageData(bigW, bigH);
  for (let y = 0; y < bigH; y++) image.data.set(pixels.subarray((bigH - 1 - y) * bigW * 4, (bigH - y) * bigW * 4), y * bigW * 4);
  outline(image.data, bigW, bigH, Math.max(2, Math.round(OUTLINE_WIDTH * density * SUPERSAMPLE)));
  bigCtx.putImageData(image, 0, 0);

  // Çıktı: önce ayak altı gölgesi, sonra yumuşakça küçültülmüş karakter.
  const [out, ctx] = canvas2d(outputCanvas, outW, outH);
  outputCanvas = out;
  ctx.clearRect(0, 0, outW, outH);
  const px = outH / unitsHigh;
  const fx = ((feet.x + 1) / 2) * outW;
  const fy = ((1 - feet.y) / 2) * outH;
  const rx = 0.85 * px;
  const shadow = ctx.createRadialGradient(fx, fy, 0, fx, fy, rx);
  shadow.addColorStop(0, "rgba(10, 8, 16, 0.42)");
  shadow.addColorStop(1, "rgba(10, 8, 16, 0)");
  ctx.save();
  ctx.translate(fx, fy);
  ctx.scale(1, 0.3);
  ctx.translate(-fx, -fy);
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.arc(fx, fy, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(big, 0, 0, outW, outH);
  return out;
}

/** Karakterin 3D portresini RGBA olarak çizer (boy: width × density); WebGL yoksa null. */
export function renderPortrait(character: Character, width: number, height: number, options: PortraitOptions = {}): PortraitImage | null {
  const canvas = draw(character, width, height, options);
  if (!canvas) return null;
  const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
  return { width: canvas.width, height: canvas.height, data };
}

/** Portreyi PNG adresine çevirir (boy: width × density; sayfada width × height CSS pikselinde gösterilir). */
export function renderPortraitUrl(character: Character, width: number, height: number, options: PortraitOptions = {}): string | null {
  return draw(character, width, height, options)?.toDataURL("image/png") ?? null;
}

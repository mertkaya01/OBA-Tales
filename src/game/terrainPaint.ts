/**
 * ARAZİ BOYAYICI — yükseklik haritasını kuşbakışı piksel haritaya ve karartı maskesine çevirir.
 *
 *   paintTerrain → deniz: kıyıyı saran basamaklı sığlık şeritleri, lekeli açık deniz, kıyı köpüğü
 *                  kara: arazi türüne ve yüksekliğe göre renk rampası, kuzeybatı ışıklı kabartma gölgesi,
 *                        koyu kıyı çizgisi, nehirler, göller (soğukta donmuş), tapınak avlusu
 *                  iki üslup: "harita" (Leaflet; dik yamaçlarda ince tarama çizgileri, güçlü gölge) ve
 *                  "dunya" (3D adanın dokusu; ışığı sahne verdiği için hafif gölge, tarama yok)
 *   paintVeil    → hikâyede henüz açılmamış karanın üstüne koyu örtü (karartı); kıyıda yumuşak
 *
 * Çıktılar ham RGBA dizisidir: Leaflet bir canvas'a, Three.js bir dokuya çevirir.
 */
import { createNoise2D } from "simplex-noise";
import { REGIONS } from "../content/regions";
import { clamp, distance } from "../lib/geometry";
import { createRng, seedFrom } from "../lib/random";
import { TERRAIN_KINDS, WORLD_SIZE } from "../types";
import type { Coordinates, TerrainKind } from "../types";
import { TERRAIN_COLORS, hexToRgba, type Rgba } from "./palette";
import { TRAIL_WIDTH } from "./paths";
import { COLD_KINDS, smoothstep, type Terrain } from "./terrain";
import { hiddenMask, type LandVisibility } from "./visibility";

export interface PaintedImage {
  width: number;
  height: number;
  /** RGBA, satır satır, üst satır önce. */
  data: Uint8ClampedArray<ArrayBuffer>;
}

export type PaintStyle = "harita" | "dunya";

export interface PaintOptions {
  style?: PaintStyle;
  /** Bir pikselin kapladığı dünya birimi. */
  texel?: number;
  /** Toprak patikalar (game/paths.ts). */
  trails?: readonly (readonly Coordinates[])[];
}

/** Boyalı haritanın piksel boyu (dünya birimi): arazi hücresinin yarısı, nehirler ve kıyı keskin çıkar. */
export const PAINT_TEXEL = 2;

const C = Object.fromEntries(Object.entries(TERRAIN_COLORS).map(([key, hex]) => [key, hexToRgba(hex)])) as Record<
  keyof typeof TERRAIN_COLORS,
  Rgba
>;

/** 4×4 Bayer matrisi: düzenli titreme için [-0.5, 0.5) eşikleri. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.5);

type Rgb = [number, number, number];

function mix(a: Rgba | Rgb, b: Rgba | Rgb, t: number): Rgb {
  const f = clamp(t, 0, 1);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

const rgbOf = (c: Rgba): Rgb => [c[0], c[1], c[2]];

const ramp = (h: number, from: number, to: number) => (h - from) / (to - from);

/** Ilıman rampa: yeşil ova → bej yayla → kaya → kar. */
function temperate(h: number, low: Rgba | Rgb): Rgb {
  if (h < 0.25) return mix(low, C.grassHigh, ramp(h, 0.05, 0.25));
  if (h < 0.48) return mix(C.grassHigh, C.highland, ramp(h, 0.25, 0.45));
  if (h < 0.72) return mix(C.highland, C.rock, ramp(h, 0.5, 0.7));
  return mix(C.rock, C.snow, ramp(h, 0.74, 0.88));
}

/** Arazi türüne ve yüksekliğe göre kara rengi. */
export function landColor(kind: TerrainKind, h: number): Rgb {
  if (h < 0.045) return mix(C.sand, C.grassLow, ramp(h, 0.025, 0.045));
  switch (kind) {
    case "liman":
    case "koy":
      return temperate(h, C.grassLow);
    case "orman":
      return temperate(h, mix(C.forest, C.grassLow, ramp(h, 0.05, 0.2)));
    case "gecit":
      // Alçak geçit yolu yeşil, kenardaki buz duvarları buz mavisi.
      return h > 0.42 ? mix(C.frost, C.ice, ramp(h, 0.42, 0.62)) : mix(C.grassHigh, C.frost, ramp(h, 0.24, 0.42));
    case "yayla":
      // Kırağıdüzü: kırağıyla yer yer beyazlamış çimenler.
      return mix(temperate(h * 0.8, C.grassLow), C.frost, 0.2 + 0.4 * smoothstep(0.26, 0.44, h));
    case "yuksek_ada":
      // Yalı yamaçları kaya, üstteki düzlük yosunlu çayır, en yüksekler buzlu.
      if (h < 0.3) return mix(C.grassLow, C.rock, ramp(h, 0.08, 0.3));
      return h < 0.62 ? mix(mix(C.grassLow, C.highland, 0.35), C.rock, ramp(h, 0.45, 0.62) * 0.6) : mix(C.rock, C.ice, ramp(h, 0.66, 0.85));
    case "tepe":
      if (h < 0.5) return temperate(h, C.grassLow);
      return h > 0.8 ? mix(C.frost, C.snow, ramp(h, 0.8, 0.9)) : mix(C.highland, C.frost, ramp(h, 0.5, 0.78));
    case "buzul":
      return h < 0.4 ? mix(C.rock, C.ice, ramp(h, 0.12, 0.4)) : mix(C.ice, C.snow, ramp(h, 0.45, 0.68));
    case "cayir":
      // Kutada: canlı yeşil çayır, tepelerde altın sarısı otlar.
      return mix(mix(C.grassLow, C.forest, 0.15), C.highland, smoothstep(0.12, 0.3, h) * 0.55);
    case "kayalik":
      return h < 0.3 ? mix(C.grassLow, C.rock, ramp(h, 0.06, 0.26)) : mix(C.rock, C.frost, ramp(h, 0.42, 0.6));
  }
}

/** Su derinliğine göre basamak: 0–2 sığlık şeritleri, 3 açık deniz. */
function waterBand(depth: number): number {
  if (depth < 0.042) return 0;
  if (depth < 0.068) return 1;
  if (depth < 0.095) return 2;
  return 3;
}

export function paintTerrain(terrain: Terrain, { style = "dunya", texel = PAINT_TEXEL, trails = [] }: PaintOptions = {}): PaintedImage {
  const width = Math.round(WORLD_SIZE.width / texel);
  const height = Math.round(WORLD_SIZE.height / texel);
  const total = width * height;
  const { cols, rows, cellSize, heights, kinds, lakeIds, lakes } = terrain;
  const map = style === "harita";
  const noise = createNoise2D(createRng(seedFrom("boya", terrain.seed)).next);

  // 1. Piksel başına yükseklik (bilinear), arazi türü ve göl
  const H = new Float32Array(total);
  const K = new Int8Array(total);
  const L = new Int16Array(total).fill(-1);
  for (let ty = 0; ty < height; ty++) {
    const fy = clamp(((ty + 0.5) * texel) / cellSize - 0.5, 0, rows - 1);
    const y0 = Math.floor(fy);
    const y1 = Math.min(rows - 1, y0 + 1);
    const wy = fy - y0;
    for (let tx = 0; tx < width; tx++) {
      const fx = clamp(((tx + 0.5) * texel) / cellSize - 0.5, 0, cols - 1);
      const x0 = Math.floor(fx);
      const x1 = Math.min(cols - 1, x0 + 1);
      const wx = fx - x0;
      const a = y0 * cols + x0;
      const b = y0 * cols + x1;
      const c = y1 * cols + x0;
      const d = y1 * cols + x1;
      const h = (heights[a] * (1 - wx) + heights[b] * wx) * (1 - wy) + (heights[c] * (1 - wx) + heights[d] * wx) * wy;
      const i = ty * width + tx;
      H[i] = h;
      // Tür: en yakın hücre; o hücre suysa çevredeki en yüksek kara hücresi.
      const nearest = (wy < 0.5 ? (wx < 0.5 ? a : b) : wx < 0.5 ? c : d);
      let kind = kinds[nearest];
      if (kind < 0) {
        let best = -1;
        for (const k of [a, b, c, d]) if (kinds[k] >= 0 && (best < 0 || heights[k] > heights[best])) best = k;
        kind = best >= 0 ? kinds[best] : 0;
      }
      K[i] = kind;
      // Göl: köşelerden biri göl hücresiyse ve yükseklik su seviyesinin altındaysa. Kıyısı yumuşak çıkar.
      for (const k of [a, b, c, d]) {
        const lake = lakeIds[k];
        if (lake >= 0) {
          if (h < lakes[lake].level) L[i] = lake;
          break;
        }
      }
    }
  }

  // 2. Nehirler ve patikalar: çizgiler piksellere damgalanır (nehir genişliği akışla büyür).
  const R = new Uint8Array(total);
  const T = new Uint8Array(total);
  const stamp = (target: Uint8Array, points: readonly Coordinates[], widthAt: (k: number) => number, value: (along: number) => number) => {
    let along = 0;
    for (let k = 0; k < points.length - 1; k++) {
      const p = points[k];
      const q = points[k + 1];
      const segment = distance(p, q);
      const steps = Math.max(1, Math.ceil(segment / (texel * 0.5)));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = (p.x + (q.x - p.x) * t) / texel;
        const y = (p.y + (q.y - p.y) * t) / texel;
        const r = ((widthAt(k) + (widthAt(k + 1) - widthAt(k)) * t) * 0.5) / texel;
        const v = value(along + segment * t);
        const r2 = Math.max(0.25, r * r);
        const reach = Math.ceil(r);
        for (let dy = -reach; dy <= reach; dy++) {
          for (let dx = -reach; dx <= reach; dx++) {
            const px = Math.floor(x + dx);
            const py = Math.floor(y + dy);
            if (px < 0 || py < 0 || px >= width || py >= height) continue;
            const ox = px + 0.5 - x;
            const oy = py + 0.5 - y;
            if (ox * ox + oy * oy <= r2 + 0.25) target[py * width + px] = Math.max(target[py * width + px], v);
          }
        }
      }
      along += segment;
    }
  };
  for (const path of terrain.rivers) stamp(R, path.points, (k) => path.widths[k], () => 1);
  // Patika: dünya üslubunda düz toprak yol, harita üslubunda kesik çizgi.
  for (const trail of trails) stamp(T, trail, () => TRAIL_WIDTH, (along) => (map ? (along % 10 < 6 ? 2 : 0) : 1));

  // 3. Renk
  const data = new Uint8ClampedArray(total * 4);
  const temple = REGIONS.gunozu_tepesi.center;
  const relief = HEIGHT_RELIEF;
  const shadeStrength = map ? 1.1 : 0.4;
  const light = { x: -0.62, y: -0.62, z: 0.48 };
  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      const i = ty * width + tx;
      const h = H[i];
      const dither = BAYER[(ty % 4) * 4 + (tx % 4)];
      const x = (tx + 0.5) * texel;
      const y = (ty + 0.5) * texel;
      const left = tx > 0 ? i - 1 : i;
      const right = tx < width - 1 ? i + 1 : i;
      const up = ty > 0 ? i - width : i;
      const down = ty < height - 1 ? i + width : i;
      let rgb: Rgb;

      if (L[i] >= 0) {
        // Göl: donmuşsa çatlaklı buz, değilse koyu mavi; kıyısında ince açık çizgi.
        const frozen = lakes[L[i]].frozen;
        if (frozen) {
          rgb = mix(C.lakeIce, C.ice, 0.35 + 0.3 * noise(x * 0.02, y * 0.02));
          if (Math.abs(noise(x * 0.045 + 9, y * 0.045)) < 0.05) rgb = mix(rgb, C.snow, 0.8);
        } else {
          rgb = mix(C.lake, C.openSea, 0.25 + 0.2 * noise(x * 0.02, y * 0.02));
        }
        const shoreline = L[left] !== L[i] || L[right] !== L[i] || L[up] !== L[i] || L[down] !== L[i];
        if (shoreline) rgb = frozen ? mix(rgb, C.snow, 0.5) : mix(rgb, C.foam, 0.4);
        rgb = rgb.map((v) => v + dither * 8) as Rgb;
      } else if (h < 0) {
        const depth = -h;
        const band = waterBand(depth);
        if (band === 0) rgb = rgbOf(C.shoal);
        else if (band === 1) rgb = rgbOf(C.shelf);
        else if (band === 2) rgb = rgbOf(C.shelfDeep);
        else {
          // Açık deniz: derinleştikçe koyulaşır; büyük, yumuşak koyu lekeler (referanstaki gibi).
          const patches = noise(x * 0.0032, y * 0.0032) * 0.6 + noise(x * 0.009, y * 0.009) * 0.4;
          rgb = mix(C.openSea, C.deepSea, smoothstep(0.1, 0.55, depth) + patches * 0.22);
        }
        // Basamak kenarı: ince koyu çizgi.
        const edge = (j: number) => H[j] < 0 && L[j] < 0 && waterBand(-H[j]) !== band;
        if (band < 3 && (edge(right) || edge(down))) rgb = rgb.map((v) => v * 0.88) as Rgb;
        // Karaya değen su: köpük.
        if (H[left] >= 0 || H[right] >= 0 || H[up] >= 0 || H[down] >= 0) rgb = mix(C.foam, C.shoal, 0.4);
        // Dünyanın kenarına doğru, dışarıdaki okyanus tabanının rengine kavuşur (çerçeve görünmesin).
        const edgeDistance = Math.min(x, y, WORLD_SIZE.width - x, WORLD_SIZE.height - y);
        rgb = mix(C.deepSea, rgb, smoothstep(10, 170, edgeDistance));
        rgb = rgb.map((v) => v + dither * 9) as Rgb;
      } else {
        const kind = TERRAIN_KINDS[K[i]];
        rgb = landColor(kind, h + noise(x * 0.06, y * 0.06) * 0.012);

        // Kabartma gölgesi: kuzeybatıdan gelen ışığa bakan yamaçlar aydınlık.
        const sx = ((H[right] - H[left]) / (2 * texel)) * relief;
        const sy = ((H[down] - H[up]) / (2 * texel)) * relief;
        const len = Math.sqrt(sx * sx + sy * sy + 1);
        const lit = (-sx * light.x - sy * light.y + light.z) / len / light.z;
        const shade = clamp(1 + (lit - 1) * shadeStrength, map ? 0.55 : 0.78, map ? 1.25 : 1.12);
        rgb = rgb.map((v) => v * shade) as Rgb;

        if (map) {
          // Harita üslubu: dik yamaçlarda yokuş aşağı uzanan ince tarama çizgileri, seyrek eş yükselti çizgileri.
          const slope = Math.sqrt(sx * sx + sy * sy);
          if (slope > 0.22) {
            const along = (x * -sy + y * sx) / (slope * texel * 2.4) + noise(x * 0.05, y * 0.05) * 0.6;
            const frac = along - Math.floor(along);
            if (frac < 0.32 * clamp((slope - 0.22) * 1.6, 0.35, 1)) rgb = rgb.map((v) => v * 0.8) as Rgb;
          }
          const level = Math.floor(h * 10);
          if (h > 0.1 && (Math.floor(Math.max(0, H[right]) * 10) !== level || Math.floor(Math.max(0, H[down]) * 10) !== level)) {
            rgb = rgb.map((v) => v * 0.86) as Rgb;
          }
        }

        // Patika
        if (T[i] === 1) rgb = mix(rgb, C.trail, 0.75);
        else if (T[i] === 2) rgb = mix(rgb, C.coastInk, 0.55);

        // Nehir
        if (R[i]) rgb = COLD_KINDS.has(kind) && h > 0.2 ? mix(C.riverIce, C.river, 0.25) : rgbOf(C.river);

        // Günözü Tapınağı: zirvede küçük altın avlu
        const fromTemple = Math.hypot(x - temple.x, y - temple.y);
        if (fromTemple < 12) rgb = fromTemple < 7 ? mix(C.temple, C.snow, 0.15) : mix(C.temple, C.rock, 0.45);

        // Koyu kıyı çizgisi
        const sea = (j: number) => H[j] < 0;
        if (sea(left) || sea(right) || sea(up) || sea(down)) rgb = mix(rgb, C.coastInk, map ? 0.6 : 0.35);
        rgb = rgb.map((v) => v + dither * 12) as Rgb;
      }

      data[i * 4] = rgb[0];
      data[i * 4 + 1] = rgb[1];
      data[i * 4 + 2] = rgb[2];
      data[i * 4 + 3] = 255;
    }
  }
  return { width, height, data };
}

/** Gölgelendirmede yükseklik farkının abartısı (3D'deki HEIGHT_SCALE ile aynı mertebede). */
const HEIGHT_RELIEF = 42;

/** Karartının rengi: gece mavisi, neredeyse siyah (kabartma gölgelendiricide hafifçe seçilir). */
export const VEIL_COLOR = "#0b1322";

/**
 * Karartı maskesi: görünmeyen (hikâyede henüz açılmamış) karanın üstüne koyu örtü. Arazi ızgarasıyla aynı boyda; kıyıda
 * iki kez yumuşatılır, böylece karartılı adanın çevresindeki sığlık da hafifçe kararır ve kenar sert durmaz.
 */
export function paintVeil(terrain: Terrain, visibility: LandVisibility): PaintedImage {
  const { cols, rows } = terrain;
  let alpha = new Float32Array(cols * rows);
  const mask = hiddenMask(terrain, visibility);
  for (let i = 0; i < alpha.length; i++) alpha[i] = mask[i];
  for (let pass = 0; pass < 2; pass++) {
    const next = new Float32Array(alpha.length);
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) {
        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const r = row + dy;
            const c = col + dx;
            if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
            sum += alpha[r * cols + c];
            count++;
          }
        const i = row * cols + col;
        // Karartılı karanın içi hep tam koyu kalır; yumuşama yalnızca dışa (suya) taşar.
        next[i] = mask[i] ? 1 : sum / count;
      }
    alpha = next;
  }
  const color = hexToRgba(VEIL_COLOR);
  const data = new Uint8ClampedArray(cols * rows * 4);
  for (let i = 0; i < alpha.length; i++) {
    data[i * 4] = color[0];
    data[i * 4 + 1] = color[1];
    data[i * 4 + 2] = color[2];
    data[i * 4 + 3] = Math.round(alpha[i] * 255);
  }
  return { width: cols, height: rows, data };
}

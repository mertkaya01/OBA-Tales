/**
 * ARAZİ ÜRETİCİSİ (v2) — world.json'daki tohumdan Ayazlı Adalar'ın yükseklik haritasını üretir.
 *
 * Sıra:
 *   1. Bölge ve ada poligonları bir kara maskesine dökülür; mesafe dönüşümüyle "birleşik" işaretli uzaklık
 *      bulunur (komşu iki bölgenin ortak kenarı kıyı sayılmaz).
 *   2. Kıyı çok ölçekli gürültüyle hem dışarı (burun) hem içeri (koy) dalgalanır. Kurallar:
 *        · bölge içleri kıyıdan PROTECT_DEPTH kadar içeride her zaman karadır (karakterler suya düşmez),
 *        · sabit yerler (content/sites.ts → LAND_SITES) her zaman karadır,
 *        · boğazlar (CHANNELS) açık kalır; yakınlarında kıyı dalgalanmaz,
 *        · kıyı önünde gürültüden küçük adacıklar çıkar.
 *   3. Kıyıya uzaklık hesaplanır: iç kesimler yükselir; denizde sığlık rafı ve basamaklı derinlik oluşur.
 *   4. Yükseklik = arazi türünün profili + yönlü dağ sırtları (ridged gürültü) + tepecikler. Profil, sırt
 *      genliği ve sırt yönü bulanıklaştırılır; böylece bölgeler arasında geçiş yumuşak olur.
 *   5. Meydanlar, obalar ve tapınak düzlenir; göl çukurları kazılır.
 *   6. Çukur doldurma (priority-flood) her kara hücresine denize inen bir yol verir. Akış birikimi eşiği
 *      aşan hücreler nehir olur; derin ve geniş çukurlar göl olur, küçükleri doldurulur.
 *
 * Çıktı motordan bağımsızdır: Three.js (3D ada) ve Leaflet (kuşbakışı harita) aynı ızgarayı kullanır.
 * Saf ve tohumludur: aynı tohum her zaman aynı adaları verir.
 */
import { createNoise2D, type NoiseFunction2D } from "simplex-noise";
import { ISLAND_LIST } from "../content/islands";
import { REGIONS } from "../content/regions";
import { BASINS, CHANNELS, FLAT_SITES, LAND_SITES, type Site } from "../content/sites";
import { clamp, distanceToPolygonEdge, distanceToSegment, pointInPolygon, polygonBounds } from "../lib/geometry";
import { createRng, seedFrom } from "../lib/random";
import { REGION_IDS, TERRAIN_KINDS, WORLD_SIZE } from "../types";
import type { Bounds, Coordinates, Region, RegionId, TerrainKind } from "../types";

export interface TerrainOptions {
  seed: number;
  /** Hücre boyu (dünya birimi). Küçüldükçe ayrıntı artar, üretim yavaşlar. */
  cellSize?: number;
}

/** Bir nehir: kaynaktan ağza (denize, göle ya da daha büyük bir nehre) uzanan yumuşatılmış çizgi. */
export interface RiverPath {
  points: Coordinates[];
  /** Her noktadaki genişlik (dünya birimi). */
  widths: number[];
}

export interface Lake {
  id: number;
  /** Su yüzeyinin yüksekliği (kara yüksekliği ölçeğinde, 0–1). */
  level: number;
  /** Hücre sayısı. */
  size: number;
  /** Soğuk arazideki göller donmuştur. */
  frozen: boolean;
  /** Gölün kapladığı alan (dünya birimi). */
  bounds: Bounds;
}

export interface Terrain {
  seed: number;
  cellSize: number;
  cols: number;
  rows: number;
  /** Satır satır (row * cols + col): < 0 su derinliği, 0–1 kara yüksekliği. Göllerde göl tabanı. */
  heights: Float32Array;
  /** REGION_IDS içindeki sıra; su ve yabani adalar için -1. */
  regions: Int8Array;
  /** ISLAND_IDS içindeki sıra (yabani adanın karası); bölgelerde ve suda -1. */
  islands: Int8Array;
  /** TERRAIN_KINDS içindeki sıra; su için -1. */
  kinds: Int8Array;
  /** Kıyı çizgisine işaretli uzaklık (dünya birimi): karada pozitif, denizde negatif. */
  shore: Float32Array;
  /** Nehir gücü: 0 = nehir yok, 0–1 arası koldan ana nehre. */
  river: Float32Array;
  rivers: RiverPath[];
  /** Hücrenin gölü (lakes içindeki sıra); göl değilse -1. */
  lakeIds: Int16Array;
  lakes: Lake[];
}

/** Bölge kenarından içeriye doğru kıyının asla giremeyeceği derinlik (dünya birimi). */
export const PROTECT_DEPTH = 55;
/** Yabani adaların çekirdeği (kıyıdan bu kadar içerisi hep kara). */
const ISLAND_CORE = 20;
/** Kıyının poligondan en fazla ne kadar içeri (koy) ve dışarı (burun) dalgalanabileceği. */
const COAST_IN = 95;
const COAST_OUT = 44;
/** Dünya kenarında açık deniz şeridi. */
const BORDER = 24;
/** Göl sayılan çukurun en küçük derinliği ve hücre sayısı. */
const LAKE_DEPTH = 0.035;
const LAKE_MIN_CELLS = 80;
/** Nehir sayılan en küçük akış birikimi (yağış ağırlıklı hücre sayısı). */
export const RIVER_MIN_FLOW = 900;
/** Soğuk arazi türleri: gölleri donar, nehirleri buzludur. */
export const COLD_KINDS: ReadonlySet<TerrainKind> = new Set(["gecit", "yayla", "yuksek_ada", "tepe", "buzul", "kayalik"]);

/** Bölgelerin dağ sırtı yönleri (radyan; 0 = doğu-batı). */
const REGION_RIDGES: Readonly<Record<RegionId, number>> = {
  akinburnu: 0.5,
  suzulkoy: -0.2,
  ayazbogazi: 1.15,
  kiragiduzu: 0.1,
  pusluada: 1.35,
  gunozu_tepesi: 0.35,
  kutada: 0.25,
};

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Birkaç oktavlı gürültü, [-1, 1] aralığında. */
function fbm(noise: NoiseFunction2D, x: number, y: number, octaves = 3): number {
  let sum = 0;
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * frequency, y * frequency) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return sum / total;
}

/** Sırt gürültüsü (ridged multifractal), yaklaşık [0, 1]: keskin, birbirine bağlanan dağ sırtları. */
function ridged(noise: NoiseFunction2D, x: number, y: number, octaves = 4): number {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let weight = 1;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    let n = 1 - Math.abs(noise(x * frequency, y * frequency));
    n *= n * weight;
    weight = clamp(n * 1.8, 0, 1);
    sum += n * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return sum / total;
}

/** Bölgeye işaretli uzaklık: içeride pozitif, dışarıda negatif (dünya birimi). Sis maskesi kullanır. */
export function signedDistance(point: Coordinates, region: Region): number {
  const d = distanceToPolygonEdge(point, region.polygon);
  return pointInPolygon(point, region.polygon) ? d : -d;
}

/** Poligonun yalnızca kuzey-güney doğrultulu kenarlarına uzaklık (Ayazboğazı'nın buz duvarları). */
function wallDistance(point: Coordinates, polygon: readonly Coordinates[]): number {
  let best = Infinity;
  for (let k = 0; k < polygon.length; k++) {
    const a = polygon[k];
    const c = polygon[(k + 1) % polygon.length];
    if (Math.abs(c.y - a.y) < Math.abs(c.x - a.x) * 0.8) continue;
    best = Math.min(best, distanceToSegment(point, a, c));
  }
  return best;
}

// ── Izgara araçları ────────────────────────────────────────────────

/**
 * Her hücrenin en yakın tohum hücresine Öklid uzaklığı (hücre birimi) ve o tohumun indeksi.
 * İki geçişli "dead reckoning" mesafe dönüşümü: doğrusal zamanda, gerçeğe çok yakın.
 */
function distanceTransform(seeds: Uint8Array, cols: number, rows: number): { dist: Float32Array; nearest: Int32Array } {
  const n = cols * rows;
  const dist = new Float32Array(n).fill(1e9);
  const nearest = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    if (seeds[i]) {
      dist[i] = 0;
      nearest[i] = i;
    }
  }
  const check = (i: number, x: number, y: number, j: number) => {
    const s = nearest[j];
    if (s < 0) return;
    const dx = x - (s % cols);
    const dy = y - ((s / cols) | 0);
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < dist[i]) {
      dist[i] = d;
      nearest[i] = s;
    }
  };
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (x > 0) check(i, x, y, i - 1);
      if (y > 0) {
        check(i, x, y, i - cols);
        if (x > 0) check(i, x, y, i - cols - 1);
        if (x < cols - 1) check(i, x, y, i - cols + 1);
      }
    }
  }
  for (let y = rows - 1; y >= 0; y--) {
    for (let x = cols - 1; x >= 0; x--) {
      const i = y * cols + x;
      if (x < cols - 1) check(i, x, y, i + 1);
      if (y < rows - 1) {
        check(i, x, y, i + cols);
        if (x < cols - 1) check(i, x, y, i + cols + 1);
        if (x > 0) check(i, x, y, i + cols - 1);
      }
    }
  }
  return { dist, nearest };
}

/** Maskeli kutu bulanıklığı (yalnızca maskeli hücrelerin ortalaması), yerinde, iki kez: Gauss'a yakın. */
function blurMasked(fields: Float32Array[], mask: Uint8Array, cols: number, rows: number, radius: number): void {
  const n = cols * rows;
  const weight = new Float32Array(n);
  for (let i = 0; i < n; i++) weight[i] = mask[i];
  const line = new Float32Array(Math.max(cols, rows));
  const lineW = new Float32Array(Math.max(cols, rows));
  const pass = (field: Float32Array, w: Float32Array, horizontal: boolean) => {
    const length = horizontal ? cols : rows;
    const count = horizontal ? rows : cols;
    const stride = horizontal ? 1 : cols;
    for (let k = 0; k < count; k++) {
      const start = horizontal ? k * cols : k;
      let sum = 0;
      let sumW = 0;
      for (let t = -radius; t <= radius; t++) {
        const idx = start + clamp(t, 0, length - 1) * stride;
        sum += field[idx] * w[idx];
        sumW += w[idx];
      }
      for (let t = 0; t < length; t++) {
        line[t] = sum;
        lineW[t] = sumW;
        const out = start + clamp(t - radius, 0, length - 1) * stride;
        const inn = start + clamp(t + radius + 1, 0, length - 1) * stride;
        sum += field[inn] * w[inn] - field[out] * w[out];
        sumW += w[inn] - w[out];
      }
      for (let t = 0; t < length; t++) {
        const idx = start + t * stride;
        field[idx] = lineW[t] > 1e-6 ? line[t] / lineW[t] : field[idx];
      }
    }
  };
  for (let iteration = 0; iteration < 2; iteration++) {
    for (const field of fields) {
      pass(field, weight, true);
      pass(field, weight, false);
    }
  }
}

/** minCells'ten küçük kara parçalarını siler (4 komşuluk). */
function removeSmallIslands(land: Uint8Array, cols: number, rows: number, minCells: number): void {
  const seen = new Uint8Array(land.length);
  const stack: number[] = [];
  for (let i = 0; i < land.length; i++) {
    if (!land[i] || seen[i]) continue;
    const cells: number[] = [];
    stack.push(i);
    seen[i] = 1;
    while (stack.length > 0) {
      const c = stack.pop()!;
      cells.push(c);
      const col = c % cols;
      const row = (c / cols) | 0;
      const visit = (j: number) => {
        if (!land[j] || seen[j]) return;
        seen[j] = 1;
        stack.push(j);
      };
      if (col > 0) visit(c - 1);
      if (col < cols - 1) visit(c + 1);
      if (row > 0) visit(c - cols);
      if (row < rows - 1) visit(c + cols);
    }
    if (cells.length < minCells) for (const c of cells) land[c] = 0;
  }
}

/** Basit ikili yığın (en küçük anahtar önce): çukur doldurma için. */
function createHeap(capacity: number) {
  const keys = new Float32Array(capacity);
  const values = new Int32Array(capacity);
  let size = 0;
  return {
    get size() {
      return size;
    },
    push(key: number, value: number) {
      let i = size++;
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (keys[parent] <= key) break;
        keys[i] = keys[parent];
        values[i] = values[parent];
        i = parent;
      }
      keys[i] = key;
      values[i] = value;
    },
    pop(): number {
      const top = values[0];
      const key = keys[--size];
      const value = values[size];
      let i = 0;
      for (;;) {
        let child = 2 * i + 1;
        if (child >= size) break;
        if (child + 1 < size && keys[child + 1] < keys[child]) child++;
        if (keys[child] >= key) break;
        keys[i] = keys[child];
        values[i] = values[child];
        i = child;
      }
      keys[i] = key;
      values[i] = value;
      return top;
    },
  };
}

/** Çizgiyi Chaikin yöntemiyle yumuşatır; uç noktalar yerinde kalır. */
function chaikin<T>(points: T[], lerp: (a: T, b: T, t: number) => T, iterations: number): T[] {
  let out = points;
  for (let k = 0; k < iterations && out.length > 2; k++) {
    const next: T[] = [out[0]];
    for (let i = 0; i < out.length - 1; i++) {
      next.push(lerp(out[i], out[i + 1], 0.25), lerp(out[i], out[i + 1], 0.75));
    }
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
}

// ── Şekiller ───────────────────────────────────────────────────────

interface Shape {
  polygon: readonly Coordinates[];
  bounds: Bounds;
  kind: number;
  elevation: number;
  /** REGION_IDS sırası; yabani adada -1. */
  region: number;
  /** ISLAND_LIST sırası; bölgede -1. */
  island: number;
  ridge: number;
  center: Coordinates;
  core: number;
}

function buildShapes(): Shape[] {
  const shapes: Shape[] = REGION_IDS.map((id, index) => {
    const region = REGIONS[id];
    return {
      polygon: region.polygon,
      bounds: polygonBounds(region.polygon),
      kind: TERRAIN_KINDS.indexOf(region.terrain),
      elevation: region.elevation,
      region: index,
      island: -1,
      ridge: REGION_RIDGES[id],
      center: region.center,
      core: PROTECT_DEPTH,
    };
  });
  ISLAND_LIST.forEach((island, islandIndex) => {
    for (const polygon of island.polygons) {
      shapes.push({
        polygon,
        bounds: polygonBounds(polygon),
        kind: TERRAIN_KINDS.indexOf(island.terrain),
        elevation: island.elevation,
        region: -1,
        island: islandIndex,
        ridge: island.ridgeAngle,
        center: island.label,
        core: ISLAND_CORE,
      });
    }
  });
  return shapes;
}

/** Alanın kapladığı hücreleri dolaşır. */
function forCellsInSite(site: Site, extra: number, cellSize: number, cols: number, rows: number, visit: (i: number, d: number) => void) {
  const r = site.radius * extra;
  const c0 = clamp(Math.floor((site.center.x - r) / cellSize), 0, cols - 1);
  const c1 = clamp(Math.ceil((site.center.x + r) / cellSize), 0, cols - 1);
  const r0 = clamp(Math.floor((site.center.y - r) / cellSize), 0, rows - 1);
  const r1 = clamp(Math.ceil((site.center.y + r) / cellSize), 0, rows - 1);
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const d = Math.hypot((col + 0.5) * cellSize - site.center.x, (row + 0.5) * cellSize - site.center.y);
      if (d <= r) visit(row * cols + col, d);
    }
  }
}

// ── Üretim ─────────────────────────────────────────────────────────

export function generateTerrain({ seed, cellSize = 4 }: TerrainOptions): Terrain {
  const cols = Math.ceil(WORLD_SIZE.width / cellSize);
  const rows = Math.ceil(WORLD_SIZE.height / cellSize);
  const n = cols * rows;
  const rng = createRng(seedFrom("terrain", seed));
  const coastNoise = createNoise2D(rng.next);
  const raggedNoise = createNoise2D(rng.next);
  const isletNoise = createNoise2D(rng.next);
  const ridgeNoise = createNoise2D(rng.next);
  const warpNoise = createNoise2D(rng.next);
  const hillNoise = createNoise2D(rng.next);
  const detailNoise = createNoise2D(rng.next);
  const shelfNoise = createNoise2D(rng.next);
  const basinNoise = createNoise2D(rng.next);
  const shapes = buildShapes();
  const cx = (col: number) => (col + 0.5) * cellSize;
  const cy = (row: number) => (row + 0.5) * cellSize;

  // 1. Poligon maskesi ve birleşik işaretli uzaklık
  const shapeOf = new Int16Array(n).fill(-1);
  shapes.forEach((shape, s) => {
    const c0 = clamp(Math.floor(shape.bounds.minX / cellSize), 0, cols - 1);
    const c1 = clamp(Math.ceil(shape.bounds.maxX / cellSize), 0, cols - 1);
    const r0 = clamp(Math.floor(shape.bounds.minY / cellSize), 0, rows - 1);
    const r1 = clamp(Math.ceil(shape.bounds.maxY / cellSize), 0, rows - 1);
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        if (pointInPolygon({ x: cx(col), y: cy(row) }, shape.polygon)) shapeOf[row * cols + col] = s;
      }
    }
  });
  const inside = new Uint8Array(n);
  const outside = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    inside[i] = shapeOf[i] >= 0 ? 1 : 0;
    outside[i] = 1 - inside[i];
  }
  const toInside = distanceTransform(inside, cols, rows);
  const toOutside = distanceTransform(outside, cols, rows);
  const polygonSd = new Float32Array(n);
  const nearestShape = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    if (inside[i]) {
      polygonSd[i] = (toOutside.dist[i] - 0.5) * cellSize;
      nearestShape[i] = shapeOf[i];
    } else {
      polygonSd[i] = -(toInside.dist[i] - 0.5) * cellSize;
      nearestShape[i] = toInside.nearest[i] >= 0 ? shapeOf[toInside.nearest[i]] : -1;
    }
  }

  // 2. Kıyı: dalgalanan kara/deniz sınırı
  const landness = new Float32Array(n);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      const x = cx(col);
      const y = cy(row);
      const sd = polygonSd[i];
      if (sd < -160) {
        landness[i] = sd;
        continue;
      }
      // Kıyı üç ölçekte dalgalanır (büyük koylar, burunlar, girintiler); örnekleme noktası bükülür ki kıvrımlar dolansın.
      const qx = x + fbm(raggedNoise, x * 0.0025 + 11, y * 0.0025, 2) * 70;
      const qy = y + fbm(raggedNoise, x * 0.0025 - 7, y * 0.0025 + 23, 2) * 70;
      let offset = fbm(coastNoise, qx * 0.0035, qy * 0.0035, 2) * 70 + fbm(coastNoise, qx * 0.011 + 50, qy * 0.011, 2) * 24 + fbm(raggedNoise, qx * 0.035, qy * 0.035, 2) * 8;
      offset = clamp(offset, -COAST_IN, COAST_OUT);

      // Boğaz yakınında kıyı dalgalanmaz; boğazın ortası her zaman sudur.
      let channelLimit = Infinity;
      for (const channel of CHANNELS) {
        const d = distanceToSegment({ x, y }, channel.from, channel.to);
        offset *= smoothstep(channel.width * 0.5, channel.width * 3.5, d);
        channelLimit = Math.min(channelLimit, d - channel.width / 2);
      }

      let land = sd + offset;
      const shape = nearestShape[i] >= 0 ? shapes[nearestShape[i]] : null;
      if (shape && sd > shape.core) land = Math.max(land, 1);
      // Adacıklar: kıyı önündeki sığ sularda gürültüden doğan küçük kara parçaları
      if (sd < -14 && sd > -120) {
        const t = fbm(isletNoise, x * 0.016, y * 0.016, 3) - 0.56 - (-sd - 14) / 300;
        if (t > 0) land = Math.max(land, t * 70);
      }
      land = Math.min(land, channelLimit);
      landness[i] = land;
    }
  }
  for (const site of LAND_SITES) {
    forCellsInSite(site, 1, cellSize, cols, rows, (i, d) => {
      landness[i] = Math.max(landness[i], site.radius - d + 0.5);
    });
  }
  const isLandCell = new Uint8Array(n);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      const edge = Math.min(cx(col), cy(row), WORLD_SIZE.width - cx(col), WORLD_SIZE.height - cy(row));
      isLandCell[i] = Math.min(landness[i], edge - BORDER) > 0 ? 1 : 0;
    }
  }
  // Tek hücrelik kara noktalarını ve su deliklerini temizle.
  for (let row = 1; row < rows - 1; row++) {
    for (let col = 1; col < cols - 1; col++) {
      const i = row * cols + col;
      const v = isLandCell[i];
      const same = (isLandCell[i - 1] === v ? 1 : 0) + (isLandCell[i + 1] === v ? 1 : 0) + (isLandCell[i - cols] === v ? 1 : 0) + (isLandCell[i + cols] === v ? 1 : 0);
      if (same === 0) isLandCell[i] = 1 - v;
    }
  }

  // Çok küçük kara parçaları (birkaç hücrelik noktacıklar) denize döner.
  removeSmallIslands(isLandCell, cols, rows, 8);

  // 3. Kıyıya uzaklık, bölge ve arazi türü
  const isWaterCell = new Uint8Array(n);
  for (let i = 0; i < n; i++) isWaterCell[i] = 1 - isLandCell[i];
  const toWater = distanceTransform(isWaterCell, cols, rows);
  const toLand = distanceTransform(isLandCell, cols, rows);
  const shore = new Float32Array(n);
  const regions = new Int8Array(n).fill(-1);
  const islands = new Int8Array(n).fill(-1);
  const kinds = new Int8Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    if (isLandCell[i]) {
      shore[i] = (toWater.dist[i] - 0.5) * cellSize;
      const shape = nearestShape[i] >= 0 ? shapes[nearestShape[i]] : shapes[0];
      regions[i] = shape.region;
      islands[i] = shape.island;
      kinds[i] = shape.kind;
    } else {
      shore[i] = -(toLand.dist[i] - 0.5) * cellSize;
    }
  }

  // 4. Yükseklik: profil, sırt ve tepecik genlikleri (bulanıklaştırılarak birbirine karışır)
  const base = new Float32Array(n);
  const ridgeAmp = new Float32Array(n);
  const hillAmp = new Float32Array(n);
  const coastWidth = new Float32Array(n);
  const dirX = new Float32Array(n);
  const dirY = new Float32Array(n);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      if (!isLandCell[i]) continue;
      const shape = nearestShape[i] >= 0 ? shapes[nearestShape[i]] : shapes[0];
      const x = cx(col);
      const y = cy(row);
      const dl = shore[i];
      const inner = smoothstep(0, 110, dl);
      const e = shape.elevation;
      let b: number;
      let ridge: number;
      let hills: number;
      let coast: number;
      switch (TERRAIN_KINDS[shape.kind]) {
        case "liman":
          [b, ridge, hills, coast] = [0.05 + 0.1 * inner, 0.035, 0.05, 18];
          break;
        case "koy":
          [b, ridge, hills, coast] = [0.045 + 0.08 * inner, 0.025, 0.035, 20];
          break;
        case "gecit": {
          // Kenarlarda yüksek buz duvarları, ortada alçak geçit yolu.
          // Duvarlar yalnızca kuzey-güney uzanan kenarlarda: geçit kuzeye ve güneye açık kalır, su akıp gider.
          const own = inside[i] && shapeOf[i] === nearestShape[i] ? wallDistance({ x, y }, shape.polygon) : 0;
          [b, ridge, hills, coast] = [e * (0.42 + 0.58 * (1 - smoothstep(0, 80, own))), 0.09, 0.05, 14];
          break;
        }
        case "yayla":
          [b, ridge, hills, coast] = [e * (0.55 + 0.45 * inner), 0.07, 0.05, 16];
          break;
        case "yuksek_ada":
          // Kıyıdan dik yükselen yalılar, üstte geniş düzlük.
          [b, ridge, hills, coast] = [e * (0.3 + 0.7 * smoothstep(0, 45, dl)), 0.12, 0.06, 5];
          break;
        case "tepe": {
          const peak = 1 - clamp(Math.hypot(x - shape.center.x, y - shape.center.y) / 300, 0, 1);
          [b, ridge, hills, coast] = [0.1 + 0.25 * inner + 0.66 * peak ** 1.4, 0.16 * (1 - 0.6 * peak), 0.04, 14];
          break;
        }
        case "buzul":
          [b, ridge, hills, coast] = [0.1 + e * 0.8 * inner, 0.3, 0.04, 8];
          break;
        case "orman":
          [b, ridge, hills, coast] = [0.06 + e * 0.42 * inner, 0.12, 0.07, 20];
          break;
        case "kayalik":
          [b, ridge, hills, coast] = [0.07 + e * 0.6 * smoothstep(0, 55, dl), 0.22, 0.05, 7];
          break;
        case "cayir":
          // Kutada: yumuşak, çiçekli tepeler; ortası hafif yüksek (Kut Kapısı uzaktan görünsün).
          [b, ridge, hills, coast] = [0.05 + e * 0.55 * inner, 0.03, 0.06, 18];
          break;
        default:
          [b, ridge, hills, coast] = [0.06, 0.05, 0.04, 16];
      }
      base[i] = b;
      ridgeAmp[i] = ridge;
      hillAmp[i] = hills;
      coastWidth[i] = coast;
      dirX[i] = Math.cos(2 * shape.ridge);
      dirY[i] = Math.sin(2 * shape.ridge);
    }
  }
  blurMasked([base, ridgeAmp, hillAmp, coastWidth, dirX, dirY], isLandCell, cols, rows, 7);

  const heights = new Float32Array(n);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      const x = cx(col);
      const y = cy(row);
      if (!isLandCell[i]) {
        // Deniz: kıyıyı saran sığlık rafı, sonra basamak basamak derinleşen açık deniz.
        const dw = -shore[i];
        const shelf = 50 + 28 * fbm(shelfNoise, x * 0.005, y * 0.005, 3);
        const depth =
          dw < shelf
            ? 0.02 + 0.075 * (dw / shelf) ** 1.2
            : 0.095 + 0.45 * smoothstep(0, 180, dw - shelf) + 0.38 * smoothstep(140, 520, dw - shelf) + 0.07 * fbm(shelfNoise, x * 0.002 + 40, y * 0.002, 2);
        heights[i] = -clamp(depth, 0.02, 1);
        continue;
      }
      const dl = shore[i];
      const coastRamp = smoothstep(0, Math.max(3, coastWidth[i]), dl);
      const theta = 0.5 * Math.atan2(dirY[i], dirX[i]);
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      const wx = fbm(warpNoise, x * 0.0028, y * 0.0028, 3) * 150;
      const wy = fbm(warpNoise, x * 0.0028 + 31, y * 0.0028 - 17, 3) * 150;
      const u = (x + wx) * cos + (y + wy) * sin;
      const v = -(x + wx) * sin + (y + wy) * cos;
      const ridges = ridged(ridgeNoise, u * 0.0042, v * 0.0064, 4);
      const hills = fbm(hillNoise, x * 0.011, y * 0.011, 3);
      const detail = fbm(detailNoise, x * 0.045, y * 0.045, 2);
      const inner = smoothstep(4, 80, dl);
      const h = base[i] * coastRamp + ridgeAmp[i] * inner * (ridges - 0.22) * 1.7 + hillAmp[i] * hills * coastRamp + 0.012 * detail;
      heights[i] = clamp(h, 0.02, 1);
    }
  }

  // 5. Düzleştirme (meydan, oba, tapınak) ve göl çukurları
  for (const site of FLAT_SITES) {
    let sum = 0;
    let count = 0;
    forCellsInSite(site, 0.8, cellSize, cols, rows, (i) => {
      if (!isLandCell[i]) return;
      sum += heights[i];
      count++;
    });
    if (count === 0) continue;
    const target = sum / count;
    forCellsInSite(site, 1, cellSize, cols, rows, (i, d) => {
      if (!isLandCell[i]) return;
      // Tam düz değil (zeminin %15'i kalır), çevresinden biraz yüksek ve hafif kubbeli: nehirler ve göller
      // içine girmez, kenarından geçer; haritada da yapay bir daire gibi görünmez.
      const w = 0.85 * (1 - smoothstep(site.radius * 0.35, site.radius, d));
      heights[i] = Math.max(0.02, heights[i] + (target + 0.014 - heights[i]) * w + 0.012 * w * (1 - d / site.radius));
    });
  }
  for (const basin of BASINS) {
    // Önce çanağın yeri düzlenir (eğimli arazide de kapalı bir çukur oluşsun), sonra kazılır.
    let sum = 0;
    let count = 0;
    forCellsInSite(basin, 1.3, cellSize, cols, rows, (i) => {
      if (!isLandCell[i]) return;
      sum += heights[i];
      count++;
    });
    const level = count > 0 ? sum / count : 0.1;
    forCellsInSite(basin, 1.6, cellSize, cols, rows, (i, d) => {
      if (!isLandCell[i]) return;
      const w = 1 - smoothstep(basin.radius * 1.2, basin.radius * 1.6, d);
      heights[i] = heights[i] + (Math.max(level, heights[i] * 0.5 + level * 0.5) + 0.02 - heights[i]) * w;
    });
    forCellsInSite(basin, 1.35, cellSize, cols, rows, (i, d) => {
      if (!isLandCell[i]) return;
      const row = Math.floor(i / cols);
      const col = i % cols;
      const angle = Math.atan2(cy(row) - basin.center.y, cx(col) - basin.center.x);
      const r = basin.radius * (1 + 0.18 * basinNoise(Math.cos(angle) * 1.3, Math.sin(angle) * 1.3));
      const t = d / r;
      if (t >= 1.3) return;
      // Çanak: ortası derin, kenarı hafif kabarık (gölün dökülme eşiği).
      const bowl = t < 1 ? basin.depth * (1 - t * t) : -basin.depth * 0.25 * (1 - (t - 1) / 0.3);
      heights[i] = Math.max(0.025, heights[i] - bowl);
    });
  }

  // 6. Çukur doldurma, akış ve nehirler. Su yolları düzlenen alanları yüksek sayar: nehir ve göl
  //    meydanlara, obalara ve tapınağa girmez, çevresinden dolanır.
  const routing = Float32Array.from(heights);
  for (const site of FLAT_SITES) {
    forCellsInSite(site, 1.1, cellSize, cols, rows, (i, d) => {
      if (isLandCell[i]) routing[i] += 0.08 * (1 - smoothstep(site.radius * 0.75, site.radius * 1.1, d));
    });
  }
  const filled = Float32Array.from(routing);
  const parent = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  const order = new Int32Array(n);
  let ordered = 0;
  const heap = createHeap(n);
  const NEIGHBORS = [-1, 1, -cols, cols, -cols - 1, -cols + 1, cols - 1, cols + 1];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      if (isLandCell[i]) continue;
      done[i] = 1;
      if (row === 0 || col === 0 || row === rows - 1 || col === cols - 1) continue;
      for (const offset of NEIGHBORS) {
        if (isLandCell[i + offset]) {
          heap.push(heights[i], i);
          break;
        }
      }
    }
  }
  while (heap.size > 0) {
    const c = heap.pop();
    const col = c % cols;
    const row = (c / cols) | 0;
    for (let k = 0; k < 8; k++) {
      const dc = k === 0 || k === 4 || k === 6 ? -1 : k === 1 || k === 5 || k === 7 ? 1 : 0;
      const dr = k === 2 || k === 4 || k === 5 ? -1 : k === 3 || k === 6 || k === 7 ? 1 : 0;
      const nc = col + dc;
      const nr = row + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const j = nr * cols + nc;
      if (done[j]) continue;
      done[j] = 1;
      filled[j] = Math.max(routing[j], filled[c] + 1e-6);
      parent[j] = c;
      order[ordered++] = j;
      heap.push(filled[j], j);
    }
  }

  // Göller: derin ve geniş çukurlar. Küçük çukurlar doldurulur (su birikintisi kalmaz).
  const lakeIds = new Int16Array(n).fill(-1);
  const lakes: Lake[] = [];
  const pending = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (isLandCell[i] && filled[i] - routing[i] > LAKE_DEPTH) pending[i] = 1;
  const stack: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!pending[i]) continue;
    const cells: number[] = [];
    stack.push(i);
    pending[i] = 0;
    while (stack.length > 0) {
      const c = stack.pop()!;
      cells.push(c);
      for (const offset of [-1, 1, -cols, cols]) {
        const j = c + offset;
        if (j >= 0 && j < n && pending[j] && Math.abs((j % cols) - (c % cols)) <= 1) {
          pending[j] = 0;
          stack.push(j);
        }
      }
    }
    if (cells.length < LAKE_MIN_CELLS || lakes.length >= 32000) {
      for (const c of cells) heights[c] += filled[c] - routing[c];
      continue;
    }
    let level = 0;
    let cold = 0;
    const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const c of cells) {
      level = Math.max(level, filled[c]);
      lakeIds[c] = lakes.length;
      if (COLD_KINDS.has(TERRAIN_KINDS[kinds[c]])) cold++;
      const x = cx(c % cols);
      const y = cy((c / cols) | 0);
      bounds.minX = Math.min(bounds.minX, x - cellSize / 2);
      bounds.maxX = Math.max(bounds.maxX, x + cellSize / 2);
      bounds.minY = Math.min(bounds.minY, y - cellSize / 2);
      bounds.maxY = Math.max(bounds.maxY, y + cellSize / 2);
    }
    lakes.push({ id: lakes.length, level, size: cells.length, frozen: cold * 2 > cells.length, bounds });
  }

  // Akış birikimi: dağlara daha çok yağış düşer.
  const flow = new Float32Array(n);
  for (let i = 0; i < n; i++) if (isLandCell[i]) flow[i] = 0.6 + heights[i] * 2.4;
  for (let k = ordered - 1; k >= 0; k--) {
    const i = order[k];
    const p = parent[i];
    if (p >= 0 && isLandCell[p]) flow[p] += flow[i];
  }
  const river = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (!isLandCell[i] || lakeIds[i] >= 0 || flow[i] < RIVER_MIN_FLOW) continue;
    river[i] = 0.15 + 0.85 * clamp(Math.log(flow[i] / RIVER_MIN_FLOW) / Math.log(25), 0, 1);
  }
  const rivers = traceRivers({ cols, cellSize, river, parent, lakeIds, isLandCell });
  // Nehir yatağı hafifçe oyulur (kuşbakışı haritada vadiler belirginleşir).
  for (let i = 0; i < n; i++) if (river[i] > 0) heights[i] = Math.max(0.015, heights[i] - (0.004 + 0.01 * river[i]));

  return { seed, cellSize, cols, rows, heights, regions, islands, kinds, shore, river, rivers, lakeIds, lakes };
}

interface TraceInput {
  cols: number;
  cellSize: number;
  river: Float32Array;
  parent: Int32Array;
  lakeIds: Int16Array;
  isLandCell: Uint8Array;
}

/** Nehir hücrelerini kaynaktan ağza çizgilere çevirir. Kollar ana nehre kavuştukları noktada biter. */
function traceRivers({ cols, cellSize, river, parent, lakeIds, isLandCell }: TraceInput): RiverPath[] {
  const n = river.length;
  const hasUpstream = new Uint8Array(n);
  const lakeInlet = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const p = parent[i];
    if (p < 0) continue;
    if (river[i] > 0) hasUpstream[p] = 1;
    // Gölden çıkan nehir: göl hücresi bu nehir hücresine akıyor.
    if (lakeIds[i] >= 0 && river[p] > 0) lakeInlet[p] = i;
  }
  const center = (i: number): Coordinates => ({ x: ((i % cols) + 0.5) * cellSize, y: (((i / cols) | 0) + 0.5) * cellSize });
  const visited = new Uint8Array(n);
  const paths: RiverPath[] = [];
  for (let s = 0; s < n; s++) {
    if (river[s] <= 0 || hasUpstream[s]) continue;
    const cells: number[] = [];
    if (lakeInlet[s] >= 0) cells.push(lakeInlet[s]);
    let i = s;
    for (;;) {
      cells.push(i);
      visited[i] = 1;
      const p = parent[i];
      if (p < 0) break;
      if (!isLandCell[p] || lakeIds[p] >= 0 || visited[p]) {
        cells.push(p);
        break;
      }
      if (river[p] <= 0) break;
      i = p;
    }
    if (cells.length < 4) continue;
    const raw = cells.map((c) => ({ p: center(c), w: 2.4 + 4.4 * Math.max(river[c], river[s]) }));
    const smooth = chaikin(raw, (a, b, t) => ({ p: { x: a.p.x + (b.p.x - a.p.x) * t, y: a.p.y + (b.p.y - a.p.y) * t }, w: a.w + (b.w - a.w) * t }), 2);
    paths.push({ points: smooth.map((q) => q.p), widths: smooth.map((q) => q.w) });
  }
  return paths;
}

// ── Örnekleme ──────────────────────────────────────────────────────

export interface TerrainSample {
  height: number;
  region: RegionId | null;
  kind: TerrainKind | null;
}

function cellIndex(terrain: Terrain, point: Coordinates): number {
  const col = clamp(Math.floor(point.x / terrain.cellSize), 0, terrain.cols - 1);
  const row = clamp(Math.floor(point.y / terrain.cellSize), 0, terrain.rows - 1);
  return row * terrain.cols + col;
}

/** Dünya koordinatındaki hücrenin yüksekliği, bölgesi ve arazi türü. */
export function sampleTerrain(terrain: Terrain, point: Coordinates): TerrainSample {
  const index = cellIndex(terrain, point);
  const regionIndex = terrain.regions[index];
  const kindIndex = terrain.kinds[index];
  return {
    height: terrain.heights[index],
    region: regionIndex >= 0 ? REGION_IDS[regionIndex] : null,
    kind: kindIndex >= 0 ? TERRAIN_KINDS[kindIndex] : null,
  };
}

/** Noktada nehir ya da göl var mı? (yapılar ve gezginler suya basmasın) */
export function isWet(terrain: Terrain, point: Coordinates): boolean {
  const index = cellIndex(terrain, point);
  return terrain.heights[index] < 0 || terrain.river[index] > 0 || terrain.lakeIds[index] >= 0;
}

/**
 * Komşu dört hücrenin ortalamasıyla yumuşatılmış yükseklik (bilinear).
 * 3D arazi ağı ve nesnelerin yere oturması için hücre köşelerinde bile pürüzsüz değer verir.
 */
export function sampleHeightBilinear(terrain: Terrain, point: Coordinates): number {
  const { cols, rows, cellSize, heights } = terrain;
  const fx = clamp(point.x / cellSize - 0.5, 0, cols - 1);
  const fy = clamp(point.y / cellSize - 0.5, 0, rows - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(cols - 1, x0 + 1);
  const y1 = Math.min(rows - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const top = heights[y0 * cols + x0] * (1 - tx) + heights[y0 * cols + x1] * tx;
  const bottom = heights[y1 * cols + x0] * (1 - tx) + heights[y1 * cols + x1] * tx;
  return top * (1 - ty) + bottom * ty;
}

export function isLand(terrain: Terrain, point: Coordinates): boolean {
  return sampleTerrain(terrain, point).height >= 0;
}

/**
 * BOSS SPRITE'LARI — dört boss, kodla çizilmiş piksel sanatı (görsel dosyası yok).
 *
 *   Buzkıran Tekgöz   tek kocaman gözlü, şaşkın kaşlı buz devi; göğsünde mavi buz çekirdeği
 *   Sisçi Karaçay     dumandan yelkenli, lomboz gözleri parlayan gölge gemisi
 *   Ayazkurt          gümüş tüylü, buz mavisi gözlü oturan fırtına kurdu
 *   Kışgölgesi Han    taçlı, pelerinli kadim muhafız; asasında sönük Günözü Taşı
 *
 * Her birinin bir de "sakin" hâli var (akın provası tamamlanınca): gözler kapanır ya da ılır, çekirdek ısınır.
 * Sprite'ların ayakları alt kenarın ortasında; `core` zayıf noktanın ayaklara göre yeridir.
 */
import type { BossId } from "../../types";
import type { Sprite } from "../sprites/composeSprite";

export interface BossSprite {
  sprite: Sprite;
  /** Zayıf noktanın ayaklara (alt orta) göre yeri; y yukarı negatif. */
  core: { x: number; y: number };
}

type Rgba = readonly [number, number, number, number];
const INK = "#1b1424";

function parse(hex: string, alpha = 255): Rgba {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha];
}

/** Küçük bir piksel tuvali: dikdörtgen, elips (üç tonlu ışık), üçgen, çizgi ve otomatik kontur. */
export class PixelCanvas {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray<ArrayBuffer>;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  set(x: number, y: number, color: string, alpha = 255): this {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= this.width || yi >= this.height) return this;
    const [r, g, b, a] = parse(color, alpha);
    this.data.set([r, g, b, a], (yi * this.width + xi) * 4);
    return this;
  }

  filled(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    return this.data[(y * this.width + x) * 4 + 3] > 0;
  }

  rect(x: number, y: number, w: number, h: number, color: string): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, color);
    return this;
  }

  /** Işık sol üstten: aydınlık, orta, gölge tonları. */
  ellipse(cx: number, cy: number, rx: number, ry: number, [light, mid, dark]: readonly [string, string, string]): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        const lit = -0.6 * nx - 0.8 * ny;
        this.set(x, y, lit > 0.35 ? light : lit < -0.3 ? dark : mid);
      }
    }
    return this;
  }

  disc(cx: number, cy: number, r: number, color: string): this {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.set(x, y, color);
      }
    }
    return this;
  }

  tri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, color: string): this {
    const minX = Math.floor(Math.min(ax, bx, cx));
    const maxX = Math.ceil(Math.max(ax, bx, cx));
    const minY = Math.floor(Math.min(ay, by, cy));
    const maxY = Math.ceil(Math.max(ay, by, cy));
    const edge = (x0: number, y0: number, x1: number, y1: number, x: number, y: number) => (x1 - x0) * (y - y0) - (y1 - y0) * (x - x0);
    const area = edge(ax, ay, bx, by, cx, cy);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = edge(bx, by, cx, cy, px, py);
        const w1 = edge(cx, cy, ax, ay, px, py);
        const w2 = edge(ax, ay, bx, by, px, py);
        if (area > 0 ? w0 >= 0 && w1 >= 0 && w2 >= 0 : w0 <= 0 && w1 <= 0 && w2 <= 0) this.set(x, y, color);
      }
    }
    return this;
  }

  /** Dörtgen (iki üçgen). */
  quad(points: readonly [number, number][], color: string): this {
    const [a, b, c, d] = points;
    return this.tri(a[0], a[1], b[0], b[1], c[0], c[1], color).tri(a[0], a[1], c[0], c[1], d[0], d[1], color);
  }

  line(points: readonly [number, number][], color: string): this {
    for (const [x, y] of points) this.set(x, y, color);
    return this;
  }

  /** Dolu piksellerin çevresine 1 piksel mürekkep kontur. */
  outline(color = INK): this {
    const marks: number[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.filled(x, y)) continue;
        if (this.filled(x - 1, y) || this.filled(x + 1, y) || this.filled(x, y - 1) || this.filled(x, y + 1)) marks.push(x, y);
      }
    }
    for (let i = 0; i < marks.length; i += 2) this.set(marks[i], marks[i + 1], color);
    return this;
  }

  toSprite(): Sprite {
    return { width: this.width, height: this.height, data: this.data };
  }
}

// ── Buzkıran Tekgöz ────────────────────────────────────────────────

const ICE = ["#d6eefb", "#a9d4ee", "#6fa8cf"] as const;
const ICE_DEEP = ["#a9d4ee", "#6fa8cf", "#3f6f9a"] as const;
const FROST = "#eaf6ff";

function tekgoz(calm: boolean): BossSprite {
  const c = new PixelCanvas(62, 80);
  // Bacaklar
  c.rect(17, 62, 11, 17, ICE_DEEP[1]).rect(17, 62, 3, 17, ICE_DEEP[0]);
  c.rect(34, 62, 11, 17, ICE_DEEP[1]).rect(34, 62, 3, 17, ICE_DEEP[0]);
  // Kollar ve yumruklar
  c.ellipse(8, 50, 6, 14, ICE_DEEP).ellipse(54, 50, 6, 14, ICE_DEEP);
  c.ellipse(8, 64, 5, 5, ICE).ellipse(54, 64, 5, 5, ICE);
  // Gövde ve kafa
  c.ellipse(31, 47, 22, 18, ICE);
  c.ellipse(31, 23, 17, 14, ICE);
  // Omuz ve kafa sarkıtları
  c.tri(8, 38, 3, 26, 14, 35, FROST).tri(54, 38, 59, 26, 48, 35, FROST);
  c.tri(20, 13, 23, 2, 27, 11, FROST).tri(29, 10, 33, 0, 37, 10, FROST).tri(39, 12, 43, 4, 44, 14, FROST);
  // Göz
  if (calm) {
    c.line([[24, 23], [25, 24], [26, 25], [27, 25], [28, 25], [29, 25], [30, 25], [31, 25], [32, 25], [33, 25], [34, 25], [35, 24], [36, 23]], "#2c3e5c");
    c.disc(20, 29, 2.2, "#f2a0b0").disc(42, 29, 2.2, "#f2a0b0");
    // Gülümseme
    c.line([[27, 33], [28, 34], [29, 34], [30, 34], [31, 34], [32, 34], [33, 34], [34, 33]], "#2c3e5c");
  } else {
    c.disc(31, 23, 7.5, "#fbf7ef").disc(32, 23, 3.4, "#1b2a4a");
    c.set(33, 21, "#ffffff").set(34, 21, "#ffffff");
    // Şaşkın kaşlar: biri havada
    c.line([[21, 12], [22, 11], [23, 10], [24, 10], [25, 10], [26, 11]], "#3f6f9a");
    c.line([[36, 13], [37, 13], [38, 13], [39, 13], [40, 13], [41, 14]], "#3f6f9a");
    // "O" diye açılmış ağız
    c.disc(31, 33, 2.4, "#2c3e5c").set(31, 33, "#5a78a8");
  }
  // Buz çekirdeği (zayıf nokta): sakinleşince ılır
  const [coreOuter, coreInner] = calm ? ["#ff9a4a", "#ffe9b0"] : ["#59c2ff", "#c8f2ff"];
  c.tri(31, 40, 25, 47, 31, 54, coreOuter).tri(31, 40, 37, 47, 31, 54, coreOuter);
  c.tri(31, 43, 28, 47, 31, 51, coreInner).tri(31, 43, 34, 47, 31, 51, coreInner);
  c.outline();
  return { sprite: c.toSprite(), core: { x: 0, y: -(80 - 47) } };
}

// ── Sisçi Karaçay ──────────────────────────────────────────────────

function karacay(calm: boolean): BossSprite {
  const c = new PixelCanvas(92, 72);
  const sail = calm ? ["#f3ead8", "#e6d6b8", "#b89c6c"] : ["#b8b2cf", "#8c86a8", "#5d5876"];
  // Direkler
  c.rect(42, 6, 3, 44, "#3b2a1e").rect(64, 14, 3, 36, "#3b2a1e");
  // Yelkenler: yırtık alt kenar
  c.quad([[46, 8], [62, 12], [60, 40], [46, 44]], sail[1]);
  c.quad([[46, 8], [52, 9], [50, 42], [46, 44]], sail[0]);
  c.quad([[67, 16], [80, 20], [78, 42], [67, 44]], sail[1]);
  c.quad([[24, 14], [41, 10], [41, 42], [27, 38]], sail[2]);
  // Yelkenlerde yırtıklar
  for (const x of [50, 55, 70, 74, 31, 35]) c.set(x, x > 60 ? 41 : 40, "#000000", 0);
  // Flama
  c.tri(43, 2, 43, 7, 53, 4, calm ? "#c4413a" : "#4a4060");
  // Gövde
  c.quad([[2, 46], [86, 46], [76, 62], [14, 62]], "#3d3450");
  c.rect(4, 46, 82, 2, "#5a4f7a");
  c.quad([[14, 58], [76, 58], [76, 62], [14, 62]], "#2b2438");
  // Lomboz gözler
  const eye = calm ? "#fff3cf" : "#f6d36f";
  c.disc(30, 53, 2.6, eye).disc(46, 53, 2.6, eye).disc(62, 53, 2.6, calm ? eye : "#6a5f8a");
  c.outline();
  // Su köpüğü (konturun dışında)
  for (let x = 8; x < 84; x += 3) c.set(x, 64 + (x % 2), "#b8c8e8");
  return { sprite: c.toSprite(), core: { x: -8, y: -(72 - 53) } };
}

// ── Ayazkurt ───────────────────────────────────────────────────────

const FUR = ["#eef3f8", "#c3ced9", "#7f8c9a"] as const;

function ayazkurt(calm: boolean): BossSprite {
  const c = new PixelCanvas(84, 64);
  // Kuyruk ve arka bacak
  c.ellipse(76, 40, 6, 13, FUR).ellipse(60, 48, 13, 11, FUR);
  // Gövde ve göğüs tüyü
  c.ellipse(46, 40, 22, 16, FUR);
  c.ellipse(29, 38, 10, 13, ["#ffffff", "#eef3f8", "#c3ced9"]);
  // Ön bacaklar
  c.rect(24, 46, 6, 17, FUR[1]).rect(24, 46, 2, 17, FUR[0]).rect(34, 48, 6, 15, FUR[2]);
  // Kafa, burun, kulaklar
  c.tri(18, 13, 21, 1, 27, 12, FUR[1]).tri(26, 12, 31, 3, 33, 14, FUR[2]);
  c.ellipse(23, 21, 12, 10, FUR);
  c.ellipse(12, 25, 7, 4.5, FUR);
  c.disc(5.5, 24, 2, "#2a2b33");
  if (calm) c.line([[18, 19], [19, 20], [20, 20], [21, 20], [22, 19]], "#2a2b33");
  else c.disc(20, 19, 2.2, "#9fe0ff").set(20, 19, "#1b2a4a");
  // Kırağı tutamları
  c.line([[40, 26], [44, 25], [48, 26], [52, 25], [56, 27]], "#ffffff");
  c.outline();
  return { sprite: c.toSprite(), core: { x: -16, y: -(64 - 38) } };
}

// ── Kışgölgesi Han ─────────────────────────────────────────────────

function kisgolgesiHan(calm: boolean): BossSprite {
  const c = new PixelCanvas(64, 90);
  // Asa ve Günözü Taşı
  c.rect(51, 22, 3, 68, "#4a3626");
  const [stoneOuter, stoneInner] = calm ? ["#f6d36f", "#fff8e0"] : ["#6a5a3a", "#8c7a52"];
  c.tri(52.5, 10, 46, 17, 52.5, 24, stoneOuter).tri(52.5, 10, 59, 17, 52.5, 24, stoneOuter);
  c.tri(52.5, 13, 49, 17, 52.5, 21, stoneInner).tri(52.5, 13, 56, 17, 52.5, 21, stoneInner);
  // Pelerin
  c.quad([[16, 30], [44, 30], [56, 89], [4, 89]], "#3e3352");
  c.quad([[16, 30], [24, 30], [16, 89], [4, 89]], "#5a4a78");
  c.quad([[38, 30], [44, 30], [56, 89], [44, 89]], "#2c2438");
  // Kırağı etek
  for (let x = 5; x < 56; x += 2) c.set(x, 88, "#c3e0f2");
  // Eller
  c.ellipse(49, 42, 4, 3, ["#e6d6b8", "#c9b8a8", "#9a8a7a"]);
  // Başlık ve gölgeli yüz
  c.ellipse(30, 22, 11, 12, ["#4a3d63", "#3e3352", "#2c2438"]);
  c.ellipse(30, 25, 7, 7, ["#141019", "#141019", "#141019"]);
  const eye = calm ? "#fff8e0" : "#f6d36f";
  c.rect(26, 24, 3, 2, eye).rect(32, 24, 3, 2, eye);
  // Taç
  c.rect(19, 9, 22, 4, "#e2a52a");
  c.tri(19, 9, 21, 1, 24, 9, "#f6d36f").tri(27, 9, 30, 0, 33, 9, "#f6d36f").tri(36, 9, 39, 1, 41, 9, "#f6d36f");
  c.set(30, 10, "#59c2ff");
  c.outline();
  return { sprite: c.toSprite(), core: { x: 20, y: -(90 - 17) } };
}

const DRAWERS: Readonly<Record<BossId, (calm: boolean) => BossSprite>> = {
  buzkiran_tekgoz: tekgoz,
  sisci_karacay: karacay,
  ayazkurt,
  kisgolgesi_han: kisgolgesiHan,
};

/** Boss'un tek renkli silueti (henüz açılmamış bölümlerin gizemli kartları için). */
export function silhouette(sprite: Sprite, color = "#26203a"): Sprite {
  const [r, g, b] = parse(color);
  const data = new Uint8ClampedArray(sprite.data.length);
  for (let i = 0; i < sprite.data.length; i += 4) {
    if (sprite.data[i + 3] === 0) continue;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return { width: sprite.width, height: sprite.height, data };
}

const cache = new Map<string, BossSprite>();

export function bossSprite(id: BossId, calm = false): BossSprite {
  const key = `${id}:${calm}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = DRAWERS[id](calm);
    cache.set(key, hit);
  }
  return hit;
}

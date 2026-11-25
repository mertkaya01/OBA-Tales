/**
 * AKIN SAHNESİ ARKA PLANI — gökyüzü, uzak dağlar ve zemin; piksel piksel, düzenli titremeli (Bayer) geçişlerle.
 *
 *   kutup          gece mavisi, yıldızlar, buzul tepeleri       (Tekgöz, Ayazkurt)
 *   alacakaranlık  mor-turuncu akşam, uzak adacıklar             (Karaçay)
 *   tutulma        koyu mor, kızıl ufuk, Günözü tepesi           (Kışgölgesi Han)
 *   zemin: kar · deniz · taş
 *
 * Saf fonksiyondur; sonuç bir kez dokuya çevrilir.
 */
import type { Sprite } from "../sprites/composeSprite";
import type { GroundKind, SkyKind } from "./fxCatalog";

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number) => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;

type Rgb = readonly [number, number, number];
const rgb = (hex: string): Rgb => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Basit, tekrarlanabilir gürültü (yıldızlar ve dağ kenarı için). */
function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

interface SkyStyle {
  /** Yukarıdan ufka renk basamakları. */
  bands: readonly string[];
  stars: number;
  /** Uzak siluetin rengi ve yüksekliği. */
  ridge: { color: string; light: string; height: number; jagged: number };
}

const SKIES: Readonly<Record<SkyKind, SkyStyle>> = {
  kutup: {
    bands: ["#070d1f", "#0b1530", "#11203f", "#17304f", "#1e3a5f", "#2a4d73"],
    stars: 0.012,
    ridge: { color: "#2e4a6e", light: "#9fc4e8", height: 34, jagged: 1 },
  },
  alacakaranlik: {
    bands: ["#1a1430", "#2a1f45", "#4a2c58", "#6e3a5e", "#a4505c", "#e08a5a"],
    stars: 0.004,
    ridge: { color: "#3a2a48", light: "#c07a6a", height: 16, jagged: 0.4 },
  },
  tutulma: {
    bands: ["#0a0614", "#120b1e", "#1c1028", "#2a1530", "#3a1f3a", "#5a2a36"],
    stars: 0.008,
    ridge: { color: "#24182e", light: "#7a4a5a", height: 46, jagged: 0.6 },
  },
};

interface GroundStyle {
  edge: string;
  tones: readonly string[];
  detail: string;
}

const GROUNDS: Readonly<Record<GroundKind, GroundStyle>> = {
  kar: { edge: "#f4f8ff", tones: ["#dbe9f5", "#c7dbec", "#b0c8de"], detail: "#93abd6" },
  deniz: { edge: "#5f84b0", tones: ["#2a4566", "#22395a", "#1b2f4a"], detail: "#7fa8d8" },
  tas: { edge: "#6d688b", tones: ["#4a4263", "#3a3450", "#2b2639"], detail: "#1a1724" },
};

export function raidBackdrop(sky: SkyKind, ground: GroundKind, width = 320, height = 180, groundY = 150): Sprite {
  const data = new Uint8ClampedArray(width * height * 4);
  const s = SKIES[sky];
  const g = GROUNDS[ground];
  const bands = s.bands.map(rgb);
  const put = (x: number, y: number, c: Rgb) => data.set([c[0], c[1], c[2], 255], (y * width + x) * 4);

  // Uzak silüetin yüksekliği: birkaç dalganın toplamı + pürüz.
  const ridgeTop = (x: number) => {
    const wave = Math.sin(x * 0.021) * 0.5 + Math.sin(x * 0.057 + 1.3) * 0.3 + Math.sin(x * 0.13 + 4) * 0.2 * s.ridge.jagged;
    return Math.round(groundY - s.ridge.height * (0.55 + 0.45 * wave) - hash(x, 0, 9) * 2 * s.ridge.jagged);
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (y < groundY) {
        const top = ridgeTop(x);
        if (y >= top) {
          // Silüet: üst kenar ışık alır.
          put(x, y, rgb(y - top < 2 ? s.ridge.light : s.ridge.color));
          continue;
        }
        const t = (y / groundY) * (bands.length - 1);
        const step = Math.min(bands.length - 1, Math.floor(t + bayer(x, y)));
        let color = bands[step];
        const star = hash(x, y, 3);
        if (star < s.stars && y < groundY - 30) color = star < s.stars * 0.25 ? [255, 255, 255] : [207, 200, 255];
        put(x, y, color);
      } else {
        const gy = y - groundY;
        if (gy === 0) {
          put(x, y, rgb(g.edge));
          continue;
        }
        const t = Math.min(g.tones.length - 1, Math.floor((gy / (height - groundY)) * g.tones.length + bayer(x, y) - 0.5));
        let color = rgb(g.tones[Math.max(0, t)]);
        if (ground === "tas" && ((gy - 1) % 6 === 5 || (x + (Math.floor((gy - 1) / 6) % 2) * 7) % 14 === 0)) color = rgb(g.detail);
        if (ground !== "tas" && hash(x, y, 7) < 0.03) color = rgb(g.detail);
        put(x, y, color);
      }
    }
  }
  return { width, height, data };
}

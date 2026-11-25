/**
 * TOHUMLU RASTGELELİK — aynı tohum her zaman aynı sonucu verir.
 *
 * Ada arazisi, takipçilerin renk varyasyonları ve mock veri bu üreteçle üretilir;
 * böylece sayfa her açıldığında ve her derlemede dünya aynı görünür.
 */

/** Metni 32 bitlik sayıya çevirir (FNV-1a + murmur karıştırma). Aynı metin → aynı sayı. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Birden çok parçadan tek tohum: seedFrom("portre", karakter.id) */
export function seedFrom(...parts: ReadonlyArray<string | number>): number {
  return hashString(parts.join("\u0000"));
}

export interface WeightedItem<T> {
  value: T;
  weight: number;
}

export interface Rng {
  /** [0, 1) aralığında sayı. simplex-noise gibi kütüphanelere doğrudan verilebilir. */
  next: () => number;
  /** [min, max) aralığında ondalıklı sayı. */
  float: (min: number, max: number) => number;
  /** [min, max] aralığında tam sayı (iki uç dahil). */
  int: (min: number, max: number) => number;
  /** Listeden rastgele bir öğe. */
  pick: <T>(items: readonly T[]) => T;
  /** Ağırlığa göre seçim: ağırlığı büyük olan daha sık gelir. */
  weighted: <T>(items: readonly WeightedItem<T>[]) => T;
  /** p olasılıkla true (0–1). */
  chance: (p: number) => boolean;
}

/** mulberry32 tabanlı hızlı, tohumlu rastgele sayı üreteci. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    float: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => {
      if (items.length === 0) throw new Error("pick: liste boş");
      return items[Math.floor(next() * items.length)];
    },
    weighted: (items) => {
      const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
      if (total <= 0) throw new Error("weighted: toplam ağırlık sıfır");
      let roll = next() * total;
      for (const item of items) {
        roll -= Math.max(0, item.weight);
        if (roll < 0) return item.value;
      }
      // Kayan nokta yuvarlaması için: ağırlığı olan son öğe.
      return items.filter((item) => item.weight > 0).at(-1)!.value;
    },
    chance: (p) => next() < p,
  };
}

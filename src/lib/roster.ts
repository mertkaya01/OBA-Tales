/**
 * KADRO MANTIĞI — /karakterler ve /katil sayfalarının hesapları (saf fonksiyonlar, testli).
 *
 *   sortCharacters     puana, nadirliğe ya da ada göre (Türkçe alfabe)
 *   rarityBreakdown    obada her nadirlikten kaç kişi var, yüzde kaçı
 *   lookupHero         "@kullanici_adi" → obadaki kahraman (yoksa benzer adlar)
 *   previewNewcomer    henüz obada olmayan biri, takip ettiği platformlarla nasıl başlar?
 */
import { LANDMARKS } from "../content/sites";
import { RARITIES } from "../types";
import type { Character, Platform, Rarity } from "../types";
import { cleanHandle, createStarterCharacter, rarityRank } from "./rules";
import { roundPercents } from "./season";
import { normalizeSearch } from "./text";

// ── Sıralama ───────────────────────────────────────────────────────

export const SORT_KEYS = ["puan", "nadirlik", "ad"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const SORT_LABELS: Readonly<Record<SortKey, string>> = {
  puan: "Puana göre",
  nadirlik: "Nadirliğe göre",
  ad: "Ada göre (A–Z)",
};

const collator = new Intl.Collator("tr", { sensitivity: "base" });

export function sortCharacters(characters: readonly Character[], key: SortKey): Character[] {
  const byName = (a: Character, b: Character) => collator.compare(a.displayName, b.displayName) || a.id.localeCompare(b.id);
  const sorted = [...characters];
  switch (key) {
    case "puan":
      return sorted.sort((a, b) => b.points - a.points || byName(a, b));
    case "nadirlik":
      return sorted.sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || b.points - a.points || byName(a, b));
    case "ad":
      return sorted.sort(byName);
  }
}

// ── Nadirlik dağılımı ──────────────────────────────────────────────

export interface RarityShare {
  rarity: Rarity;
  count: number;
  /** Tam sayı yüzde; toplamı 100. */
  percent: number;
}

export function rarityBreakdown(characters: readonly Character[]): RarityShare[] {
  const counts = RARITIES.map((r) => characters.filter((c) => c.rarity === r).length);
  const percents = roundPercents(counts);
  return RARITIES.map((rarity, i) => ({ rarity, count: counts[i], percent: percents[i] }));
}

// ── Kahramanını bul ────────────────────────────────────────────────

export interface LookupResult {
  /** Kullanıcı adı birebir eşleşen kahraman (büyük-küçük harf ve Türkçe harf farkı gözetilmez). */
  hero: Character | null;
  /** Birebir eşleşme yoksa adında aranan geçen en fazla 5 kahraman. */
  suggestions: Character[];
  /** Temizlenmiş kullanıcı adı ("@" ve boşluklar atılmış). */
  handle: string;
}

export function lookupHero(characters: readonly Character[], input: string): LookupResult {
  const handle = cleanHandle(input);
  const needle = normalizeSearch(handle);
  if (needle.length < 2) return { hero: null, suggestions: [], handle };
  const hero = characters.find((c) => normalizeSearch(c.handle) === needle) ?? null;
  const suggestions = hero
    ? []
    : characters
        .filter((c) => normalizeSearch(c.handle).includes(needle) || normalizeSearch(c.displayName).includes(needle))
        .slice(0, 5);
  return { hero, suggestions, handle };
}

// ── Yeni gelenin önizlemesi ────────────────────────────────────────

/** Kullanıcı adı kuralları (roster şemasıyla aynı): 2–30 karakter; harf, rakam, ".", "_", "-". */
export function isValidHandle(handle: string): boolean {
  return /^[A-Za-z0-9._-]{2,30}$/.test(cleanHandle(handle));
}

/**
 * Henüz obada olmayan birinin başlangıç karakteri: ana platform sınıfı belirler, takip edilen her ek
 * platform nadirliği ve rozeti etkiler. Yeni yoldaşlar takımadanın ortasındaki Kutada'da, Kut Kapısı'nın önünde başlar.
 */
export function previewNewcomer(handle: string, platforms: readonly Platform[]): Character | null {
  if (!isValidHandle(handle) || platforms.length === 0) return null;
  const [primary, ...linked] = platforms;
  return createStarterCharacter({
    handle,
    platform: primary,
    linkedPlatforms: linked,
    // Her yeni yoldaş Kutada'da, Kut Kapısı'nın önünde başlar.
    region: "kutada",
    coordinates: { x: LANDMARKS.kutKapisi.x, y: LANDMARKS.kutKapisi.y + 38 },
    now: new Date("2026-01-01T00:00:00Z"),
  });
}

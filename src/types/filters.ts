/**
 * FİLTRE VE GÖRÜNÜM MODELİ — haritadaki filtreler ve adres çubuğu (URL) sözleşmesi.
 *
 * Kurallar:
 *   - Gruplar arası AND: arama VE sınıf VE nadirlik VE bölge VE özel durum
 *   - Grup içinde OR: "Nadir" ve "Destansı" seçiliyse ikisinden biri olan karakterler
 *   - Özel durum filtreleri kendi aralarında AND
 */
import type { ClassId, Rarity } from './character';
import type { RegionId } from './world';

/**
 * kadro  → Ana & Yan Kadro (lider ve anlatıcı dahil, takipçi olmayan herkes)
 * coklu  → Çoklu Platform Rozetliler (cift_iz ya da oba_onculugu rozeti olanlar)
 * akin   → Aktif Bölüm Akınındakiler (season.json'daki aktif bölümün katılımcıları)
 */
export const SPECIAL_FILTER_IDS = ['kadro', 'coklu', 'akin'] as const;
export type SpecialFilterId = (typeof SPECIAL_FILTER_IDS)[number];

export interface FilterState {
  /** Kullanıcı adı, görünen ad ya da unvan içinde aranır (Türkçe karakter duyarsız). */
  query: string;
  classes: ClassId[];
  rarities: Rarity[];
  regions: RegionId[];
  special: SpecialFilterId[];
}

/** Her çağrıda yeni bir boş filtre nesnesi döner (paylaşılan dizi değiştirilmesin diye). */
export function createEmptyFilters(): FilterState {
  return { query: '', classes: [], rarities: [], regions: [], special: [] };
}

/** Haritanın iki görünümü: Three.js Dünya ve Leaflet Harita. */
export const VIEW_MODES = ['dunya', 'harita'] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

/**
 * URL parametre adları.
 * Örnek: /?q=ayaz&sinif=okyeli&nadirlik=nadir,destansi&bolge=pusluada&ozel=coklu&k=buzkalkan&gorunum=harita
 */
export const URL_PARAMS = {
  query: 'q',
  classes: 'sinif',
  rarities: 'nadirlik',
  regions: 'bolge',
  special: 'ozel',
  selected: 'k',
  view: 'gorunum',
} as const;

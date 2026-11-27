/**
 * DÜNYA MODELİ — koordinat sistemi, bölgeler ve canlı dünya durumu (public/data/world.json).
 *
 * Koordinat sistemi: 3200 × 2240 "dünya birimi".
 *   x → doğuya doğru artar (0 = en batı kıyı)
 *   y → güneye doğru artar (0 = en kuzey kıyı)
 * Three.js bu değerleri (x, z) düzleminde, Leaflet ise [-y, x] olarak okur.
 */

export const WORLD_SIZE = { width: 3200, height: 2240 } as const;

/** Dünya birimi cinsinden bir nokta. */
export interface Coordinates {
  x: number;
  y: number;
}

/** Eksen hizalı sınır kutusu (kamera odaklama ve kümeleme için). */
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Haritadaki 6 bölgenin kalıcı kimlikleri. URL'de ve JSON'da bu değerler kullanılır. */
export const REGION_IDS = [
  'akinburnu',
  'suzulkoy',
  'ayazbogazi',
  'kiragiduzu',
  'pusluada',
  'gunozu_tepesi',
  // Orta ada: yeni yoldaşlar Kut Kapısı'ndan buraya gelir (bölümü yok, hep açık).
  'kutada',
] as const;
export type RegionId = (typeof REGION_IDS)[number];

/**
 * Arazi üretimine (game/terrain.ts) ipucu veren arazi türü. İlk altısı bölgelerin, son üçü yabani adaların
 * (content/islands.ts): buzul = buzullu dağ sırtı, orman = nehirli yeşil ada, kayalik = kayalık adacıklar;
 * cayir = Kutada'nın çiçekli çayırları.
 */
export const TERRAIN_KINDS = ['liman', 'koy', 'gecit', 'yayla', 'yuksek_ada', 'tepe', 'buzul', 'orman', 'kayalik', 'cayir'] as const;
export type TerrainKind = (typeof TERRAIN_KINDS)[number];

/** Kanon bölge tanımı — src/content/regions.ts içinde doldurulur. */
export interface Region {
  id: RegionId;
  name: string;
  /** Kartlarda ve harita etiketinde görünen tek satırlık tanım. */
  tagline: string;
  description: string;
  terrain: TerrainKind;
  /** Taban yüksekliği: 0 = deniz seviyesi, 1 = adanın en yüksek noktası. */
  elevation: number;
  /** Bölge sınırının sıralı köşe noktaları (en az 3 nokta). */
  polygon: Coordinates[];
  /** Etiketin durduğu ve kameranın odaklandığı nokta. */
  center: Coordinates;
  /** Bölgenin sisten çıktığı bölüm numarası (1–12). */
  unlockEpisode: number;
  /** Başlangıç adası: hiçbir bölümün geçtiği yer değil, hep açık; yeni yoldaşlar burada başlar. */
  hub?: boolean;
}

/** world.json içindeki ek görüş halkası: henüz açılmamış bir yere kısa bir bakış. */
export interface RevealCircle {
  name: string;
  center: Coordinates;
  /** Dünya birimi cinsinden yarıçap. */
  radius: number;
}

/** Obaya Katıl sayfasındaki platform bağlantıları. Yalnızca https adresleri kabul edilir. */
export interface SocialLinks {
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
}

/**
 * Adalardaki hava: açık, hafif kar ya da tipi (yoğun, rüzgârlı kar).
 * 3D dünyada kar taneleri olarak görünür.
 */
export const WEATHERS = ['acik', 'kar', 'tipi'] as const;
export type Weather = (typeof WEATHERS)[number];

/**
 * Topluluğun ad koyabildiği yerler: fener, iskele, şenlik ocağı, obalar…
 * Kimlikler kalıcıdır; görünen ad world.json'daki `namedPlaces` listesinden gelir.
 */
export const PLACE_IDS = [
  'fener',
  'ruzgar_gulleri',
  'iskele',
  'senlik_ocagi',
  'gunozu_tapinagi',
  'pusluada_kemerleri',
  'kadim_kemer',
  'akinburnu_obasi',
  'suzulkoy_obasi',
  'pusluada_obasi',
  'burun_obasi',
  'yel_obasi',
  'agci_obasi',
  'koybasi_obasi',
  'gecit_obasi',
  'yanki_obasi',
  'kiragi_obasi',
  'yayla_obasi',
  'kemer_obasi',
  'tapinak_obasi',
  'konuk_obasi',
  'kut_kapisi',
  'bati_kemer',
  // Anıtlar (content/sites.ts → MONUMENTS)
  'ata_heykeli',
  'balbal_yolu',
  'yazitli_taslar',
  'kartal_aniti',
  'dilek_agaci',
  'uckardes_feneri',
  'batik_gemi',
  'donmus_selale',
  'yikik_kale',
  'ulu_kayin',
  'firtina_feneri',
  // Yabani adalar (content/islands.ts): takipçi ad koyana kadar "Adsız ada" görünür.
  'kartalyuva',
  'buzultac',
  'uckardes',
  'yesilsirt',
  'marti_adaciklari',
  'kalekaya',
  'kuzgunorman',
  'firtinaburnu',
] as const;
export type PlaceId = (typeof PLACE_IDS)[number];

/** Bir takipçinin (çoğu zaman en beğenilen yorumla) adını koyduğu yer. */
export interface NamedPlace {
  place: PlaceId;
  /** Yerin yeni adı, ör. "Yıldızgözü Feneri". */
  name: string;
  /** Adı koyan karakterin kimliği (roster ya da kadro). */
  namedBy: string;
}

/** Hikâyede bir kahramanın gelişi. */
export interface StoryArrival {
  /** Kahramanın kimliği (content/story.ts → ARRIVAL_ORDER). */
  id: string;
  /** ISO 8601 tarih-saat. */
  at: string;
}

/** Hikâyenin durumu: kaçıncı gün ve kimler geldi. */
export interface StoryState {
  day: number;
  arrivals: StoryArrival[];
}

/** public/data/world.json dosyasının şekli. */
export interface WorldState {
  version: 1;
  /** Ada arazisini üreten tohum; değişirse adanın şekli değişir. */
  seed: number;
  /** Sis kenarının yumuşaklığı (dünya birimi). */
  fogSoftness: number;
  /** Görünen (karartısı kalkmış) bölgeler. */
  revealedRegions: RegionId[];
  /** Görünen yabani adalar (yazılmazsa hiçbiri). */
  revealedIslands: PlaceId[];
  glimpses: RevealCircle[];
  /** Adalardaki hava (yazılmazsa "kar"). */
  weather: Weather;
  /** Topluluğun ad koyduğu yerler (yazılmazsa boş). */
  namedPlaces: NamedPlace[];
  socialLinks: SocialLinks;
  /** Destek bağlantısı; yoksa üst menüdeki "Destek" düğmesi "yakında" der (yönetim panelinden girilir). */
  supportUrl: string | null;
  /** Hikâye: gün ve gelen kahramanlar (yazılmazsa 1. gün, kimse yok). */
  story: StoryState;
  /** ISO 8601 tarih-saat, ör. "2026-11-24T18:00:00+03:00". */
  updatedAt: string;
}

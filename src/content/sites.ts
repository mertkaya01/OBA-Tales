/**
 * SABİT YERLER — haritada konumu elle seçilmiş her şey: yapılar, obalar, akın meydanları, boğaz ve göller.
 *
 * Arazi üreticisi (game/terrain.ts) bu listeyi okur: buraları kara tutar, meydan ve obaları düzler,
 * gölleri kazar, boğazı açar. 3D yerleşim (world3d/layout.ts) ve akın (world3d/living/raid.ts) da
 * konumları buradan alır. Koordinatlar dünya birimindedir (3200 × 2240, y güneye doğru artar).
 */
import { REGIONS } from "./regions";
import type { Coordinates, PlaceId, RegionId } from "../types";

// ── Yapılar ────────────────────────────────────────────────────────

/** Kırağıdüzü'ndeki büyük şenlik ocağı (çevresinde çadır halkası var). */
export const SENLIK_OCAGI: Coordinates = { x: 915, y: 1088 };

export const LANDMARKS = {
  /** Akınburnu'nun batı burnundaki fener. */
  fener: { x: 268, y: 1425 },
  /** Akınburnu'nda dönen rüzgâr gülleri. */
  ruzgarGulleri: [
    { x: 525, y: 1358 },
    { x: 608, y: 1493 },
  ],
  /** Günözü Tepesi'ndeki taş tapınak ve Günözü Taşı. */
  tapinak: REGIONS.gunozu_tepesi.center,
  senlikOcagi: SENLIK_OCAGI,
  /** Pusluada'nın gizemli taş kemerleri. */
  kemerler: [
    { x: 2135, y: 908 },
    { x: 2263, y: 1080 },
    { x: 2158, y: 1193 },
  ],
  /** Kadim Kemer: Pusluada'yı Kutada'ya bağlayan eski taş köprü (iki ayağı karada, ortası boğazın üstünde). */
  kadimKemer: { from: { x: 1936, y: 1080 }, to: { x: 2031, y: 1080 } },
  /** Kut Kapısı: Kutada'nın ortasındaki portal. Obaya katılan her yeni yoldaş buradan gelir. */
  kutKapisi: { x: 1600, y: 1105 },
  /** Batı Kemeri: ana adayı Kutada'ya bağlayan köprü. */
  batiKemer: { from: { x: 1170, y: 1080 }, to: { x: 1264, y: 1080 } },
} as const;

/** Anıtlar ve gizemli yapılar: hepsinin adını topluluk koyabilir (PLACE_IDS). */
export const MONUMENTS = {
  /** Kırağıdüzü'nde, asasına dayanmış dev taş ata. */
  ataHeykeli: { x: 765, y: 972 },
  /** Günözü Tapınağı'na çıkan yolun iki yanında sıra sıra küçük taş figürler (balballar). */
  balbalYolu: { from: { x: 790, y: 830 }, to: { x: 872, y: 778 } },
  /** Yeşilsırt'ta göl kıyısında runlu dikili taş halkası. */
  yazitliTaslar: { x: 2150, y: 1792 },
  /** Kartalyuva'nın ortasında kanatlarını açmış taş kartal. */
  kartalAniti: { x: 290, y: 450 },
  /** Süzülkoy'da rengârenk bezler bağlanmış yaşlı ağaç. */
  dilekAgaci: { x: 930, y: 1332 },
  /** Ahşap gözcü kuleleri: Akınburnu kıyısı ve Ayazboğazı'nın kuzey ağzı. */
  gozcuKuleleri: [
    { x: 335, y: 1335 },
    { x: 470, y: 920 },
  ],
  /** Üçkardeş'in ortanca adasındaki ikinci fener. */
  uckardesFeneri: { x: 2580, y: 805 },
  /** Martı Adacıkları'nın resifine oturmuş eski bir akın teknesi (suda). */
  batikGemi: { x: 168, y: 1312 },
  /** Kalekaya'nın tepesindeki yıkık kale. */
  yikikKale: { x: 2290, y: 225 },
  /** Kuzgunorman'ın ortasındaki ulu kayın ağacı. */
  uluKayin: { x: 760, y: 1975 },
  /** Fırtınaburnu'nun kuzey kayasındaki kırmızı-beyaz fener. */
  firtinaFeneri: { x: 2915, y: 990 },
  /** Buzultaç'ın güney yamacında donup kalmış şelale. */
  donmusSelale: { x: 1450, y: 495 },
} as const;

/** Oba: ortasında ateş kampı, çevresinde çadırlar. Takipçiler kendi bölgelerinin obalarında yaşar. */
export interface Village {
  /** Topluluğun ad koyabildiği yer kimliği (şenlik halkasının ayrı bir kimliği yok: şenlik ocağı). */
  id: PlaceId | null;
  name: string;
  region: RegionId;
  center: Coordinates;
  /** Çadır sayısı. */
  count: number;
  /** Çadırların yayıldığı yarıçap. */
  radius: number;
  /** Tuğ sancağının rengi. */
  banner: string;
  /** Yanında at ağılı var mı? */
  corral: boolean;
}

export const VILLAGES: readonly Village[] = [
  { id: "akinburnu_obasi", name: "Akınburnu obası", region: "akinburnu", center: { x: 473, y: 1455 }, count: 12, radius: 82, banner: "#c4413a", corral: true },
  { id: "burun_obasi", name: "Burun obası", region: "akinburnu", center: { x: 308, y: 1490 }, count: 6, radius: 56, banner: "#3f6f8a", corral: false },
  { id: "yel_obasi", name: "Yel obası", region: "akinburnu", center: { x: 628, y: 1388 }, count: 6, radius: 56, banner: "#d9a12a", corral: true },
  { id: "suzulkoy_obasi", name: "Süzülkoy obası", region: "suzulkoy", center: { x: 855, y: 1365 }, count: 8, radius: 60, banner: "#2a9677", corral: false },
  { id: "agci_obasi", name: "Ağcılar obası", region: "suzulkoy", center: { x: 965, y: 1452 }, count: 6, radius: 56, banner: "#3f6f8a", corral: false },
  { id: "koybasi_obasi", name: "Koybaşı obası", region: "suzulkoy", center: { x: 742, y: 1482 }, count: 6, radius: 56, banner: "#c4413a", corral: true },
  { id: "gecit_obasi", name: "Geçit obası", region: "ayazbogazi", center: { x: 432, y: 1000 }, count: 7, radius: 58, banner: "#5fb8f0", corral: false },
  { id: "yanki_obasi", name: "Yankı obası", region: "ayazbogazi", center: { x: 560, y: 1206 }, count: 6, radius: 56, banner: "#6a43b8", corral: true },
  { id: null, name: "Şenlik halkası", region: "kiragiduzu", center: SENLIK_OCAGI, count: 8, radius: 48, banner: "#e2b23c", corral: false },
  { id: "kiragi_obasi", name: "Kırağı obası", region: "kiragiduzu", center: { x: 785, y: 1140 }, count: 7, radius: 58, banner: "#dfeef2", corral: true },
  { id: "yayla_obasi", name: "Yayla obası", region: "kiragiduzu", center: { x: 1085, y: 1000 }, count: 7, radius: 58, banner: "#2a9677", corral: true },
  { id: "pusluada_obasi", name: "Pusluada obası", region: "pusluada", center: { x: 2203, y: 1035 }, count: 6, radius: 51, banner: "#8a8f9a", corral: false },
  { id: "kemer_obasi", name: "Kemeraltı obası", region: "pusluada", center: { x: 2237, y: 1160 }, count: 5, radius: 51, banner: "#6a43b8", corral: false },
  { id: "konuk_obasi", name: "Konuk obası", region: "kutada", center: { x: 1490, y: 1210 }, count: 8, radius: 58, banner: "#e2b23c", corral: true },
  { id: "tapinak_obasi", name: "Tapınak obası", region: "gunozu_tepesi", center: { x: 1030, y: 805 }, count: 6, radius: 56, banner: "#e2b23c", corral: false },
];

// ── Oba ölçüleri (çadır halkası) ───────────────────────────────────

/** Oba çadırlarının boyu (karakterler 1,8 kat iri; obalar uzaktan da dolgun görünsün diye çadırlar 2,5 kat). */
export const YURT_SIZE = 2.5;
/** Boyu 1 olan çadırın tabandaki yarıçapı (dünya birimi). */
export const YURT_FOOT = 3.6;
/** Komşu iki çadırın duvarları arasında kalan en az boşluk (gezinenler buradan geçer). */
const YURT_GAP = 10;
/** Çadır halkasının en küçük yarıçapı: içteki avluda ateş, kazan, odun ve oturaklara yer kalsın. */
const MIN_RING = 38;

/**
 * Bir obanın çadır halkasının yarıçapı: komşu çadırlar arasında YURT_GAP kalacak kadar geniş, en az MIN_RING,
 * en çok obanın kendi yarıçapı. Şenlik halkası kendi yarıçapındadır (ocağın çevresindeki büyük halka).
 */
export function ringRadius(village: Village): number {
  if (village.center === SENLIK_OCAGI) return village.radius;
  const foot = YURT_FOOT * YURT_SIZE;
  const needed = (2 * foot + YURT_GAP) / (2 * Math.sin(Math.PI / village.count));
  return Math.min(village.radius - foot + 4, Math.max(MIN_RING, Math.ceil(needed)));
}

/** Patikaların bittiği yer: çadır halkasının hemen dışı (yol obanın kapısına gelir, çadırların arasına girmez). */
export function trailStop(village: Village): number {
  return ringRadius(village) + YURT_FOOT * YURT_SIZE + 10;
}

// ── Akın meydanları ────────────────────────────────────────────────

export interface RaidGround {
  /** Saf düzeninin ortası. */
  square: Coordinates;
  /** Akıncıların baktığı nokta; boss burada durur. */
  focus: Coordinates;
}

/** Bölgelerin akın meydanları: düz, ağaçsız ve nehirsiz (terrain.test.ts ve layout.test.ts doğrular). */
export const RAID_GROUNDS: Readonly<Record<RegionId, RaidGround>> = {
  akinburnu: { square: { x: 450, y: 1329 }, focus: { x: 450, y: 1263 } },
  suzulkoy: { square: { x: 852, y: 1473 }, focus: { x: 852, y: 1413 } },
  ayazbogazi: { square: { x: 504, y: 1089 }, focus: { x: 504, y: 1020 } },
  kiragiduzu: { square: { x: 918, y: 993 }, focus: { x: 918, y: 924 } },
  pusluada: { square: { x: 2213, y: 933 }, focus: { x: 2213, y: 867 } },
  gunozu_tepesi: { square: { x: 750, y: 810 }, focus: { x: 828, y: 786 } },
  // Kutada'da akın olmaz; meydan, yeni yoldaşların toplanıp ilk saflarını denediği yerdir.
  kutada: { square: { x: 1745, y: 1190 }, focus: { x: 1745, y: 1128 } },
};

// ── Arazi şekillendirme ────────────────────────────────────────────

/** Elle açılan su yolları: genişlik suyun en dar yeridir. Kıyı bu çizginin yakınında dalgalanmaz. */
export interface Channel {
  from: Coordinates;
  to: Coordinates;
  width: number;
}

export const CHANNELS: readonly Channel[] = [
  // Kutada'nın iki yanındaki boğazlar: batıda Batı Kemeri, doğuda Kadim Kemer üzerinden geçilir.
  { from: { x: 1217, y: 890 }, to: { x: 1217, y: 1270 }, width: 24 },
  { from: { x: 1984, y: 890 }, to: { x: 1984, y: 1270 }, width: 24 },
];

/** Göl çukurları: arazi buralarda kazılır, nehirler gölü doldurup taşar. */
export interface Basin {
  name: string;
  center: Coordinates;
  radius: number;
  /** Kazılan derinlik (yükseklik birimi, 0–1). */
  depth: number;
}

export const BASINS: readonly Basin[] = [
  { name: "Ayna Göl (Kırağıdüzü, donmuş)", center: { x: 1075, y: 1130 }, radius: 42, depth: 0.07 },
  { name: "Yeşilsırt gölü", center: { x: 2050, y: 1750 }, radius: 52, depth: 0.07 },
];

/** Yelkenlilerin dolaştığı deniz yolları (elips): açık suda kalır (layout.test.ts doğrular). */
export interface SeaRoute {
  center: Coordinates;
  rx: number;
  ry: number;
  boats: number;
  /** Açısal hız (radyan / saniye); eksi değer ters yön. */
  speed: number;
}

export const SEA_ROUTES: readonly SeaRoute[] = [
  // Kuzey denizi: Buzultaç, Kalekaya ve Kutada arası
  { center: { x: 1800, y: 655 }, rx: 190, ry: 55, boats: 2, speed: 0.022 },
  // Güney denizi: Süzülkoy, Kutada, Yeşilsırt ve Kuzgunorman arası
  { center: { x: 1350, y: 1640 }, rx: 270, ry: 70, boats: 2, speed: -0.018 },
  // Doğu boğazı: Üçkardeş ile Fırtınaburnu arası
  { center: { x: 2725, y: 1300 }, rx: 42, ry: 150, boats: 1, speed: 0.03 },
  // Batı açıkları: Kartalyuva ile Martı Adacıkları arası
  { center: { x: 125, y: 770 }, rx: 50, ry: 140, boats: 1, speed: -0.03 },
];

/** Daire şeklinde bir alan. */
export interface Site {
  center: Coordinates;
  radius: number;
  /** Düzlemenin tam güçte sürdüğü iç yarıçap (yoksa yarıçapın %35'i); dışında kenara doğru yumuşakça azalır. */
  plateau?: number;
}

/** Obanın düz alanı: çadır halkasının dış kenarına kadar tam düz, sonra en az 18 birimlik yumuşak kenar. */
function villageSite(v: Village): Site {
  const plateau = ringRadius(v) + YURT_FOOT * YURT_SIZE + 2;
  return { center: v.center, radius: Math.max(v.radius + 16, plateau + 18), plateau };
}

/** Düzlenen alanlar: saflar, çadırlar ve tapınak düz zemine otursun. */
export const FLAT_SITES: readonly Site[] = [
  ...Object.values(RAID_GROUNDS).flatMap((g) => [
    { center: g.square, radius: 48 },
    { center: g.focus, radius: 22 },
  ]),
  ...VILLAGES.map(villageSite),
  { center: LANDMARKS.tapinak, radius: 36 },
  { center: MONUMENTS.ataHeykeli, radius: 16 },
  { center: LANDMARKS.kutKapisi, radius: 92 },
];

/** Her zaman kara kalan alanlar: düzlenen yerler ve kıyıya yakın yapılar. */
export const LAND_SITES: readonly Site[] = [
  ...FLAT_SITES,
  { center: LANDMARKS.fener, radius: 14 },
  ...LANDMARKS.ruzgarGulleri.map((p) => ({ center: p, radius: 10 })),
  ...LANDMARKS.kemerler.map((p) => ({ center: p, radius: 12 })),
  { center: LANDMARKS.kadimKemer.from, radius: 8 },
  { center: LANDMARKS.kadimKemer.to, radius: 8 },
  { center: LANDMARKS.batiKemer.from, radius: 8 },
  { center: LANDMARKS.batiKemer.to, radius: 8 },
  { center: MONUMENTS.ataHeykeli, radius: 14 },
  { center: MONUMENTS.yazitliTaslar, radius: 14 },
  { center: MONUMENTS.kartalAniti, radius: 10 },
  { center: MONUMENTS.dilekAgaci, radius: 10 },
  ...MONUMENTS.gozcuKuleleri.map((p) => ({ center: p, radius: 8 })),
  { center: MONUMENTS.uckardesFeneri, radius: 10 },
  { center: MONUMENTS.donmusSelale, radius: 12 },
  { center: MONUMENTS.yikikKale, radius: 18 },
  { center: MONUMENTS.uluKayin, radius: 12 },
  { center: MONUMENTS.firtinaFeneri, radius: 10 },
];

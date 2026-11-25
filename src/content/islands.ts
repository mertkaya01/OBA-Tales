/**
 * YABANİ ADALAR — obaların henüz yerleşmediği, haritanın kenarlarındaki adalar.
 *
 *   · Kimse yaşamaz, sis örtmez; her birinde tek bir gizemli yapı durur (anıt, fener, batık gemi…).
 *   · Adlarını topluluk koyar: world.json → namedPlaces içinde adanın kimliğiyle ad verilene kadar
 *     haritada "Adsız ada" yazar. `nickname`, haritacıların ona şimdilik verdiği addır.
 *   · Arazi türü (terrain) yükseklik ve renkleri belirler; ridgeAngle dağ sırtlarının uzandığı yöndür.
 */
import type { Coordinates, PlaceId, TerrainKind } from "../types";

export const ISLAND_IDS = ["kartalyuva", "buzultac", "uckardes", "yesilsirt", "marti_adaciklari", "kalekaya", "kuzgunorman", "firtinaburnu"] as const satisfies readonly PlaceId[];
export type IslandId = (typeof ISLAND_IDS)[number];

export interface Island {
  id: IslandId;
  /** Haritacıların geçici adı (topluluk gerçek adını koyana kadar). */
  nickname: string;
  /** Kartlarda ve etikette görünen kısa tanım. */
  tagline: string;
  terrain: TerrainKind;
  /** Taban yüksekliği (0–1). */
  elevation: number;
  /** Dağ sırtlarının uzandığı yön (radyan; 0 = doğu-batı, π/2 = kuzey-güney). */
  ridgeAngle: number;
  /** Bir ya da birkaç kara parçası (adacık grupları birden çok poligonla çizilir). */
  polygons: readonly (readonly Coordinates[])[];
  /** Etiketin durduğu yer (adanın üstünde ya da hemen açığında). */
  label: Coordinates;
}

export const ISLANDS: Readonly<Record<IslandId, Island>> = {
  kartalyuva: {
    id: "kartalyuva",
    nickname: "Kartalyuva",
    tagline: "Yalçın yalıların üstünde kartalların yuvalandığı kuzeybatı adası",
    terrain: "yuksek_ada",
    elevation: 0.6,
    ridgeAngle: 0.15,
    polygons: [
      [
        { x: 110, y: 440 },
        { x: 200, y: 375 },
        { x: 330, y: 370 },
        { x: 450, y: 410 },
        { x: 470, y: 480 },
        { x: 390, y: 535 },
        { x: 250, y: 540 },
        { x: 140, y: 515 },
      ],
    ],
    label: { x: 290, y: 455 },
  },
  buzultac: {
    id: "buzultac",
    nickname: "Buzultaç",
    tagline: "Sırtı yaz kış buzla kaplı, taç gibi uzanan kuzey adası",
    terrain: "buzul",
    elevation: 0.7,
    ridgeAngle: 0.05,
    polygons: [
      [
        { x: 1080, y: 456 },
        { x: 1160, y: 388 },
        { x: 1300, y: 364 },
        { x: 1460, y: 368 },
        { x: 1600, y: 401 },
        { x: 1645, y: 466 },
        { x: 1575, y: 516 },
        { x: 1420, y: 504 },
        { x: 1285, y: 516 },
        { x: 1160, y: 521 },
      ],
    ],
    label: { x: 1360, y: 444 },
  },
  uckardes: {
    id: "uckardes",
    nickname: "Üçkardeş",
    tagline: "Pusluada'nın doğusunda sıra sıra dizilmiş üç kayalık ada",
    terrain: "kayalik",
    elevation: 0.5,
    ridgeAngle: Math.PI / 2,
    polygons: [
      [
        { x: 2465, y: 500 },
        { x: 2545, y: 470 },
        { x: 2605, y: 520 },
        { x: 2585, y: 620 },
        { x: 2515, y: 650 },
        { x: 2455, y: 590 },
      ],
      [
        { x: 2505, y: 740 },
        { x: 2595, y: 710 },
        { x: 2665, y: 780 },
        { x: 2645, y: 900 },
        { x: 2565, y: 930 },
        { x: 2495, y: 860 },
      ],
      [
        { x: 2485, y: 1000 },
        { x: 2565, y: 980 },
        { x: 2615, y: 1050 },
        { x: 2585, y: 1140 },
        { x: 2505, y: 1150 },
        { x: 2465, y: 1080 },
      ],
    ],
    label: { x: 2550, y: 820 },
  },
  yesilsirt: {
    id: "yesilsirt",
    nickname: "Yeşilsırt",
    tagline: "Nehirleri bir gölde buluşan, ormanlı büyük güneydoğu adası",
    terrain: "orman",
    elevation: 0.45,
    ridgeAngle: -0.3,
    polygons: [
      [
        { x: 1750, y: 1680 },
        { x: 1870, y: 1610 },
        { x: 2030, y: 1600 },
        { x: 2190, y: 1620 },
        { x: 2340, y: 1665 },
        { x: 2375, y: 1770 },
        { x: 2300, y: 1860 },
        { x: 2110, y: 1885 },
        { x: 1930, y: 1875 },
        { x: 1790, y: 1820 },
        { x: 1740, y: 1745 },
      ],
    ],
    label: { x: 2060, y: 1710 },
  },
  marti_adaciklari: {
    id: "marti_adaciklari",
    nickname: "Martı Adacıkları",
    tagline: "Akınburnu'nun batısında martıların konduğu küçük adacıklar ve resif",
    terrain: "kayalik",
    elevation: 0.3,
    ridgeAngle: 1.2,
    polygons: [
      [
        { x: 60, y: 1200 },
        { x: 110, y: 1180 },
        { x: 140, y: 1230 },
        { x: 110, y: 1280 },
        { x: 60, y: 1270 },
      ],
      [
        { x: 50, y: 1350 },
        { x: 100, y: 1330 },
        { x: 130, y: 1370 },
        { x: 100, y: 1420 },
        { x: 55, y: 1405 },
      ],
      [
        { x: 100, y: 1490 },
        { x: 150, y: 1475 },
        { x: 175, y: 1520 },
        { x: 140, y: 1560 },
        { x: 100, y: 1545 },
      ],
    ],
    label: { x: 128, y: 1375 },
  },
  kalekaya: {
    id: "kalekaya",
    nickname: "Kalekaya",
    tagline: "Kuzeydoğuda, yıkık bir kalenin taşlarıyla taçlanmış kayalık ada",
    terrain: "kayalik",
    elevation: 0.55,
    ridgeAngle: 0.2,
    polygons: [
      [
        { x: 1960, y: 230 },
        { x: 2050, y: 140 },
        { x: 2200, y: 105 },
        { x: 2380, y: 110 },
        { x: 2540, y: 150 },
        { x: 2600, y: 240 },
        { x: 2520, y: 330 },
        { x: 2350, y: 370 },
        { x: 2160, y: 380 },
        { x: 2020, y: 330 },
      ],
    ],
    label: { x: 2280, y: 300 },
  },
  kuzgunorman: {
    id: "kuzgunorman",
    nickname: "Kuzgunorman",
    tagline: "Güneybatıda, dev ağaçlarının gölgesinde kuzgunların öttüğü ormanlı ada",
    terrain: "orman",
    elevation: 0.5,
    ridgeAngle: 0.6,
    polygons: [
      [
        { x: 340, y: 1930 },
        { x: 430, y: 1830 },
        { x: 600, y: 1790 },
        { x: 800, y: 1800 },
        { x: 980, y: 1830 },
        { x: 1130, y: 1900 },
        { x: 1150, y: 2010 },
        { x: 1050, y: 2090 },
        { x: 860, y: 2110 },
        { x: 640, y: 2100 },
        { x: 450, y: 2060 },
        { x: 350, y: 2000 },
      ],
    ],
    label: { x: 740, y: 1900 },
  },
  firtinaburnu: {
    id: "firtinaburnu",
    nickname: "Fırtınaburnu",
    tagline: "En doğuda, dalgaların hiç dinmediği iki sarp kaya adası",
    terrain: "kayalik",
    elevation: 0.5,
    ridgeAngle: 1.3,
    polygons: [
      [
        { x: 2820, y: 930 },
        { x: 2900, y: 885 },
        { x: 2990, y: 920 },
        { x: 3010, y: 1040 },
        { x: 2950, y: 1110 },
        { x: 2850, y: 1090 },
        { x: 2810, y: 1010 },
      ],
      [
        { x: 2880, y: 1250 },
        { x: 2970, y: 1220 },
        { x: 3060, y: 1270 },
        { x: 3080, y: 1390 },
        { x: 3010, y: 1470 },
        { x: 2910, y: 1460 },
        { x: 2860, y: 1360 },
      ],
    ],
    label: { x: 2915, y: 1000 },
  },
};

export const ISLAND_LIST: readonly Island[] = ISLAND_IDS.map((id) => ISLANDS[id]);

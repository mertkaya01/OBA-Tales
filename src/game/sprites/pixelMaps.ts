/**
 * PİKSEL HARİTALARI — karakterler kodla çizilir, dış görsel dosyası yoktur.
 *
 * Her katman 16 sütun × 20 satırlık bir metindir. Her harf bir renk yuvasıdır;
 * "." boş (saydam) demektir. Katmanlar sırayla üst üste çizilir:
 *
 *   sınıf arka (davul, pelerin) → nadirlik arka (uzun pelerin) → gövde → saç
 *   → sınıf ön (kalkan, yay, fener) → nadirlik ön (rozet, motif, madalyon, işleme)
 *
 * Renk yuvaları (SpriteSlot):
 *   o dış çizgi   s ten        S ten gölgesi   h saç        e göz
 *   c kıyafet     C kıyafet g. f kürk          w atkı/şal   k deri/ahşap
 *   p pantolon    b çizme      m metal         M metal par. i fildişi
 *   l ışık        L parlak ış. d davul derisi  g altın      r nadirlik rengi
 *   v pelerin
 */
import type { ClassId, Rarity } from "../../types";

export const SPRITE_WIDTH = 16;
export const SPRITE_HEIGHT = 20;

export const SPRITE_SLOTS = [
  "o", "s", "S", "h", "e", "c", "C", "f", "w", "k", "p", "b", "m", "M", "i", "l", "L", "d", "g", "r", "v",
] as const;
export type SpriteSlot = (typeof SPRITE_SLOTS)[number];

/** 20 satırlık katman. */
export type PixelLayer = readonly string[];

const EMPTY_ROW = ".".repeat(SPRITE_WIDTH);

/** Yalnızca dolu satırları verilen seyrek bir katmanı 20 satıra tamamlar. */
function layer(rows: Readonly<Record<number, string>>): PixelLayer {
  return Array.from({ length: SPRITE_HEIGHT }, (_, i) => rows[i] ?? EMPTY_ROW);
}

// ── Gövde ──────────────────────────────────────────────────────────

export const BODY: PixelLayer = [
  "................",
  ".....oooooo.....",
  "....ohhhhhho....",
  "...ohhhhhhhho...",
  "...ohhsssshho...",
  "...ohsessesho...",
  "...osssssssso...",
  "....ossSSsso....",
  "...owwwwwwwwo...",
  "..offccccccffo..",
  "..oCccccccccCo..",
  "..oCccccccccCo..",
  "..osckkkkkkcso..",
  "...occcccccco...",
  "...oCccooccCo...",
  "....oppooppo....",
  "....oppooppo....",
  "....obboobbo....",
  "...obbboobbbo...",
  "...oooooooooo...",
];

// ── Saç modelleri ──────────────────────────────────────────────────

export const HAIR_STYLES = ["kisa", "uzun", "topuz"] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

export const HAIR_LAYERS: Readonly<Record<HairStyle, PixelLayer>> = {
  kisa: layer({}),
  uzun: layer({
    5: "..h..........h..",
    6: "..h..........h..",
    7: "..h..........h..",
    8: "..h..........h..",
  }),
  topuz: layer({
    0: "......ohho......",
  }),
};

// ── Sınıf ekipmanı ─────────────────────────────────────────────────

export interface GearLayers {
  back: PixelLayer;
  front: PixelLayer;
}

export const CLASS_LAYERS: Readonly<Record<ClassId, GearLayers>> = {
  /** Kalkaneri: omuzda pirinç kalkan, sağ elde buz baltası, sarkan kalın atkı. */
  kalkaneri: {
    back: layer({}),
    front: layer({
      6: ".............oo.",
      7: "............oMmo",
      8: "............omko",
      9: ".ooo.....ww...k.",
      10: "ommmo....w....k.",
      11: "omMmo.........k.",
      12: "ommmo.........k.",
      13: ".ooo............",
    }),
  },
  /** Okyeli: tüylü başlık, alında kar gözlüğü, deri omuzluk, sol elde fildişi yay. */
  okyeli: {
    back: layer({}),
    front: layer({
      0: "............iw..",
      1: "...........iw...",
      2: ".....cccccci....",
      3: "....cmMmmMmc....",
      4: "....cc....cc....",
      7: ".i..............",
      8: "il..............",
      9: "il.kk......kk...",
      10: "il..............",
      11: "il..............",
      12: "il..............",
      13: "il..............",
      14: ".i..............",
    }),
  },
  /** Ocakcan: sırtta oba davulu, yumuşak pelerin, sağ elde sıcak fener. */
  ocakcan: {
    back: layer({
      6: ".okko...........",
      7: "okddko..........",
      8: "okddko..........",
      9: ".okkovvvvvvvvvv.",
      10: ".vvvvvvvvvvvvvv.",
      11: ".vvvvvvvvvvvvvv.",
      12: ".vvvvvvvvvvvvvv.",
      13: ".vvvvvvvvvvvvvv.",
      14: ".vvvvvvvvvvvvvv.",
      15: "..vvvvvvvvvvvv..",
    }),
    front: layer({
      11: ".............oko",
      12: ".............olo",
      13: ".............oLo",
      14: ".............ooo",
    }),
  },
};

// ── Nadirlik süsleri ───────────────────────────────────────────────

const LONG_CAPE = layer({
  9: ".vvvvvvvvvvvvvv.",
  10: ".vvvvvvvvvvvvvv.",
  11: ".vvvvvvvvvvvvvv.",
  12: ".vvvvvvvvvvvvvv.",
  13: ".vvvvvvvvvvvvvv.",
  14: ".vvvvvvvvvvvvvv.",
  15: ".vvvvvvvvvvvvvv.",
  16: ".vvvvvvvvvvvvvv.",
  17: "..vvvvvvvvvvvv..",
  18: "..vvvvvvvvvvvv..",
});

const GOLD_EDGED_CAPE = layer({
  9: ".gvvvvvvvvvvvvg.",
  10: ".gvvvvvvvvvvvvg.",
  11: ".gvvvvvvvvvvvvg.",
  12: ".gvvvvvvvvvvvvg.",
  13: ".gvvvvvvvvvvvvg.",
  14: ".gvvvvvvvvvvvvg.",
  15: ".gvvvvvvvvvvvvg.",
  16: ".gvvvvvvvvvvvvg.",
  17: "..gvvvvvvvvvvg..",
  18: "..gggggggggggg..",
});

/** Göksel pelerin: gece mavisi, yıldız ışığı kenarlı, üstünde parlayan yıldızlar. */
const STAR_CAPE = layer({
  9: ".wvvvLvvvvvvvvw.",
  10: ".wvvvvvvvLvvvvw.",
  11: ".wvLvvvvvvvvvvw.",
  12: ".wvvvvvLvvvvvvw.",
  13: ".wvvvvvvvvvLvvw.",
  14: ".wvvLvvvvvvvvvw.",
  15: ".wvvvvvvLvvvvvw.",
  16: ".wvvvvvvvvvvLvw.",
  17: "..wvvLvvvvvvw...",
  18: "..wwwwwwwwwwww..",
});

export const RARITY_LAYERS: Readonly<Record<Rarity, GearLayers>> = {
  /** Sıradan: göğüste tek küçük rozet. */
  siradan: {
    back: layer({}),
    front: layer({ 10: ".....r.........." }),
  },
  /** Nadir: kıyafette oba motifleri (atkı da nadirlik rengini alır). */
  nadir: {
    back: layer({}),
    front: layer({
      11: ".....r.rr.r.....",
      13: "......r..r......",
    }),
  },
  /** Destansı: uzun pelerin, altın madalyon, parlak metal kenarlar. */
  destansi: {
    back: LONG_CAPE,
    front: layer({
      10: ".......gg.......",
      11: ".....r.gg.r.....",
      13: "...g........g...",
    }),
  },
  /** Efsanevi: altın kenarlı pelerin, altın-gümüş işlemeler, başta parlayan kadim tüy. */
  efsanevi: {
    back: GOLD_EDGED_CAPE,
    front: layer({
      0: "...l............",
      1: "....l...........",
      2: "...L............",
      10: "....g..gg..g....",
      11: "....M..gg..M....",
      12: ".......gg.......",
      13: "...g.g....g.g...",
    }),
  },
  /** Ulu: göğüste güneş amblemi, başının iki yanında parıltı. Yalnızca özel kahramanlar. */
  ulu: {
    back: layer({}),
    front: layer({
      0: "..l..........l..",
      1: ".l............l.",
      10: ".....g.gg.g.....",
      11: "......gLLg......",
      12: ".....g.gg.g.....",
      13: "...g........g...",
    }),
  },
  /** Göksel: yıldızlı gece pelerini, göğüste yıldız ışığı, başında süzülen yıldızlar. En yüksek kademe. */
  goksel: {
    back: STAR_CAPE,
    front: layer({
      0: "..L..........L..",
      1: "...........L....",
      10: "....w..LL..w....",
      11: "....M.LLLL.M....",
      12: ".......LL.......",
      13: "...w.w....w.w...",
    }),
  },
};

// ── Özel kahramanlar ───────────────────────────────────────────────

/**
 * Özel kahramanların sınıf ekipmanı yerine kendi katmanları (kimliğe göre).
 *   egetunce   mor kova şapka (iki iri göz), sakal, sol elde lavanta, sağda uzun sarı-beyaz Gün Kılıcı
 *              (m/M şapka moru, i ak, l gün sarısı, f sakal, d lavanta, v sap yeşili)
 *   mhellingtr beyaz kapüşon, gölgede parlayan gözler, yıldızlı altın hale, kristal oklu okluk, beyaz-altın Yıldız Yayı
 *   bintas     alev taç, omuzların arkasından taşan alev kanatlar, kaldırdığı elde ateş küresi, eteğinde alevler
 *              (l alev, L kor sarısı, v kanat kızılı, g altın)
 */
export const HERO_LAYERS: Readonly<Record<string, GearLayers>> = {
  egetunce: {
    back: layer({}),
    front: layer({
      0: ".....oooooo.....",
      1: "....oMmmmmmMo.i.",
      2: "....omiommiomoil",
      3: "..ommmmmmmmmmoil",
      4: "..............il",
      5: "..............il",
      6: "...of......fo.il",
      7: ".d..offffffo..il",
      8: "d.d...........il",
      9: "dd............il",
      10: ".v............il",
      11: ".v............il",
      12: "vv............il",
      13: "............gggg",
      14: "..............k.",
      15: "..............g.",
    }),
  },
  mhellingtr: {
    back: layer({
      3: "............L.L.",
      4: "............LLL.",
      5: "............kgk.",
      6: "............kkk.",
      7: "............kgk.",
      8: "...........kkk..",
      9: "...........kk...",
    }),
    front: layer({
      0: "....g.gLLg.g....",
      1: ".....mmmmmm.....",
      2: "....mmmmmmmm....",
      3: "...mmmmmmmmmm...",
      4: "...mm......mm...",
      5: "...mm.L..L.mm...",
      6: "g..mm......mm...",
      7: "mL.mmm....mmm...",
      8: "mL..............",
      9: "mL.MM......MM...",
      10: "mL..............",
      11: "mL..............",
      12: "mL..gggggggg....",
      13: "mL..............",
      14: "mL..............",
      15: "g...............",
    }),
  },
  bintas: {
    back: layer({}),
    front: layer({
      0: "...l.L.LL.L.l...",
      1: "....gLgllgLg....",
      4: "l..............l",
      5: "vl............lv",
      6: "vvl..........lvv",
      7: "lvvl........lvvl",
      8: ".lvv........vvl.",
      9: "..l..........lL.",
      10: ".............LLl",
      11: "..............l.",
      13: "...l........l...",
      14: "..l.l......l.l..",
    }),
  },
};

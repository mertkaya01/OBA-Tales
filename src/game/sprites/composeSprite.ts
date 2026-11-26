/**
 * SPRITE BİRLEŞTİRİCİ — bir karakteri 16×20 piksellik RGBA görüntüye çevirir.
 *
 * Renkler karakterin kimliğinden türetilen tohumla seçilir: aynı takipçi her yerde aynı görünür,
 * farklı takipçiler farklı ten, saç, kıyafet ve saç modeline sahip olur.
 * Kadro üyelerinin kendine özgü renkleri CAST_LOOKS içinde sabittir.
 */
import type { Character } from "../../types";
import { createRng, seedFrom } from "../../lib/random";
import {
  BASE_COLORS,
  CAPE_COLORS,
  CLASS_CLOTH,
  CLASS_METAL,
  HAIR_COLORS,
  RARITY_COLORS,
  SCARF_COLORS,
  SKIN_TONES,
  hexToRgba,
  type Rgba,
} from "../palette";
import {
  BODY,
  CLASS_LAYERS,
  HERO_LAYERS,
  HAIR_LAYERS,
  HAIR_STYLES,
  RARITY_LAYERS,
  SPRITE_HEIGHT,
  SPRITE_WIDTH,
  type HairStyle,
  type PixelLayer,
  type SpriteSlot,
} from "./pixelMaps";

export interface Sprite {
  width: number;
  height: number;
  /** RGBA, satır satır, üst satır önce. */
  data: Uint8ClampedArray<ArrayBuffer>;
}

export type SpriteColors = Record<SpriteSlot, string>;

export interface SpriteLook {
  colors: SpriteColors;
  hair: HairStyle;
}

interface LookOverride {
  colors?: Partial<SpriteColors>;
  hair?: HairStyle;
}

/** Kadronun hikâyedeki görünüşüne uygun sabit renkler. */
const CAST_LOOKS: Readonly<Record<string, LookOverride>> = {
  baturay: { colors: { c: "#2a3f6b", C: "#1e2e50", w: "#c4413a", h: "#2b1d16" }, hair: "kisa" },
  dede_toygar: { colors: { c: "#6b4a8a", C: "#50376a", h: "#e8e2d5", w: "#e8a83c" }, hair: "uzun" },
  alptug: { colors: { c: "#7a4a2a", C: "#5a351e", w: "#b89c6c", h: "#4a2e1c" }, hair: "kisa" },
  suheyla: { colors: { c: "#3f6f8a", C: "#2e5268", w: "#efe6d4", h: "#2b1d16" }, hair: "uzun" },
  kursat: { colors: { c: "#a8642e", C: "#824b21", w: "#7fbf6a", h: "#7a4a26" }, hair: "topuz" },
  yalvac: { colors: { c: "#d0603a", C: "#a8482a", h: "#8a2f2a" }, hair: "uzun" },
  isikay: { colors: { c: "#9cc7e6", C: "#6fa3c8", h: "#e8e2d5" }, hair: "uzun" },
  // Özel kahramanlar: egetunce siyah tişört-şort, mor kova şapka, sarı saç; mhellingtr buğday ten (SKIN_TONES ikinci ton),
  // beyaz kapüşon, kahverengi saç, altın hale.
  egetunce: {
    colors: { s: "#f1c9a2", S: "#d9a67c", c: "#1e1c24", C: "#141218", p: "#1e1c24", b: "#efeee9", h: "#e8c55c", f: "#b8893a", m: "#5a2e94", M: "#7c4cc0", i: "#ffffff", l: "#ffe680", L: "#fff6c0", g: "#ffd23f", d: "#9a7fd6", v: "#4f8a3c", k: "#6b4a2a" },
    hair: "uzun",
  },
  mhellingtr: {
    colors: { s: "#eebd94", S: "#d39a6f", c: "#1a2150", C: "#121738", p: "#161b3c", b: "#1d2142", h: "#4a2e1c", m: "#e8ebf6", M: "#ffffff", g: "#f2c84b", i: "#f4f1e6", l: "#7fd8ff", L: "#d9f6ff", v: "#1b2766", k: "#2a2440", w: "#f2c84b" },
    hair: "kisa",
  },
  // BinTaş: kırmızı-altın elbise, koyu kızıl saç, alev rengi parıltılar.
  bintas: {
    colors: { s: "#db8b67", S: "#be6a4e", c: "#b4211c", C: "#7a1515", p: "#392322", b: "#1e171b", h: "#4f1012", k: "#1e171b", g: "#edbd45", m: "#edbd45", M: "#ffdb57", l: "#f65612", L: "#ffdb57", v: "#961f19", i: "#fff7df" },
    hair: "uzun",
  },
};

/** Karakterin renklerini ve saç modelini belirler. */
export function resolveLook(character: Character): SpriteLook {
  const rng = createRng(seedFrom("sprite", character.id));
  const [skin, skinShadow] = rng.pick(SKIN_TONES);
  const hair = rng.pick(HAIR_COLORS);
  const [cloth, clothShadow] = rng.pick(CLASS_CLOTH[character.class.id]);
  const scarf = rng.pick(SCARF_COLORS);
  const hairStyle = rng.pick(HAIR_STYLES);
  const [metal, metalBright] = CLASS_METAL[character.class.id];

  const colors: SpriteColors = {
    o: BASE_COLORS.outline,
    e: BASE_COLORS.eye,
    s: skin,
    S: skinShadow,
    h: hair,
    c: cloth,
    C: clothShadow,
    f: BASE_COLORS.fur,
    // Nadir ve üstünde atkı/şal nadirlik rengini alır: haritada uzaktan bile ayırt edilir.
    w: character.rarity === "siradan" ? scarf : RARITY_COLORS[character.rarity],
    k: BASE_COLORS.leather,
    p: BASE_COLORS.pants,
    b: BASE_COLORS.boots,
    m: metal,
    M: metalBright,
    i: BASE_COLORS.ivory,
    l: BASE_COLORS.glow,
    L: BASE_COLORS.glowBright,
    d: BASE_COLORS.drumSkin,
    g: BASE_COLORS.gold,
    r: RARITY_COLORS[character.rarity],
    v: CAPE_COLORS[character.rarity],
  };

  const override = CAST_LOOKS[character.id];
  if (override && character.roleType !== "follower") {
    Object.assign(colors, override.colors);
    // Kadroda da atkı nadirlik rengini korusun (yalnızca sıradan değilse).
    if (character.rarity !== "siradan" && !override.colors?.w) colors.w = RARITY_COLORS[character.rarity];
    return { colors, hair: override.hair ?? hairStyle };
  }
  return { colors, hair: hairStyle };
}

/** Katmanların çizim sırası. */
export function spriteLayers(character: Character, hair: HairStyle): PixelLayer[] {
  // Özel kahramanlar sınıf ekipmanı yerine kendi katmanlarını giyer.
  const gear = (character.roleType !== "follower" && HERO_LAYERS[character.id]) || CLASS_LAYERS[character.class.id];
  const trim = RARITY_LAYERS[character.rarity];
  return [gear.back, trim.back, BODY, HAIR_LAYERS[hair], gear.front, trim.front];
}

const rgbaCache = new Map<string, Rgba>();
function toRgba(hex: string): Rgba {
  let rgba = rgbaCache.get(hex);
  if (!rgba) {
    rgba = hexToRgba(hex);
    rgbaCache.set(hex, rgba);
  }
  return rgba;
}

export function composeSprite(character: Character): Sprite {
  const { colors, hair } = resolveLook(character);
  const data = new Uint8ClampedArray(SPRITE_WIDTH * SPRITE_HEIGHT * 4);

  for (const pixelLayer of spriteLayers(character, hair)) {
    for (let y = 0; y < SPRITE_HEIGHT; y++) {
      const row = pixelLayer[y];
      for (let x = 0; x < SPRITE_WIDTH; x++) {
        const slot = row[x];
        if (slot === ".") continue;
        const [r, g, b, a] = toRgba(colors[slot as SpriteSlot]);
        const offset = (y * SPRITE_WIDTH + x) * 4;
        data[offset] = r;
        data[offset + 1] = g;
        data[offset + 2] = b;
        data[offset + 3] = a;
      }
    }
  }
  return { width: SPRITE_WIDTH, height: SPRITE_HEIGHT, data };
}

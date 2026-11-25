/**
 * EFEKT KATALOĞU — OBA-Tales dünyasında olan şey → oynayacak pixelfx efekti.
 *
 *   Portre auraları   alev → ruh alevi (ateş renginde) · ışık → hale · efsanevi → arkada dönen güneş
 *                     destansı → mor hale · nadir → zümrüt ateşböcekleri · sıradan → hafif kar
 *   Sınıf yetenekleri Kalkaneri → Kalkan Duvarı · Okyeli → Buz Oku · Ocakcan → Ocak Çayı
 *   Boss akınları     her boss'un gökyüzü, ortam efektleri, saldırıları ve zayıf noktası (bosses.ts ile aynı)
 *
 * Renkler OBA-Tales paletinden; efektlerin kendisi src/vendor/pixelfx içinde, değiştirilmeden durur.
 */
import { RARITIES } from "../../types";
import type { BossId, Character, ClassId } from "../../types";
import type { EffectId } from "../../vendor/pixelfx/effects.js";
import type { PlayOptions } from "./PixelFxPlayer";

export interface FxRecipe {
  id: EffectId;
  options?: PlayOptions;
  /**
   * auto: efektin kendi arka/ön parçaları karakterin arkasına ve önüne · back: hepsi arkada · front: hepsi önde
   */
  layer?: "auto" | "back" | "front";
}

// ── OBA-Tales rampaları (koyudan açığa) ─────────────────────────────

export const RAMPS = {
  ates: ["#4a1712", "#8a1f17", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"],
  isik: ["#1b2a4a", "#3f5f8f", "#7fa8d8", "#b8dcf6", "#d6f1ff", "#eef9ff", "#ffffff", "#ffffff"],
  destansi: ["#1a0f2e", "#341c5c", "#55308e", "#7a4cc0", "#9566e0", "#bb98f2", "#e2d4ff", "#ffffff"],
  efsanevi: ["#3a1208", "#7a2410", "#c03c18", "#f0642f", "#ff9a4a", "#ffc970", "#ffe9b0", "#ffffff"],
  zumrut: ["#0b2a20", "#145a42", "#24906a", "#34b08b", "#8ae6c0", "#ffffff"],
  gunozu: ["#3b2a08", "#7a5612", "#b8861c", "#e2a52a", "#f6d36f", "#fbe7a6", "#fff8e0", "#ffffff"],
} as const;

// ── Canlı portre ───────────────────────────────────────────────────

/** Portrede karakterin ayaklarının yeri ve tuval boyu (piksel). Sprite 2 kat büyütülür: 32 × 40. */
export const PORTRAIT = { width: 88, height: 96, feetX: 44, feetY: 88, spriteScale: 2 } as const;

/** Karakterin sürekli auraları (döngüler). */
export function portraitAuras(c: Character): FxRecipe[] {
  const { feetX: x, feetY: y } = PORTRAIT;
  const out: FxRecipe[] = [];
  if (c.rarity === "efsanevi") {
    out.push({ id: "holy/sunburst", options: { x, y: y - 26, palette: RAMPS.efsanevi, light: 0.75 }, layer: "back" });
  }
  if (c.elementAura === "alev") {
    out.push({ id: "fire/spirit-flame", options: { x, y: y + 2, palette: RAMPS.ates, light: 0.9 }, layer: "back" });
  }
  if (c.elementAura === "isik") {
    out.push({ id: "holy/halo", options: { x, y, palette: RAMPS.isik } });
  } else if (c.rarity === "destansi") {
    out.push({ id: "holy/halo", options: { x, y, palette: RAMPS.destansi } });
  }
  if (c.rarity === "nadir") out.push({ id: "weather/fireflies", options: { x, y: y + 2, palette: RAMPS.zumrut } });
  if (c.rarity === "siradan" && !c.elementAura) out.push({ id: "weather/snow", options: { x, y: y + 2 } });
  return out;
}

/** Portreye dokununca: sınıfın imza yeteneği (tek seferlik). */
export function classSkill(classId: ClassId, at: { x: number; y: number }): FxRecipe[] {
  switch (classId) {
    case "kalkaneri":
      return [{ id: "impacts/shield-block", options: { x: at.x, y: at.y } }];
    case "okyeli":
      return [
        {
          id: "projectiles/arrow",
          options: { x: at.x - 70, y: at.y - 22, velocity: { x: 280, y: 0 }, lifetime: 0.55, palette: ["#2a4a6a", "#3f8cc4", "#e8e2d5", "#ffffff"] },
          layer: "front",
        },
      ];
    case "ocakcan":
      return [{ id: "holy/heal", options: { x: at.x, y: at.y, palette: RAMPS.gunozu } }];
  }
}

export const CLASS_SKILL_NAMES: Readonly<Record<ClassId, string>> = {
  kalkaneri: "Kalkan Duvarı",
  okyeli: "Buz Oku",
  ocakcan: "Ocak Çayı",
};

// ── Boss akını sahneleri ───────────────────────────────────────────

/** Akın sahnesinin boyu (piksel), zeminin çizgisi, boss'un ve ocağın yeri. */
export const RAID_STAGE = { width: 320, height: 180, groundY: 150, bossX: 242, campfireX: 92 } as const;

export type SkyKind = "kutup" | "alacakaranlik" | "tutulma";
export type GroundKind = "kar" | "deniz" | "tas";

/**
 * Efektin yerleştiği nokta:
 *   sahne → tuvalde mutlak (dx, dy) · boss → boss'un ayakları · cekirdek → boss'un zayıf noktası
 *   ocak → obanın kamp ateşi · oba → obadan rastgele birinin ayakları
 */
export type FxAnchor = "sahne" | "boss" | "cekirdek" | "ocak" | "oba";

export interface AnchoredFx extends FxRecipe {
  at: FxAnchor;
  dx?: number;
  dy?: number;
}

export interface BossScene {
  sky: SkyKind;
  ground: GroundKind;
  /** Sürekli oynayan ortam efektleri. */
  ambient: AnchoredFx[];
  /** Boss'un sırayla yaptığı (çocuk dostu) saldırılar. */
  attacks: AnchoredFx[];
  /** Zayıf noktası: Ocakcan düğmesi bunu oynatır (bosses.ts ile aynı). */
  weakness: { label: string; hint: string; fx: AnchoredFx[] };
}

const { width: W, groundY: G } = RAID_STAGE;

export const BOSS_SCENES: Readonly<Record<BossId, BossScene>> = {
  buzkiran_tekgoz: {
    sky: "kutup",
    ground: "kar",
    ambient: [
      { id: "weather/aurora", at: "sahne", dx: W / 2, dy: 180, options: { light: 0.8 }, layer: "back" },
      { id: "ice/ice-crystal", at: "boss", dx: 48, dy: -46, options: { light: 0.8 }, layer: "back" },
      { id: "weather/snow", at: "sahne", dx: W / 2, dy: G + 20, layer: "front" },
    ],
    attacks: [
      // Geçide buz kütlesi yuvarlar; öndeki Kalkaneriler baltayla kırar (Buz Kırıcı).
      { id: "ice/ice-shatter", at: "boss", dx: -64, dy: 3 },
      { id: "ice/frost-nova", at: "boss", dy: 2, options: { reach: 84 } },
    ],
    weakness: {
      label: "Ocak Ninnisi",
      hint: "Ocak ateşinin sıcaklığı ve sakin bir ninni göğsündeki buz çekirdeğini eritir.",
      fx: [
        { id: "holy/heal", at: "ocak", dx: 24, options: { palette: RAMPS.gunozu } },
        { id: "ice/ice-shatter", at: "cekirdek", dx: -2, dy: 14, options: { delay: 0.5 } },
      ],
    },
  },
  sisci_karacay: {
    sky: "alacakaranlik",
    ground: "deniz",
    ambient: [{ id: "weather/fog", at: "sahne", dx: W / 2, dy: G + 20, options: { light: 0.9 }, layer: "front" }],
    attacks: [{ id: "shadow/shadow-flames", at: "oba", dy: 2 }],
    weakness: {
      label: "Fener Işığı",
      hint: "Birbirine seslenen, birbirini gören bir oba sisin içinde kaybolmaz: fenerler zincir olur.",
      fx: [{ id: "holy/sunburst", at: "cekirdek", options: { palette: RAMPS.gunozu, lifetime: 2.4 } }],
    },
  },
  ayazkurt: {
    sky: "kutup",
    ground: "kar",
    ambient: [{ id: "weather/blizzard", at: "sahne", dx: W / 2, dy: G + 20, layer: "front" }],
    attacks: [{ id: "ice/frost-breath", at: "cekirdek", dx: -30, dy: -10, options: { flip: true } }],
    weakness: {
      label: "Oba Davulu",
      hint: "Sıcak kamp ateşi ve hep birlikte söylenen türküler fırtınasını dindirir.",
      fx: [
        { id: "fire/campfire", at: "boss", dx: -44, dy: 2, options: { lifetime: 3 } },
        { id: "holy/heal", at: "ocak", dx: 24, options: { palette: RAMPS.gunozu } },
      ],
    },
  },
  kisgolgesi_han: {
    sky: "tutulma",
    ground: "tas",
    ambient: [
      { id: "shadow/eclipse", at: "sahne", dx: 252, dy: 40, options: { light: 0.9 }, layer: "back" },
      { id: "weather/snow", at: "sahne", dx: W / 2, dy: G + 20, layer: "front" },
    ],
    attacks: [{ id: "shadow/shadow-flames", at: "oba", dy: 2 }],
    weakness: {
      label: "Paylaşılan Işık",
      hint: "Obanın her ferdi kendi küçük ışığını taşa uzattığında gölge incelir.",
      fx: [{ id: "holy/sunburst", at: "cekirdek", options: { palette: RAMPS.gunozu, lifetime: 2.4 } }],
    },
  },
};

/** Akın sahnesinde her sınıfın düğmesi. Ocakcan, boss'un zayıf noktasını oynatır. */
export function raidSkills(scene: BossScene): Record<ClassId, string> {
  return { kalkaneri: CLASS_SKILL_NAMES.kalkaneri, okyeli: CLASS_SKILL_NAMES.okyeli, ocakcan: scene.weakness.label };
}

/** Bir çapalı efektin tuvaldeki yeri. */
export function anchorPoint(
  fx: AnchoredFx,
  anchors: { boss: { x: number; y: number }; cekirdek: { x: number; y: number }; ocak: { x: number; y: number }; oba: () => { x: number; y: number } },
): { x: number; y: number } {
  const base = fx.at === "sahne" ? { x: 0, y: 0 } : fx.at === "oba" ? anchors.oba() : anchors[fx.at];
  return { x: base.x + (fx.dx ?? 0), y: base.y + (fx.dy ?? 0) };
}

/** Akın sahnesine çıkacak akıncılar: her sınıftan en fazla `perClass`, önce kadro, sonra nadirlik. */
export function pickRaiders(participants: readonly Character[], perClass = 4): Record<ClassId, Character[]> {
  const rank = (c: Character) => (c.roleType === "follower" ? 0 : 10) + RARITIES.indexOf(c.rarity);
  const sorted = [...participants].sort((a, b) => rank(b) - rank(a) || a.id.localeCompare(b.id));
  const out: Record<ClassId, Character[]> = { kalkaneri: [], okyeli: [], ocakcan: [] };
  for (const c of sorted) if (out[c.class.id].length < perClass) out[c.class.id].push(c);
  return out;
}

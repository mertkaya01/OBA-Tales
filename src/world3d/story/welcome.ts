/**
 * KARŞILAMA (siteye ilk kez gelen) — kahramanlar Kut Kapısı'ndan birlikte doğar, kapının önünde yan yana durur,
 * kamera her birini yakından tanıtır; sonra Dede'nin turu açılır (saf, testli).
 *
 *   0,0–2,6        kamera kapıya iner, kapı titrer                     "Kut Kapısı titriyor…"
 *   2,6–son iniş   küreler arayla kalkar, kapının önüne yan yana iner   "Üç ışık doğuyor…"
 *   grup           üçü yan yana, kameraya el sallar                     "Kutada'nın kahramanları"
 *   tanıtım × n    kamera sırayla her kahramana yaklaşır; kart: unvan, sınıf, nadirlik, üç özel yetenek, imza
 *   son            bantlar kalkar; kahramanlar gün düzenine döner, tur açılır
 */
import { isCastMember } from "../../content/cast";
import { CLASSES } from "../../content/classes";
import { RARITY_INFO } from "../../content/rarities";
import { PORTRAIT, signatureSkill } from "../../game/fx/fxCatalog";
import type { Character, Coordinates } from "../../types";
import { ORB_STAGGER, arrivalAt } from "./arrival";

/** Hepsi indikten sonra grup çekiminin süresi. */
export const WELCOME_GROUP = 1.1;
/** Her kahramanın yakın tanıtımının süresi. */
export const WELCOME_PER_HERO = 2.8;
const OUTRO = 0.5;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Son kürenin indiği an. */
export const welcomeLanded = (n: number) => 4.8 + Math.max(0, n - 1) * ORB_STAGGER;
/** i. kahramanın tanıtımının başladığı an. */
export const introStart = (n: number, i: number) => welcomeLanded(n) + WELCOME_GROUP + i * WELCOME_PER_HERO;
export const welcomeLength = (n: number) => introStart(n, n) + OUTRO;

export interface WelcomeFrame {
  flare: number;
  /** Sinema bantları (0–1). */
  letterbox: number;
  caption: string | null;
  /** Yan yana grup çekimi mi? */
  group: boolean;
  /** Yakından tanıtılan kahramanın sırası (yoksa null). */
  focus: number | null;
}

export function welcomeAt(t: number, n: number): WelcomeFrame {
  const landed = welcomeLanded(n);
  const end = welcomeLength(n);
  const base = arrivalAt(t, n);
  const introFrom = landed + WELCOME_GROUP;
  const focus = t >= introFrom && t < introStart(n, n) ? Math.floor((t - introFrom) / WELCOME_PER_HERO) : null;
  return {
    flare: base.flare,
    letterbox: t < end - 0.5 ? clamp01(t / 0.5) : 1 - clamp01((t - (end - 0.5)) / 0.5),
    caption: t < landed ? base.caption : t < introFrom ? "Kutada'nın kahramanları" : null,
    group: t >= landed && t < introFrom,
    focus,
  };
}

/**
 * Kahramanların doğup durduğu yerler: Kut Kapısı'nın taş meydanının hemen önünde (kameraya, güneye doğru), soldan
 * sağa geliş sırasıyla, aralarında yeterli boşluk.
 */
export function welcomeSpots(portal: Coordinates, n: number, gap = 15, ahead = 54): Coordinates[] {
  return Array.from({ length: n }, (_, i) => ({ x: portal.x + (i - (n - 1) / 2) * gap, y: portal.y + ahead }));
}

export interface HeroIntro {
  name: string;
  title: string;
  /** "Kalkaneri · Ulu" */
  tags: string;
  /** Lakabı (kadrodaysa), ör. "Kut Kapısı'nın Bekçisi". */
  epithet: string | null;
  /** En çok üç özel yetenek adı (kadroda yoksa sınıfının yetenekleri). */
  features: string[];
  /** Portreye dokununca oynayan imza yeteneği. */
  skill: string;
}

/** Tanıtım kartının içeriği. */
export function heroIntro(c: Character): HeroIntro {
  const cls = CLASSES[c.class.id];
  const abilities = isCastMember(c) && c.specialAbilities ? c.specialAbilities.map((a) => a.split(": ")[0]) : cls.abilities.map((a) => a.split(":")[0]);
  return {
    name: c.displayName,
    title: c.title,
    tags: `${cls.name} · ${RARITY_INFO[c.rarity].label}`,
    epithet: isCastMember(c) ? c.epithet : null,
    features: abilities.slice(0, 3),
    skill: signatureSkill(c, { x: PORTRAIT.feetX, y: PORTRAIT.feetY }).name,
  };
}

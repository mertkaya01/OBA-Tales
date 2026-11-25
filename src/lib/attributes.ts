/**
 * NİTELİKLER — Güç, Çeviklik, Dayanıklılık ve Kut.
 *
 * Takipçilerin ve kadronun nitelikleri sınıftan, nadirlikten ve kimlikten türetilir: herkes her açılışta aynı
 * değerleri görür, iki yoldaş neredeyse hiç aynı olmaz. Tavan 99'dur. Özel kahramanların nitelikleri elle
 * verilir (src/content/cast.ts → attributes); tavanı aşarlar ve yalnızca onlara ait bir nitelikleri vardır.
 */
import { hashString } from "./random";
import { rarityRank } from "./rules";
import { ATTRIBUTE_IDS } from "../types";
import type { AttributeId, CastMember, Character, CharacterAttributes, ClassId, HeroAttributes } from "../types";

/** Takipçi ve kadro nitelikleri bu değeri geçmez; geçen yalnızca özel kahramanlardır. */
export const ATTRIBUTE_CAP = 99;

export const ATTRIBUTE_INFO: Readonly<Record<AttributeId, { label: string; description: string }>> = {
  guc: { label: "Güç", description: "Buzu kırar, kalkanı taşır, rüzgâra göğüs gerer." },
  ceviklik: { label: "Çeviklik", description: "Hızlı adım, isabetli atış, kayan buzda dengede kalmak." },
  dayaniklilik: { label: "Dayanıklılık", description: "Ayaza, yorgunluğa ve uzun akınlara katlanmak." },
  kut: { label: "Kut", description: "Göğün verdiği uğur ve iç ışığı: şifa, cesaret ve sezgi." },
};

/** Sınıfların temel nitelikleri: Kalkaneri güçlü ve dayanıklı, Okyeli çevik, Ocakcan kutlu. */
const CLASS_BASE: Readonly<Record<ClassId, CharacterAttributes>> = {
  kalkaneri: { guc: 62, ceviklik: 38, dayaniklilik: 68, kut: 40 },
  okyeli: { guc: 44, ceviklik: 68, dayaniklilik: 40, kut: 50 },
  ocakcan: { guc: 34, ceviklik: 46, dayaniklilik: 50, kut: 68 },
};

/** Her nadirlik kademesi bütün niteliklere eklenir. */
const RARITY_STEP = 7;
const CAST_BONUS = 5;

export interface AttributeSheet {
  values: CharacterAttributes;
  /** Yalnızca özel kahramanlarda: kendine ait nitelik. */
  special: HeroAttributes["special"] | null;
  /** Değerler elle mi verildi (özel kahraman)? */
  heroic: boolean;
}

const hasHeroAttributes = (c: Character): c is CastMember & { attributes: HeroAttributes } =>
  "attributes" in c && (c as CastMember).attributes !== undefined;

export function attributesOf(c: Character): AttributeSheet {
  if (hasHeroAttributes(c)) {
    const { special, ...values } = c.attributes;
    return { values, special, heroic: true };
  }
  const base = CLASS_BASE[c.class.id];
  const bonus = rarityRank(c.rarity) * RARITY_STEP + (c.roleType === "follower" ? 0 : CAST_BONUS);
  const values = Object.fromEntries(
    ATTRIBUTE_IDS.map((id) => {
      const jitter = (hashString(`nitelik:${id}:${c.id}`) % 13) - 6;
      return [id, Math.max(1, Math.min(ATTRIBUTE_CAP, base[id] + bonus + jitter))];
    }),
  ) as CharacterAttributes;
  return { values, special: null, heroic: false };
}

/**
 * OYUN KURALLARI — platform → sınıf, çoklu abonelik, nadirlik kademeleri ve rozetler.
 *
 *   - Ana platform sınıfı belirler (Instagram → Kalkaneri, TikTok → Okyeli, YouTube → Ocakcan).
 *   - 2 ya da 3 platform: başlangıç nadirliği bir kademe yükselir (Sıradan → Nadir).
 *   - 2 platform `cift_iz`, 3 platform `oba_onculugu` rozeti verir.
 *   - Boss ve özel bölüm akınlarına katılım ile çok oy kullanmak ayrıca rozet kazandırır.
 */
import { BADGE_IDS, FOLLOWER_RARITY_CAP, PLATFORMS, PLATFORM_TO_CLASS, RARITIES } from "../types";
import type { BadgeId, Character, ClassId, Coordinates, Platform, Rarity, RegionId, RoleType } from "../types";
import { CLASSES, toClassInfo } from "../content/classes";
import { RARITY_INFO } from "../content/rarities";
import { clamp } from "./geometry";
import { slugify } from "./text";

// ── Sınıf ve nadirlik ──────────────────────────────────────────────

export function classForPlatform(platform: Platform): ClassId {
  return PLATFORM_TO_CLASS[platform];
}

/** "siradan" → 0 … "efsanevi" → 3 */
export function rarityRank(rarity: Rarity): number {
  return RARITIES.indexOf(rarity);
}

/** Kademe numarasından nadirlik (sınırların dışı en yakın kademeye sıkıştırılır). */
export function rarityAt(rank: number): Rarity {
  return RARITIES[clamp(Math.round(rank), 0, RARITIES.length - 1)];
}

/**
 * Nadirliği verilen kademe kadar yükseltir (negatif değer düşürür). Tavan "efsanevi": Ulu ve Göksel
 * yükseltmeyle kazanılmaz, yalnızca özel kahramanlara elle verilir (onlarınki olduğu gibi kalır).
 */
export function raiseRarity(rarity: Rarity, steps = 1): Rarity {
  const cap = rarityRank(FOLLOWER_RARITY_CAP);
  if (rarityRank(rarity) > cap) return rarity;
  return rarityAt(Math.min(rarityRank(rarity) + steps, cap));
}

/** Sıralama için: yüksek nadirlik önce gelir. */
export function compareRarityDesc(a: Rarity, b: Rarity): number {
  return rarityRank(b) - rarityRank(a);
}

// ── Platformlar ────────────────────────────────────────────────────

/** Ana platform en başta, kalanlar sabit sırayla; tekrarlar atılır. */
export function uniquePlatforms(primary: Platform, linked: readonly Platform[] = []): Platform[] {
  const set = new Set<Platform>([primary, ...linked]);
  return [primary, ...PLATFORMS.filter((p) => p !== primary && set.has(p))];
}

/** Takip edilen platform sayısına göre rozet. */
export function multiPlatformBadge(platformCount: number): BadgeId | null {
  if (platformCount >= 3) return "oba_onculugu";
  if (platformCount === 2) return "cift_iz";
  return null;
}

/** Çoklu aboneliğin nadirliğe kattığı kademe. */
export function multiPlatformBonus(platformCount: number): number {
  return platformCount >= 2 ? 1 : 0;
}

/** Obaya yeni katılan bir takipçinin başlangıç nadirliği. */
export function startingRarity(platformCount: number): Rarity {
  return raiseRarity("siradan", multiPlatformBonus(platformCount));
}

// ── Rozetler ───────────────────────────────────────────────────────

/** Akınına katılınca rozet kazandıran bölümler. */
export const EPISODE_BADGES: Readonly<Partial<Record<number, BadgeId>>> = {
  1: "ilk_adim",
  3: "buzkiran_akini",
  5: "senlik_neferi",
  6: "sis_yaran",
  9: "ayaz_dindiren",
  12: "gunozu_bekcisi",
};

/** "Ozan Dostu" rozeti için gereken en az oy sayısı. */
export const OZAN_DOSTU_MIN_VOTES = 10;

export interface BadgeInput {
  roleType: RoleType;
  linkedPlatforms: readonly Platform[];
  /** Akınına katıldığı bölüm numaraları. */
  joinedEpisodes?: readonly number[];
  votesCast?: number;
}

/** Kurallara göre kazanılmış rozetler (BADGE_IDS sırasıyla). */
export function deriveBadges({ roleType, linkedPlatforms, joinedEpisodes = [], votesCast = 0 }: BadgeInput): BadgeId[] {
  const earned = new Set<BadgeId>();
  const platformBadge = multiPlatformBadge(new Set(linkedPlatforms).size);
  if (platformBadge) earned.add(platformBadge);
  if (roleType !== "follower") earned.add("kurucu_oba");
  for (const episode of joinedEpisodes) {
    const badge = EPISODE_BADGES[episode];
    if (badge) earned.add(badge);
  }
  if (votesCast >= OZAN_DOSTU_MIN_VOTES) earned.add("ozan_dostu");
  return BADGE_IDS.filter((id) => earned.has(id));
}

// ── Unvan ve yeni karakter ─────────────────────────────────────────

/** Varsayılan unvan: "Çırak Kalkaneri", "Yoldaş Okyeli", "Efsane Ocakcan" … */
export function defaultTitle(rarity: Rarity, classId: ClassId): string {
  return `${RARITY_INFO[rarity].title} ${CLASSES[classId].name}`;
}

/** Kullanıcı adını sadeleştirir: boşlukları ve baştaki "@" işaretlerini atar. */
export function cleanHandle(handle: string): string {
  return handle.trim().replace(/^@+/, "");
}

export interface StarterInput {
  handle: string;
  displayName?: string;
  platform: Platform;
  linkedPlatforms?: readonly Platform[];
  region: RegionId;
  coordinates: Coordinates;
  /** Varsayılan: şu an. */
  now?: Date;
}

/**
 * Obaya yeni katılan bir takipçinin başlangıç karakteri.
 * Obaya Katıl sayfasındaki önizleme ve mock veri üretici bu fonksiyonu kullanır.
 */
export function createStarterCharacter(input: StarterInput): Character {
  const handle = cleanHandle(input.handle);
  const linkedPlatforms = uniquePlatforms(input.platform, input.linkedPlatforms);
  const classId = classForPlatform(input.platform);
  const rarity = startingRarity(linkedPlatforms.length);

  return {
    id: slugify(handle, "_"),
    handle,
    displayName: input.displayName?.trim() || handle,
    roleType: "follower",
    platform: input.platform,
    linkedPlatforms,
    class: toClassInfo(classId),
    rarity,
    title: defaultTitle(rarity, classId),
    points: 0,
    region: input.region,
    coordinates: { ...input.coordinates },
    badges: deriveBadges({ roleType: "follower", linkedPlatforms }),
    elementAura: null,
    seasonContributions: { votesCast: 0, raidsJoined: 0 },
    updatedAt: (input.now ?? new Date()).toISOString(),
  };
}

/**
 * KARAKTER MODELİ — takipçiler, kadro, sınıflar, nadirlikler ve rozetler.
 *
 * Takipçi karakterleri public/data/roster.json içinde, kadro (lider, anlatıcı,
 * ana ve yan karakterler) src/content/cast.ts içinde durur. İkisi de `Character` şeklindedir.
 */
import type { Coordinates, RegionId } from './world';

// ── Platform ve sınıf ──────────────────────────────────────────────

export const PLATFORMS = ['instagram', 'tiktok', 'youtube'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const CLASS_IDS = ['kalkaneri', 'okyeli', 'ocakcan'] as const;
export type ClassId = (typeof CLASS_IDS)[number];

export const ARCHETYPES = ['savasci', 'menzilli', 'destek'] as const;
export type Archetype = (typeof ARCHETYPES)[number];

/** Ana platform → başlangıç sınıfı. Eşleşme bire birdir. */
export const PLATFORM_TO_CLASS = {
  instagram: 'kalkaneri',
  tiktok: 'okyeli',
  youtube: 'ocakcan',
} as const satisfies Record<Platform, ClassId>;

/** Sınıf → arketip. */
export const CLASS_ARCHETYPE = {
  kalkaneri: 'savasci',
  okyeli: 'menzilli',
  ocakcan: 'destek',
} as const satisfies Record<ClassId, Archetype>;

/** Karakterin üzerinde taşınan kısa sınıf bilgisi. */
export interface ClassInfo {
  id: ClassId;
  /** Görünen ad, ör. "Kalkaneri". */
  name: string;
  archetype: Archetype;
}

// ── Nadirlik ───────────────────────────────────────────────────────

/** Sıralama önemlidir: dizideki konum = nadirlik kademesi (0 en düşük). */
export const RARITIES = ['siradan', 'nadir', 'destansi', 'efsanevi'] as const;
export type Rarity = (typeof RARITIES)[number];

// ── Rol, aura, rozet ───────────────────────────────────────────────

export const ROLE_TYPES = ['follower', 'core', 'side', 'leader', 'narrator'] as const;
export type RoleType = (typeof ROLE_TYPES)[number];

/** Kadro üyelerinin rolleri (takipçi dışındaki her şey). */
export type CastRole = Exclude<RoleType, 'follower'>;

export const ELEMENT_AURAS = ['alev', 'isik'] as const;
/** Alev (Yalvaç teması), ışık (Işıkay teması) ya da aurasız. */
export type ElementAura = (typeof ELEMENT_AURAS)[number] | null;

/**
 * Tüm rozet kimlikleri. Rozetin adı, açıklaması ve kazanma koşulu
 * src/content/badges.ts içinde tanımlanır.
 */
export const BADGE_IDS = [
  'cift_iz', //         2 platformda takip
  'oba_onculugu', //    3 platformda takip
  'kurucu_oba', //      kadro üyeleri
  'ilk_adim', //        Bölüm 1 akınına katıldı
  'buzkiran_akini', //  Bölüm 3 boss akını
  'senlik_neferi', //   Bölüm 5 Ocak Şenliği
  'sis_yaran', //       Bölüm 6 boss akını
  'ayaz_dindiren', //   Bölüm 9 boss akını
  'gunozu_bekcisi', //  Bölüm 12 boss akını
  'ozan_dostu', //      sezon boyunca çok oy kullandı
] as const;
export type BadgeId = (typeof BADGE_IDS)[number];

// ── Karakter ───────────────────────────────────────────────────────

export interface SeasonContributions {
  /** Yorumlarla verilen oy sayısı. */
  votesCast: number;
  /** Katıldığı akın sayısı. */
  raidsJoined: number;
}

export interface Character {
  /** Değişmeyen kimlik (küçük harf, rakam, "-" ve "_"). URL'de `?k=` ile kullanılır. */
  id: string;
  /** Platform kullanıcı adı, "@" olmadan. */
  handle: string;
  displayName: string;
  roleType: RoleType;
  /** Ana platform: sınıfı belirler. */
  platform: Platform;
  /** Takip edilen tüm platformlar; ana platformu da içerir. */
  linkedPlatforms: Platform[];
  class: ClassInfo;
  rarity: Rarity;
  /** Unvan, ör. "Ayazboğazı Yoldaşı". */
  title: string;
  points: number;
  region: RegionId;
  coordinates: Coordinates;
  badges: BadgeId[];
  elementAura: ElementAura;
  seasonContributions: SeasonContributions;
  /** ISO 8601 tarih-saat. */
  updatedAt: string;
}

/** public/data/roster.json dosyasının şekli (yalnızca takipçiler). */
export interface RosterFile {
  version: 1;
  season: number;
  /** ISO 8601 tarih-saat. */
  generatedAt: string;
  characters: Character[];
}

/** Kadro üyesi: karakter alanlarına ek olarak hikâye bilgileri taşır. */
export interface CastMember extends Character {
  roleType: CastRole;
  /** Lakap, ör. "Akın Lideri". */
  epithet: string;
  bio: string;
  appearance: string;
  /** İmza hareketi ya da sözü. */
  signature: string;
}

// ── Kanon tanımları (src/content/* içinde doldurulur) ───────────────

export interface ClassDefinition {
  id: ClassId;
  name: string;
  archetype: Archetype;
  /** "Savaşçı", "Menzilli", "Destek". */
  archetypeLabel: string;
  platform: Platform;
  /** "Instagram", "TikTok", "YouTube". */
  platformLabel: string;
  /** Tek cümlelik rol özeti. */
  role: string;
  description: string;
  /** Görünüş maddeleri (kıyafet, ekipman). */
  appearance: string[];
  abilities: string[];
}

export interface RarityDefinition {
  id: Rarity;
  /** 0 = sıradan … 3 = efsanevi. */
  rank: number;
  /** "Sıradan", "Nadir", "Destansı", "Efsanevi". */
  label: string;
  /** Kademe unvanı: "Çırak", "Yoldaş", "Başeri", "Efsane". */
  title: string;
  description: string;
  /** Çerçeve tanımı, ör. "Zümrüt / Süzülkoy çerçeve". */
  frameLabel: string;
  /** Görsel farklar (kıyafet, süs, efekt). */
  visuals: string[];
  hasAura: boolean;
  hasTrail: boolean;
}

export interface BadgeDefinition {
  id: BadgeId;
  name: string;
  description: string;
  howToEarn: string;
  /** Arayüzde rozet simgesini seçen anahtar. */
  icon: string;
}

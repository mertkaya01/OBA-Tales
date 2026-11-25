/**
 * AKIN MEYDANI — aktif bölümün akıncıları evlerinden çıkıp bölgenin meydanında saf tutar.
 *
 *   · Her bölgenin düz, ağaçsız bir meydanı ve akıncıların yüzünü döndüğü bir "odak" noktası vardır.
 *     Boss'lu bölümlerde boss o noktada durur.
 *   · Saf düzeni: en önde kadro (öncüler), arkasında kalkanlı Kalkaneriler, ortada davullu Ocakcanlar,
 *     en arkada yaylı Okyeliler. Her sınıf kendi bloğunda; eksik kalan son sıra ortalanır.
 *   · Sıralar boss'a bakar; Oba Narası ön sıradan arkaya dalga gibi yayılır.
 *
 * Saf fonksiyonlardır: Three.js bilmez, testlerde doğrulanır. Koordinatlar dünya birimindedir (x, y).
 */
import { RAID_GROUNDS, type RaidGround } from "../../content/sites";
import { BOSS_IDS, RARITIES } from "../../types";
import type { BossId, Character, ClassId, RegionId } from "../../types";

// Meydanların konumu content/sites.ts içinde (arazi üreticisi onları düzler ve nehirden korur).
export { RAID_GROUNDS, type RaidGround } from "../../content/sites";

/** Saf aralıkları (dünya birimi): karakter ≈ 3,4 birim geniş, 8 birim boyunda (CHARACTER_SIZE 1,8). */
export const COLUMN_SPACING = 4.9;
export const ROW_SPACING = 5.8;

/** Ön sıradan arkaya: kalkanlar önde, yaylar arkada. */
const CLASS_ORDER: readonly ClassId[] = ["kalkaneri", "ocakcan", "okyeli"];

export interface FormationSlot {
  x: number;
  y: number;
  /** 0 = en ön sıra (öncüler). */
  row: number;
}

export interface RaidFormation {
  region: RegionId;
  ground: RaidGround;
  /** Akıncıların baktığı yön (radyan; Three.js y ekseni etrafında, 0 = güney). */
  facing: number;
  slots: ReadonlyMap<string, FormationSlot>;
  /** Saf düzenini çevreleyen dairenin yarıçapı (gezginler buraya girmez). */
  radius: number;
}

const rarityRank = (c: Character) => RARITIES.indexOf(c.rarity);

function byRank(a: Character, b: Character): number {
  return rarityRank(b) - rarityRank(a) || b.points - a.points || a.id.localeCompare(b.id);
}

/** Satır sayısına göre bir bloğu sıralara böler; son sıra ortalanır. */
function blockRows(members: readonly Character[], columns: number): Character[][] {
  const rows: Character[][] = [];
  for (let i = 0; i < members.length; i += columns) rows.push(members.slice(i, i + columns));
  return rows;
}

export function planFormation(participants: readonly Character[], region: RegionId): RaidFormation {
  const ground = RAID_GROUNDS[region];
  const fx = ground.focus.x - ground.square.x;
  const fy = ground.focus.y - ground.square.y;
  const length = Math.hypot(fx, fy) || 1;
  // İleri (boss'a doğru) ve sağ yönler.
  const forward = { x: fx / length, y: fy / length };
  const right = { x: -forward.y, y: forward.x };

  const leaders = participants.filter((c) => c.roleType !== "follower").sort(byRank);
  const followers = participants.filter((c) => c.roleType === "follower");
  const columns = Math.min(18, Math.max(6, Math.round(Math.sqrt(followers.length * 1.4))));

  const rows: Character[][] = [];
  if (leaders.length > 0) rows.push(...blockRows(leaders, columns));
  const leaderRows = rows.length;
  for (const classId of CLASS_ORDER) {
    rows.push(...blockRows(followers.filter((c) => c.class.id === classId).sort(byRank), columns));
  }

  // Öncülerle saf arasında biraz boşluk; bütün düzen meydanın ortasına hizalanır.
  const gap = leaderRows > 0 ? ROW_SPACING * 0.5 : 0;
  const depth = Math.max(0, rows.length - 1) * ROW_SPACING + gap;
  const slots = new Map<string, FormationSlot>();
  rows.forEach((members, row) => {
    const back = row * ROW_SPACING + (row >= leaderRows ? gap : 0);
    const along = depth / 2 - back;
    members.forEach((c, i) => {
      const lateral = (i - (members.length - 1) / 2) * COLUMN_SPACING;
      slots.set(c.id, {
        x: ground.square.x + forward.x * along + right.x * lateral,
        y: ground.square.y + forward.y * along + right.y * lateral,
        row,
      });
    });
  });

  const halfWidth = ((columns - 1) / 2) * COLUMN_SPACING;
  return {
    region,
    ground,
    // Harita (x, y) → Three.js (x, z): yüzün +z'den bu yöne dönmesi.
    facing: Math.atan2(forward.x, forward.y),
    slots,
    radius: Math.hypot(depth / 2, halfWidth) + 3,
  };
}

/** Oba Narası'nın bu sıraya ulaşma gecikmesi (saniye). */
export function cheerDelay(row: number): number {
  return row * 0.12;
}

/** Boss modellerinin yaklaşık boyu (Three.js birimi): ad plakası başlarının biraz üstünde durur. */
export const BOSS_HEIGHT: Readonly<Record<BossId, number>> = {
  buzkiran_tekgoz: 27,
  sisci_karacay: 33,
  ayazkurt: 30,
  kisgolgesi_han: 33,
};

/** Boss'un hedef noktasının (buz çekirdeği, gövde, göğüs, Günözü Taşı) zeminden yüksekliği: oklar ve ışıklar buraya gider. */
export const BOSS_CORE_HEIGHT: Readonly<Record<BossId, number>> = {
  buzkiran_tekgoz: 12,
  sisci_karacay: 11,
  ayazkurt: 14,
  kisgolgesi_han: 21,
};

/** Canlı akının (savaş döngüsünün) sahneler arası paylaşılan durumu. */
export interface BattleRuntime {
  /** Boss irkilmesi: >0 iken titrer (saniye). */
  flinch: number;
  /** İzleme modunda döngü daha sık döner. */
  intense: boolean;
}

export function createBattleRuntime(): BattleRuntime {
  return { flinch: 0, intense: false };
}

/**
 * Geliştirme sırasında ?boss=ayazkurt gibi bir adresle o boss'un akın meydanı önizlenir
 * (aktif bölümün akıncıları o bölgenin meydanına taşınır). Geçersizse null.
 */
export function parseBossPreview(search: string): BossId | null {
  const value = new URLSearchParams(search).get("boss");
  return value && (BOSS_IDS as readonly string[]).includes(value) ? (value as BossId) : null;
}

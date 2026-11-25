/**
 * SEZON MANTIĞI — /bolumler sayfasının hesapları (saf fonksiyonlar, testli).
 *
 *   pollStandings   oylama seçenekleri, oy sayıları, yüzdeler (toplamı tam 100), kazanan / önde giden
 *   seasonProgress  kaç bölüm bitti, hangisi aktif, yüzde kaç
 *   seasonActs      12 bölüm → 4 perde; her perde bir boss akınıyla kapanır
 *   nextAirTime     sıradaki bölümün tahmini yayın zamanı (haftalık ritim)
 *   bossReveal      boss kartında ne kadarı görünsün (gizem → siluet → tam → sakin)
 */
import type { BossId, EpisodeStatus, Poll, PollResult } from "../types";

// ── Oylama ─────────────────────────────────────────────────────────

export interface OptionStanding {
  id: string;
  label: string;
  description?: string;
  votes: number;
  /** Tam sayı yüzde; bütün seçeneklerin toplamı 100 (oy yoksa hepsi 0). */
  percent: number;
  /** Oylama bittiyse kazanan. */
  winner: boolean;
  /** Oylama sürüyorsa en çok oyu alan(lar). */
  leading: boolean;
}

export interface PollStanding {
  poll: Poll;
  total: number;
  /** Oylama bitti mi (kazanan yazılmış mı)? */
  closed: boolean;
  options: OptionStanding[];
}

/**
 * Yüzdeleri, toplamı tam 100 olacak şekilde yuvarlar (en büyük kalan yöntemi):
 * 33,3 + 33,3 + 33,3 → 34 + 33 + 33.
 */
export function roundPercents(values: readonly number[]): number[] {
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map((v) => (v / total) * 100);
  const floors = exact.map(Math.floor);
  let left = 100 - floors.reduce((sum, v) => sum + v, 0);
  const order = exact.map((v, i) => ({ i, rest: v - floors[i] })).sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return floors;
}

export function pollStandings(poll: Poll, result: PollResult | undefined): PollStanding {
  const votes = poll.options.map((o) => result?.tallies[o.id] ?? 0);
  const percents = roundPercents(votes);
  const closed = !!result?.winnerOptionId;
  const top = Math.max(0, ...votes);
  return {
    poll,
    total: votes.reduce((sum, v) => sum + v, 0),
    closed,
    options: poll.options.map((o, i) => ({
      id: o.id,
      label: o.label,
      description: o.description,
      votes: votes[i],
      percent: percents[i],
      winner: closed && result?.winnerOptionId === o.id,
      leading: !closed && top > 0 && votes[i] === top,
    })),
  };
}

// ── Sezon ilerlemesi ───────────────────────────────────────────────

interface EpisodeLike {
  number: number;
  status: EpisodeStatus;
  bossId: BossId | null;
  progress: { airedAt: string | null } | null;
}

export interface SeasonProgress {
  completed: number;
  total: number;
  /** Aktif bölümün numarası (yoksa null). */
  active: number | null;
  /** Tamamlanan bölümler + aktif bölümün yarısı, yüzde. */
  percent: number;
}

export function seasonProgress(episodes: readonly EpisodeLike[]): SeasonProgress {
  const completed = episodes.filter((e) => e.status === "tamamlandi").length;
  const active = episodes.find((e) => e.status === "aktif")?.number ?? null;
  const total = episodes.length;
  const percent = total === 0 ? 0 : Math.round(((completed + (active ? 0.5 : 0)) / total) * 100);
  return { completed, total, active, percent };
}

export interface SeasonAct<E> {
  /** 1–4 */
  number: number;
  episodes: E[];
  /** Perdeyi kapatan boss (son bölümün boss'u). */
  bossId: BossId | null;
}

/** Bölümleri perdelere ayırır: her boss bölümü bir perdeyi kapatır; sonda boss'suz kalanlar son perdeye. */
export function seasonActs<E extends EpisodeLike>(episodes: readonly E[]): SeasonAct<E>[] {
  const acts: SeasonAct<E>[] = [];
  let current: E[] = [];
  for (const episode of episodes) {
    current.push(episode);
    if (episode.bossId) {
      acts.push({ number: acts.length + 1, episodes: current, bossId: episode.bossId });
      current = [];
    }
  }
  if (current.length > 0) {
    if (acts.length > 0) acts[acts.length - 1].episodes.push(...current);
    else acts.push({ number: 1, episodes: current, bossId: null });
  }
  return acts;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Sıradaki bölümün tahmini yayın zamanı: son yayınlanan bölümden bir hafta sonra (haftalık ritim).
 * Sezon bittiyse ya da hiç yayın yoksa null.
 */
export function nextAirTime(episodes: readonly EpisodeLike[]): { number: number; iso: string } | null {
  const aired = episodes.filter((e) => e.progress?.airedAt);
  const last = aired[aired.length - 1];
  if (!last?.progress?.airedAt) return null;
  const next = episodes.find((e) => e.number === last.number + 1);
  if (!next) return null;
  return { number: next.number, iso: new Date(Date.parse(last.progress.airedAt) + WEEK_MS).toISOString() };
}

// ── Boss kartı ─────────────────────────────────────────────────────

/**
 * gizem  → bölüm kilitli: yalnızca siluet, adı "???"
 * siluet → bölüm yakında: siluet ve adı
 * tam    → akın sürüyor: renkli, öfkeli hâli, zayıf noktası
 * sakin  → akın bitti: sakinleşmiş hâli ve nasıl dost olduğu
 */
export type BossReveal = "gizem" | "siluet" | "tam" | "sakin";

export function bossReveal(status: EpisodeStatus): BossReveal {
  switch (status) {
    case "kilitli":
      return "gizem";
    case "yakinda":
      return "siluet";
    case "aktif":
      return "tam";
    case "tamamlandi":
      return "sakin";
  }
}

/**
 * Takipçiye nasıl oy vereceğini anlatan kısa metin (cümle içinde kullanılır). Bütün seçenekleri tarafsızca sayar:
 * yorumlara "A", "B" ya da "C" yaz
 */
export function voteHint(optionLabels: readonly string[]): string {
  const quoted = optionLabels.map((label) => `"${label}"`);
  const list = quoted.length > 1 ? `${quoted.slice(0, -1).join(", ")} ya da ${quoted[quoted.length - 1]}` : (quoted[0] ?? "seçeneğin adını");
  return `yorumlara ${list} yaz`;
}

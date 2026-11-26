/**
 * DÜNYADAKİ İZLER — kahramanların işi Kutada'da görünür kalır.
 *
 *   · Ağaç: balta her indiğinde sarsılır, devrilir, yarılır; kütük kalır, odun bağları taşındıkça azalır.
 *     Ertesi sabah 05:00–07:00 arasında kütükten fidan büyür.
 *   · İstif: getirilen her bağla büyür, ateşe atılan her odunla küçülür; gece boyunca yavaşça yanıp biter.
 *   · Çalı ve ot öbeği: toplandıkça meyvesi, çiçeği azalır; ertesi sabah yenilenir.
 *
 * Hepsi o günün (ve gerekirse önceki günün) planından okunur: saf fonksiyonlardır.
 */
import { AXE_IMPACT, CLIP_LENGTH, type DayPlan } from "./daySchedule";
import { at } from "./storyClock";

export interface TreeState {
  kind: "ayakta" | "devriliyor" | "yatik" | "kutuk" | "fidan";
  /** Balta sarsıntısı (0–1). */
  shake: number;
  /** Devrilme (0 = dik, 1 = yerde). */
  fall: number;
  /** Fidanın büyüklüğü (0–1). */
  grow: number;
  /** Yerde kalan odun bağı. */
  bundles: number;
}

const FALL_SECONDS = 1.8;
const REGROW_FROM = at(5);
const REGROW_TO = at(7);

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** Balta inişinden sonraki sarsıntı (vuruştan hemen sonra en güçlü). */
export function impactShake(sinceStart: number): number {
  const local = sinceStart % CLIP_LENGTH.balta;
  const after = local - AXE_IMPACT;
  return after >= 0 ? Math.exp(-after * 7) : Math.exp(-(after + CLIP_LENGTH.balta) * 7);
}

/** Bir anda (balta klibinde) balta gövdeye yeni mi indi? Son dt saniye içinde inişi geçtiyse true. */
export function impactBetween(sinceStart: number, dt: number): boolean {
  if (sinceStart < 0 || dt <= 0) return false;
  const local = sinceStart % CLIP_LENGTH.balta;
  return local >= AXE_IMPACT && local - dt < AXE_IMPACT;
}

export function treeStateAt(today: DayPlan, yesterday: DayPlan | null, tree: number, seconds: number): TreeState {
  const state: TreeState = { kind: "ayakta", shake: 0, fall: 0, grow: 1, bundles: 0 };
  const chop = today.chops.find((c) => c.tree === tree);
  if (chop && seconds >= chop.start) {
    if (seconds < chop.fall) {
      state.shake = impactShake(seconds - chop.start);
      return state;
    }
    if (seconds < chop.fall + FALL_SECONDS) {
      state.kind = "devriliyor";
      const u = (seconds - chop.fall) / FALL_SECONDS;
      state.fall = u * u;
      return state;
    }
    if (seconds < chop.splitEnd) {
      state.kind = "yatik";
      state.fall = 1;
      state.shake = seconds >= chop.splitStart ? impactShake(seconds - chop.splitStart) * 0.35 : 0;
      return state;
    }
    state.kind = "kutuk";
    state.fall = 1;
    const total = chop.hero === "egetunce" ? 3 : 2;
    state.bundles = Math.max(0, total - chop.pickups.filter((p) => p <= seconds).length);
    return state;
  }
  if (yesterday?.chops.some((c) => c.tree === tree) && seconds < REGROW_TO) {
    if (seconds < REGROW_FROM) {
      state.kind = "kutuk";
      state.grow = 0;
      return state;
    }
    state.kind = "fidan";
    state.grow = 0.12 + 0.88 * smooth((seconds - REGROW_FROM) / (REGROW_TO - REGROW_FROM));
  }
  return state;
}

const countUntil = (sorted: readonly number[], seconds: number) => {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= seconds) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

/** İstifin her zaman durduğu en az kütük. */
export const STACK_BASE = 5;
export const STACK_MAX = 30;

/** Günün sonunda istifte biriken (taban hariç). */
const netAtEnd = (plan: DayPlan) => Math.max(0, plan.drops.length - plan.feeds.length);

/** İstifteki kütük sayısı. Gece yarısı sıçramasın diye dünden kalan, sabah 7'ye kadar yavaşça yanıp biter. */
export function stackCountAt(today: DayPlan, yesterday: DayPlan | null, seconds: number): number {
  const net = countUntil(today.drops, seconds) - countUntil(today.feeds, seconds);
  const carry = yesterday && seconds < REGROW_TO ? netAtEnd(yesterday) * (1 - seconds / REGROW_TO) : 0;
  return Math.min(STACK_MAX, Math.max(2, Math.round(STACK_BASE + net + carry)));
}

/** Çalının ya da ot öbeğinin kalan meyvesi/çiçeği (0–1). Ertesi sabah 05–07 arası yenilenir. */
export function pickedFruit(picks: readonly { index: number; start: number; end: number }[], yesterdayPicks: readonly { index: number; start: number; end: number }[] | null, index: number, seconds: number): number {
  const LEFT = 0.15;
  const pick = picks.find((p) => p.index === index);
  if (pick && seconds >= pick.start) return seconds >= pick.end ? LEFT : 1 - (1 - LEFT) * ((seconds - pick.start) / (pick.end - pick.start));
  if (yesterdayPicks?.some((p) => p.index === index) && seconds < REGROW_TO) {
    if (seconds < REGROW_FROM) return LEFT;
    return LEFT + (1 - LEFT) * smooth((seconds - REGROW_FROM) / (REGROW_TO - REGROW_FROM));
  }
  return 1;
}

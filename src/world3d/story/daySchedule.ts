/**
 * GÜN DÜZENİ — kahramanlar İstanbul saatine göre ne yapar?
 *
 *   01–05  çadırında uyur (BinTaş biraz önce kalkar, ocağı yakar)
 *   05–07  çadırdan eğilerek çıkar, gerinir, derede yüz yıkar, ateş başında kahvaltı
 *   07–12  odun: egetunce ağaç keser ve yarar, mhellingtr odunu istife taşır; BinTaş dereden su taşır, kazana bakar
 *   12–15  toplama: mhellingtr meyve, egetunce ve BinTaş ot toplar
 *   15–19  av: mhellingtr çayırda iz sürüp nişan alır, egetunce iz arar; BinTaş otları kurutur, ocağa bakar
 *   19–01  ateş başında oturur, sohbet eder; BinTaş ara ara ateşe odun atar
 *
 *   · Her kahramanın günü bir kez, sıralı parçalar (yürü, dur, gizli) olarak kurulur; o andaki duruş bu çizelgeden
 *     okunur. Herkes aynı anda aynı şeyi görür (çeşitlilik tarihten gelir).
 *   · Kim gelmişse ona göre: egetunce henüz yoksa ağacı mhellingtr kendi keser ve taşır.
 *   · Dünyadaki izler de buradan çıkar: hangi ağaç ne zaman devrildi, istife kaç bağ odun geldi, hangi çalı toplandı.
 *
 * Saf fonksiyonlardır; testleri daySchedule.test.ts içinde.
 */
import { ARRIVAL_ORDER, type ArrivalHeroId } from "../../content/story";
import { createRng, seedFrom, type Rng } from "../../lib/random";
import type { Coordinates } from "../../types";
import { CHARACTER_SIZE } from "../characters/instanceData";
import type { HeroClip } from "./heroModel";
import { RUN_CLIP_SPEED, WALK_CLIP_SPEED } from "./heroMotion";
import { yawTo, type KutadaSites, type WorkSpot } from "./kutadaSites";
import { at, DAY_SECONDS } from "./storyClock";
import { huntTarget, stillWindows, type AnimalEvent, type AnimalKind } from "./animals";
import { findWalk, isWalkable, walkLength } from "./walkGrid";

export type Activity = "uyku" | "uyanis" | "sabah" | "odun" | "tasima" | "su" | "toplama" | "av" | "iz" | "kurutma" | "ates" | "yol";
export type Carry = "odun" | "testi" | "sepet" | "av" | null;

export interface HeroProps {
  /** Elinde balta (kılıcı ya da yayı o sırada görünmez). */
  axe: boolean;
  carry: Carry;
}

interface SegmentBase {
  t0: number;
  t1: number;
  clip: HeroClip;
  activity: Activity;
  props: HeroProps;
}
interface StaySegment extends SegmentBase {
  kind: "stay";
  at: Coordinates;
  yaw: number;
}
interface HiddenSegment extends SegmentBase {
  kind: "hidden";
  at: Coordinates;
  yaw: number;
}
interface WalkSegment extends SegmentBase {
  kind: "walk";
  path: Coordinates[];
  /** Her köşeye kadar yürünen yol. */
  cum: number[];
  /** Dünya birimi/sn. */
  speed: number;
  /** Bu klibin 1 hızında yerde aldığı yol (dünya birimi/sn): ayak kaymasın diye klip zamanı yoldan hesaplanır. */
  stride: number;
}
export type Segment = StaySegment | HiddenSegment | WalkSegment;

export interface SchedulePose {
  x: number;
  z: number;
  yaw: number;
  clip: HeroClip;
  /** Klibin zamanı (saniye, 1 hızında); döngülerde klip boyuyla bölünür. */
  clipTime: number;
  /** Çadırın içinde: görünmez. */
  hidden: boolean;
  activity: Activity;
  props: HeroProps;
  /** Yürüyor mu (konum değişiyor mu)? */
  moving: boolean;
}

export interface ChopEvent {
  tree: number;
  hero: ArrivalHeroId;
  start: number;
  /** Ağacın devrildiği an. */
  fall: number;
  /** Devrilen gövdeyi yarmaya başladığı ve bitirdiği an. */
  splitStart: number;
  splitEnd: number;
  /** Yarılan odunların (bağların) alındığı anlar. */
  pickups: number[];
}

export interface DayPlan {
  day: number;
  heroes: ArrivalHeroId[];
  timelines: Map<ArrivalHeroId, Segment[]>;
  chops: ChopEvent[];
  /** İstife bırakılan bağ odunların anları (sıralı). */
  drops: number[];
  /** Ateşe atılan odunların anları (sıralı). */
  feeds: number[];
  /** Toplanan çalı ve otlar: hangisi, ne zaman başlandı, ne zaman bitti. */
  bushPicks: { index: number; start: number; end: number }[];
  herbPicks: { index: number; start: number; end: number }[];
  /** mhellingtr'nin attığı oklar: ne zaman, nereden, nereye, isabet mi. */
  shots: Shot[];
  /** Günün avı (hangi hayvan) ve yakalandıysa ne zaman, nerede. */
  hunt: { kind: AnimalKind; index: number };
  kill: Kill | null;
  /** Günün avının ok olayları (kaçış, yığılma): hayvan bunlarla birlikte okunur (animals.ts → animalPose). */
  huntEvents: AnimalEvent[];
}

export interface Shot {
  at: number;
  from: Coordinates;
  to: Coordinates;
  hit: boolean;
}

export interface Kill {
  kind: AnimalKind;
  index: number;
  at: Coordinates;
  yaw: number;
  /** Okun saplandığı, avcının sırtladığı ve asacağa astığı anlar. */
  time: number;
  pickup: number;
  hang: number;
}

// ── Hızlar ─────────────────────────────────────────────────────────

/** Klibin 1 hızında yerde aldığı yol (model birimi/sn). */
const CLIP_GROUND: Partial<Record<HeroClip, number>> = {
  yuru: WALK_CLIP_SPEED,
  kos: RUN_CLIP_SPEED,
  // Sırtta yük: uyluk ±20°, adım 0,55 sn → 2 × 1,75 × sin 20° / 0,55.
  tasi: 2.18,
  // Eğilerek çadıra girip çıkma: uyluk 45 ± 12°, diz bükük.
  cadir: 0.62,
};
/** Gerçek yürüyüş klibinin biraz altında: ayaklar kaymaz, adımlar rahat görünür. */
const PACE = 0.95;

export const CLIP_LENGTH: Readonly<Record<HeroClip, number>> = {
  bosta: 2.4,
  yuru: 1.0,
  kos: 0.62,
  balta: 1.3,
  yay: 2.4,
  topla: 2.2,
  tasi: 1.1,
  otur: 3.0,
  sohbet: 3.0,
  selam: 1.8,
  esne: 3.0,
  cadir: 1.6,
  yika: 2.6,
};

/** Baltanın gövdeye indiği an (balta klibinde). */
export const AXE_IMPACT = 0.62;

const NO_PROPS: HeroProps = { axe: false, carry: null };
const AXE: HeroProps = { axe: true, carry: null };
const WOOD: HeroProps = { axe: false, carry: "odun" };
const JUG: HeroProps = { axe: false, carry: "testi" };
const BASKET: HeroProps = { axe: false, carry: "sepet" };
const CATCH: HeroProps = { axe: false, carry: "av" };

/** Okun hızı (dünya birimi/sn): uçuş süresi buradan. */
export const ARROW_SPEED = 38;
export const arrowFlight = (from: Coordinates, to: Coordinates) => Math.hypot(to.x - from.x, to.y - from.y) / ARROW_SPEED;
/** Yay klibinde okun bırakıldığı an. */
export const BOW_RELEASE = 1.72;
/** Pusu: hayvana ne kadar yaklaşınca eğilir, nereden atar (dünya birimi). */
const AMBUSH: Readonly<Record<AnimalKind, { approach: number; aim: number }>> = {
  geyik: { approach: 26, aim: 16 },
  tavsan: { approach: 19, aim: 12 },
  kus: { approach: 15, aim: 11 },
};

// ── Çizelge kurucu ─────────────────────────────────────────────────

class Builder {
  readonly segments: Segment[] = [];
  readonly sites: KutadaSites;
  t: number;
  pos: Coordinates;
  yaw: number;

  constructor(sites: KutadaSites, start: Coordinates, yaw: number) {
    this.sites = sites;
    this.t = 0;
    this.pos = start;
    this.yaw = yaw;
  }

  stay(duration: number, clip: HeroClip, activity: Activity, props: HeroProps = NO_PROPS, yaw = this.yaw): this {
    if (duration <= 0) return this;
    this.segments.push({ kind: "stay", t0: this.t, t1: this.t + duration, clip, activity, props, at: this.pos, yaw });
    this.t += duration;
    this.yaw = yaw;
    return this;
  }

  /** Verilen ana kadar bekler (geçtiyse hiçbir şey eklemez). */
  stayUntil(time: number, clip: HeroClip, activity: Activity, props: HeroProps = NO_PROPS, yaw = this.yaw): this {
    return this.stay(time - this.t, clip, activity, props, yaw);
  }

  hide(until: number, at: Coordinates, yaw: number): this {
    if (until <= this.t) return this;
    this.segments.push({ kind: "hidden", t0: this.t, t1: until, clip: "bosta", activity: "uyku", props: NO_PROPS, at, yaw });
    this.t = until;
    return this;
  }

  /** Yürüme ağıyla (çadırlara, ocağa çarpmadan) hedefe yürür. direct: düz çizgi (çadır kapısı). */
  walk(to: Coordinates, clip: HeroClip, activity: Activity, props: HeroProps = NO_PROPS, direct = false): this {
    const path = direct ? [this.pos, to] : findWalk(this.sites.grid, this.pos, to);
    const cum = [0];
    for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
    const length = cum[cum.length - 1];
    if (length < 0.05) return this;
    const stride = (CLIP_GROUND[clip] ?? WALK_CLIP_SPEED) * CHARACTER_SIZE;
    const speed = stride * PACE;
    const duration = length / speed;
    this.segments.push({ kind: "walk", t0: this.t, t1: this.t + duration, clip, activity, props, path, cum, speed, stride });
    this.t += duration;
    this.pos = to;
    const a = path[path.length - 2];
    this.yaw = yawTo(a, to);
    return this;
  }

  /** Bir iş yerine yürüyüp ona dönük durur. */
  work(spot: WorkSpot, duration: number, clip: HeroClip, activity: Activity, props: HeroProps = NO_PROPS, walkProps: HeroProps = props, walkClip: HeroClip = "yuru"): this {
    return this.walk(spot.at, walkClip, "yol", walkProps).stay(duration, clip, activity, props, spot.yaw);
  }

  /** Çizelgeyi bu anda keser: taşan parça kısalır, yürüyüş yarıda kalır (sonraki iş oradan başlar). */
  cutAt(time: number): this {
    while (this.segments.length > 0 && this.segments[this.segments.length - 1].t0 >= time) this.segments.pop();
    const last = this.segments[this.segments.length - 1];
    if (last) {
      if (last.t1 > time) last.t1 = time;
      // Atılan parçalar yürüyüş olabilir: yer ve yön kalan son parçadan yeniden okunur.
      if (last.kind === "walk") {
        const pose = poseInSegment(last, last.t1);
        this.pos = { x: pose.x, y: pose.z };
        this.yaw = pose.yaw;
      } else {
        this.pos = last.at;
        this.yaw = last.yaw;
      }
      this.t = last.t1;
    }
    // Boşluk kalmasın.
    if (this.t < time) this.stay(time - this.t, last?.kind === "stay" ? last.clip : "bosta", last?.activity ?? "yol", last?.props ?? NO_PROPS, this.yaw);
    this.t = time;
    return this;
  }
}

// ── Duruşu okumak ──────────────────────────────────────────────────

/** Yürüyüş yönü yumuşak dönsün diye bu kadar ileriye bakılır (dünya birimi). */
const LOOK_AHEAD = 1.4;

function pointAlong(seg: WalkSegment, d: number): Coordinates {
  const { path, cum } = seg;
  if (d <= 0) return path[0];
  const total = cum[cum.length - 1];
  if (d >= total) return path[path.length - 1];
  let i = 1;
  while (cum[i] < d) i++;
  const f = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
  return { x: path[i - 1].x + (path[i].x - path[i - 1].x) * f, y: path[i - 1].y + (path[i].y - path[i - 1].y) * f };
}

function poseInSegment(seg: Segment, time: number, out?: SchedulePose): SchedulePose {
  const pose = out ?? { x: 0, z: 0, yaw: 0, clip: "bosta" as HeroClip, clipTime: 0, hidden: false, activity: "yol" as Activity, props: NO_PROPS, moving: false };
  pose.clip = seg.clip;
  pose.activity = seg.activity;
  pose.props = seg.props;
  if (seg.kind === "walk") {
    const total = seg.cum[seg.cum.length - 1];
    const d = Math.min(total, Math.max(0, (time - seg.t0) * seg.speed));
    const p = pointAlong(seg, d);
    const ahead = d + LOOK_AHEAD <= total ? pointAlong(seg, d + LOOK_AHEAD) : seg.path[seg.path.length - 1];
    const behind = d + LOOK_AHEAD <= total ? p : pointAlong(seg, Math.max(0, total - LOOK_AHEAD));
    pose.x = p.x;
    pose.z = p.y;
    pose.yaw = yawTo(behind, ahead);
    pose.clipTime = d / seg.stride;
    pose.hidden = false;
    pose.moving = true;
  } else {
    pose.x = seg.at.x;
    pose.z = seg.at.y;
    pose.yaw = seg.yaw;
    pose.clipTime = time - seg.t0;
    pose.hidden = seg.kind === "hidden";
    pose.moving = false;
  }
  return pose;
}

/** Çizelgenin verilen saniyedeki parçası (ikili arama). */
export function segmentAt(timeline: readonly Segment[], seconds: number): Segment {
  let lo = 0;
  let hi = timeline.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (timeline[mid].t0 <= seconds) lo = mid;
    else hi = mid - 1;
  }
  return timeline[lo];
}

/** Kahramanın verilen saniyedeki duruşu. */
export function poseAt(timeline: readonly Segment[], seconds: number, out?: SchedulePose): SchedulePose {
  return poseInSegment(segmentAt(timeline, seconds), seconds, out);
}

// ── Günün kurgusu ──────────────────────────────────────────────────

/** Uyku ve uyanış saatleri (BinTaş önce kalkar, ocağı yakar). */
export const SLEEP_AT: Readonly<Record<ArrivalHeroId, number>> = { mhellingtr: at(0, 50), egetunce: at(0, 55), bintas: at(1, 0) };
export const WAKE_AT: Readonly<Record<ArrivalHeroId, number>> = { mhellingtr: at(5, 0), egetunce: at(5, 6), bintas: at(4, 48) };
const WORK_START = at(7);
const GATHER_START = at(12);
const HUNT_START = at(15);
const HOME_AT = at(18, 40);

const between = (rng: Rng, a: number, b: number) => a + (b - a) * rng.next();

/** Ateş başında: oturur, ara ara sohbet eder (BinTaş arada ateşe odun atar). */
function campfire(b: Builder, sites: KutadaSites, id: ArrivalHeroId, until: number, rng: Rng, plan: DayPlan) {
  const seat = sites.homes[id].seat;
  let nextFeed = b.t + between(rng, 900, 1500);
  while (b.t < until) {
    if (id === "bintas" && b.t >= nextFeed) {
      b.work(sites.stackSpot, 3, "topla", "ates")
        .walk(sites.fireSpot.at, "tasi", "ates", WOOD)
        .stay(3, "topla", "ates", NO_PROPS, sites.fireSpot.yaw);
      plan.feeds.push(b.t - 1.5);
      b.walk(seat.at, "yuru", "yol");
      nextFeed = b.t + between(rng, 1300, 1900);
      continue;
    }
    b.stay(between(rng, 30, 90), "otur", "ates", NO_PROPS, seat.yaw).stay(between(rng, 15, 45), "sohbet", "ates", NO_PROPS, seat.yaw);
  }
  b.cutAt(until);
}

function goToSleep(b: Builder, sites: KutadaSites, id: ArrivalHeroId, wake: number) {
  const home = sites.homes[id];
  b.walk(home.front, "yuru", "yol").walk(home.door, "cadir", "uyku", NO_PROPS, true);
  b.hide(wake, home.door, home.inYaw);
}

function wakeUp(b: Builder, sites: KutadaSites, id: ArrivalHeroId) {
  const home = sites.homes[id];
  b.walk(home.front, "cadir", "uyanis", NO_PROPS, true).stay(CLIP_LENGTH.esne, "esne", "uyanis", NO_PROPS, home.inYaw + Math.PI);
}

/** Odun: ağacı kesen. Taşıyan yoksa bağları istife kendisi taşır. */
function chopWood(b: Builder, sites: KutadaSites, id: ArrivalHeroId, carriesOwn: boolean, rng: Rng, plan: DayPlan) {
  const order = sites.trees.map((_, i) => i).sort((x, y) => ((x * 7 + plan.day * 5) % 12) - ((y * 7 + plan.day * 5) % 12));
  // Bir ağaç ≈ yarım saat (devirmek + yarmak): dokuz ağaç sabahı doldurur.
  const count = carriesOwn ? 8 : 9;
  for (let k = 0; k < count && b.t < GATHER_START; k++) {
    const index = order[k % order.length];
    const tree = sites.trees[index];
    b.walk(tree.spot.at, "yuru", "yol", AXE);
    const start = b.t;
    b.stay(between(rng, 780, 900), "balta", "odun", AXE, tree.spot.yaw);
    const fall = b.t;
    b.stay(5, "bosta", "odun", AXE, tree.spot.yaw).walk(tree.logSpot.at, "yuru", "yol", AXE);
    const splitStart = b.t;
    b.stay(between(rng, 840, 960), "balta", "odun", AXE, tree.logSpot.yaw);
    const event: ChopEvent = { tree: index, hero: id, start, fall, splitStart, splitEnd: b.t, pickups: [] };
    plan.chops.push(event);
    b.stay(30, "bosta", "odun", AXE, tree.logSpot.yaw);
    if (carriesOwn) {
      for (let trip = 0; trip < 2; trip++) {
        if (trip > 0) b.walk(tree.logSpot.at, "yuru", "yol");
        b.stay(4, "topla", "tasima", NO_PROPS, tree.logSpot.yaw);
        event.pickups.push(b.t);
        b.walk(sites.stackSpot.at, "tasi", "tasima", WOOD).stay(3, "topla", "tasima", NO_PROPS, sites.stackSpot.yaw);
        plan.drops.push(b.t - 1);
      }
    }
  }
  // Kalan vakitte istifi düzeltir, nefeslenir.
  if (b.t < GATHER_START) b.walk(sites.stackSpot.at, "yuru", "yol");
  while (b.t < GATHER_START) b.stay(between(rng, 90, 150), "topla", "odun", NO_PROPS, sites.stackSpot.yaw).stay(between(rng, 30, 60), "bosta", "odun", NO_PROPS, sites.stackSpot.yaw);
  b.cutAt(GATHER_START);
}

/** Odun: taşıyan (ağacı başkası keserken). Her yarılan ağaçtan üç bağ taşır, arada istifi düzeltir. */
function carryWood(b: Builder, sites: KutadaSites, chops: readonly ChopEvent[], rng: Rng, plan: DayPlan) {
  b.walk(sites.stackSpot.at, "yuru", "yol");
  const idle = (until: number) => {
    while (b.t < until) b.stay(Math.min(until - b.t, between(rng, 80, 140)), "topla", "tasima", NO_PROPS, sites.stackSpot.yaw).stay(Math.min(Math.max(0, until - b.t), between(rng, 20, 45)), "bosta", "tasima", NO_PROPS, sites.stackSpot.yaw);
  };
  for (const chop of chops) {
    if (chop.splitEnd >= GATHER_START) break;
    idle(chop.splitEnd + 20);
    const tree = sites.trees[chop.tree];
    for (let trip = 0; trip < 3 && b.t < GATHER_START; trip++) {
      b.walk(tree.logSpot.at, "yuru", "yol").stay(4, "topla", "tasima", NO_PROPS, tree.logSpot.yaw);
      chop.pickups.push(b.t);
      b.walk(sites.stackSpot.at, "tasi", "tasima", WOOD).stay(3, "topla", "tasima", NO_PROPS, sites.stackSpot.yaw);
      plan.drops.push(b.t - 1);
    }
  }
  idle(GATHER_START);
  b.cutAt(GATHER_START);
}

/** BinTaş sabah: dereden su taşır, kazana bakar. */
function fetchWater(b: Builder, sites: KutadaSites, rng: Rng) {
  while (b.t < GATHER_START) {
    b.work(sites.water, 8, "topla", "su")
      .walk(sites.cauldronSpot.at, "tasi", "su", JUG)
      .stay(between(rng, 100, 140), "topla", "su", NO_PROPS, sites.cauldronSpot.yaw);
    const until = b.t + between(rng, 1100, 1600);
    while (b.t < until) b.stay(between(rng, 150, 260), "topla", "su", NO_PROPS, sites.cauldronSpot.yaw).stay(between(rng, 40, 80), "bosta", "su", NO_PROPS, sites.cauldronSpot.yaw);
  }
  b.cutAt(GATHER_START);
}

/** Toplama: sırayla iş yerlerine gider; iki yerde bir sepeti teslim eder. */
function gather(b: Builder, spots: readonly WorkSpot[], indices: readonly number[], deliver: WorkSpot, rng: Rng, picks: DayPlan["bushPicks"]) {
  if (indices.length === 0) return;
  const perSpot = (at(15) - at(12)) / indices.length;
  let k = 0;
  while (b.t < HUNT_START) {
    const index = indices[k % indices.length];
    b.walk(spots[index].at, "yuru", "yol", BASKET);
    const start = b.t;
    b.stay(Math.max(120, perSpot - between(rng, 60, 110)), "topla", "toplama", BASKET, spots[index].yaw);
    if (k < indices.length) picks.push({ index, start, end: b.t });
    k++;
    if (k % 2 === 0) b.work(deliver, 5, "topla", "toplama", NO_PROPS, BASKET);
  }
  b.cutAt(HUNT_START);
}

/**
 * Av: mhellingtr çayırın kenarına gelir, günün avını gözler. Hayvan bir yerde otlarken (kıpırdamadan dururken)
 * yürüyerek yaklaşır, son metreleri eğilerek gider, yayı gerer. Iskalarsa hayvan kaçar, yeniden pusu kurar; son
 * ok isabet eder: hayvan yere yığılır, koşup sırtlar, kamptaki asacağa asar, ateş başında dinlenir.
 */
function hunt(b: Builder, sites: KutadaSites, id: ArrivalHeroId, rng: Rng, plan: DayPlan, events: AnimalEvent[]) {
  const target = plan.hunt;
  const ambush = AMBUSH[target.kind];
  const rim = sites.meadow.rim.length > 0 ? sites.meadow.rim : sites.meadow.spots;
  const fromCamp = (s: WorkSpot) => Math.hypot(s.at.x - sites.center.x, s.at.y - sites.center.y);
  const edge = rim.reduce((best, s) => (fromCamp(s) < fromCamp(best) ? s : best));
  b.walk(edge.at, "yuru", "av").stay(between(rng, 20, 40), "bosta", "av", NO_PROPS, yawTo(edge.at, sites.meadow.center));
  // Önce çayırın kenarında dolaşıp gözler: avı acele etmez.
  const scout = (until: number) => {
    let k = Math.floor(rng.next() * rim.length);
    while (b.t < until) {
      const s = rim[k % rim.length];
      b.walk(s.at, "yuru", "av").stay(Math.min(Math.max(0, until - b.t), between(rng, 60, 160)), "bosta", "av", NO_PROPS, s.yaw);
      k += rng.next() < 0.5 ? 1 : rim.length - 1;
    }
  };
  scout(at(15) + between(rng, 1800, 4200));
  const attempts = 1 + Math.floor(rng.next() * 3);
  const walkSpeed = WALK_CLIP_SPEED * CHARACTER_SIZE * PACE;
  const crouchSpeed = (CLIP_GROUND.cadir ?? 0.62) * CHARACTER_SIZE * PACE;
  const crouchTime = (ambush.approach - ambush.aim) / crouchSpeed;
  let misses = 0;
  let guard = 0;
  while (!plan.kill && b.t < at(18, 2) && guard++ < 60) {
    let acted = false;
    for (const w of stillWindows(sites, plan.day, target.kind, target.index, events, b.t + 3, b.t + 1200, crouchTime + BOW_RELEASE + 2)) {
      const P = w.at;
      let dx = b.pos.x - P.x;
      let dz = b.pos.y - P.y;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      const A = { x: P.x + dx * ambush.approach, y: P.y + dz * ambush.approach };
      const C = { x: P.x + dx * ambush.aim, y: P.y + dz * ambush.aim };
      if (!isWalkable(sites.grid, A) || !isWalkable(sites.grid, C)) continue;
      const walkTime = walkLength(findWalk(sites.grid, b.pos, A)) / walkSpeed;
      // Hayvan durmaya başlayınca pusu yerine varacak şekilde yola çık.
      const leave = Math.max(b.t, w.t0 - walkTime + 1);
      if (leave - b.t > 900) break;
      const shotAt = leave + walkTime + crouchTime + BOW_RELEASE;
      if (shotAt > w.t1 - 1) continue;
      b.stayUntil(leave, "bosta", "av", NO_PROPS, yawTo(b.pos, P));
      b.walk(A, "yuru", "av").walk(C, "cadir", "av", NO_PROPS, true);
      const aimYaw = yawTo(C, P);
      const release = b.t + BOW_RELEASE;
      b.stay(CLIP_LENGTH.yay, "yay", "av", NO_PROPS, aimYaw);
      const hit = misses + 1 >= attempts || release > at(17, 45);
      if (!hit) {
        const side = { x: -dz, y: dx };
        const miss = { x: P.x + side.x * 2.6 - dx * 2, y: P.y + side.y * 2.6 - dz * 2 };
        plan.shots.push({ at: release, from: C, to: miss, hit: false });
        events.push({ type: "flee", at: release + arrowFlight(C, miss), from: C });
        misses++;
        b.stay(between(rng, 5, 10), "bosta", "av", NO_PROPS, aimYaw);
        // Hayvanlar yatışsın diye kenara çekilip bekler.
        scout(Math.min(at(17, 30), b.t + between(rng, 600, 1400)));
      } else {
        const time = release + arrowFlight(C, P);
        plan.shots.push({ at: release, from: C, to: P, hit: true });
        // Hayvanın yığılmasını izler, yanına yürür, diz çöküp sırtlar.
        b.stay(2.6, "bosta", "av", NO_PROPS, aimYaw);
        const kneel = { x: P.x + dx * 2.3, y: P.y + dz * 2.3 };
        b.walk(kneel, "yuru", "av").stay(6, "topla", "av", NO_PROPS, yawTo(kneel, P));
        const pickup = b.t - 1;
        events.push({ type: "kill", at: time, pickup });
        b.walk(sites.huntRackSpot.at, "tasi", "av", CATCH).stay(5, "topla", "av", NO_PROPS, sites.huntRackSpot.yaw);
        plan.kill = { kind: target.kind, index: target.index, at: P, yaw: w.yaw, time, pickup, hang: b.t - 1.5 };
      }
      acted = true;
      break;
    }
    // Uygun an yoksa kenarda bekleyip gözler.
    if (!acted) b.stay(between(rng, 25, 45), "bosta", "av", NO_PROPS, yawTo(b.pos, sites.meadow.center));
  }
  // Av asıldıysa ateş başında dinlenir; yoksa akşama kadar gözlemeye devam eder.
  if (plan.kill) {
    const seat = sites.homes[id].seat;
    b.walk(seat.at, "yuru", "yol").stayUntil(HOME_AT, "otur", "ates", NO_PROPS, seat.yaw);
  } else {
    while (b.t < HOME_AT) b.stay(between(rng, 25, 45), "bosta", "av", NO_PROPS, yawTo(b.pos, sites.meadow.center));
  }
  b.cutAt(HOME_AT);
}

/** İz sürmek: egetunce çayırın kenarında dolaşıp eğilip izlere bakar (hayvanları ürkütmez). */
function track(b: Builder, sites: KutadaSites, rng: Rng) {
  const spots = sites.meadow.rim.length >= 4 ? sites.meadow.rim : sites.meadow.spots;
  let k = Math.floor(rng.next() * spots.length) + 4;
  while (b.t < HOME_AT) {
    const s = spots[k % spots.length];
    b.walk(s.at, "yuru", "iz").stay(between(rng, 15, 30), "topla", "iz", NO_PROPS, s.yaw).stay(between(rng, 10, 25), "bosta", "iz", NO_PROPS, s.yaw);
    k += 2;
  }
  b.cutAt(HOME_AT);
}

/** BinTaş ikindi: otları kurutur, ocağa bakar, biraz dinlenir. */
function dryHerbs(b: Builder, sites: KutadaSites, rng: Rng) {
  const seat = sites.homes.bintas.seat;
  while (b.t < HOME_AT) {
    b.work(sites.rackSpot, between(rng, 480, 720), "topla", "kurutma")
      .work(sites.fireSpot, between(rng, 30, 50), "topla", "kurutma")
      .walk(seat.at, "yuru", "yol")
      .stay(between(rng, 300, 600), "otur", "kurutma", NO_PROPS, seat.yaw);
  }
  b.cutAt(HOME_AT);
}

function buildTimeline(sites: KutadaSites, id: ArrivalHeroId, heroes: readonly ArrivalHeroId[], plan: DayPlan, chopsByOther: readonly ChopEvent[], huntEvents: AnimalEvent[]): Segment[] {
  const rng = createRng(seedFrom("gun-duzeni", plan.day, id));
  const home = sites.homes[id];
  const b = new Builder(sites, home.seat.at, home.seat.yaw);
  const present = (h: ArrivalHeroId) => heroes.includes(h);

  // Gece yarısından uykuya: ateş başı sürer.
  campfire(b, sites, id, SLEEP_AT[id], createRng(seedFrom("gece-yarisi", plan.day, id)), plan);
  goToSleep(b, sites, id, WAKE_AT[id]);
  wakeUp(b, sites, id);

  // Sabah: BinTaş önce ocağı yakar; herkes derede yüzünü yıkar, ateş başında kahvaltı eder.
  if (id === "bintas") b.work(sites.fireSpot, between(rng, 140, 200), "topla", "sabah");
  b.work(sites.water, between(rng, 70, 110), "yika", "sabah");
  if (id === "bintas") b.work(sites.cauldronSpot, 1, "topla", "sabah").stayUntil(WORK_START, "topla", "sabah", NO_PROPS, sites.cauldronSpot.yaw);
  else b.walk(home.seat.at, "yuru", "yol").stayUntil(WORK_START, "otur", "sabah", NO_PROPS, home.seat.yaw);
  b.cutAt(WORK_START);

  // Odun.
  const chopper: ArrivalHeroId = present("egetunce") ? "egetunce" : "mhellingtr";
  if (id === "bintas") fetchWater(b, sites, rng);
  else if (id === chopper) chopWood(b, sites, id, !(chopper === "egetunce" && present("mhellingtr")), rng, plan);
  else carryWood(b, sites, chopsByOther, rng, plan);

  // Toplama.
  const herbIndices = sites.herbs.map((_, i) => i);
  if (id === "mhellingtr") gather(b, sites.bushes, sites.bushes.map((_, i) => i), sites.cauldronSpot, rng, plan.bushPicks);
  else {
    const both = present("egetunce") && present("bintas");
    const mine = both ? herbIndices.filter((i) => i % 2 === (id === "egetunce" ? 0 : 1)) : herbIndices;
    gather(b, sites.herbs, mine, sites.rackSpot, rng, plan.herbPicks);
  }

  // Av ya da kurutma.
  if (id === "mhellingtr") hunt(b, sites, id, rng, plan, huntEvents);
  else if (id === "egetunce") track(b, sites, rng);
  else dryHerbs(b, sites, rng);

  // Akşam: ateş başı.
  b.walk(home.seat.at, "yuru", "yol");
  campfire(b, sites, id, DAY_SECONDS, rng, plan);
  return b.segments;
}

const plans = new Map<string, DayPlan>();

/** Geliştirmede ?av=geyik|tavsan|kus ile günün avı seçilir (yayında yok sayılır; StoryLayer ayarlar). */
let huntPreview: AnimalKind | null = null;
export function setHuntPreview(kind: AnimalKind | null): void {
  huntPreview = kind;
}
export function parseHuntPreview(search: string): AnimalKind | null {
  const value = new URLSearchParams(search).get("av");
  return value === "geyik" || value === "tavsan" || value === "kus" ? value : null;
}

/** Verilen günün planı (gelmiş kahramanlarla). Son birkaç gün önbellekte tutulur. */
export function dayPlan(sites: KutadaSites, heroes: readonly ArrivalHeroId[], day: number): DayPlan {
  const ordered = ARRIVAL_ORDER.filter((id) => heroes.includes(id));
  const key = `${day}:${ordered.join(",")}:${huntPreview ?? ""}`;
  const cached = plans.get(key);
  if (cached) return cached;
  const plan: DayPlan = {
    day,
    heroes: ordered,
    timelines: new Map(),
    chops: [],
    drops: [],
    feeds: [],
    bushPicks: [],
    herbPicks: [],
    shots: [],
    hunt: huntPreview ? { kind: huntPreview, index: huntPreview === "geyik" ? 1 : 0 } : huntTarget(day),
    kill: null,
    huntEvents: [],
  };
  const huntEvents = plan.huntEvents;
  // Önce ağacı kesen: taşıyan onun yardığı ağaçlara göre gider.
  const chopper: ArrivalHeroId | null = ordered.includes("egetunce") ? "egetunce" : ordered.includes("mhellingtr") ? "mhellingtr" : null;
  const sequence = chopper ? [chopper, ...ordered.filter((id) => id !== chopper)] : ordered;
  for (const id of sequence) plan.timelines.set(id, buildTimeline(sites, id, ordered, plan, plan.chops, huntEvents));

  plan.drops.sort((a, b) => a - b);
  plan.feeds.sort((a, b) => a - b);
  if (plans.size > 8) plans.delete(plans.keys().next().value!);
  plans.set(key, plan);
  return plan;
}

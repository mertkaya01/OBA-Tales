/**
 * KUTADA'NIN HAYVANLARI — av çayırında geyikler, tavşanlar ve kuşlar nasıl yaşar?
 *
 *   · Geyikler sürü hâlinde otlar: sürünün otladığı yer on dakikada bir değişir, her geyik onun çevresinde otlar,
 *     durup etrafı kollar, yürür. Gece daha az kıpırdarlar.
 *   · Tavşanların her birinin çayırda kendi köşesi var: zıplayarak gezer, kemirir, kulak kabartır.
 *   · Kuşlar sürüyle konar (çayıra ya da meyve çalılarına), gagalar, birlikte kalkıp başka yere uçar; akşam uzaklara
 *     gider, sabah geri gelir.
 *   · Av olayları zamana yazılır: ıskalanan ok hayvanı kaçırır; isabet eden ok onu yere yığar, avcı sırtlayınca
 *     çayırdan kalkar. Ertesi gün yeniden doğar.
 *
 * Gün kısa bölümlerden oluşur (geyikte 10, tavşanda 5 dakika; kuşta her konak bir bölüm). Her bölüm sabit bir
 * başlangıç ve bitiş noktası arasında kendi tohumuyla kurulur: o anın duruşu için yalnızca o bölüm hesaplanır,
 * bütün gün bellekte tutulmaz. Saf fonksiyonlardır; testleri animals.test.ts içinde.
 */
import { createRng, hashString, seedFrom, type Rng } from "../../lib/random";
import type { Coordinates } from "../../types";
import { yawTo, type KutadaSites } from "./kutadaSites";
import { at, DAY_SECONDS } from "./storyClock";
import { isWalkable } from "./walkGrid";

export type AnimalKind = "geyik" | "tavsan" | "kus";

export interface AnimalSpec {
  count: number;
  /** Oyundaki ölçek (Blender'da dünya birimiyle kuruldu). */
  scale: number;
  /** Klip boyları (saniye). */
  lengths: Readonly<Record<string, number>>;
  /** Klibin 1 hızında yerde aldığı yol (dünya birimi/sn, ölçek 1); olmayanlarda klip zamanla akar. */
  strides: Readonly<Record<string, number>>;
  move: string;
  flee: string;
  idle: string;
  /** Kaçınca ne kadar uzağa gider. */
  fleeDistance: number;
}

export const ANIMALS: Readonly<Record<AnimalKind, AnimalSpec>> = {
  geyik: {
    count: 4,
    scale: 1.15,
    lengths: { dur: 3.2, otla: 2.4, yuru: 1.2, kos: 0.55, yigil: 2.2 },
    // Yürüyüş: bacak ≈ 2,8, ±20°, adım 0,6 sn → 3,2; dörtnala ≈ 13.
    strides: { yuru: 3.2, kos: 13 },
    move: "yuru",
    flee: "kos",
    idle: "dur",
    fleeDistance: 26,
  },
  tavsan: {
    count: 5,
    scale: 1.25,
    lengths: { bekle: 2.0, kemir: 1.6, zipla: 0.5, kac: 0.32, yigil: 1.8 },
    strides: { zipla: 2.0, kac: 5.0 },
    move: "zipla",
    flee: "kac",
    idle: "bekle",
    fleeDistance: 18,
  },
  kus: {
    count: 7,
    scale: 1.6,
    lengths: { dur: 1.8, gagala: 0.7, kanat: 0.3, suzul: 1.8, yigil: 1.4 },
    strides: {},
    move: "kanat",
    flee: "kanat",
    idle: "dur",
    fleeDistance: 30,
  },
};

export const ANIMAL_KINDS: readonly AnimalKind[] = ["geyik", "tavsan", "kus"];
/** Yığılma klibi: bir kez oynar, son karesinde kalır. */
export const ANIMAL_ONE_SHOT = "yigil";
export const animalKey = (kind: AnimalKind, index: number) => `${kind}-${index}`;

interface Base {
  t0: number;
  t1: number;
  clip: string;
}
export interface AnimalStay extends Base {
  kind: "stay";
  at: Coordinates;
  /** Yerden yükseklik (kuş konarken 0). */
  h: number;
  yaw: number;
}
export interface AnimalMove extends Base {
  kind: "move";
  from: Coordinates;
  to: Coordinates;
  h0: number;
  h1: number;
  /** Yolun ortasında eklenen yükseklik (kuş uçarken kavis). */
  arc: number;
  yaw: number;
  speed: number;
  /** Klibin 1 hızındaki adımı: klip zamanı yoldan (0 ise zamandan). */
  stride: number;
}
export interface AnimalHidden extends Base {
  kind: "hidden";
  at: Coordinates;
  h: number;
  yaw: number;
}
export type AnimalSegment = AnimalStay | AnimalMove | AnimalHidden;

export type AnimalEvent = { type: "flee"; at: number; from: Coordinates } | { type: "kill"; at: number; pickup: number };

export interface AnimalPose {
  x: number;
  /** Yerden yükseklik. */
  h: number;
  z: number;
  yaw: number;
  clip: string;
  clipTime: number;
  hidden: boolean;
  dead: boolean;
  moving: boolean;
}

// ── Çayırda yer seçmek ─────────────────────────────────────────────

/** Hayvanların gezdiği iç çayır (avcı ve iz süren kenardan gelir). */
const INNER = 14;
const NIGHT_FROM = at(20, 30);
const NIGHT_TO = at(5, 30);
export const BIRDS_LEAVE = at(19, 20);
export const BIRDS_RETURN = at(5, 30);
const DEER_SLOT = 600;
const RABBIT_SLOT = 300;

const between = (rng: Rng, a: number, b: number) => a + (b - a) * rng.next();
const isNight = (seconds: number) => seconds < NIGHT_TO || seconds > NIGHT_FROM;

function meadowPoint(sites: KutadaSites, rng: Rng, near: Coordinates, radius: number): Coordinates {
  const { center } = sites.meadow;
  for (let k = 0; k < 24; k++) {
    const angle = rng.next() * Math.PI * 2;
    const r = radius * Math.sqrt(rng.next());
    let p = { x: near.x + Math.cos(angle) * r, y: near.y + Math.sin(angle) * r };
    const d = Math.hypot(p.x - center.x, p.y - center.y);
    if (d > INNER) p = { x: center.x + ((p.x - center.x) / d) * INNER, y: center.y + ((p.y - center.y) / d) * INNER };
    if (isWalkable(sites.grid, p)) return p;
  }
  return near;
}

/** Sürünün otladığı yer (on dakikalık mutlak dilim; bütün geyikler için aynı, gece yarısında da kesintisiz). */
export function herdCenter(sites: KutadaSites, slot: number): Coordinates {
  // Sürü çayırın ortasında kalır: dişiler çevresinde dizilince bile kenardaki iz yoluna (21) taşmaz.
  return meadowPoint(sites, createRng(seedFrom("geyik-suru", slot)), sites.meadow.center, INNER * 0.4);
}

/** Her tavşanın çayırdaki köşesi (her gün aynı). */
export function rabbitHome(sites: KutadaSites, index: number): Coordinates {
  return meadowPoint(sites, createRng(seedFrom("tavsan-yuva", index)), sites.meadow.center, INNER * 0.6);
}

/** Sürüde her geyiğin yeri: erkek ortada, dişiler çevresinde üç yanda (birbirine girmesinler). */
const HERD_RING = 7;
function deerSpot(sites: KutadaSites, rng: Rng, slot: number, index: number): Coordinates {
  const herd = herdCenter(sites, slot);
  const base = (hashString(`suru-yonu-${slot}`) % 628) / 100;
  const angle = base + index * ((Math.PI * 2) / (ANIMALS.geyik.count - 1));
  const r = index === 0 ? 0 : HERD_RING;
  const jitter = 1.6;
  const p = {
    x: herd.x + Math.cos(angle) * r + (rng.next() - 0.5) * 2 * jitter,
    y: herd.y + Math.sin(angle) * r + (rng.next() - 0.5) * 2 * jitter,
  };
  return isWalkable(sites.grid, p) && Math.hypot(p.x - sites.meadow.center.x, p.y - sites.meadow.center.y) <= INNER + HERD_RING * 0.5 ? p : meadowPoint(sites, rng, herd, 3);
}

function slotAnchor(sites: KutadaSites, kind: "geyik" | "tavsan", index: number, slot: number): Coordinates {
  const rng = createRng(seedFrom("hayvan-durak", kind, index, slot));
  if (kind === "geyik") return deerSpot(sites, rng, slot, index);
  return meadowPoint(sites, rng, rabbitHome(sites, index), 5);
}

// ── Bölüm kurucu ───────────────────────────────────────────────────

class EpisodeBuilder {
  readonly segments: AnimalSegment[] = [];
  t: number;
  pos: Coordinates;
  h = 0;
  yaw: number;
  /** Kuş: kaçtıktan sonra döneceği konak. */
  home: Coordinates;
  readonly spec: AnimalSpec;
  readonly sites: KutadaSites;
  readonly end: number;
  private readonly rng: Rng;
  private readonly flees: { at: number; from: Coordinates }[];
  private next = 0;

  constructor(spec: AnimalSpec, sites: KutadaSites, t0: number, end: number, start: Coordinates, yaw: number, events: readonly AnimalEvent[], rng: Rng) {
    this.spec = spec;
    this.sites = sites;
    this.t = t0;
    this.end = end;
    this.pos = start;
    this.home = start;
    this.yaw = yaw;
    this.rng = rng;
    this.flees = events.filter((e): e is { type: "flee"; at: number; from: Coordinates } => e.type === "flee" && e.at >= t0 && e.at < end).sort((a, b) => a.at - b.at);
  }

  private pending(until: number) {
    const e = this.flees[this.next];
    return e && e.at <= until ? e : null;
  }

  stay(duration: number, clip: string, yaw = this.yaw): void {
    if (duration <= 0 || this.t >= this.end) return;
    const end = Math.min(this.end, this.t + duration);
    const flee = this.pending(end);
    const t1 = flee ? Math.max(this.t, flee.at) : end;
    if (t1 > this.t) this.segments.push({ kind: "stay", t0: this.t, t1, clip, at: this.pos, h: this.h, yaw });
    this.t = t1;
    this.yaw = yaw;
    if (flee) this.flee(flee);
  }

  move(to: Coordinates, clip: string, h1 = 0, arc = 0, speedOverride?: number): void {
    if (this.t >= this.end) return;
    const length = Math.hypot(to.x - this.pos.x, to.y - this.pos.y);
    if (length < 0.05 && Math.abs(h1 - this.h) < 0.05) return;
    const stride = (this.spec.strides[clip] ?? 0) * this.spec.scale;
    const speed = speedOverride ?? stride * 0.95;
    const duration = Math.max(0.4, length / Math.max(0.1, speed));
    const yaw = length > 0.05 ? yawTo(this.pos, to) : this.yaw;
    const seg: AnimalMove = { kind: "move", t0: this.t, t1: this.t + duration, clip, from: this.pos, to, h0: this.h, h1, arc, yaw, speed: length / duration, stride };
    const flee = this.pending(Math.min(this.end, seg.t1));
    const cut = flee ? Math.max(seg.t0, flee.at) : Math.min(this.end, seg.t1);
    const p = movePoint(seg, cut);
    seg.t1 = cut;
    if (cut > seg.t0) this.segments.push(seg);
    this.t = cut;
    this.pos = { x: p.x, y: p.z };
    this.h = p.h;
    this.yaw = yaw;
    if (flee) this.flee(flee);
  }

  hide(until: number): void {
    const t1 = Math.min(this.end, until);
    if (t1 <= this.t) return;
    this.segments.push({ kind: "hidden", t0: this.t, t1, clip: this.spec.idle, at: this.pos, h: this.h, yaw: this.yaw });
    this.t = t1;
  }

  /** Bölümü bitiş noktasında kapatır (uzaksa hızlanır). */
  finish(to: Coordinates, clip: string, h = 0, arc = 0): void {
    const left = this.end - this.t;
    if (left > 0.05) {
      const dist = Math.hypot(to.x - this.pos.x, to.y - this.pos.y);
      const normal = (this.spec.strides[clip] ?? 0) * this.spec.scale * 0.95;
      const speed = normal > 0 ? Math.max(normal, dist / Math.max(0.1, left - 0.05)) : Math.max(4, dist / Math.max(0.1, left - 0.05));
      this.move(to, clip, h, arc, speed);
      this.stay(this.end - this.t, this.spec.idle);
    }
  }

  private flee(event: { at: number; from: Coordinates }): void {
    this.next++;
    const { center } = this.sites.meadow;
    let dx = this.pos.x - event.from.x;
    let dz = this.pos.y - event.from.y;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    let to = { x: this.pos.x + dx * this.spec.fleeDistance, y: this.pos.y + dz * this.spec.fleeDistance };
    const bird = this.spec === ANIMALS.kus;
    const limit = bird ? INNER * 2.2 : INNER + 6;
    const d = Math.hypot(to.x - center.x, to.y - center.y);
    if (d > limit) to = { x: center.x + ((to.x - center.x) / d) * limit, y: center.y + ((to.y - center.y) / d) * limit };
    if (bird) {
      this.move(to, "kanat", 0, 5, 9);
      this.stay(between(this.rng, 4, 8), "dur", yawTo(to, event.from));
      this.move(this.home, "kanat", 0, 3, 7);
    } else {
      if (!isWalkable(this.sites.grid, to)) to = meadowPoint(this.sites, this.rng, center, INNER);
      this.move(to, this.spec.flee);
      this.stay(between(this.rng, 4, 8), this.spec.idle, yawTo(to, event.from));
    }
  }
}

function movePoint(seg: AnimalMove, time: number): { x: number; z: number; h: number } {
  const u = seg.t1 > seg.t0 ? Math.min(1, Math.max(0, (time - seg.t0) / (seg.t1 - seg.t0))) : 1;
  return {
    x: seg.from.x + (seg.to.x - seg.from.x) * u,
    z: seg.from.y + (seg.to.y - seg.from.y) * u,
    h: seg.h0 + (seg.h1 - seg.h0) * u + seg.arc * 4 * u * (1 - u),
  };
}

// ── Geyik ve tavşan: sabit uzunlukta bölümler ──────────────────────

function slotEpisode(sites: KutadaSites, kind: "geyik" | "tavsan", index: number, day: number, k: number, events: readonly AnimalEvent[]): AnimalSegment[] {
  const spec = ANIMALS[kind];
  const length = kind === "geyik" ? DEER_SLOT : RABBIT_SLOT;
  const perDay = DAY_SECONDS / length;
  const slot = day * perDay + k;
  const t0 = k * length;
  const t1 = t0 + length;
  const start = slotAnchor(sites, kind, index, slot);
  const end = slotAnchor(sites, kind, index, slot + 1);
  const rng = createRng(seedFrom("hayvan-bolum", kind, index, slot));
  const b = new EpisodeBuilder(spec, sites, t0, t1, start, (hashString(`${kind}${index}${slot}`) % 628) / 100, events, rng);
  const travel = (INNER * 2) / ((spec.strides[spec.move] ?? 1) * spec.scale * 0.95) + 2;
  const night = isNight(t0);
  // Her duruş, bölüm sonundaki buluşma noktasına yürüyecek vakti bırakır.
  const room = (wanted: number) => Math.min(wanted, t1 - travel - b.t);
  if (kind === "geyik") {
    while (b.t < t1 - travel) {
      if (night) {
        b.stay(room(between(rng, 90, 200)), "dur", rng.next() * Math.PI * 2);
        continue;
      }
      b.stay(room(between(rng, 25, 70)), "otla", b.yaw + between(rng, -0.8, 0.8));
      b.stay(room(between(rng, 6, 18)), "dur");
      if (b.t < t1 - travel - 10) b.move(deerSpot(sites, rng, slot, index), "yuru");
    }
  } else {
    const home = rabbitHome(sites, index);
    while (b.t < t1 - travel) {
      if (night) {
        b.stay(room(between(rng, 60, 160)), "bekle");
        continue;
      }
      b.stay(room(between(rng, 15, 45)), "kemir", b.yaw + between(rng, -1, 1));
      b.stay(room(between(rng, 6, 15)), "bekle");
      if (b.t < t1 - travel - 6) b.move(meadowPoint(sites, rng, home, 5), "zipla");
    }
  }
  b.finish(end, spec.move);
  return b.segments;
}

// ── Kuş: konak konak ───────────────────────────────────────────────

interface BirdVisit {
  t0: number;
  t1: number;
  spot: Coordinates;
}

const visitCache = new Map<string, BirdVisit[]>();

/** Kuş sürüsünün o günkü konakları (bütün kuşlar için aynı): çayırda ya da meyve çalılarında. */
export function birdVisits(sites: KutadaSites, day: number): BirdVisit[] {
  const key = `${day}`;
  const cached = visitCache.get(key);
  if (cached) return cached;
  const rng = createRng(seedFrom("kus-suru", day));
  const visits: BirdVisit[] = [];
  let t = BIRDS_RETURN + 20;
  while (t < BIRDS_LEAVE - 60) {
    const atBush = rng.next() < 0.3;
    const spot = atBush ? sites.bushes[Math.floor(rng.next() * sites.bushes.length)].at : meadowPoint(sites, rng, sites.meadow.center, INNER);
    const length = between(rng, 150, 330);
    visits.push({ t0: t, t1: Math.min(t + length, BIRDS_LEAVE - 30), spot });
    t += length + 12;
  }
  if (visitCache.size > 6) visitCache.delete(visitCache.keys().next().value!);
  visitCache.set(key, visits);
  return visits;
}

/** Kuşların gece gittiği yer: çayırın kuzeyinde, uzakta ve yüksekte. */
const roostOf = (sites: KutadaSites): Coordinates => ({ x: sites.meadow.center.x + 20, y: sites.meadow.center.y - 70 });
const ROOST_HEIGHT = 16;
const birdDelay = (index: number) => index * 0.35 + (hashString(`kus-gecikme-${index}`) % 30) / 100;

function landing(day: number, visit: number, index: number, spot: Coordinates): Coordinates {
  const rng = createRng(seedFrom("kus-konak", day, visit, index));
  const angle = (index / ANIMALS.kus.count) * Math.PI * 2 + rng.next() * 0.6;
  const r = 0.8 + rng.next() * 1.8;
  return { x: spot.x + Math.cos(angle) * r, y: spot.y + Math.sin(angle) * r };
}

/** Kuşun i. konak bölümü (i = konak sayısı: akşam uçup gidişi). */
function birdEpisode(sites: KutadaSites, day: number, index: number, i: number, events: readonly AnimalEvent[]): AnimalSegment[] {
  const visits = birdVisits(sites, day);
  const delay = birdDelay(index);
  const roost = roostOf(sites);
  const rng = createRng(seedFrom("kus-bolum", day, i, index));
  const t0 = visits[i] ? visits[i].t0 + delay : BIRDS_LEAVE + delay;
  const t1 = visits[i + 1] ? visits[i + 1].t0 + delay : i < visits.length ? BIRDS_LEAVE + delay : DAY_SECONDS;
  const from = i === 0 ? roost : landing(day, i - 1, index, visits[i - 1].spot);
  const b = new EpisodeBuilder(ANIMALS.kus, sites, t0, t1, from, 0, events, rng);
  if (i === 0) b.h = ROOST_HEIGHT;
  if (i >= visits.length) {
    // Akşam: uzaklara uçar, gece görünmez.
    b.move(roost, "kanat", ROOST_HEIGHT, 3, 9);
    b.hide(t1);
    return b.segments;
  }
  const land = landing(day, i, index, visits[i].spot);
  b.home = land;
  const mid = { x: (b.pos.x + land.x) / 2, y: (b.pos.y + land.y) / 2 };
  const height = Math.max(4, Math.hypot(land.x - b.pos.x, land.y - b.pos.y) * 0.12);
  b.move(mid, "kanat", height, 1.5, 8);
  b.move(land, "suzul", 0, 0.5, 6);
  const room = (wanted: number) => Math.min(wanted, t1 - 2.5 - b.t);
  while (b.t < t1 - 2.5) {
    b.stay(room(between(rng, 6, 14)), "gagala", b.yaw + between(rng, -1.2, 1.2));
    b.stay(room(between(rng, 4, 10)), "dur");
    if (rng.next() < 0.2 && b.t < t1 - 4) {
      const hop = { x: land.x + between(rng, -1.2, 1.2), y: land.y + between(rng, -1.2, 1.2) };
      b.move(hop, "kanat", 0, 0.6, 3);
    }
  }
  // Bir sonraki konağa kalkış yerinde bitir.
  b.finish(land, "kanat", 0, 0.4);
  return b.segments;
}

function birdEpisodeIndex(sites: KutadaSites, day: number, index: number, seconds: number): number {
  const visits = birdVisits(sites, day);
  const delay = birdDelay(index);
  let lo = 0;
  let hi = visits.length; // visits.length = akşam bölümü
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    const start = mid < visits.length ? visits[mid].t0 + delay : BIRDS_LEAVE + delay;
    if (start <= seconds) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// ── Duruş ──────────────────────────────────────────────────────────

/** Bir hayvanın bir anı kapsayan bölümü (önbellek için anahtarıyla). */
export function animalEpisodeAt(sites: KutadaSites, day: number, kind: AnimalKind, index: number, seconds: number, events: readonly AnimalEvent[]): { key: string; t0: number; t1: number; build: () => AnimalSegment[] } {
  if (kind === "kus") {
    const visits = birdVisits(sites, day);
    const delay = birdDelay(index);
    if (visits.length === 0 || seconds < visits[0].t0 + delay) {
      // Sabah dönmeden önce (ve gece yarısından sonra) uzakta.
      const roost = roostOf(sites);
      const end = visits.length ? visits[0].t0 + delay : DAY_SECONDS;
      return { key: `${day}:sabah`, t0: 0, t1: end, build: () => [{ kind: "hidden", t0: 0, t1: end, clip: "dur", at: roost, h: ROOST_HEIGHT, yaw: 0 }] };
    }
    const i = birdEpisodeIndex(sites, day, index, seconds);
    const t0 = i < visits.length ? visits[i].t0 + delay : BIRDS_LEAVE + delay;
    const t1 = visits[i + 1] ? visits[i + 1].t0 + delay : i < visits.length ? BIRDS_LEAVE + delay : DAY_SECONDS;
    return { key: `${day}:${i}:${events.length}`, t0, t1, build: () => birdEpisode(sites, day, index, i, events) };
  }
  const length = kind === "geyik" ? DEER_SLOT : RABBIT_SLOT;
  const k = Math.min(DAY_SECONDS / length - 1, Math.max(0, Math.floor(seconds / length)));
  return { key: `${day}:${k}:${events.length}`, t0: k * length, t1: (k + 1) * length, build: () => slotEpisode(sites, kind, index, day, k, events) };
}

function segmentIn(segments: readonly AnimalSegment[], seconds: number): AnimalSegment {
  let lo = 0;
  let hi = segments.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (segments[mid].t0 <= seconds) lo = mid;
    else hi = mid - 1;
  }
  return segments[lo];
}

function poseFromSegment(seg: AnimalSegment, seconds: number, pose: AnimalPose): AnimalPose {
  pose.clip = seg.clip;
  pose.yaw = seg.yaw;
  pose.hidden = seg.kind === "hidden";
  pose.dead = false;
  pose.moving = seg.kind === "move";
  if (seg.kind === "move") {
    const p = movePoint(seg, seconds);
    pose.x = p.x;
    pose.z = p.z;
    pose.h = p.h;
    const elapsed = Math.max(0, seconds - seg.t0);
    pose.clipTime = seg.stride > 0 ? (elapsed * seg.speed) / seg.stride : elapsed;
  } else {
    pose.x = seg.at.x;
    pose.z = seg.at.y;
    pose.h = seg.h;
    pose.clipTime = Math.max(0, seconds - seg.t0);
  }
  return pose;
}

/** Bölüm önbelleği: her hayvan için son kullanılan bölüm. */
export type EpisodeCache = Map<string, { key: string; segments: AnimalSegment[] }>;

function episodeSegments(sites: KutadaSites, day: number, kind: AnimalKind, index: number, seconds: number, events: readonly AnimalEvent[], cache?: EpisodeCache): AnimalSegment[] {
  const episode = animalEpisodeAt(sites, day, kind, index, seconds, events);
  const id = animalKey(kind, index);
  const hit = cache?.get(id);
  if (hit && hit.key === episode.key) return hit.segments;
  const segments = episode.build();
  cache?.set(id, { key: episode.key, segments });
  return segments;
}

/** Hayvanın verilen andaki duruşu. events: günün av olayları (yalnızca avlanan hayvan için). */
export function animalPose(sites: KutadaSites, day: number, kind: AnimalKind, index: number, seconds: number, events: readonly AnimalEvent[] = [], cache?: EpisodeCache, out?: AnimalPose): AnimalPose {
  const pose = out ?? { x: 0, h: 0, z: 0, yaw: 0, clip: "dur", clipTime: 0, hidden: false, dead: false, moving: false };
  const kill = events.find((e): e is { type: "kill"; at: number; pickup: number } => e.type === "kill");
  if (kill && seconds >= kill.at) {
    // Okun saplandığı yerde yığılır; sırtlanınca çayırdan kalkar.
    const before = Math.max(0, kill.at - 1e-3);
    poseFromSegment(segmentIn(episodeSegments(sites, day, kind, index, before, events, cache), before), before, pose);
    pose.h = 0;
    pose.moving = false;
    pose.dead = seconds < kill.pickup;
    pose.hidden = seconds >= kill.pickup;
    pose.clip = ANIMAL_ONE_SHOT;
    pose.clipTime = seconds - kill.at;
    return pose;
  }
  const segments = episodeSegments(sites, day, kind, index, seconds, events, cache);
  return poseFromSegment(segmentIn(segments, seconds), seconds, pose);
}

/** Avcının pusu kurabileceği duraklar: hayvanın [from, to] arasında kıpırdamadan yerde durduğu parçalar. */
export function stillWindows(sites: KutadaSites, day: number, kind: AnimalKind, index: number, events: readonly AnimalEvent[], from: number, to: number, minLength: number): AnimalStay[] {
  const out: AnimalStay[] = [];
  let t = from;
  let guard = 0;
  while (t < to && guard++ < 400) {
    const episode = animalEpisodeAt(sites, day, kind, index, t, events);
    for (const s of episode.build()) {
      if (s.kind === "stay" && s.h < 0.5 && s.t1 > from && s.t0 < to && s.t1 - Math.max(s.t0, from) >= minLength) out.push(s);
    }
    t = Math.max(episode.t1, t + 1);
  }
  return out;
}

/** Günün avı: hangi tür, hangisi (tarihten). Boynuzlu erkek geyik (0) sürünün başıdır, avlanmaz. */
export function huntTarget(day: number): { kind: AnimalKind; index: number } {
  const h = hashString(`av:${day}`) >>> 0;
  const roll = h % 10;
  const kind: AnimalKind = roll < 5 ? "geyik" : roll < 8 ? "tavsan" : "kus";
  const index = kind === "geyik" ? 1 + ((h >>> 4) % (ANIMALS.geyik.count - 1)) : (h >>> 4) % ANIMALS[kind].count;
  return { kind, index };
}

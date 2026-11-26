/**
 * KUTADA'NIN İŞ YERLERİ — kahramanların gün boyu gittiği yerler, araziye göre bir kez bulunur.
 *
 *   · Konuk obasında: ocak, kazan, odun yığını (ve gün içinde büyüyen istif), ateş başı oturakları, her kahramanın
 *     kendi çadırı (kapısı ocağa bakar).
 *   · Obanın dışında, ağaçsız çayırın içinde: kesilebilir ağaç korusu, meyve çalıları, ot öbekleri; daha uzakta av
 *     çayırı; en yakın dere ya da göl kıyısında yüz yıkama yeri; BinTaş'ın çadırının yanında ot kurutma sehpası.
 *   · Her yer kuru, Kutada'nın içinde ve yapılardan uzak seçilir (testler denetler).
 *
 * Saf fonksiyonlardır; sonuç arazi başına önbellekte tutulur.
 */
import { REGIONS } from "../../content/regions";
import { VILLAGES } from "../../content/sites";
import { ARRIVAL_ORDER, type ArrivalHeroId } from "../../content/story";
import { onTrail } from "../../game/paths";
import { isWet, sampleTerrain, type Terrain } from "../../game/terrain";
import { distance, pointInPolygon } from "../../lib/geometry";
import { hashString } from "../../lib/random";
import type { Coordinates } from "../../types";
import { campLayouts, scatterTrees, structureObstacles, yurtPlacements, YURT_SIZE } from "../layout";
import type { Obstacle } from "../living/placement";
import { buildWalkGrid, type WalkGrid } from "./walkGrid";

/** Durulacak yer ve bakılacak şey. yaw: oyunun yön kuralı (0 = güneye/kameraya; atan2(dx, dz)). */
export interface WorkSpot {
  at: Coordinates;
  target: Coordinates;
  yaw: number;
}

export interface HeroHome {
  /** Çadırın ortası ve boyu. */
  tent: Coordinates;
  tentScale: number;
  /** Kapının eşiği (kahraman burada gözden kaybolur). */
  door: Coordinates;
  /** Kapının önü (çıkınca burada durur). */
  front: Coordinates;
  /** Çadıra girerken baktığı yön. */
  inYaw: number;
  /** Ateş başındaki oturağı (ocağa bakar). */
  seat: WorkSpot;
}

export interface ChopTree {
  trunk: Coordinates;
  /** Kesenin durduğu yer; ağaç onun baktığı yöne devrilir. */
  spot: WorkSpot;
  /** Devrilip yarılınca odunların durduğu yer ve taşıyanın eğildiği yer. */
  logs: Coordinates;
  logSpot: WorkSpot;
  scale: number;
  rotation: number;
}

export interface KutadaSites {
  center: Coordinates;
  fire: Coordinates;
  cauldron: Coordinates;
  cauldronSpot: WorkSpot;
  /** Ateşe odun atılan yer. */
  fireSpot: WorkSpot;
  /** Obanın eski odun yığını ve yanında gün içinde büyüyen istif. */
  woodpile: Coordinates;
  stack: Coordinates;
  stackSpot: WorkSpot;
  homes: Record<ArrivalHeroId, HeroHome>;
  trees: ChopTree[];
  bushes: WorkSpot[];
  herbs: WorkSpot[];
  /** Av çayırı: hayvanlar içte gezer; iz süren ve avcı kenardaki noktalardan (rim) gelir. */
  meadow: { center: Coordinates; radius: number; spots: WorkSpot[]; rim: WorkSpot[] };
  /** Avın asıldığı direkler (mhellingtr'nin çadırının yanında). */
  huntRack: Coordinates;
  huntRackSpot: WorkSpot;
  water: WorkSpot;
  rack: Coordinates;
  rackSpot: WorkSpot;
  /** Oturak kütüklerinin yeri (oturanın arkasında). */
  seatLogs: { at: Coordinates; yaw: number }[];
  grid: WalkGrid;
}

const TAU = Math.PI * 2;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
/** Kahramanların yürüdüğü alanın yarıçapı (Konuk obasından). */
const REACH = 300;
const SEAT_RADII = [11, 12.5, 9.8, 14];
const TREE_COUNT = 12;
const BUSH_COUNT = 8;
const HERB_COUNT = 10;

export const yawTo = (from: Coordinates, to: Coordinates) => Math.atan2(to.x - from.x, to.y - from.y);
const polar = (c: Coordinates, angle: number, r: number): Coordinates => ({ x: c.x + Math.cos(angle) * r, y: c.y + Math.sin(angle) * r });
const toward = (from: Coordinates, to: Coordinates, d: number): Coordinates => {
  const len = distance(from, to) || 1;
  return { x: from.x + ((to.x - from.x) / len) * d, y: from.y + ((to.y - from.y) / len) * d };
};
const spot = (at: Coordinates, target: Coordinates): WorkSpot => ({ at, target, yaw: yawTo(at, target) });

const cache = new WeakMap<Terrain, Map<number, KutadaSites>>();

export function kutadaSites(terrain: Terrain, seed: number): KutadaSites {
  let bySeed = cache.get(terrain);
  if (!bySeed) {
    bySeed = new Map();
    cache.set(terrain, bySeed);
  }
  let sites = bySeed.get(seed);
  if (!sites) {
    sites = buildSites(terrain, seed);
    bySeed.set(seed, sites);
  }
  return sites;
}

function buildSites(terrain: Terrain, seed: number): KutadaSites {
  const village = VILLAGES.find((v) => v.id === "konuk_obasi");
  if (!village) throw new Error("Konuk obası bulunamadı");
  const camp = campLayouts(terrain).find((c) => c.village === village);
  if (!camp) throw new Error("Konuk obasının kampı yok");
  const center = village.center;
  const polygon = REGIONS.kutada.polygon;
  const structures = structureObstacles(terrain, seed);
  const near = structures.filter((o) => distance(o, center) < REACH + o.r);

  const dry = (p: Coordinates) => {
    const h = sampleTerrain(terrain, p).height;
    return h >= 0.05 && h <= 0.62 && !isWet(terrain, p) && pointInPolygon(p, polygon);
  };
  const clearOf = (p: Coordinates, list: readonly Obstacle[], pad: number) => list.every((o) => distance(o, p) > o.r + pad);
  const free = (p: Coordinates, pad: number) => dry(p) && clearOf(p, near, pad);

  // ── Çadırlar: obanın çadırlarından kapı önü ocağa yakın ama ateşin dışında kalan üçü ──
  const yurts = yurtPlacements(terrain, seed)
    .filter((y) => distance(y, center) <= village.radius + 1)
    .map((y) => {
      const out = { x: Math.sin(y.rotation), y: Math.cos(y.rotation) }; // kapının baktığı yön (ocağa doğru)
      const wall = 3.3 * YURT_SIZE * y.scale;
      const door = { x: y.x + out.x * (wall + 0.2), y: y.y + out.y * (wall + 0.2) };
      const front = { x: y.x + out.x * (wall + 3.2), y: y.y + out.y * (wall + 3.2) };
      return { y, door, front, inYaw: y.rotation + Math.PI };
    })
    .filter((t) => distance(t.front, center) >= 14 && dry(t.front))
    .sort((a, b) => distance(a.y, center) - distance(b.y, center));
  if (yurts.length < ARRIVAL_ORDER.length) throw new Error("Konuk obasında kahramanlara yetecek çadır yok");

  // ── Ateş başı oturakları: kameraya yüzü dönük olsun diye önce ocağın kuzeyi ──
  const avoid = [
    { p: camp.cauldron, r: 2.6 + 2.4 },
    { p: camp.woodpile, r: 3 + 2.4 },
  ];
  // Ocağın çevresi kalabalık (kazan, odun, ateşe yakın çadırlar): çemberin her yanı ve üç yarıçap denenir,
  // kuzeye (kameraya yüzü dönük) yakın olanlar önce seçilir.
  const candidates: { p: Coordinates; pref: number }[] = [];
  for (let k = 0; k < 36; k++) {
    const angle = (k / 36) * TAU;
    SEAT_RADII.forEach((radius, ri) => {
      const p = polar(camp.fire, angle, radius);
      if (avoid.some((a) => distance(a.p, p) < a.r) || !clearOf(p, near, 0.5)) return;
      const fromNorth = Math.abs(((angle + Math.PI / 2 + Math.PI * 3) % TAU) - Math.PI);
      candidates.push({ p, pref: fromNorth + ri * 0.25 });
    });
  }
  candidates.sort((a, b) => a.pref - b.pref);
  const seatPoints: Coordinates[] = [];
  for (const c of candidates) {
    if (seatPoints.length > ARRIVAL_ORDER.length) break;
    if (seatPoints.some((s) => distance(s, c.p) < 5.5)) continue;
    seatPoints.push(c.p);
  }
  if (seatPoints.length <= ARRIVAL_ORDER.length) throw new Error("Konuk obasının ocağında oturak yeri yok");
  const fireSpotPoint = seatPoints[ARRIVAL_ORDER.length];
  const seats = seatPoints.slice(0, ARRIVAL_ORDER.length).map((p) => spot(p, camp.fire));
  const seatLogs = seats.map((s) => ({ at: toward(s.at, camp.fire, -0.7), yaw: s.yaw }));

  const homes = Object.fromEntries(
    ARRIVAL_ORDER.map((id, i) => {
      const t = yurts[i];
      return [id, { tent: { x: t.y.x, y: t.y.y }, tentScale: t.y.scale, door: t.door, front: t.front, inYaw: t.inYaw, seat: seats[i] } satisfies HeroHome];
    }),
  ) as Record<ArrivalHeroId, HeroHome>;

  // ── Kazan, ateş, istif ──
  const cauldronSpot = spot(toward(camp.cauldron, center, -2.6), camp.cauldron);
  const fireSpot = spot(toward(camp.fire, fireSpotPoint, 9.2), camp.fire);
  const outward = (p: Coordinates, d: number) => toward(center, p, distance(center, p) + d);
  let stack = outward(camp.woodpile, 5);
  for (let k = 1; k < 8 && !free(stack, 2.6); k++) stack = polar(center, Math.atan2(camp.woodpile.y - center.y, camp.woodpile.x - center.x) + (k % 2 ? k : -k) * 0.12, distance(center, camp.woodpile) + 5);
  const stackSpot = spot(toward(stack, center, 2.9), stack);

  // ── Kesilebilir ağaç korusu: obanın ağaçsız çayırında, en çok ağacın sığdığı yön ──
  const base = ((hashString("konuk-koru") % 360) * Math.PI) / 180;
  let best: ChopTree[] = [];
  let groveAngle = base;
  for (let a = 0; a < 24 && best.length < TREE_COUNT; a++) {
    const angle = base + a * (TAU / 24);
    const gc = polar(center, angle, 96);
    const picked: ChopTree[] = [];
    for (let k = 0; k < 60 && picked.length < TREE_COUNT; k++) {
      const trunk = polar(gc, k * GOLDEN, 3.4 * Math.sqrt(k + 0.5));
      if (!free(trunk, 4) || onTrail(terrain, trunk)) continue;
      if (picked.some((t) => distance(t.trunk, trunk) < 6)) continue;
      const at = toward(trunk, center, 2.7);
      if (!free(at, 1) || picked.some((t) => distance(t.trunk, at) < 3)) continue;
      const chop = spot(at, trunk);
      const fall = { x: Math.sin(chop.yaw), y: Math.cos(chop.yaw) };
      const logs = { x: trunk.x + fall.x * 5.5, y: trunk.y + fall.y * 5.5 };
      const side = { x: fall.y, y: -fall.x };
      const logAt = { x: logs.x + side.x * 2.4, y: logs.y + side.y * 2.4 };
      if (!free(logs, 1.5) || !free(logAt, 0.5)) continue;
      const h = hashString(`koru:${k}:${a}`);
      picked.push({ trunk, spot: chop, logs, logSpot: spot(logAt, logs), scale: 0.95 + (h % 100) / 400, rotation: ((h >> 7) % 628) / 100 });
    }
    if (picked.length > best.length) {
      best = picked;
      groveAngle = angle;
    }
  }

  // ── Çalılar ve ot öbekleri: koruya uzak iki ayrı yön ──
  const arc = (count: number, dist: number, step: number, startAngle: number, taken: readonly Coordinates[]): WorkSpot[] => {
    for (let a = 0; a < 24; a++) {
      const angle = startAngle + (a % 2 ? 1 : -1) * Math.ceil(a / 2) * (TAU / 24);
      const out: WorkSpot[] = [];
      for (let k = 0; k < count * 3 && out.length < count; k++) {
        const offset = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * step;
        const p = polar(center, angle + offset, dist + ((k * 7) % 3) * 2.5);
        if (!free(p, 2.5) || onTrail(terrain, p)) continue;
        if ([...taken, ...out.map((s) => s.target)].some((q) => distance(q, p) < 5)) continue;
        const at = toward(p, center, 2.1);
        if (!free(at, 0.5)) continue;
        out.push(spot(at, p));
      }
      if (out.length === count) return out;
    }
    throw new Error("Kutada'da çalı ve ot için yer bulunamadı");
  };
  const treePoints = best.map((t) => t.trunk);
  const bushes = arc(BUSH_COUNT, 80, 0.07, groveAngle + TAU / 3, treePoints);
  const herbs = arc(HERB_COUNT, 88, 0.058, groveAngle - TAU / 3, [...treePoints, ...bushes.map((b) => b.target)]);

  // ── Av çayırı: uzakta, ağacı en az açık yer ──
  const forest = scatterTrees(terrain, seed).filter((t) => distance(t, center) < REACH + 40);
  let meadow = { center, radius: 0, spots: [] as WorkSpot[], rim: [] as WorkSpot[] };
  let meadowScore = Number.POSITIVE_INFINITY;
  for (const dist of [170, 200, 230]) {
    for (let a = 0; a < 18; a++) {
      const mc = polar(center, base + a * (TAU / 18), dist);
      if (!free(mc, 30)) continue;
      const ring = Array.from({ length: 8 }, (_, k) => polar(mc, (k / 8) * TAU, 16));
      const points = [mc, ...ring].filter((p) => free(p, 4) && forest.every((t) => distance(t, p) > 3.5));
      if (points.length < 7) continue;
      const score = forest.filter((t) => distance(t, mc) < 28).length - points.length * 3;
      if (score < meadowScore) {
        meadowScore = score;
        const rim = Array.from({ length: 12 }, (_, k) => polar(mc, (k / 12) * TAU, 21))
          .filter((p) => free(p, 2) && forest.every((t) => distance(t, p) > 2.6))
          .map((p) => spot(p, mc));
        meadow = { center: mc, radius: 24, spots: points.map((p, k) => ({ at: p, target: points[(k + 3) % points.length], yaw: yawTo(p, points[(k + 3) % points.length]) })), rim };
      }
    }
  }
  if (meadow.spots.length === 0) throw new Error("Kutada'da av çayırı bulunamadı");

  // ── Yüz yıkama: en yakın dere ya da göl kıyısı (yoksa kazan) ──
  let water = cauldronSpot;
  search: for (let r = 24; r <= 240; r += 4) {
    const steps = Math.max(12, Math.round((TAU * r) / 5));
    for (let i = 0; i < steps; i++) {
      const p = polar(center, (i / steps) * TAU, r);
      if (!isWet(terrain, p) || !pointInPolygon(p, polygon)) continue;
      let q = p;
      for (let d = 1; d < 20 && (isWet(terrain, q) || sampleTerrain(terrain, q).height < 0.04); d++) q = toward(p, center, d);
      const at = toward(q, center, 1.2);
      if (!free(at, 0.5)) continue;
      water = spot(at, p);
      break search;
    }
  }

  // ── BinTaş'ın ot kurutma sehpası: çadırının yanında ──
  const bintas = homes.bintas;
  const doorDir = { x: Math.sin(bintas.inYaw + Math.PI), y: Math.cos(bintas.inYaw + Math.PI) };
  const sideDir = { x: doorDir.y, y: -doorDir.x };
  let rack = { x: bintas.front.x + sideDir.x * 6, y: bintas.front.y + sideDir.y * 6 };
  if (!free(rack, 1.5)) rack = { x: bintas.front.x - sideDir.x * 6, y: bintas.front.y - sideDir.y * 6 };
  const rackSpot = spot(toward(rack, center, 2.2), rack);

  // ── Av asacağı: mhellingtr'nin çadırının yanında ──
  const mh = homes.mhellingtr;
  const mhDoor = { x: Math.sin(mh.inYaw + Math.PI), y: Math.cos(mh.inYaw + Math.PI) };
  const mhSide = { x: mhDoor.y, y: -mhDoor.x };
  let huntRack = { x: mh.front.x - mhSide.x * 7, y: mh.front.y - mhSide.y * 7 };
  if (!free(huntRack, 2) || distance(huntRack, rack) < 6) huntRack = { x: mh.front.x + mhSide.x * 7, y: mh.front.y + mhSide.y * 7 };
  const huntRackSpot = spot(toward(huntRack, center, 2.6), huntRack);

  const workObstacles: Obstacle[] = [
    ...near,
    ...best.map((t) => ({ x: t.trunk.x, y: t.trunk.y, r: 1.3 })),
    ...bushes.map((b) => ({ x: b.target.x, y: b.target.y, r: 1.1 })),
    ...seatLogs.map((s) => ({ x: s.at.x, y: s.at.y, r: 0.6 })),
    { x: stack.x, y: stack.y, r: 2.2 },
    { x: rack.x, y: rack.y, r: 1.2 },
    { x: huntRack.x, y: huntRack.y, r: 1.6 },
    ...forest.map((t) => ({ x: t.x, y: t.y, r: 1.1 })),
  ];
  const grid = buildWalkGrid(terrain, center, REACH, workObstacles);

  return {
    center,
    fire: camp.fire,
    cauldron: camp.cauldron,
    cauldronSpot,
    fireSpot,
    woodpile: camp.woodpile,
    stack,
    stackSpot,
    homes,
    trees: best,
    bushes,
    herbs,
    meadow,
    water,
    rack,
    rackSpot,
    huntRack,
    huntRackSpot,
    seatLogs,
    grid,
  };
}

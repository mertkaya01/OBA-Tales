/**
 * DÜNYA YERLEŞİMİ — 3D adadaki yapıların konumları ve doğanın tohumlu serpilmesi.
 *
 * Konumlar dünya birimindedir (x doğu, y güney). Doğa (ağaç, kaya, buz kristali) world.json
 * tohumundan üretilir; aynı tohum her zaman aynı ormanı verir. Yapıların çevresi boş bırakılır.
 * Saf fonksiyonlardır: Three.js bilmezler, testlerde doğrulanırlar.
 */
import { createNoise2D } from "simplex-noise";
import { ISLAND_LIST } from "../content/islands";
import { REGIONS } from "../content/regions";
import { LANDMARKS, MONUMENTS, RAID_GROUNDS, VILLAGES, type Village } from "../content/sites";
import { onTrail } from "../game/paths";
import { isWet, sampleTerrain, type Terrain } from "../game/terrain";
import { distance, pointInPolygon } from "../lib/geometry";
import { createRng, hashString, seedFrom } from "../lib/random";
import { WORLD_SIZE } from "../types";
import type { Coordinates, PlaceId, TerrainKind } from "../types";
import type { Obstacle } from "./living/placement";

// ── Yapılar ────────────────────────────────────────────────────────

// Konumlar content/sites.ts içinde (arazi üreticisi de onları okur).
export { LANDMARKS, VILLAGES, type Village } from "../content/sites";

/** Akın meydanlarının ağaçsız kalan yarıçapı ve boss'un durduğu yerin açıklığı. */
export const RAID_CLEARING = { square: 34, focus: 14 } as const;

/** Doğanın yerleşmeyeceği alanlar (yapıların çevresi ve akın meydanları). */
const EXCLUSIONS: readonly { center: Coordinates; radius: number }[] = [
  // Obaların çevresi açık çayır: ağıl ve sürü de buraya kurulur.
  ...VILLAGES.map((v) => ({ center: v.center, radius: v.radius + 40 })),
  ...Object.values(RAID_GROUNDS).flatMap((g) => [
    { center: g.square, radius: RAID_CLEARING.square },
    { center: g.focus, radius: RAID_CLEARING.focus },
  ]),
  { center: LANDMARKS.tapinak, radius: 32 },
  { center: LANDMARKS.fener, radius: 12 },
  ...LANDMARKS.ruzgarGulleri.map((p) => ({ center: p, radius: 9 })),
  ...LANDMARKS.kemerler.map((p) => ({ center: p, radius: 10 })),
  { center: LANDMARKS.kadimKemer.from, radius: 12 },
  { center: LANDMARKS.kadimKemer.to, radius: 12 },
  { center: LANDMARKS.batiKemer.from, radius: 12 },
  { center: LANDMARKS.batiKemer.to, radius: 12 },
  { center: LANDMARKS.kutKapisi, radius: 74 },
  { center: MONUMENTS.yikikKale, radius: 26 },
  { center: MONUMENTS.uluKayin, radius: 16 },
  { center: MONUMENTS.firtinaFeneri, radius: 10 },
  { center: MONUMENTS.ataHeykeli, radius: 16 },
  { center: MONUMENTS.yazitliTaslar, radius: 14 },
  { center: MONUMENTS.kartalAniti, radius: 10 },
  { center: MONUMENTS.dilekAgaci, radius: 9 },
  ...MONUMENTS.gozcuKuleleri.map((p) => ({ center: p, radius: 8 })),
  { center: MONUMENTS.uckardesFeneri, radius: 10 },
  { center: MONUMENTS.donmusSelale, radius: 14 },
  ...balbalPlacements().map((p) => ({ center: p, radius: 3 })),
];

// ── Balbal yolu ────────────────────────────────────────────────────

/** Günözü Tapınağı'na çıkan yolun iki yanına dizili küçük taş figürler. */
export function balbalPlacements(): (Coordinates & { rotation: number })[] {
  const { from, to } = MONUMENTS.balbalYolu;
  const length = distance(from, to);
  const ux = (to.x - from.x) / length;
  const uy = (to.y - from.y) / length;
  const out: (Coordinates & { rotation: number })[] = [];
  for (let i = 0; i <= 8; i++) {
    for (const side of [-1, 1]) {
      const t = i / 8;
      out.push({
        x: from.x + (to.x - from.x) * t - uy * side * 7,
        y: from.y + (to.y - from.y) * t + ux * side * 7,
        // Yüzleri yola dönük.
        rotation: Math.atan2(uy * side, -ux * side),
      });
    }
  }
  return out;
}

// ── Oba kampı ──────────────────────────────────────────────────────

/** Bir obanın ortak yerleri: ateş, kazan, odun yığını, tuğ sancağı, (varsa) at ağılı ve koyun sürüsü. */
export interface CampLayout {
  village: Village;
  fire: Coordinates;
  cauldron: Coordinates;
  woodpile: Coordinates;
  banner: Coordinates;
  corral: Coordinates | null;
  flock: Coordinates | null;
}

export const CORRAL_RADIUS = 11;
/** Kut Kapısı'nın taş meydanının yarıçapı (gezinenler girmez). */
export const PORTAL_RADIUS = 30;
/** Oba çadırlarının boyu (karakterler 1,8 kat iri olduğu için çadırlar da büyütüldü). */
export const YURT_SIZE = 1.35;
export const FLOCK_RADIUS = 11;

const polar = (c: Coordinates, angle: number, r: number): Coordinates => ({ x: c.x + Math.cos(angle) * r, y: c.y + Math.sin(angle) * r });

const campCache = new WeakMap<Terrain, CampLayout[]>();

/** Obaların kamp yerleşimi (arazi başına bir kez): ağıl ve sürü kuru, yolsuz bir yere kurulur. */
export function campLayouts(terrain: Terrain): CampLayout[] {
  const cached = campCache.get(terrain);
  if (cached) return cached;
  const layouts = VILLAGES.map((village) => {
    const base = ((hashString(village.name) % 360) * Math.PI) / 180;
    const free = (p: Coordinates, r: number) => {
      for (let a = 0; a < 8; a++) {
        const q = polar(p, (a / 8) * Math.PI * 2, r);
        if (sampleTerrain(terrain, q).height < 0.04 || isWet(terrain, q) || onTrail(terrain, q)) return false;
      }
      return !isWet(terrain, p) && pointInPolygon(p, REGIONS[village.region].polygon);
    };
    const spot = (start: number, distanceFromCenter: number, r: number) => {
      for (const turn of [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2, -2, 2.6]) {
        const p = polar(village.center, start + turn, distanceFromCenter);
        if (free(p, r)) return p;
      }
      return null;
    };
    return {
      village,
      fire: village.center,
      cauldron: polar(village.center, base + 1.2, 6),
      woodpile: polar(village.center, base + 2.7, 7.6),
      banner: spot(base, village.radius + 8, 2.5) ?? polar(village.center, base, village.radius + 8),
      corral: village.corral ? spot(base + Math.PI, village.radius + 20, CORRAL_RADIUS + 1) : null,
      flock: !village.corral && village.id ? spot(base + Math.PI * 0.6, village.radius + 25, FLOCK_RADIUS) : null,
    };
  });
  campCache.set(terrain, layouts);
  return layouts;
}

export function isExcluded(point: Coordinates): boolean {
  return EXCLUSIONS.some((zone) => distance(point, zone.center) < zone.radius);
}

// ── Kıyıya bağlı yapılar (konum araziye göre bulunur) ──────────────

/** Verilen noktanın çevresinde, yeterince derin ilk su noktasını bulur. */
export function findWater(terrain: Terrain, near: Coordinates, minDepth = 0.06, maxRadius = 60): Coordinates | null {
  for (let r = 0; r <= maxRadius; r += 3) {
    const steps = Math.max(1, Math.round((2 * Math.PI * r) / 6));
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const p = { x: near.x + Math.cos(angle) * r, y: near.y + Math.sin(angle) * r };
      if (sampleTerrain(terrain, p).height <= -minDepth) return p;
    }
  }
  return null;
}

/** Batık gemi: resifin sığ suyunda (sığlık rafında) en yakın yer. */
export function shipwreckPlacement(terrain: Terrain): Coordinates {
  const near = MONUMENTS.batikGemi;
  for (let r = 0; r <= 90; r += 3) {
    const steps = Math.max(1, Math.round((2 * Math.PI * r) / 6));
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const p = { x: near.x + Math.cos(angle) * r, y: near.y + Math.sin(angle) * r };
      const h = sampleTerrain(terrain, p).height;
      if (h < -0.03 && h > -0.06) return p;
    }
  }
  return near;
}

export interface Pier {
  start: Coordinates;
  end: Coordinates;
}

/** Akınburnu obasının güneyindeki kıyıdan denize uzanan iskele: karadan başlar, suda biter. */
export function pierPlacement(terrain: Terrain): Pier {
  const x = 423;
  let y = 1510;
  while (y < WORLD_SIZE.height - 1 && sampleTerrain(terrain, { x, y }).height >= 0) y += 1;
  const start = { x, y: y - 6 };
  return { start, end: { x, y: Math.min(WORLD_SIZE.height - 1, y + 24) } };
}

/** İskelenin yanında ve Süzülkoy açığında demirli tekneler. */
export function boatPlacements(terrain: Terrain): Coordinates[] {
  const pier = pierPlacement(terrain);
  const targets = [
    { x: pier.end.x - 14, y: pier.end.y - 4 },
    { x: pier.end.x + 14, y: pier.end.y - 8 },
    { x: 1065, y: 1550 },
  ];
  return targets.map((t) => findWater(terrain, t)).filter((p): p is Coordinates => p !== null);
}

// ── Oba çadırları ──────────────────────────────────────────────────

export interface Placement {
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Köy merkezinin çevresine ayçiçeği deseninde çadır dizer; suya ya da dik yamaca düşenleri atlar. */
export function yurtPlacements(terrain: Terrain, seed: number): Placement[] {
  const rng = createRng(seedFrom("cadirlar", seed));
  const out: Placement[] = [];
  for (const village of VILLAGES) {
    const ringOnly = village.center === LANDMARKS.senlikOcagi;
    for (let i = 0; i < village.count; i++) {
      const angle = i * (ringOnly ? (Math.PI * 2) / village.count : GOLDEN_ANGLE) + rng.float(-0.15, 0.15);
      const radius = ringOnly ? village.radius : village.radius * Math.sqrt((i + 0.6) / village.count);
      const p = { x: village.center.x + Math.cos(angle) * radius, y: village.center.y + Math.sin(angle) * radius };
      const sample = sampleTerrain(terrain, p);
      if (sample.height < 0.05 || sample.height > 0.7) continue;
      if (out.some((o) => distance(o, p) < 11)) continue;
      // Kapı köy merkezine baksın.
      out.push({ ...p, rotation: Math.atan2(village.center.x - p.x, village.center.y - p.y), scale: rng.float(0.9, 1.15) });
    }
  }
  return out;
}

// ── Gezginlerin çarpmaması gereken yapılar ─────────────────────────

/** Çadırlar, fener, rüzgâr gülleri, tapınak, ocak, kemerler ve köprü ayakları. */
export function structureObstacles(terrain: Terrain, seed: number): Obstacle[] {
  const circle = (p: Coordinates, r: number): Obstacle => ({ x: p.x, y: p.y, r });
  return [
    ...yurtPlacements(terrain, seed).map((y) => circle(y, 3.6 * YURT_SIZE * y.scale + 1.2)),
    circle(LANDMARKS.fener, 4.5),
    ...LANDMARKS.ruzgarGulleri.map((p) => circle(p, 2.6)),
    circle(LANDMARKS.tapinak, 14.5),
    circle(LANDMARKS.senlikOcagi, 3.8),
    ...LANDMARKS.kemerler.map((p) => circle(p, 6)),
    circle(LANDMARKS.kadimKemer.from, 3.5),
    circle(LANDMARKS.kadimKemer.to, 3.5),
    circle(LANDMARKS.batiKemer.from, 3.5),
    circle(LANDMARKS.batiKemer.to, 3.5),
    circle(LANDMARKS.kutKapisi, PORTAL_RADIUS),
    circle(MONUMENTS.yikikKale, 16),
    circle(MONUMENTS.uluKayin, 5),
    circle(MONUMENTS.firtinaFeneri, 4.5),
    ...campLayouts(terrain).flatMap((camp) => [
      circle(camp.fire, 5.4),
      circle(camp.cauldron, 2),
      circle(camp.woodpile, 2.2),
      circle(camp.banner, 1.8),
      ...(camp.corral ? [circle(camp.corral, CORRAL_RADIUS + 1)] : []),
    ]),
    circle(MONUMENTS.ataHeykeli, 7),
    circle(MONUMENTS.yazitliTaslar, 8),
    circle(MONUMENTS.kartalAniti, 3),
    circle(MONUMENTS.dilekAgaci, 3.5),
    ...MONUMENTS.gozcuKuleleri.map((q) => circle(q, 3.6)),
    circle(MONUMENTS.uckardesFeneri, 4.5),
    ...balbalPlacements().map((q) => circle(q, 1.3)),
  ];
}

// ── Adı konabilen yerler ───────────────────────────────────────────

export interface PlaceAnchor {
  point: Coordinates;
  /** Etiketin zeminden yüksekliği (Three.js birimi). */
  lift: number;
}

const centroid = (points: readonly Coordinates[]): Coordinates => ({
  x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
  y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
});

/** "Adını koyan @…" etiketlerinin dünyadaki yerleri. */
export function placeAnchors(terrain: Terrain): Record<PlaceId, PlaceAnchor> {
  const pier = pierPlacement(terrain);
  const anchors: Partial<Record<PlaceId, PlaceAnchor>> = {
    fener: { point: LANDMARKS.fener, lift: 19 },
    ruzgar_gulleri: { point: centroid(LANDMARKS.ruzgarGulleri), lift: 10 },
    iskele: { point: { x: pier.start.x, y: (pier.start.y + pier.end.y) / 2 }, lift: 6 },
    senlik_ocagi: { point: LANDMARKS.senlikOcagi, lift: 9 },
    gunozu_tapinagi: { point: LANDMARKS.tapinak, lift: 17 },
    pusluada_kemerleri: { point: centroid(LANDMARKS.kemerler), lift: 12 },
    // Köprünün ortası suyun üstünde: etiket batı ayağında, güvertenin hizasında durur.
    kadim_kemer: { point: LANDMARKS.kadimKemer.to, lift: 12 },
    bati_kemer: { point: LANDMARKS.batiKemer.from, lift: 12 },
    kut_kapisi: { point: LANDMARKS.kutKapisi, lift: 52 },
    yikik_kale: { point: MONUMENTS.yikikKale, lift: 18 },
    ulu_kayin: { point: MONUMENTS.uluKayin, lift: 30 },
    firtina_feneri: { point: MONUMENTS.firtinaFeneri, lift: 18 },
    ata_heykeli: { point: MONUMENTS.ataHeykeli, lift: 34 },
    balbal_yolu: { point: centroid([MONUMENTS.balbalYolu.from, MONUMENTS.balbalYolu.to]), lift: 7 },
    yazitli_taslar: { point: MONUMENTS.yazitliTaslar, lift: 11 },
    kartal_aniti: { point: MONUMENTS.kartalAniti, lift: 20 },
    dilek_agaci: { point: MONUMENTS.dilekAgaci, lift: 15 },
    uckardes_feneri: { point: MONUMENTS.uckardesFeneri, lift: 18 },
    batik_gemi: { point: shipwreckPlacement(terrain), lift: 8 },
    donmus_selale: { point: MONUMENTS.donmusSelale, lift: 14 },
  };
  for (const v of VILLAGES) if (v.id) anchors[v.id] = { point: v.center, lift: 9 };
  for (const island of ISLAND_LIST) anchors[island.id] = { point: island.label, lift: 16 };
  return anchors as Record<PlaceId, PlaceAnchor>;
}

// ── Doğa ───────────────────────────────────────────────────────────

export interface TreePlacement extends Placement {
  conifer: boolean;
  snowy: boolean;
}

/** Bölge türüne göre orman yoğunluğu: gürültü eşiği ve seçilme olasılığı. */
const TREE_DENSITY: Readonly<Record<TerrainKind, { threshold: number; chance: number }>> = {
  liman: { threshold: -0.05, chance: 0.75 },
  koy: { threshold: 0.1, chance: 0.6 },
  gecit: { threshold: 0.05, chance: 0.55 },
  yayla: { threshold: 0.35, chance: 0.45 },
  yuksek_ada: { threshold: -0.1, chance: 0.6 },
  tepe: { threshold: 0.2, chance: 0.5 },
  buzul: { threshold: 0.3, chance: 0.35 },
  orman: { threshold: -0.25, chance: 0.85 },
  kayalik: { threshold: 0.15, chance: 0.4 },
  cayir: { threshold: 0.25, chance: 0.5 },
};

export function scatterTrees(terrain: Terrain, seed: number): TreePlacement[] {
  const rng = createRng(seedFrom("agaclar", seed));
  const forest = createNoise2D(rng.next);
  const out: TreePlacement[] = [];
  const step = 7;
  for (let gy = step / 2; gy < WORLD_SIZE.height; gy += step) {
    for (let gx = step / 2; gx < WORLD_SIZE.width; gx += step) {
      const p = { x: gx + rng.float(-3, 3), y: gy + rng.float(-3, 3) };
      const sample = sampleTerrain(terrain, p);
      if (sample.height < 0.07 || !sample.kind || isWet(terrain, p) || onTrail(terrain, p)) continue;
      const kind = sample.kind;
      if ((kind === "gecit" && sample.height > 0.42) || (kind === "tepe" && sample.height > 0.72) || (kind === "buzul" && sample.height > 0.38) || sample.height > 0.78) continue;
      const density = TREE_DENSITY[kind];
      if (forest(p.x * 0.013, p.y * 0.013) < density.threshold) continue;
      if (!rng.chance(density.chance) || isExcluded(p)) continue;
      const conifer = kind === "liman" || kind === "koy" ? rng.chance(0.3) : kind === "orman" ? rng.chance(0.55) : kind === "cayir" ? rng.chance(0.15) : true;
      out.push({
        ...p,
        rotation: rng.float(0, Math.PI * 2),
        scale: rng.float(0.75, 1.3),
        conifer,
        snowy: conifer && (sample.height > 0.32 || kind === "yayla"),
      });
    }
  }
  return out;
}

/** Çayır otları ve çiçekler: alçak, yumuşak arazide (yalnızca yakından görünür). */
export interface TuftPlacement extends Placement {
  flower: boolean;
  color: string;
}

const GRASS_COLORS = ["#86b862", "#9cc66e", "#74a556", "#a9cf7b"];
const FROST_GRASS = ["#b9cdb7", "#c8d8c4", "#a9bfa5"];
const FLOWER_COLORS = ["#e8c94a", "#f3efe6", "#d0573f", "#9b6fd6", "#f29fbd"];
const TUFT_KINDS: ReadonlySet<TerrainKind> = new Set(["liman", "koy", "cayir", "orman", "yayla"]);

export function scatterTufts(terrain: Terrain, seed: number): TuftPlacement[] {
  const rng = createRng(seedFrom("otlar", seed));
  const meadow = createNoise2D(rng.next);
  const out: TuftPlacement[] = [];
  const step = 8;
  for (let gy = step / 2; gy < WORLD_SIZE.height; gy += step) {
    for (let gx = step / 2; gx < WORLD_SIZE.width; gx += step) {
      const p = { x: gx + rng.float(-3.5, 3.5), y: gy + rng.float(-3.5, 3.5) };
      const sample = sampleTerrain(terrain, p);
      if (!sample.kind || !TUFT_KINDS.has(sample.kind) || sample.height < 0.05 || sample.height > 0.42) continue;
      if (meadow(p.x * 0.02, p.y * 0.02) < -0.1 || !rng.chance(0.55)) continue;
      if (isWet(terrain, p) || onTrail(terrain, p)) continue;
      const flowery = sample.kind === "cayir" || sample.kind === "koy" ? 0.45 : 0.12;
      const flower = rng.chance(flowery);
      const frosty = sample.kind === "yayla";
      out.push({
        ...p,
        rotation: rng.float(0, Math.PI * 2),
        scale: rng.float(0.7, 1.3),
        flower,
        color: flower ? rng.pick(FLOWER_COLORS) : rng.pick(frosty ? FROST_GRASS : GRASS_COLORS),
      });
    }
  }
  return out;
}

/** Kıyı önündeki sığ sularda yarısı batık kayalar. */
export function scatterSeaRocks(terrain: Terrain, seed: number): Placement[] {
  const rng = createRng(seedFrom("deniz-kayalari", seed));
  const reef = createNoise2D(rng.next);
  const out: Placement[] = [];
  for (let gy = 6; gy < WORLD_SIZE.height; gy += 12) {
    for (let gx = 6; gx < WORLD_SIZE.width; gx += 12) {
      const p = { x: gx + rng.float(-5, 5), y: gy + rng.float(-5, 5) };
      const h = sampleTerrain(terrain, p).height;
      if (h >= -0.02 || h < -0.055) continue;
      if (reef(p.x * 0.01, p.y * 0.01) < 0.25 || !rng.chance(0.35)) continue;
      out.push({ ...p, rotation: rng.float(0, Math.PI * 2), scale: rng.float(0.8, 2.2) });
    }
  }
  return out;
}

/** Yüksek adada, geçitte ve tepede kayalar. */
export function scatterRocks(terrain: Terrain, seed: number): Placement[] {
  const rng = createRng(seedFrom("kayalar", seed));
  const out: Placement[] = [];
  for (let gy = 7; gy < WORLD_SIZE.height; gy += 14) {
    for (let gx = 7; gx < WORLD_SIZE.width; gx += 14) {
      const p = { x: gx + rng.float(-6, 6), y: gy + rng.float(-6, 6) };
      const sample = sampleTerrain(terrain, p);
      if (!sample.kind || sample.height < 0.3 || isWet(terrain, p) || onTrail(terrain, p)) continue;
      const kind = sample.kind;
      if (kind !== "yuksek_ada" && kind !== "gecit" && kind !== "tepe" && kind !== "buzul" && kind !== "kayalik") continue;
      if (!rng.chance(0.2) || isExcluded(p)) continue;
      out.push({ ...p, rotation: rng.float(0, Math.PI * 2), scale: rng.float(0.7, 1.8) });
    }
  }
  return out;
}

/** Ayazboğazı'nın buz duvarlarında ve Günözü zirvesinde buz kristalleri. */
export function scatterIce(terrain: Terrain, seed: number): Placement[] {
  const rng = createRng(seedFrom("buz", seed));
  const out: Placement[] = [];
  for (let gy = 5; gy < WORLD_SIZE.height; gy += 10) {
    for (let gx = 5; gx < WORLD_SIZE.width; gx += 10) {
      const p = { x: gx + rng.float(-4, 4), y: gy + rng.float(-4, 4) };
      const sample = sampleTerrain(terrain, p);
      if (!sample.kind || isWet(terrain, p)) continue;
      const kind = sample.kind;
      const wall = kind === "gecit" && sample.height > 0.5 && rng.chance(0.4);
      const summit = kind === "tepe" && sample.height > 0.75 && rng.chance(0.15);
      const glacier = kind === "buzul" && sample.height > 0.45 && rng.chance(0.22);
      if ((!wall && !summit && !glacier) || isExcluded(p)) continue;
      out.push({ ...p, rotation: rng.float(0, Math.PI * 2), scale: rng.float(0.7, 1.6) });
    }
  }
  return out;
}

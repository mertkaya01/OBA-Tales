import { describe, expect, it } from "vitest";
import rosterText from "../../public/data/roster.json?raw";
import { MONUMENTS, RAID_GROUNDS, SEA_ROUTES } from "../content/sites";
import { getTrails } from "../game/paths";
import { pointInPolygon } from "../lib/geometry";
import { generateTerrain, isWet, sampleHeightBilinear, sampleTerrain } from "../game/terrain";
import { REGIONS } from "../content/regions";
import { distance } from "../lib/geometry";
import {
  LANDMARKS,
  VILLAGES,
  balbalPlacements,
  boatPlacements,
  campLayouts,
  isExcluded,
  pierPlacement,
  scatterIce,
  scatterRocks,
  scatterSeaRocks,
  scatterTufts,
  scatterTrees,
  shipwreckPlacement,
  yurtPlacements,
} from "./layout";
import { HEIGHT_SCALE, cameraZoomFor, detailCameraZoom, heightToY, overviewCameraZoom, overviewWorldZoom, tiltForZoom, WATER_LEVEL, worldZoomOf } from "./worldScale";

const SEED = 20261124;
const terrain = generateTerrain({ seed: SEED });
const isLandAt = (p: { x: number; y: number }) => sampleTerrain(terrain, p).height >= 0;

describe("3D ölçek", () => {
  it("kara su yüzeyinin üstünde, deniz tabanı altında kalır", () => {
    expect(heightToY(0.02)).toBeGreaterThan(WATER_LEVEL);
    expect(heightToY(1)).toBeCloseTo(0.6 + HEIGHT_SCALE);
    expect(heightToY(-0.05)).toBeLessThan(WATER_LEVEL);
    expect(heightToY(-5)).toBe(-7);
  });

  it("bilinear yükseklik hücre değerleri arasında pürüzsüz geçer", () => {
    const peak = REGIONS.gunozu_tepesi.center;
    const a = sampleHeightBilinear(terrain, peak);
    const b = sampleHeightBilinear(terrain, { x: peak.x + 1, y: peak.y });
    expect(Math.abs(a - b)).toBeLessThan(0.05);
    expect(a).toBeGreaterThan(0.8);
  });

  it("genel görünüm bütün dünyayı sığdırır; dünya zoom'u ayrıntı ölçeğidir", () => {
    expect(overviewCameraZoom({ width: 3260, height: 2460 })).toBeCloseTo(1);
    expect(detailCameraZoom({ width: 1060, height: 840 })).toBeCloseTo(1);
    expect(cameraZoomFor(4, { width: 1060, height: 840 })).toBeCloseTo(4);
    expect(worldZoomOf(cameraZoomFor(7, { width: 1280, height: 720 }), { width: 1280, height: 720 })).toBeCloseTo(7);
    // Dünya ilk hâlinin 3,2 katı genişlikte: genel görünüm, ayrıntı ölçeğinin üçte biri kadar.
    expect(overviewWorldZoom({ width: 1280, height: 720 })).toBeGreaterThan(0.25);
    expect(overviewWorldZoom({ width: 1280, height: 720 })).toBeLessThan(0.45);
    expect(overviewCameraZoom({ width: 0, height: 100 })).toBe(1);
  });

  it("kamera uzakta tepeden, yakında eğik bakar", () => {
    expect(tiltForZoom(1)).toBeLessThan(0.05);
    expect(tiltForZoom(16)).toBeGreaterThan(0.7);
    expect(tiltForZoom(4)).toBeGreaterThan(tiltForZoom(2));
  });
});

describe("yapılar", () => {
  it("fener, rüzgâr gülleri, tapınak, ocak, kemerler ve köprü ayakları karada", () => {
    const points = [
      LANDMARKS.fener,
      LANDMARKS.tapinak,
      LANDMARKS.senlikOcagi,
      ...LANDMARKS.ruzgarGulleri,
      ...LANDMARKS.kemerler,
      LANDMARKS.kadimKemer.from,
      LANDMARKS.kadimKemer.to,
    ];
    for (const p of points) expect(isLandAt(p), JSON.stringify(p)).toBe(true);
    // Köprünün ortası boğazın üstünde, yani suda.
    const mid = { x: (LANDMARKS.kadimKemer.from.x + LANDMARKS.kadimKemer.to.x) / 2, y: LANDMARKS.kadimKemer.from.y };
    expect(isLandAt(mid)).toBe(false);
  });

  it("iskele karadan başlar, suda biter; tekneler suda", () => {
    const pier = pierPlacement(terrain);
    expect(isLandAt(pier.start)).toBe(true);
    expect(isLandAt(pier.end)).toBe(false);
    const boats = boatPlacements(terrain);
    expect(boats.length).toBe(3);
    for (const b of boats) expect(sampleTerrain(terrain, b).height).toBeLessThan(-0.05);
  });

  it("oba çadırları karada, birbirine çok yakın değil ve köylerinin çevresinde", () => {
    const yurts = yurtPlacements(terrain, SEED);
    expect(yurts.length).toBeGreaterThan(25);
    for (const y of yurts) {
      expect(isLandAt(y)).toBe(true);
      expect(VILLAGES.some((v) => distance(v.center, y) <= v.radius + 4)).toBe(true);
    }
    for (let i = 0; i < yurts.length; i++) {
      for (let j = i + 1; j < yurts.length; j++) expect(distance(yurts[i], yurts[j])).toBeGreaterThanOrEqual(8);
    }
  });
});

describe("doğa", () => {
  const trees = scatterTrees(terrain, SEED);
  const rocks = scatterRocks(terrain, SEED);
  const ice = scatterIce(terrain, SEED);

  it("yeterince ağaç, kaya ve buz kristali üretir", () => {
    expect(trees.length).toBeGreaterThan(3000);
    expect(rocks.length).toBeGreaterThan(20);
    expect(ice.length).toBeGreaterThan(10);
  });

  it("hepsi karada, nehir ve göl dışında; yapıların çevresi boş", () => {
    for (const p of [...trees, ...rocks, ...ice]) {
      expect(isLandAt(p)).toBe(true);
      expect(isWet(terrain, p)).toBe(false);
      expect(isExcluded(p)).toBe(false);
    }
  });

  it("aynı tohum aynı ormanı verir", () => {
    expect(scatterTrees(terrain, SEED)).toEqual(trees);
    expect(scatterTrees(terrain, 7)).not.toEqual(trees);
  });

  it("buz kristalleri yalnızca geçitte, zirvede ve buzullu adada", () => {
    for (const p of ice) expect(["gecit", "tepe", "buzul"]).toContain(sampleTerrain(terrain, p).kind);
  });
});

describe("obalar, anıtlar ve patikalar", () => {
  const camps = campLayouts(terrain);
  const trails = getTrails(terrain);

  it("obalar kendi bölgelerinde, kuru ve birbirinden ve akın meydanlarından uzak", () => {
    for (const v of VILLAGES) {
      expect(pointInPolygon(v.center, REGIONS[v.region].polygon), v.name).toBe(true);
      expect(isWet(terrain, v.center), v.name).toBe(false);
      for (const o of VILLAGES) if (o !== v) expect(distance(o.center, v.center), `${v.name} ↔ ${o.name}`).toBeGreaterThan(v.radius + o.radius + 20);
      for (const g of Object.values(RAID_GROUNDS)) expect(distance(g.square, v.center), v.name).toBeGreaterThan(v.radius + 40);
    }
  });

  it("her obada ateş, kazan, odun ve sancak var; ağıl ve sürü kuru karada", () => {
    expect(camps).toHaveLength(VILLAGES.length);
    expect(camps.filter((c) => c.corral).length).toBeGreaterThan(4);
    expect(camps.filter((c) => c.flock).length).toBeGreaterThan(3);
    for (const camp of camps) {
      for (const p of [camp.banner, camp.corral, camp.flock].filter((q): q is { x: number; y: number } => q !== null)) {
        expect(isLandAt(p), camp.village.name).toBe(true);
        expect(isWet(terrain, p), camp.village.name).toBe(false);
      }
    }
  });

  it("anıtlar karada; batık gemi resifin sığ suyunda", () => {
    const points = [MONUMENTS.ataHeykeli, MONUMENTS.yazitliTaslar, MONUMENTS.kartalAniti, MONUMENTS.dilekAgaci, MONUMENTS.uckardesFeneri, MONUMENTS.donmusSelale, ...MONUMENTS.gozcuKuleleri, ...balbalPlacements()];
    for (const p of points) expect(isLandAt(p), JSON.stringify(p)).toBe(true);
    const wreck = sampleTerrain(terrain, shipwreckPlacement(terrain)).height;
    expect(wreck).toBeLessThan(0);
    expect(wreck).toBeGreaterThan(-0.07);
  });

  it("patikalar her obaya ulaşır ve nehri yalnızca köprüden geçer", () => {
    for (const v of VILLAGES.filter((q) => q.id)) {
      const reaches = trails.paths.some((path) => path.some((p) => distance(p, v.center) < v.radius * 0.55 + 10));
      expect(reaches, v.name).toBe(true);
    }
    expect(trails.bridges.length).toBeGreaterThan(0);
    for (const path of trails.paths) {
      for (const p of path) {
        const cell = Math.floor(p.y / terrain.cellSize) * terrain.cols + Math.floor(p.x / terrain.cellSize);
        if (terrain.river[cell] <= 0) continue;
        const bridged = trails.bridges.some((b) => distance(b.center, p) < b.length / 2 + terrain.cellSize * 2);
        expect(bridged, `köprüsüz geçiş (${p.x.toFixed(0)}, ${p.y.toFixed(0)})`).toBe(true);
      }
    }
  });

  it("takipçiler kendi bölgelerindeki bir obanın çevresinde ve kuru yerde yaşar", () => {
    const roster = JSON.parse(rosterText) as { characters: { id: string; region: keyof typeof REGIONS; coordinates: { x: number; y: number } }[] };
    for (const c of roster.characters) {
      expect(pointInPolygon(c.coordinates, REGIONS[c.region].polygon), c.id).toBe(true);
      expect(isWet(terrain, c.coordinates), c.id).toBe(false);
      // Yeni gelenler (Kutada) Kut Kapısı'nın meydanında da olabilir.
      const atPortal = c.region === "kutada" && distance(LANDMARKS.kutKapisi, c.coordinates) <= 115;
      const home = atPortal || VILLAGES.filter((v) => v.region === c.region).some((v) => distance(v.center, c.coordinates) <= v.radius + 27);
      expect(home, c.id).toBe(true);
    }
  });
});

describe("Kutada ve Kut Kapısı", () => {
  const trails = getTrails(terrain);

  it("Kutada takımadanın ortasında; Kut Kapısı karada, kuru ve düz bir meydanda", () => {
    expect(distance(REGIONS.kutada.center, { x: 1600, y: 1120 })).toBeLessThan(120);
    const portal = LANDMARKS.kutKapisi;
    expect(sampleTerrain(terrain, portal).region).toBe("kutada");
    expect(isWet(terrain, portal)).toBe(false);
    const hs = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => sampleHeightBilinear(terrain, { x: portal.x + Math.cos(k) * 14, y: portal.y + Math.sin(k) * 14 }));
    expect(Math.max(...hs) - Math.min(...hs)).toBeLessThan(0.05);
  });

  it("iki taş köprü Kutada'yı ana adaya ve Pusluada'ya bağlar; patikalar köprü ayaklarına ve kapıya ulaşır", () => {
    for (const span of [LANDMARKS.batiKemer, LANDMARKS.kadimKemer]) {
      expect(isLandAt(span.from)).toBe(true);
      expect(isLandAt(span.to)).toBe(true);
      expect(isLandAt({ x: (span.from.x + span.to.x) / 2, y: span.from.y })).toBe(false);
      for (const end of [span.from, span.to]) expect(trails.paths.some((path) => path.some((p) => distance(p, end) < 12)), JSON.stringify(end)).toBe(true);
    }
    expect(trails.paths.some((path) => path.some((p) => distance(p, LANDMARKS.kutKapisi) < 58))).toBe(true);
  });

  it("yelkenlilerin deniz yolları açık suda", () => {
    for (const route of SEA_ROUTES) {
      for (let k = 0; k < 64; k++) {
        const a = (k / 64) * Math.PI * 2;
        const p = { x: route.center.x + Math.cos(a) * route.rx, y: route.center.y + Math.sin(a) * route.ry };
        expect(sampleTerrain(terrain, p).height, `(${p.x.toFixed(0)}, ${p.y.toFixed(0)})`).toBeLessThan(-0.05);
      }
    }
  });

  it("otlar alçak çayırlarda, deniz kayaları sığ suda", () => {
    const tufts = scatterTufts(terrain, SEED);
    expect(tufts.length).toBeGreaterThan(2000);
    for (const t of tufts.slice(0, 500)) expect(isWet(terrain, t)).toBe(false);
    const rocks = scatterSeaRocks(terrain, SEED);
    expect(rocks.length).toBeGreaterThan(50);
    for (const r of rocks) expect(sampleTerrain(terrain, r).height).toBeLessThan(0);
  });
});

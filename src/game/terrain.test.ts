import { describe, expect, it } from "vitest";
import { CAST } from "../content/cast";
import { ISLAND_LIST } from "../content/islands";
import { REGION_LIST, REGIONS } from "../content/regions";
import { BASINS, CHANNELS, FLAT_SITES, LAND_SITES, LANDMARKS } from "../content/sites";
import { randomPointInPolygon } from "../lib/geometry";
import { createRng, seedFrom } from "../lib/random";
import { WORLD_SIZE } from "../types";
import { PROTECT_DEPTH, generateTerrain, isLand, isWet, sampleTerrain } from "./terrain";

const terrain = generateTerrain({ seed: 20261124 });

/** Alanın içinden düzenli örnek noktalar. */
function siteSamples(center: { x: number; y: number }, radius: number): { x: number; y: number }[] {
  const out = [center];
  for (const r of [0.3, 0.6, 0.9]) {
    for (let a = 0; a < 24; a++) out.push({ x: center.x + Math.cos((a / 24) * Math.PI * 2) * radius * r, y: center.y + Math.sin((a / 24) * Math.PI * 2) * radius * r });
  }
  return out;
}

describe("arazi üreticisi", () => {
  it("ızgara boyutu dünyayı kaplar", () => {
    expect(terrain.cols * terrain.cellSize).toBeGreaterThanOrEqual(WORLD_SIZE.width);
    expect(terrain.rows * terrain.cellSize).toBeGreaterThanOrEqual(WORLD_SIZE.height);
    expect(terrain.heights).toHaveLength(terrain.cols * terrain.rows);
  });

  it("aynı tohum aynı araziyi, farklı tohum farklı kıyıyı üretir", () => {
    const again = generateTerrain({ seed: 20261124 });
    const other = generateTerrain({ seed: 7 });
    expect(again.heights).toEqual(terrain.heights);
    expect(again.rivers).toEqual(terrain.rivers);
    expect(other.heights).not.toEqual(terrain.heights);
  });

  it("bölge içleri (kıyıdan korunan derinlikte) her zaman karadır ve doğru bölgeye aittir", () => {
    for (const region of REGION_LIST) {
      const rng = createRng(seedFrom("arazi-testi", region.id));
      for (let i = 0; i < 300; i++) {
        const p = randomPointInPolygon(region.polygon, rng, { margin: PROTECT_DEPTH + 4 });
        const sample = sampleTerrain(terrain, p);
        expect(sample.height, `${region.id} (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`).toBeGreaterThanOrEqual(0);
        expect(sample.region).toBe(region.id);
      }
    }
  });

  it("kıyı poligonun dışına taşar ve içine koylar açar (düz çizgi değil)", () => {
    let capes = 0;
    let bays = 0;
    for (let i = 0; i < terrain.heights.length; i += 3) {
      const p = { x: ((i % terrain.cols) + 0.5) * terrain.cellSize, y: (Math.floor(i / terrain.cols) + 0.5) * terrain.cellSize };
      const inRegion = REGION_LIST.some((r) => pointInRegion(p, r.id));
      if (terrain.heights[i] >= 0 && terrain.regions[i] >= 0 && !inRegion) capes++;
      if (terrain.heights[i] < 0 && inRegion) bays++;
    }
    expect(capes).toBeGreaterThan(100);
    expect(bays).toBeGreaterThan(100);
  });

  it("kadro karada ve kendi bölgesinde durur", () => {
    for (const member of CAST) {
      expect(sampleTerrain(terrain, member.coordinates).region, member.id).toBe(member.region);
      expect(isWet(terrain, member.coordinates), member.id).toBe(false);
    }
  });

  it("dünyanın köşeleri ve Pusluada boğazı sudur", () => {
    expect(isLand(terrain, { x: 5, y: 5 })).toBe(false);
    expect(isLand(terrain, { x: WORLD_SIZE.width - 5, y: WORLD_SIZE.height - 5 })).toBe(false);
    for (const channel of CHANNELS) {
      for (let t = 0.15; t <= 0.85; t += 0.05) {
        const p = { x: channel.from.x + (channel.to.x - channel.from.x) * t, y: channel.from.y + (channel.to.y - channel.from.y) * t };
        expect(isLand(terrain, p), `boğaz (${p.x}, ${p.y})`).toBe(false);
      }
    }
  });

  it("Günözü Tepesi bölgelerin en yüksek yeridir; liman alçaktır", () => {
    const peak = sampleTerrain(terrain, REGIONS.gunozu_tepesi.center).height;
    const harbor = sampleTerrain(terrain, REGIONS.akinburnu.center).height;
    expect(peak).toBeGreaterThan(0.8);
    expect(harbor).toBeLessThan(0.3);
    // Dünyanın en yüksek noktası Günözü Tepesi'nde.
    let highest = 0;
    for (let i = 1; i < terrain.heights.length; i++) if (terrain.heights[i] > terrain.heights[highest]) highest = i;
    expect(sampleTerrain(terrain, { x: ((highest % terrain.cols) + 0.5) * terrain.cellSize, y: (Math.floor(highest / terrain.cols) + 0.5) * terrain.cellSize }).region).toBe("gunozu_tepesi");
  });

  it("sabit yerler karada; meydanlar, obalar ve tapınak kurudur (nehir ve göl yok)", () => {
    for (const site of LAND_SITES) expect(isLand(terrain, site.center), JSON.stringify(site.center)).toBe(true);
    for (const site of FLAT_SITES) {
      for (const p of siteSamples(site.center, site.radius * 0.85)) {
        expect(isWet(terrain, p), `(${p.x.toFixed(0)}, ${p.y.toFixed(0)})`).toBe(false);
      }
    }
    // Köprünün iki ayağı karada, ortası suda.
    expect(isLand(terrain, LANDMARKS.kadimKemer.from)).toBe(true);
    expect(isLand(terrain, LANDMARKS.kadimKemer.to)).toBe(true);
  });

  it("düzlenen alanlar düzdür (saflar ve çadırlar yokuşa dizilmez)", () => {
    for (const site of FLAT_SITES) {
      const hs = siteSamples(site.center, site.radius * 0.5).map((p) => sampleTerrain(terrain, p).height);
      expect(Math.max(...hs) - Math.min(...hs), JSON.stringify(site.center)).toBeLessThan(0.06);
    }
  });

  it("her yabani adada kara vardır ve kıyı önünde sığlık rafı uzanır", () => {
    for (const island of ISLAND_LIST) {
      // Etiket adanın üstünde ya da en fazla 60 birim açığında.
      const near = siteSamples(island.label, 60).filter((p) => isLand(terrain, p));
      expect(near.length, island.id).toBeGreaterThan(0);
      for (const p of near) expect(sampleTerrain(terrain, p).region, island.id).toBeNull();
      for (const polygon of island.polygons) {
        const c = polygon.reduce((acc, q) => ({ x: acc.x + q.x / polygon.length, y: acc.y + q.y / polygon.length }), { x: 0, y: 0 });
        expect(isLand(terrain, c), `${island.id} parçası`).toBe(true);
      }
    }
    let shelf = 0;
    let coast = 0;
    for (let i = 0; i < terrain.heights.length; i++) {
      if (terrain.shore[i] < 0 && terrain.shore[i] > -12) {
        coast++;
        if (terrain.heights[i] > -0.06) shelf++;
      }
    }
    expect(shelf / coast).toBeGreaterThan(0.95);
  });

  it("nehirler kaynaktan denize, göle ya da başka bir nehre ulaşır", () => {
    expect(terrain.rivers.length).toBeGreaterThan(6);
    for (const river of terrain.rivers) {
      expect(river.points.length).toBe(river.widths.length);
      const end = river.points[river.points.length - 1];
      const i = Math.min(terrain.cols - 1, Math.floor(end.x / terrain.cellSize)) + Math.min(terrain.rows - 1, Math.floor(end.y / terrain.cellSize)) * terrain.cols;
      const reaches = terrain.heights[i] < 0 || terrain.lakeIds[i] >= 0 || terrain.river[i] > 0;
      expect(reaches, `nehir ağzı (${end.x.toFixed(0)}, ${end.y.toFixed(0)})`).toBe(true);
    }
  });

  it("göl çukurları göl olur; soğuk arazidekiler donar", () => {
    for (const basin of BASINS) {
      const i = Math.floor(basin.center.x / terrain.cellSize) + Math.floor(basin.center.y / terrain.cellSize) * terrain.cols;
      expect(terrain.lakeIds[i], basin.name).toBeGreaterThanOrEqual(0);
    }
    const ayna = terrain.lakeIds[Math.floor(BASINS[0].center.x / terrain.cellSize) + Math.floor(BASINS[0].center.y / terrain.cellSize) * terrain.cols];
    expect(terrain.lakes[ayna].frozen).toBe(true);
    const yesil = terrain.lakeIds[Math.floor(BASINS[1].center.x / terrain.cellSize) + Math.floor(BASINS[1].center.y / terrain.cellSize) * terrain.cols];
    expect(terrain.lakes[yesil].frozen).toBe(false);
  });
});

function pointInRegion(p: { x: number; y: number }, id: keyof typeof REGIONS): boolean {
  const poly = REGIONS[id].polygon;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

import { describe, expect, it } from "vitest";
import { REGIONS } from "../content/regions";
import { generateTerrain } from "./terrain";
import { PAINT_TEXEL, paintTerrain, paintVeil, type PaintedImage } from "./terrainPaint";
import { createVisibility } from "./visibility";
import { ISLANDS } from "../content/islands";
import { WORLD_SIZE } from "../types";

const terrain = generateTerrain({ seed: 20261124 });

/** Dünya koordinatındaki pikselin [r, g, b, a] değeri. */
function pixelAt(image: PaintedImage, x: number, y: number, cellSize: number): number[] {
  const col = Math.min(image.width - 1, Math.floor(x / cellSize));
  const row = Math.min(image.height - 1, Math.floor(y / cellSize));
  const i = (row * image.width + col) * 4;
  return [...image.data.subarray(i, i + 4)];
}

describe("arazi boyama", () => {
  const image = paintTerrain(terrain);
  const map = paintTerrain(terrain, { style: "harita" });

  it("dünyayı PAINT_TEXEL birimlik opak piksellerle kaplar", () => {
    expect(image.width).toBe(WORLD_SIZE.width / PAINT_TEXEL);
    expect(image.height).toBe(WORLD_SIZE.height / PAINT_TEXEL);
    // Her piksel opak (tek tek expect çağırmak 1,8 milyon pikselde çok yavaş).
    let transparent = 0;
    for (let i = 3; i < image.data.length; i += 4) if (image.data[i] !== 255) transparent++;
    expect(transparent).toBe(0);
  });

  it("açık deniz mavi, liman yeşil, zirve açık renklidir", () => {
    const [sr, sg, sb] = pixelAt(image, 10, 10, PAINT_TEXEL);
    expect(sb).toBeGreaterThan(sr);
    expect(sb).toBeGreaterThan(sg - 10);

    const harbor = REGIONS.akinburnu.center;
    const [hr, hg, hb] = pixelAt(image, harbor.x, harbor.y, PAINT_TEXEL);
    expect(hg).toBeGreaterThan(hr);
    expect(hg).toBeGreaterThan(hb);

    // Zirve yamacı: karlı/kırağılı, yani yeşil değil beyaza yakın ve soğuk tonlu.
    const peak = REGIONS.gunozu_tepesi.center;
    const [pr, pg, pb] = pixelAt(image, peak.x + 20, peak.y + 20, PAINT_TEXEL);
    expect(Math.min(pr, pg, pb)).toBeGreaterThan(150);
    expect(pb).toBeGreaterThanOrEqual(pr - 10);
    expect(pg - pb).toBeLessThan(hg - hb);
  });

  it("aynı arazi aynı görüntüyü verir; harita üslubu farklı (tarama ve güçlü gölge)", () => {
    expect(paintTerrain(terrain).data).toEqual(image.data);
    expect(map.data).not.toEqual(image.data);
  });

  it("nehirler ve göller boyanır", () => {
    const river = terrain.rivers[0].points[Math.floor(terrain.rivers[0].points.length / 2)];
    const [rr, , rb] = pixelAt(image, river.x, river.y, PAINT_TEXEL);
    expect(rb).toBeGreaterThan(rr + 40);
  });
});

describe("karartı maskesi", () => {
  const visibility = createVisibility(["kutada"], []);
  const veil = paintVeil(terrain, visibility);
  const alpha = (x: number, y: number) => pixelAt(veil, x, y, terrain.cellSize)[3];

  it("açık bölge karartısız, kapalı bölge ve yabani adalar tam koyu; deniz karartılmaz", () => {
    expect(alpha(REGIONS.kutada.center.x, REGIONS.kutada.center.y)).toBe(0);
    expect(alpha(REGIONS.pusluada.center.x, REGIONS.pusluada.center.y)).toBe(255);
    expect(alpha(REGIONS.akinburnu.center.x, REGIONS.akinburnu.center.y)).toBe(255);
    expect(alpha(ISLANDS.kartalyuva.label.x, ISLANDS.kartalyuva.label.y)).toBe(255);
    expect(alpha(40, 40)).toBe(0); // açık deniz
  });

  it("açılan ada aydınlanır; her şey açıksa hiç karartı kalmaz", () => {
    const open = paintVeil(terrain, createVisibility(["kutada", "pusluada"], ["kartalyuva"]));
    expect(pixelAt(open, REGIONS.pusluada.center.x, REGIONS.pusluada.center.y, terrain.cellSize)[3]).toBe(0);
    expect(pixelAt(open, ISLANDS.kartalyuva.label.x, ISLANDS.kartalyuva.label.y, terrain.cellSize)[3]).toBe(0);
    const all = paintVeil(terrain, createVisibility(Object.keys(REGIONS), Object.keys(ISLANDS)));
    expect(all.data.filter((_, i) => i % 4 === 3).every((a) => a === 0)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { REGIONS } from "../content/regions";
import { generateTerrain } from "./terrain";
import { PAINT_TEXEL, paintFog, paintTerrain, type PaintedImage } from "./terrainPaint";
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

describe("sis maskesi", () => {
  const fog = paintFog({
    revealedRegions: new Set(["akinburnu", "ayazbogazi"]),
    glimpses: [{ name: "Süzülkoy'un ışıkları", center: REGIONS.suzulkoy.center, radius: 90 }],
    softness: 24,
  });
  const alpha = (x: number, y: number) => pixelAt(fog, x, y, 4)[3];

  it("açılmış bölgeler sissiz, açılmamışlar sislidir", () => {
    expect(alpha(REGIONS.akinburnu.center.x, REGIONS.akinburnu.center.y)).toBe(0);
    expect(alpha(REGIONS.ayazbogazi.center.x, REGIONS.ayazbogazi.center.y)).toBe(0);
    expect(alpha(REGIONS.pusluada.center.x, REGIONS.pusluada.center.y)).toBeGreaterThan(120);
    expect(alpha(REGIONS.gunozu_tepesi.center.x, REGIONS.gunozu_tepesi.center.y)).toBeGreaterThan(120);
  });

  it("kısa bakış halkası sisi aralar", () => {
    const glimpse = alpha(REGIONS.suzulkoy.center.x, REGIONS.suzulkoy.center.y);
    const edge = alpha(REGIONS.suzulkoy.center.x + 120, REGIONS.suzulkoy.center.y + 30);
    expect(glimpse).toBeLessThan(60);
    expect(edge).toBeGreaterThan(glimpse);
  });

  it("bütün bölgeler açıksa hiç sis kalmaz", () => {
    const clear = paintFog({ revealedRegions: new Set(Object.keys(REGIONS) as (keyof typeof REGIONS)[]), glimpses: [], softness: 24 });
    expect(clear.data.filter((_, i) => i % 4 === 3).every((a) => a === 0)).toBe(true);
  });
});

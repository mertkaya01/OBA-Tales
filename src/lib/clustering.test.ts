import { describe, expect, it } from "vitest";
import { CAST } from "../content/cast";
import { REGIONS } from "../content/regions";
import type { Character } from "../types";
import {
  CLUSTER_ZOOM_THRESHOLD,
  MAX_FOCUS_ZOOM,
  WORLD_BOUNDS,
  clusterByRegion,
  countByClass,
  focusForBounds,
  regionsBounds,
  shouldCluster,
} from "./clustering";
import { polygonBounds } from "./geometry";
import { createStarterCharacter } from "./rules";

const now = new Date("2026-11-24T15:00:00Z");
const everyone: Character[] = [
  ...CAST.filter((c) => c.roleType !== "hero"), // hikâye kadrosu (özel kahramanlar ayrı testlerde)
  createStarterCharacter({ handle: "ayaz_okcu", platform: "tiktok", region: "ayazbogazi", coordinates: { x: 235, y: 330 }, now }),
  createStarterCharacter({ handle: "kar_tanesi", platform: "youtube", region: "suzulkoy", coordinates: { x: 470, y: 545 }, now }),
];

describe("bölge kümeleri", () => {
  it("karakterleri bölgelere göre sayar, boş bölgeleri atlar", () => {
    const clusters = clusterByRegion(everyone);
    expect(clusters.map((c) => [c.regionId, c.count])).toEqual([
      ["akinburnu", 7],
      ["suzulkoy", 1],
      ["ayazbogazi", 1],
    ]);
    expect(clusters.reduce((sum, c) => sum + c.count, 0)).toBe(everyone.length);
  });

  it("balon merkezini bölgeden, halka rengini en yüksek nadirlikten alır", () => {
    const [akinburnu, suzulkoy] = clusterByRegion(everyone);
    expect(akinburnu.center).toEqual(REGIONS.akinburnu.center);
    expect(akinburnu.topRarity).toBe("efsanevi");
    expect(akinburnu.byRarity).toEqual({ siradan: 0, nadir: 0, destansi: 3, efsanevi: 4, ulu: 0, goksel: 0 });
    expect(suzulkoy.topRarity).toBe("siradan");
  });

  it("sınıf sayaçları toplamı tutar", () => {
    expect(countByClass(everyone)).toEqual({ kalkaneri: 2, okyeli: 3, ocakcan: 4 });
  });

  it("eşiğin altında kümeler, üstünde pin gösterir", () => {
    expect(shouldCluster(1)).toBe(true);
    expect(shouldCluster(CLUSTER_ZOOM_THRESHOLD)).toBe(false);
    expect(shouldCluster(3)).toBe(false);
  });
});

describe("bölgeye odak", () => {
  const viewport = { width: 1000, height: 700 };

  it("seçim yoksa bütün dünya", () => {
    expect(regionsBounds([])).toEqual(WORLD_BOUNDS);
    expect(focusForBounds(WORLD_BOUNDS, viewport)).toEqual({ center: { x: 1600, y: 1120 }, zoom: 1 });
  });

  it("tek bölgenin sınırını (boşluksuz) verir, boşluklu sınır dünya dışına taşmaz", () => {
    expect(regionsBounds(["pusluada"], 0)).toEqual(polygonBounds(REGIONS.pusluada.polygon));
    const padded = regionsBounds(["pusluada"], 200);
    expect(padded.minX).toBeGreaterThanOrEqual(0);
    expect(padded.maxX).toBeLessThanOrEqual(WORLD_BOUNDS.maxX);
    expect(padded.minY).toBeGreaterThanOrEqual(0);
  });

  it("küçük bölgeye yakınlaşır ama sınırı aşmaz", () => {
    const focus = focusForBounds(regionsBounds(["gunozu_tepesi"]), viewport);
    expect(focus.zoom).toBeGreaterThan(1);
    expect(focus.zoom).toBeLessThanOrEqual(MAX_FOCUS_ZOOM);
    const tiny = focusForBounds({ minX: 100, minY: 100, maxX: 101, maxY: 101 }, viewport);
    expect(tiny.zoom).toBe(MAX_FOCUS_ZOOM);
  });

  it("dar ekranda da çalışır, boyutsuz ekranda zoom 1 döner", () => {
    const mobile = focusForBounds(regionsBounds(["akinburnu", "suzulkoy"]), { width: 375, height: 700 });
    expect(mobile.zoom).toBeGreaterThanOrEqual(1);
    expect(focusForBounds(WORLD_BOUNDS, { width: 0, height: 0 }).zoom).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import { ISLANDS, ISLAND_IDS } from "../content/islands";
import { REGIONS } from "../content/regions";
import { LANDMARKS, VILLAGES } from "../content/sites";
import { REGION_IDS } from "../types";
import { generateTerrain } from "./terrain";
import { createVisibility, hiddenLandmasses, isHiddenAt, isHiddenIndex, ownerAt } from "./visibility";

const terrain = generateTerrain({ seed: 20261124 });
const day1 = createVisibility(["kutada"], []);

describe("görünürlük: 1. günde yalnızca Kutada", () => {
  it("her kara hücresinin sahibi bölge ya da yabani ada", () => {
    expect(ownerAt(terrain, REGIONS.kutada.center)).toEqual({ kind: "bolge", id: "kutada" });
    expect(ownerAt(terrain, ISLANDS.kartalyuva.label)).toEqual({ kind: "ada", id: "kartalyuva" });
    expect(ownerAt(terrain, { x: 30, y: 30 })).toBeNull(); // açık deniz
  });

  it("Kutada ve Konuk obası açık; öteki bölgeler, adalar ve obaları karartılı", () => {
    expect(isHiddenAt(terrain, day1, REGIONS.kutada.center)).toBe(false);
    expect(isHiddenAt(terrain, day1, LANDMARKS.kutKapisi)).toBe(false);
    for (const village of VILLAGES) expect(isHiddenAt(terrain, day1, village.center), village.name).toBe(village.region !== "kutada");
    for (const id of REGION_IDS) if (id !== "kutada") expect(isHiddenAt(terrain, day1, REGIONS[id].center), id).toBe(true);
    // Her yabani adanın karası karartılı (etiket noktası Martı Adacıkları gibi adalarda denize düşebilir; karaya bakılır).
    ISLAND_IDS.forEach((id, index) => {
      const cell = terrain.islands.indexOf(index);
      expect(cell, id).toBeGreaterThanOrEqual(0);
      expect(isHiddenIndex(terrain, day1, cell), id).toBe(true);
    });
  });

  it("taş köprü iki yakası da açıkken görünür", () => {
    const bridgeOpen = (v: ReturnType<typeof createVisibility>) =>
      !isHiddenAt(terrain, v, LANDMARKS.kadimKemer.from) && !isHiddenAt(terrain, v, LANDMARKS.kadimKemer.to);
    expect(bridgeOpen(day1)).toBe(false);
    expect(bridgeOpen(createVisibility(["kutada", "pusluada"], []))).toBe(true);
  });

  it("karartılı her kara parçasına tek \"?\": noktası karartılı karada; her şey açılınca hiç yok", () => {
    const marks = hiddenLandmasses(terrain, day1);
    // Ana ada (5 bölge) tek işaret; Pusluada ve yabani adalar kendi işaretleri.
    expect(marks.length).toBeGreaterThanOrEqual(6);
    expect(marks.length).toBeLessThanOrEqual(ISLAND_IDS.length + 2); // her yabani adaya en çok bir işaret
    for (const p of marks) expect(isHiddenAt(terrain, day1, p)).toBe(true);
    const mainIsland = marks.filter((p) => ["akinburnu", "ayazbogazi", "kiragiduzu", "suzulkoy", "gunozu_tepesi"].includes(ownerAt(terrain, p)?.id ?? ""));
    expect(mainIsland).toHaveLength(1);
    expect(hiddenLandmasses(terrain, createVisibility(REGION_IDS, ISLAND_IDS))).toEqual([]);
  });
});

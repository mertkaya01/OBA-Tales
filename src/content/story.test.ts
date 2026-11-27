import { describe, expect, it } from "vitest";
import { worldStateSchema } from "../schemas/data";
import { ARRIVAL_ORDER, arrivalsInOrder, arrivedHeroIds, nextArrival, withNextArrival, withoutLastArrival } from "./story";
import { CAST } from "./cast";
import type { StoryState } from "../types";

const day1: StoryState = { day: 1, arrivals: [] };
const at = new Date("2026-11-27T09:00:00+03:00");

describe("hikâye: kahramanların gelişi", () => {
  it("sırayla gelirler: mhellingtr, egetunce, BinTaş; hepsi kadroda var", () => {
    expect(ARRIVAL_ORDER).toEqual(["mhellingtr", "egetunce", "bintas"]);
    for (const id of ARRIVAL_ORDER) expect(CAST.some((c) => c.id === id && c.roleType === "hero")).toBe(true);
    let story = day1;
    expect(nextArrival(story)).toBe("mhellingtr");
    story = withNextArrival(story, at);
    story = withNextArrival(story, at);
    expect(arrivedHeroIds(story)).toEqual(["mhellingtr", "egetunce"]);
    expect(nextArrival(story)).toBe("bintas");
    story = withNextArrival(story, at);
    expect(nextArrival(story)).toBeNull();
    expect(withNextArrival(story, at)).toBe(story); // hepsi geldi
    expect(story.arrivals[0].at).toBe(at.toISOString());
  });

  it("son geliş geri alınabilir; sırası bozuk liste world.json'da reddedilir", () => {
    const two = withNextArrival(withNextArrival(day1, at), at);
    expect(arrivedHeroIds(withoutLastArrival(two))).toEqual(["mhellingtr"]);
    expect(arrivalsInOrder({ day: 1, arrivals: [{ id: "egetunce", at: at.toISOString() }] })).toBe(false);
    const world = {
      version: 1,
      seed: 1,
      fogSoftness: 24,
      revealedRegions: ["kutada"],
      glimpses: [],
      socialLinks: { instagram: null, tiktok: null, youtube: null },
      updatedAt: at.toISOString(),
    };
    // story ve revealedIslands yazılmazsa 1. gün, kimse yok.
    const parsed = worldStateSchema.parse(world);
    expect(parsed.story).toEqual({ day: 1, arrivals: [], welcome: "uclu" });
    expect(parsed.revealedIslands).toEqual([]);
    expect(worldStateSchema.safeParse({ ...world, story: { day: 1, arrivals: [{ id: "bintas", at: at.toISOString() }] } }).success).toBe(false);
  });
});

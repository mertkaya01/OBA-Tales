import { describe, expect, it } from "vitest";
import { createStarterCharacter } from "../../lib/rules";
import type { Character, Platform } from "../../types";
import { RAID_ACTS, RAID_DAY_LENGTH, actAt, fillAct, rageAt, raidCallouts } from "./raidDay";

const now = new Date("2026-11-26T12:00:00Z");
const make = (handle: string, platform: Platform): Character => createStarterCharacter({ handle, platform, region: "ayazbogazi", coordinates: { x: 500, y: 1100 }, now });
const raiders = [
  ...["kalkan_a", "kalkan_b", "kalkan_c", "kalkan_d"].map((h) => make(h, "instagram")),
  ...["ok_a", "ok_b", "ok_c"].map((h) => make(h, "tiktok")),
  ...["ocak_a", "ocak_b"].map((h) => make(h, "youtube")),
];

describe("Akın Günü", () => {
  it("perdeler boşluksuz ve sırayla turu doldurur", () => {
    expect(RAID_ACTS[0].start).toBe(0);
    expect(RAID_ACTS.at(-1)!.end).toBe(RAID_DAY_LENGTH);
    for (let i = 1; i < RAID_ACTS.length; i++) expect(RAID_ACTS[i].start).toBe(RAID_ACTS[i - 1].end);
    expect(actAt(0).act.id).toBe("toplanma");
    expect(actAt(10).act.id).toBe("kalkan");
    expect(actAt(17).act.cls).toBe("okyeli");
    expect(actAt(RAID_DAY_LENGTH + 31).act.id).toBe("final"); // tur başa döner
    expect(actAt(12.5).progress).toBeCloseTo(0.5);
  });

  it("Öfke dalgalarla iner, finalde sıfırlanır, yeni turda dolar", () => {
    expect(rageAt(0)).toBe(100);
    expect(rageAt(8)).toBe(100);
    let last = 101;
    for (let t = 9; t <= 34; t += 0.5) {
      const rage = rageAt(t);
      expect(rage).toBeLessThanOrEqual(last);
      last = rage;
    }
    expect(rageAt(34)).toBe(0);
    expect(rageAt(40)).toBe(0);
    expect(rageAt(RAID_DAY_LENGTH + 1)).toBe(100);
  });

  it("her dalgada o sınıftan gerçek yoldaşlar anılır; tur değişince kişiler de değişir", () => {
    const first = raidCallouts(raiders, 0);
    const byAct = (list: typeof first, cls: string) => list.filter((c) => c.cls === cls);
    expect(byAct(first, "kalkaneri")).toHaveLength(3);
    expect(byAct(first, "okyeli")).toHaveLength(3);
    expect(byAct(first, "ocakcan")).toHaveLength(2); // yalnızca iki Ocakcan var
    for (const c of byAct(first, "kalkaneri")) expect(c.text).toMatch(/@kalkan_/);
    for (const c of byAct(first, "okyeli")) expect(c.text).toMatch(/@ok_/);
    // Aynı dalgada aynı kişi iki kez anılmaz; anılma anları kendi perdesinin içinde.
    for (const cls of ["kalkaneri", "okyeli"]) expect(new Set(byAct(first, cls).map((c) => c.text.split(" ")[0])).size).toBe(3);
    for (const c of first) {
      const act = actAt(c.at).act;
      expect(c.at).toBeGreaterThanOrEqual(act.start);
      expect(c.at).toBeLessThan(act.end);
    }
    const turns = new Set(Array.from({ length: 6 }, (_, loop) => raidCallouts(raiders, loop).map((c) => c.text).join("|")));
    expect(turns.size).toBeGreaterThan(1);
    expect(raidCallouts([], 0)).toEqual([]);
  });

  it("başlıklar boss adı ve akıncı sayısıyla dolar", () => {
    expect(fillAct(RAID_ACTS.at(-1)!.title, "Buzkıran Tekgöz", 1203)).toBe("Buzkıran Tekgöz sakinleşti!");
    expect(fillAct(RAID_ACTS[0].caption, "Buzkıran Tekgöz", 1203)).toBe("1.203 yoldaş meydanda, Buzkıran Tekgöz karşılarında.");
  });
});

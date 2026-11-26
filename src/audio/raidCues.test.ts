import { describe, expect, it } from "vitest";
import { actAt, RAID_DAY_LENGTH } from "../world3d/living/raidDay";
import { cuesBetween, raidCues } from "./raidCues";

describe("akın sesleri", () => {
  const cues = raidCues();

  it("sıralı, turun içinde ve her ses kendi perdesinde", () => {
    for (let i = 1; i < cues.length; i++) expect(cues[i].at).toBeGreaterThanOrEqual(cues[i - 1].at);
    for (const c of cues) {
      expect(c.at).toBeGreaterThanOrEqual(0);
      expect(c.at).toBeLessThan(RAID_DAY_LENGTH);
    }
    const inAct = (id: string) => cues.filter((c) => c.id === id).map((c) => actAt(c.at).act.id);
    expect(new Set(inAct("ok"))).toEqual(new Set(["ok", "final"]));
    expect(new Set(inAct("ocak"))).toEqual(new Set(["ocak", "final"]));
    expect(inAct("zafer")).toEqual(["zafer"]);
    expect(inAct("patlama")).toEqual(["final"]);
    expect(cues.filter((c) => c.id === "nara" && actAt(c.at).act.id === "nara")).toHaveLength(4);
    // Ok yağmuru RaidBattle gibi 1,2 sn'de bir.
    const arrows = cues.filter((c) => c.id === "ok" && actAt(c.at).act.id === "ok");
    expect(arrows.length).toBe(6);
    expect(arrows[1].at - arrows[0].at).toBeCloseTo(1.2);
  });

  it("aralık sorgusu tur başa sarınca da çalışır", () => {
    expect(cuesBetween(cues, 33, 34).map((c) => c.id)).toEqual(["patlama"]);
    const wrapped = cuesBetween(cues, 41.5, 5.5);
    expect(wrapped.map((c) => c.id)).toEqual(["nara"]);
    expect(cuesBetween(cues, 0, RAID_DAY_LENGTH)).toHaveLength(cues.length);
  });
});

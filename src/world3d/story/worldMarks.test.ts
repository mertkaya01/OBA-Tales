import { describe, expect, it } from "vitest";
import type { ArrivalHeroId } from "../../content/story";
import { getTerrain } from "../../game/terrainCache";
import { dayPlan } from "./daySchedule";
import { kutadaSites } from "./kutadaSites";
import { at, DAY_SECONDS } from "./storyClock";
import { impactBetween, impactShake, pickedFruit, stackCountAt, STACK_BASE, treeStateAt } from "./worldMarks";

const SEED = 20261124;
const sites = kutadaSites(getTerrain(SEED), SEED);
const ALL: ArrivalHeroId[] = ["mhellingtr", "egetunce", "bintas"];
const DAY = 20784;
const today = dayPlan(sites, ALL, DAY);
const yesterday = dayPlan(sites, ALL, DAY - 1);
const tomorrow = dayPlan(sites, ALL, DAY + 1);

describe("dünyadaki izler", () => {
  it("kesilen ağaç: sarsılır → devrilir → yarılır → kütük kalır, bağlar taşındıkça azalır", () => {
    const chop = today.chops[0];
    const t = chop.tree;
    expect(treeStateAt(today, null, t, chop.start - 10).kind).toBe("ayakta");
    expect(treeStateAt(today, null, t, chop.start + 30).kind).toBe("ayakta");
    expect(treeStateAt(today, null, t, chop.fall + 0.9).kind).toBe("devriliyor");
    expect(treeStateAt(today, null, t, chop.splitStart + 5).kind).toBe("yatik");
    const after = treeStateAt(today, null, t, chop.splitEnd + 1);
    expect(after.kind).toBe("kutuk");
    expect(after.bundles).toBe(3);
    expect(treeStateAt(today, null, t, chop.pickups[0] + 1).bundles).toBe(2);
    expect(treeStateAt(today, null, t, chop.pickups[2] + 1).bundles).toBe(0);
  });

  it("dün kesilen ağaç gece kütük, sabah 05–07 arası fidandan büyür", () => {
    const t = yesterday.chops.find((c) => !today.chops.some((d) => d.tree === c.tree))!.tree;
    expect(treeStateAt(today, yesterday, t, at(3)).kind).toBe("kutuk");
    const sapling = treeStateAt(today, yesterday, t, at(6));
    expect(sapling.kind).toBe("fidan");
    expect(sapling.grow).toBeGreaterThan(0.2);
    expect(sapling.grow).toBeLessThan(1);
    expect(treeStateAt(today, yesterday, t, at(7, 30)).kind).toBe("ayakta");
  });

  it("balta sarsıntısı vuruşta en güçlü, vuruş anı yakalanır", () => {
    expect(impactShake(0.63)).toBeGreaterThan(0.9);
    expect(impactShake(1.25)).toBeLessThan(0.05);
    expect(impactBetween(0.65, 0.05)).toBe(true);
    expect(impactBetween(0.4, 0.05)).toBe(false);
  });

  it("istif gün içinde büyür, gece yarısı sıçramaz", () => {
    const morning = stackCountAt(today, yesterday, at(7, 5));
    const noon = stackCountAt(today, yesterday, at(12));
    expect(noon).toBeGreaterThan(morning);
    // Gece yarısından sonra ateşe atılanlar sabahki istiften düşer ama istif hiç bitmez.
    expect(morning).toBeGreaterThanOrEqual(2);
    expect(morning).toBeLessThanOrEqual(STACK_BASE + 2);
    const lastNight = stackCountAt(today, yesterday, DAY_SECONDS - 1);
    const firstMinute = stackCountAt(tomorrow, today, 1);
    expect(Math.abs(lastNight - firstMinute)).toBeLessThanOrEqual(1);
  });

  it("çalının meyvesi toplandıkça azalır, ertesi sabah yenilenir", () => {
    const pick = today.bushPicks[0];
    expect(pickedFruit(today.bushPicks, null, pick.index, pick.start - 1)).toBe(1);
    const mid = pickedFruit(today.bushPicks, null, pick.index, (pick.start + pick.end) / 2);
    expect(mid).toBeLessThan(1);
    expect(mid).toBeGreaterThan(0.15);
    expect(pickedFruit(today.bushPicks, null, pick.index, pick.end + 1)).toBeCloseTo(0.15);
    expect(pickedFruit(tomorrow.bushPicks, today.bushPicks, pick.index, at(3))).toBeCloseTo(0.15);
    expect(pickedFruit(tomorrow.bushPicks, today.bushPicks, pick.index, at(7, 30))).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import { REGIONS } from "../../content/regions";
import type { ArrivalHeroId } from "../../content/story";
import { getTerrain } from "../../game/terrainCache";
import { isWet, sampleTerrain } from "../../game/terrain";
import { createVisibility, isHiddenAt } from "../../game/visibility";
import { pointInPolygon } from "../../lib/geometry";
import { dayPlan, poseAt, segmentAt, SLEEP_AT, WAKE_AT, type Activity } from "./daySchedule";
import { kutadaSites } from "./kutadaSites";
import { at, DAY_SECONDS } from "./storyClock";

const SEED = 20261124;
const terrain = getTerrain(SEED);
const sites = kutadaSites(terrain, SEED);
const DAY = 20784;
const ALL: ArrivalHeroId[] = ["mhellingtr", "egetunce", "bintas"];
const full = dayPlan(sites, ALL, DAY);
const solo = dayPlan(sites, ["mhellingtr"], DAY);
const day1 = createVisibility(["kutada"], []);

describe("gün düzeni", () => {
  it("gelen her kahramanın bir günü var; gelmeyenin yok", () => {
    expect([...full.timelines.keys()].sort()).toEqual([...ALL].sort());
    expect([...solo.timelines.keys()]).toEqual(["mhellingtr"]);
    for (const tl of full.timelines.values()) {
      expect(tl[0].t0).toBe(0);
      expect(tl[tl.length - 1].t1).toBeCloseTo(DAY_SECONDS, 3);
      // Parçalar boşluksuz ve sıralı.
      for (let i = 1; i < tl.length; i++) expect(tl[i].t0).toBeCloseTo(tl[i - 1].t1, 6);
    }
  });

  it("01:00–04:45 arası herkes çadırında uyur, sabah sırayla uyanır", () => {
    for (const [id, tl] of full.timelines) {
      for (let s = at(1, 5); s < at(4, 45); s += 600) expect(poseAt(tl, s).hidden, `${id} ${s}`).toBe(true);
      expect(poseAt(tl, SLEEP_AT[id] - 120).hidden).toBe(false);
      expect(poseAt(tl, WAKE_AT[id] + 60).hidden).toBe(false);
      expect(segmentAt(tl, WAKE_AT[id] + 1).clip).toBe("cadir"); // eğilerek çıkar
    }
    expect(WAKE_AT.bintas).toBeLessThan(WAKE_AT.mhellingtr); // ocağı BinTaş yakar
  });

  it("her saatin bir işi var", () => {
    const expectAt = (id: ArrivalHeroId, hour: number, allowed: Activity[]) => {
      const activity = poseAt(full.timelines.get(id)!, at(hour)).activity;
      expect(allowed, `${id} ${hour}:00 → ${activity}`).toContain(activity);
    };
    expectAt("egetunce", 8, ["odun", "yol"]);
    expectAt("mhellingtr", 8, ["tasima", "yol"]);
    expectAt("bintas", 8, ["su", "yol"]);
    for (const id of ALL) expectAt(id, 13, ["toplama", "yol"]);
    expectAt("mhellingtr", 16, ["av"]);
    expectAt("egetunce", 16, ["iz"]);
    expectAt("bintas", 16, ["kurutma", "yol"]);
    for (const id of ALL) {
      expectAt(id, 21, ["ates", "yol"]);
      expectAt(id, 6, ["sabah", "yol"]);
    }
  });

  it("kimse ışınlanmaz: yer, yürüyüş hızından hızlı değişmez (gece yarısı dahil)", () => {
    const next = dayPlan(sites, ALL, DAY + 1);
    for (const [id, tl] of full.timelines) {
      let prev = poseAt(tl, 0);
      let px = prev.x;
      let pz = prev.z;
      for (let s = 0.5; s < DAY_SECONDS; s += 0.5) {
        const p = poseAt(tl, s);
        const jump = Math.hypot(p.x - px, p.z - pz);
        if (jump > 4) throw new Error(`${id} ${(s / 3600).toFixed(3)} sa: ${jump.toFixed(2)} birim sıçradı`);
        px = p.x;
        pz = p.z;
      }
      const end = poseAt(tl, DAY_SECONDS - 0.01);
      const start = poseAt(next.timelines.get(id)!, 0);
      expect(Math.hypot(end.x - start.x, end.z - start.z), id).toBeLessThan(0.5);
    }
  });

  it("gittiği her yer kuru, Kutada'nın içinde ve karanlıkta değil", () => {
    for (const [id, tl] of full.timelines) {
      for (let s = 0; s < DAY_SECONDS; s += 45) {
        const p = poseAt(tl, s);
        const point = { x: p.x, y: p.z };
        expect(pointInPolygon(point, REGIONS.kutada.polygon), `${id} ${s}`).toBe(true);
        expect(isWet(terrain, point), `${id} ${s} ıslak`).toBe(false);
        expect(sampleTerrain(terrain, point).height, `${id} ${s}`).toBeGreaterThan(0.02);
        expect(isHiddenAt(terrain, day1, point), `${id} ${s}`).toBe(false);
      }
    }
  });

  it("odun: egetunce keser ve yarar, mhellingtr taşır; yalnızken mhellingtr ikisini de yapar", () => {
    expect(full.chops.length).toBeGreaterThanOrEqual(8);
    expect(full.chops.every((c) => c.hero === "egetunce" && c.start < c.fall && c.fall < c.splitStart && c.splitStart < c.splitEnd)).toBe(true);
    expect(full.chops.every((c) => c.splitEnd <= at(12))).toBe(true);
    expect(new Set(full.chops.map((c) => c.tree)).size).toBe(full.chops.length); // aynı ağaç iki kez kesilmez
    expect(full.drops.length).toBeGreaterThan(15);
    // Bağ, ağaç yarıldıktan sonra alınır.
    for (const c of full.chops) for (const p of c.pickups) expect(p).toBeGreaterThan(c.splitEnd);

    expect(solo.chops.every((c) => c.hero === "mhellingtr")).toBe(true);
    const axe = solo.timelines.get("mhellingtr")!.some((s) => s.props.axe && s.clip === "balta");
    expect(axe).toBe(true);
    // egetunce varken mhellingtr balta tutmaz.
    expect(full.timelines.get("mhellingtr")!.some((s) => s.props.axe)).toBe(false);
  });

  it("toplama, av ve ateş izleri plana yazılır", () => {
    expect(full.bushPicks.length).toBe(sites.bushes.length);
    expect(full.herbPicks.length).toBe(sites.herbs.length);
    // Av: 1–3 ok, sonuncusu isabet eder; av asacağa ikindi bitmeden asılır.
    expect(full.shots.length).toBeGreaterThanOrEqual(1);
    expect(full.shots.length).toBeLessThanOrEqual(3);
    expect(full.shots.every((s) => s.at >= at(15) && s.at <= at(18, 41))).toBe(true);
    expect(full.shots[full.shots.length - 1].hit).toBe(true);
    expect(full.shots.slice(0, -1).every((s) => !s.hit)).toBe(true);
    expect(full.kill).not.toBeNull();
    expect(full.kill!.hang).toBeLessThan(at(18, 40));
    expect(full.feeds.length).toBeGreaterThan(5);
    expect(solo.feeds.length).toBe(0); // ateşe odun atan BinTaş
  });

  it("aynı gün herkes için aynı, ertesi gün farklı", () => {
    expect(dayPlan(sites, [...ALL].reverse(), DAY)).toBe(full);
    const other = dayPlan(sites, ALL, DAY + 3);
    expect(other.chops.map((c) => c.tree)).not.toEqual(full.chops.map((c) => c.tree));
  });
});

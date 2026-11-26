import { describe, expect, it } from "vitest";
import type { ArrivalHeroId } from "../../content/story";
import { getTerrain } from "../../game/terrainCache";
import { isWet } from "../../game/terrain";
import { ANIMAL_KINDS, ANIMALS, animalPose, BIRDS_LEAVE, BIRDS_RETURN, huntTarget, stillWindows, type AnimalKind, type EpisodeCache } from "./animals";
import { dayPlan, poseAt } from "./daySchedule";
import { kutadaSites } from "./kutadaSites";
import { at, DAY_SECONDS } from "./storyClock";

const SEED = 20261124;
const terrain = getTerrain(SEED);
const sites = kutadaSites(terrain, SEED);
const DAY = 20784;
const ALL: ArrivalHeroId[] = ["mhellingtr", "egetunce", "bintas"];
const fromMeadow = (x: number, z: number) => Math.hypot(x - sites.meadow.center.x, z - sites.meadow.center.y);

describe("Kutada'nın hayvanları", () => {
  it("kimse ışınlanmaz; dört ayaklılar çayırda, kuru yerde kalır (gece yarısı dahil)", () => {
    for (const kind of ["geyik", "tavsan"] as AnimalKind[]) {
      for (let index = 0; index < ANIMALS[kind].count; index++) {
        const cache: EpisodeCache = new Map();
        let prev = animalPose(sites, DAY, kind, index, 0, [], cache);
        let px = prev.x;
        let pz = prev.z;
        const max = (ANIMALS[kind].strides[ANIMALS[kind].flee] ?? 10) * ANIMALS[kind].scale * 2 * 0.5 + 0.5;
        for (let s = 0.5; s < DAY_SECONDS; s += 0.5) {
          const p = animalPose(sites, DAY, kind, index, s, [], cache);
          const jump = Math.hypot(p.x - px, p.z - pz);
          if (jump > max) throw new Error(`${kind}${index} ${(s / 3600).toFixed(3)} sa: ${jump.toFixed(2)} birim`);
          px = p.x;
          pz = p.z;
          if (s % 60 === 0) {
            expect(fromMeadow(p.x, p.z), `${kind}${index}`).toBeLessThan(kind === "geyik" ? 16.5 : 21);
            expect(isWet(terrain, { x: p.x, y: p.z })).toBe(false);
          }
        }
        const end = animalPose(sites, DAY, kind, index, DAY_SECONDS - 0.01);
        const next = animalPose(sites, DAY + 1, kind, index, 0);
        expect(Math.hypot(end.x - next.x, end.z - next.z), `${kind}${index} gece yarısı`).toBeLessThan(1);
      }
    }
  });

  it("kuşlar sürüyle konar, kalkar; akşam gider, sabah döner", () => {
    for (let index = 0; index < ANIMALS.kus.count; index++) {
      expect(animalPose(sites, DAY, "kus", index, at(3)).hidden).toBe(true);
      expect(animalPose(sites, DAY, "kus", index, at(22)).hidden).toBe(true);
      expect(animalPose(sites, DAY, "kus", index, at(12)).hidden).toBe(false);
      let px = NaN;
      let pz = NaN;
      for (let s = BIRDS_RETURN + 60; s < BIRDS_LEAVE - 60; s += 0.5) {
        const p = animalPose(sites, DAY, "kus", index, s);
        if (!Number.isNaN(px) && Math.hypot(p.x - px, p.z - pz) > 6) throw new Error(`kuş ${index} ${(s / 3600).toFixed(3)} sıçradı`);
        px = p.x;
        pz = p.z;
      }
    }
    // Sürü birlikte: öğlen kuşlar birbirine yakın.
    const noon = Array.from({ length: ANIMALS.kus.count }, (_, i) => animalPose(sites, DAY, "kus", i, at(12, 0, )));
    const spread = Math.max(...noon.map((a) => Math.max(...noon.map((b) => Math.hypot(a.x - b.x, a.z - b.z)))));
    expect(spread).toBeLessThan(12);
  });

  it("günün avı: önce gözler, ıskalanınca hayvan kaçar, isabette yığılır, sırtlanınca kalkar", () => {
    const plan = dayPlan(sites, ALL, DAY);
    const { kind, index } = plan.hunt;
    const kill = plan.kill!;
    expect(kill).toBeTruthy();
    expect(kill.time).toBeGreaterThan(at(15, 20)); // önce gözler
    expect(kill.pickup).toBeGreaterThan(kill.time + 5);
    expect(kill.hang).toBeGreaterThan(kill.pickup);
    const events = plan.huntEvents;
    const dead = animalPose(sites, DAY, kind, index, kill.time + 3, events);
    expect(dead.dead).toBe(true);
    expect(dead.clip).toBe("yigil");
    expect(Math.hypot(dead.x - kill.at.x, dead.z - kill.at.y)).toBeLessThan(0.5);
    expect(animalPose(sites, DAY, kind, index, kill.pickup + 1, events).hidden).toBe(true);
    // Avcı vuruş anında hayvana nişan almış, eğilerek yaklaşmış.
    const hunter = plan.timelines.get("mhellingtr")!;
    const shot = plan.shots[plan.shots.length - 1];
    expect(poseAt(hunter, shot.at).clip).toBe("yay");
    expect(poseAt(hunter, shot.at - 3).clip).toBe("cadir");
    // Sırtlarken avın yanında, sonra sırtında av.
    const carry = poseAt(hunter, kill.pickup + 5);
    expect(carry.props.carry).toBe("av");
    // Ertesi gün aynı hayvan yeniden çayırda.
    expect(animalPose(sites, DAY + 1, kind, index, at(12)).hidden).toBe(false);
    // Iska olduysa hayvan kaçtı (yer değiştirdi).
    for (const flee of events.filter((e) => e.type === "flee")) {
      const before = animalPose(sites, DAY, kind, index, flee.at - 0.1, events);
      const after = animalPose(sites, DAY, kind, index, flee.at + 4, events);
      expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(5);
    }
  });

  it("her gün bir av; boynuzlu geyik avlanmaz; pusu için duraklar bulunur", () => {
    const kinds = new Set<AnimalKind>();
    for (let d = DAY; d < DAY + 30; d++) {
      const t = huntTarget(d);
      kinds.add(t.kind);
      expect(t.index).toBeGreaterThanOrEqual(t.kind === "geyik" ? 1 : 0);
      expect(t.index).toBeLessThan(ANIMALS[t.kind].count);
    }
    expect(kinds).toEqual(new Set(ANIMAL_KINDS));
    for (let d = DAY; d < DAY + 8; d++) expect(dayPlan(sites, ALL, d).kill, `gün ${d}`).not.toBeNull();
    expect(stillWindows(sites, DAY, "geyik", 1, [], at(15), at(16), 10).length).toBeGreaterThan(3);
  });
});

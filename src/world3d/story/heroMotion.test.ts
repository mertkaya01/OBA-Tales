import { describe, expect, it } from "vitest";
import { cyclePeriod, motionAt } from "../living/motion";
import type { CharacterPlacement } from "../living/placement";
import { locomotion, RUN_CLIP_SPEED, WALK_CLIP_SPEED, wanderPose } from "./heroMotion";

const SCALE = 1.8;

describe("locomotion", () => {
  it("duran kahraman bostadadır", () => {
    expect(locomotion(0, SCALE)).toEqual({ clip: "bosta", timeScale: 1 });
  });

  it("klibin kendi hızında yürüyen kahraman klibi 1 hızında oynatır", () => {
    expect(locomotion(WALK_CLIP_SPEED * SCALE, SCALE)).toEqual({ clip: "yuru", timeScale: 1 });
  });

  it("çok hızlıysa koşar, koşu da adım uzunluğuna göre hızlanır", () => {
    const run = locomotion(RUN_CLIP_SPEED * SCALE, SCALE);
    expect(run.clip).toBe("kos");
    expect(run.timeScale).toBeCloseTo(1);
  });

  it("klip hızı makul aralıkta kalır", () => {
    expect(locomotion(0.3 * SCALE, SCALE).timeScale).toBeGreaterThanOrEqual(0.55);
    expect(locomotion(40 * SCALE, SCALE).timeScale).toBeLessThanOrEqual(1.5);
  });

  it("büyük karakter aynı hızda daha yavaş adım atar", () => {
    const small = locomotion(4, 1.5);
    const big = locomotion(4, 2.2);
    expect(small.clip).toBe("yuru");
    expect(big.timeScale).toBeLessThan(small.timeScale);
  });
});

describe("wanderPose", () => {
  const placement: CharacterPlacement = {
    home: { x: 1490, y: 1210 },
    groundY: 3,
    scale: SCALE,
    motion: { radius: 12, seed: 0.37, yaw: 0, cheer: -1 },
    inFormation: false,
  };

  it("ad plakası ve seçim halkasıyla aynı yerde durur", () => {
    for (const t of [0, 3.3, 11.8, 40]) {
      const pose = wanderPose(placement, t);
      const m = motionAt(placement.motion, t);
      expect(pose.x).toBeCloseTo(placement.home.x + m.dx, 6);
      expect(pose.z).toBeCloseTo(placement.home.y + m.dz, 6);
      expect(pose.yaw).toBeCloseTo(m.yaw, 6);
    }
  });

  it("bir tur içinde hem durur hem yürür, hiç koşmaz", () => {
    const period = cyclePeriod(placement.motion.seed);
    const clips = new Set<string>();
    for (let t = 0; t < period * 3; t += 0.1) clips.add(wanderPose(placement, t).clip);
    expect(clips).toEqual(new Set(["bosta", "yuru"]));
  });

  it("yerinden kımıldamayan kahraman hep bostadadır", () => {
    const still = { ...placement, motion: { ...placement.motion, radius: 0 } };
    for (let t = 0; t < 30; t += 1.7) expect(wanderPose(still, t).clip).toBe("bosta");
  });
});

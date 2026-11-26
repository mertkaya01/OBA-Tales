import { describe, expect, it } from "vitest";
import { closeness, hearing, hearingRadius, panFor } from "./soundMix";

describe("ada seslerinin karışımı", () => {
  it("uzaktan bakarken ada sesleri duyulmaz", () => {
    expect(closeness(0.5)).toBe(0);
    expect(hearing(0, 0.5)).toBe(0);
  });

  it("yakından bakınca yakın ses tam, uzak ses hiç duyulmaz", () => {
    expect(hearing(0, 12)).toBeCloseTo(1);
    expect(hearing(hearingRadius(12) + 1, 12)).toBe(0);
    expect(hearing(10, 12)).toBeGreaterThan(hearing(30, 12));
  });

  it("yakınlaştıkça duyma yarıçapı daralır", () => {
    expect(hearingRadius(30)).toBeLessThan(hearingRadius(3));
  });

  it("sağ-sol dengesi ekrandaki yerden, kenarda bile tam tek kulağa değil", () => {
    expect(panFor(0)).toBe(0);
    expect(panFor(1)).toBeCloseTo(0.85);
    expect(panFor(-3)).toBeCloseTo(-0.85);
  });
});

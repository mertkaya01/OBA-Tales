import { describe, expect, it } from "vitest";
import { TOUR_STEPS, tourSteps } from "./tour";

describe("ilk oba turu", () => {
  it("adalarla başlar, kendini bul çağrısıyla biter; boss adı metne girer", () => {
    const steps = tourSteps("Buzkıran Tekgöz");
    expect(steps).toHaveLength(TOUR_STEPS.length);
    expect(steps[0].target).toBe("adalar");
    expect(steps.at(-1)!.target).toBe("arama");
    expect(steps.find((s) => s.target === "meydan")!.text).toContain("Buzkıran Tekgöz");
    for (const s of steps) expect(s.text).not.toContain("{");
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
  });

  it("aktif akın yoksa meydan adımı atlanır", () => {
    const steps = tourSteps(null);
    expect(steps).toHaveLength(TOUR_STEPS.length - 1);
    expect(steps.some((s) => s.target === "meydan")).toBe(false);
  });
});

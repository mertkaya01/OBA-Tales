import { describe, expect, it } from "vitest";
import { TOUR_STEPS } from "./tour";

describe("ilk oba turu", () => {
  it("Kutada ile başlar, kendini bul çağrısıyla biter; akın adımı yok, karanlıktaki adalar anlatılır", () => {
    expect(TOUR_STEPS[0].target).toBe("adalar");
    expect(TOUR_STEPS.at(-1)!.target).toBe("arama");
    expect(TOUR_STEPS.map((s) => s.target)).toEqual(["adalar", "kapi", "oba", "oba", "gizli", "arama"]);
    expect(TOUR_STEPS.some((s) => /akın/i.test(s.text))).toBe(false);
    expect(new Set(TOUR_STEPS.map((s) => s.id)).size).toBe(TOUR_STEPS.length);
  });
});

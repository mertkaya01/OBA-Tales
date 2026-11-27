import { describe, expect, it } from "vitest";
import { ARRIVAL_LENGTH, ORB_STAGGER, arrivalAt, arrivalLength, openingCinematic, orbAt, orbPath, pendingArrival } from "./arrival";

describe("geliş sineması", () => {
  it("sırası: kapı parlar → küre uçar → kahraman belirir → kart → bantlar kalkar", () => {
    expect(arrivalAt(0.2)).toMatchObject({ revealed: false, card: false, orb: null, caption: "Kut Kapısı titriyor…" });
    expect(arrivalAt(2).flare).toBeGreaterThan(0.5);
    expect(arrivalAt(3.7).orb).toBeCloseTo(0.5);
    expect(arrivalAt(3.7).caption).toBe("Bir ışık doğuyor…");
    expect(arrivalAt(4.8)).toMatchObject({ revealed: true, orb: null, column: 1 });
    expect(arrivalAt(6).card).toBe(true);
    expect(arrivalAt(7).flare).toBe(0);
    expect(arrivalAt(1).letterbox).toBe(1);
    expect(arrivalAt(ARRIVAL_LENGTH).letterbox).toBe(0);
    expect(arrivalAt(ARRIVAL_LENGTH).card).toBe(false);
  });

  it("küre kapıdan çıkar, havada kavis çizer, kahramanın yerine iner", () => {
    const from = { x: 0, y: 10, z: 0 };
    const to = { x: 100, y: 2, z: 50 };
    expect(orbPath(from, to, 0)).toEqual([0, 10, 0]);
    const mid = orbPath(from, to, 0.5);
    expect(mid[1]).toBeGreaterThan(30);
    const end = orbPath(from, to, 1);
    expect(end[0]).toBeCloseTo(100);
    expect(end[1]).toBeCloseTo(2);
  });

  it("görülmemiş en son geliş oynar; görülmüşse ya da 7 günden eskiyse oynamaz", () => {
    const story = {
      day: 2,
      arrivals: [
        { id: "mhellingtr", at: "2026-11-27T09:00:00+03:00" },
        { id: "egetunce", at: "2026-11-29T09:00:00+03:00" },
      ],
    };
    const now = new Date("2026-11-29T12:00:00+03:00");
    expect(pendingArrival(story, new Set(), now)).toBe("egetunce");
    expect(pendingArrival(story, new Set(["egetunce"]), now)).toBe("mhellingtr");
    expect(pendingArrival(story, new Set(["egetunce", "mhellingtr"]), now)).toBeNull();
    expect(pendingArrival(story, new Set(), new Date("2026-12-20T12:00:00+03:00"))).toBeNull();
    expect(pendingArrival({ day: 1, arrivals: [] }, new Set(), now)).toBeNull();
  });

  it("karşılama: üç küre arayla kalkar, kapı son küreye kadar parlar, kart hepsi indikten sonra gelir", () => {
    const n = 3;
    expect(arrivalAt(3.7, n).caption).toBe("Üç ışık doğuyor…");
    // İkinci küre birincisinden ORB_STAGGER sonra yolun ortasında.
    expect(orbAt(3.7 + ORB_STAGGER, 1).orb).toBeCloseTo(0.5);
    expect(orbAt(3.7, 2).orb).toBeLessThan(orbAt(3.7, 0).orb!);
    const lastLanding = 4.8 + 2 * ORB_STAGGER;
    expect(orbAt(lastLanding - 0.01, 2).revealed).toBe(false);
    expect(orbAt(lastLanding, 2).revealed).toBe(true);
    expect(arrivalAt(lastLanding - 0.01, n).flare).toBeGreaterThan(0.9);
    expect(arrivalAt(5.3, n).card).toBe(false);
    expect(arrivalAt(lastLanding + 0.5, n).card).toBe(true);
    expect(arrivalLength(n)).toBeGreaterThan(ARRIVAL_LENGTH);
    expect(arrivalAt(arrivalLength(n), n).letterbox).toBe(0);
    // Tek kahraman eskisi gibi.
    expect(arrivalLength(1)).toBe(ARRIVAL_LENGTH);
  });

  it("ilk ziyarette karşılama (tarihe bakmaz), geri gelende yalnızca yeni geliş", () => {
    const old = new Date("2027-02-01T12:00:00+03:00");
    const story = {
      day: 3,
      arrivals: [
        { id: "mhellingtr", at: "2026-11-27T09:00:00+03:00" },
        { id: "egetunce", at: "2026-11-27T12:00:00+03:00" },
        { id: "bintas", at: "2026-11-27T13:00:00+03:00" },
      ],
    };
    expect(openingCinematic(story, new Set(), old, true)).toEqual({ kind: "karsilama", heroes: ["mhellingtr", "egetunce", "bintas"] });
    expect(openingCinematic({ ...story, welcome: "son" }, new Set(), old, true)).toEqual({ kind: "karsilama", heroes: ["bintas"] });
    expect(openingCinematic({ ...story, welcome: "kapali" }, new Set(), old, true)).toBeNull();
    // Geri gelen: aylar sonra sinema yok; yeni bir geliş varsa o.
    expect(openingCinematic(story, new Set(), old, false)).toBeNull();
    expect(openingCinematic(story, new Set(["mhellingtr", "egetunce"]), new Date("2026-11-28T12:00:00+03:00"), false)).toEqual({ kind: "gelis", heroes: ["bintas"] });
    // Kimse gelmediyse karşılama da yok.
    expect(openingCinematic({ day: 1, arrivals: [] }, new Set(), old, true)).toBeNull();
  });
});

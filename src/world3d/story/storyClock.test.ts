import { describe, expect, it } from "vitest";
import { TIME_LAPSE_DAY_MS } from "../living/sky";
import { DAY_SECONDS, istanbulOffset, storyTime } from "./storyClock";

// 2026-11-26 09:30:00 İstanbul = 06:30:00 UTC
const NOW = Date.UTC(2026, 10, 26, 6, 30, 0);

describe("hikâye saati", () => {
  it("İstanbul UTC+3", () => {
    expect(istanbulOffset(NOW)).toBe(3 * 3600);
  });

  it("gerçek zamanda İstanbul saati, milisaniye hassas", () => {
    const t = storyTime({ override: null, lapse: null }, NOW, 0);
    expect(t.seconds).toBeCloseTo(9.5 * 3600, 6);
    const later = storyTime({ override: null, lapse: null }, NOW + 250, 0);
    expect(later.seconds - t.seconds).toBeCloseTo(0.25, 6);
    expect(later.day).toBe(t.day);
  });

  it("?saat= ile sabitlenince oradan gerçek hızda ilerler", () => {
    const t = storyTime({ override: 3, lapse: null }, NOW, 0);
    expect(t.seconds).toBeCloseTo(3 * 3600, 6);
    expect(storyTime({ override: 3, lapse: null }, NOW, 42).seconds).toBeCloseTo(3 * 3600 + 42, 6);
    // Gece yarısını geçince ertesi güne döner.
    const wrap = storyTime({ override: 23.99, lapse: null }, NOW, 120);
    expect(wrap.day).toBe(t.day + 1);
    expect(wrap.seconds).toBeLessThan(120);
  });

  it("hızlı zamanda gün düzeni de hızlanır", () => {
    const lapse = { startedAt: NOW, startHour: 6 };
    const start = storyTime({ override: null, lapse }, NOW, 0);
    expect(start.seconds).toBeCloseTo(6 * 3600, 3);
    const quarter = storyTime({ override: null, lapse }, NOW + TIME_LAPSE_DAY_MS / 4, 0);
    expect(quarter.seconds).toBeCloseTo(12 * 3600, 3);
    expect(quarter.seconds).toBeLessThan(DAY_SECONDS);
  });
});

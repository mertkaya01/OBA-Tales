import { describe, expect, it } from "vitest";
import { GREETINGS, pickLine, WAKE_LINES, WORK_LINES } from "../../content/heroLines";
import { ASLEEP, AWAKE, asleepLength, awakeLength, reactionFrame, type Reaction } from "./reactions";

const awake: Reaction = { start: 10, asleep: false, sitting: false, anchor: { x: 5, z: 7, yaw: 1 }, line: "Selam!" };
const door = { x: 0, y: 0 };
const front = { x: 0, y: 3 };
const asleep: Reaction = { start: 10, asleep: true, sitting: false, anchor: { x: 0, z: 0, yaw: 0 }, door, front, inYaw: Math.PI, line: "Uyuyordum… Hoş geldin!" };

describe("seslenince el sallama", () => {
  it("uyanıkken: kameraya döner, el sallar, söyler, sonra işine yetişir", () => {
    expect(reactionFrame(awake, 9.9)).toBeNull(); // henüz başlamadı
    const turn = reactionFrame(awake, 10.1)!;
    expect(turn.yaw).toBeNull(); // kameraya döner
    expect(turn.clip).toBe("bosta");
    const wave = reactionFrame(awake, 10 + AWAKE.turn + 1)!;
    expect(wave.clip).toBe("selam");
    expect(wave.speech).toBe("Selam!");
    expect([wave.x, wave.z]).toEqual([5, 7]); // yerinden kımıldamaz
    const catchUp = reactionFrame(awake, 10 + AWAKE.turn + AWAKE.wave + AWAKE.hold + 0.5)!;
    expect(catchUp.catchUp).toBeGreaterThan(0);
    expect(catchUp.speech).toBeNull();
    expect(reactionFrame(awake, 10 + awakeLength() + 0.01)).toBeNull();
  });

  it("ateş başında oturuyorsa kalkmaz: oturduğu yerden el kol sallar", () => {
    const f = reactionFrame({ ...awake, sitting: true }, 11)!;
    expect(f.clip).toBe("sohbet");
    expect(f.speech).toBe("Selam!");
  });

  it("uyurken: çadırdan çıkar → esner → el sallar → geri girer", () => {
    const exit = reactionFrame(asleep, 10.05)!;
    expect(exit.clip).toBe("cadir");
    expect(exit.hidden).toBe(false);
    expect(Math.hypot(exit.x - door.x, exit.z - door.y)).toBeLessThan(0.2);
    const yawn = reactionFrame(asleep, 10 + ASLEEP.exit + 1)!;
    expect(yawn.clip).toBe("esne");
    expect([yawn.x, yawn.z]).toEqual([front.x, front.y]);
    expect(yawn.speech).toBeNull();
    const wave = reactionFrame(asleep, 10 + ASLEEP.exit + ASLEEP.yawn + ASLEEP.turn + 1)!;
    expect(wave.clip).toBe("selam");
    expect(wave.yaw).toBeNull();
    expect(wave.speech).toBe("Uyuyordum… Hoş geldin!");
    const enter = reactionFrame(asleep, 10 + asleepLength() - 0.01)!;
    expect(enter.clip).toBe("cadir");
    expect(enter.hidden).toBe(true);
    expect(reactionFrame(asleep, 10 + asleepLength() + 0.01)).toBeNull();
    // Toplam 8–13 saniye.
    expect(asleepLength()).toBeGreaterThan(8);
    expect(asleepLength()).toBeLessThan(13);
  });

  it("sözler: uyurken uyanma sözü, uyanıkken işe göre; sırayla döner", () => {
    expect(pickLine("egetunce", "odun", true, 0)).toBe(WAKE_LINES.egetunce[0]);
    expect(pickLine("egetunce", "odun", false, 0)).toBe(WORK_LINES.egetunce.odun![0]);
    expect(pickLine("egetunce", "odun", false, 1)).not.toBe(pickLine("egetunce", "odun", false, 0));
    expect(pickLine("bintas", "av", false, 0)).toBe(GREETINGS.bintas[0]); // BinTaş'ın av sözü yok
    for (const lines of [...Object.values(WAKE_LINES), ...Object.values(GREETINGS)]) for (const line of lines) expect(line.length).toBeLessThanOrEqual(48);
  });
});

import { describe, expect, it } from "vitest";
import { EPISODES } from "../content/episodes";
import type { EpisodeStatus } from "../types";
import { formatAirTime } from "./text";
import { bossReveal, nextAirTime, pollStandings, roundPercents, seasonActs, seasonProgress, voteHint } from "./season";

const poll = EPISODES[1].polls[0]; // b02-onarim: alptug, suheyla, kursat

describe("oylama", () => {
  it("yüzdeler tam sayı ve toplamı 100", () => {
    expect(roundPercents([1, 1, 1])).toEqual([34, 33, 33]);
    // 17,47 · 63,25 · 19,28 → tabanlar 17 + 63 + 19 = 99; eksik 1, en büyük kalana (0,47) gider.
    expect(roundPercents([29, 105, 32])).toEqual([18, 63, 19]);
    expect(roundPercents([0, 0])).toEqual([0, 0]);
    for (const values of [[3, 7], [1, 2, 3, 4], [999, 1], [5]]) {
      expect(roundPercents(values).reduce((a, b) => a + b, 0)).toBe(100);
    }
  });

  it("biten oylamada kazanan işaretlenir", () => {
    const s = pollStandings(poll, { pollId: poll.id, tallies: { alptug: 29, suheyla: 105, kursat: 32 }, winnerOptionId: "suheyla" });
    expect(s.closed).toBe(true);
    expect(s.total).toBe(166);
    expect(s.options.find((o) => o.winner)?.id).toBe("suheyla");
    expect(s.options.some((o) => o.leading)).toBe(false);
  });

  it("süren oylamada önde giden işaretlenir, kazanan yoktur; sonuç yoksa her şey sıfır", () => {
    const s = pollStandings(poll, { pollId: poll.id, tallies: { alptug: 10, suheyla: 4 }, winnerOptionId: null });
    expect(s.closed).toBe(false);
    expect(s.options.map((o) => o.leading)).toEqual([true, false, false]);
    expect(s.options.find((o) => o.id === "kursat")?.votes).toBe(0);
    const empty = pollStandings(poll, undefined);
    expect(empty.total).toBe(0);
    expect(empty.options.every((o) => o.percent === 0 && !o.leading && !o.winner)).toBe(true);
  });

  it("oy verme ipucu bütün seçenekleri tarafsızca sayar", () => {
    expect(voteHint(["Cesaret Taktiği", "Buz Eritme Planı"])).toBe('yorumlara "Cesaret Taktiği" ya da "Buz Eritme Planı" yaz');
    expect(voteHint(["A", "B", "C"])).toBe('yorumlara "A", "B" ya da "C" yaz');
    expect(voteHint([])).toBe("yorumlara seçeneğin adını yaz");
  });
});

const view = (statuses: EpisodeStatus[], aired: (string | null)[] = []) =>
  EPISODES.map((e, i) => ({ ...e, status: statuses[i] ?? ("kilitli" as const), progress: aired[i] !== undefined ? { airedAt: aired[i] } : null }));

describe("sezon", () => {
  it("ilerleme: biten bölümler + aktifin yarısı", () => {
    const p = seasonProgress(view(["tamamlandi", "tamamlandi", "aktif", "yakinda"]));
    expect(p).toEqual({ completed: 2, total: 12, active: 3, percent: 21 });
    expect(seasonProgress([]).percent).toBe(0);
  });

  it("12 bölüm 4 perde; her perde bir boss akınıyla kapanır", () => {
    const acts = seasonActs(view([]));
    expect(acts.map((a) => a.episodes.length)).toEqual([3, 3, 3, 3]);
    expect(acts.map((a) => a.bossId)).toEqual(["buzkiran_tekgoz", "sisci_karacay", "ayazkurt", "kisgolgesi_han"]);
    expect(acts.flatMap((a) => a.episodes.map((e) => e.number))).toEqual(EPISODES.map((e) => e.number));
  });

  it("sıradaki bölüm, son yayından bir hafta sonra (İstanbul saatiyle aynı gün ve saat)", () => {
    const next = nextAirTime(view(["tamamlandi", "tamamlandi", "aktif"], ["2026-11-10T19:00:00+03:00", "2026-11-17T19:00:00+03:00", "2026-11-24T19:00:00+03:00"]));
    expect(next?.number).toBe(4);
    expect(formatAirTime(next!.iso)).toBe("1 Aralık Salı 19:00");
    expect(nextAirTime(view([]))).toBeNull();
  });

  it("boss kartı bölüm durumuna göre açılır", () => {
    expect((["kilitli", "yakinda", "aktif", "tamamlandi"] as const).map(bossReveal)).toEqual(["gizem", "siluet", "tam", "sakin"]);
  });
});

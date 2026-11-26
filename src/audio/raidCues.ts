/**
 * AKIN SESLERİ — Akın Günü'nün (world3d/living/raidDay.ts) hangi saniyesinde hangi ses çalacağı. Saf veri, testli.
 * Zamanlar RaidBattle.tsx'teki hamlelerle aynıdır: ayaz dalgası 9,6 ve 12,8'de, ok yağmuru ok perdesinde 1,2 sn'de bir,
 * ocak ışığı ocak perdesinde 1,5 sn'de bir, hep birlikte son hamle 30,4'te, büyük parlama 33,2'de.
 */
import { RAID_ACTS, RAID_DAY_LENGTH } from "../world3d/living/raidDay";

export type RaidCueId = "nara" | "ayaz" | "kalkan" | "ok" | "ocak" | "patlama" | "zafer";

export interface RaidCue {
  /** Akın Günü'nün saniyesi. */
  at: number;
  id: RaidCueId;
}

const actById = (id: string) => RAID_ACTS.find((a) => a.id === id)!;

function every(id: RaidCueId, from: number, to: number, step: number): RaidCue[] {
  const out: RaidCue[] = [];
  for (let at = from; at < to - 0.05; at += step) out.push({ at: Math.round(at * 100) / 100, id });
  return out;
}

/** Bir turun bütün sesleri, zamana göre sıralı. */
export function raidCues(): RaidCue[] {
  const nara = actById("nara");
  const ok = actById("ok");
  const ocak = actById("ocak");
  const zafer = actById("zafer");
  const cues: RaidCue[] = [
    // Oba Narası: ön saftan arkaya dört dalga.
    ...[0.2, 0.9, 1.6, 2.3].map((d) => ({ at: nara.start + d, id: "nara" as const })),
    // Kalkan Duvarı: ayaz dalgası duvara çarpar, kalkanlar çınlar.
    { at: 9.6, id: "ayaz" },
    { at: 9.85, id: "kalkan" },
    ...[10.6, 11.5].map((at) => ({ at, id: "kalkan" as const })),
    { at: 12.8, id: "ayaz" },
    { at: 13.05, id: "kalkan" },
    ...[13.9, 14.8].map((at) => ({ at, id: "kalkan" as const })),
    // Buz Oku ve Ocak ışığı.
    ...every("ok", ok.start + 0.3, ok.end, 1.2),
    ...every("ocak", ocak.start + 0.3, ocak.end, 1.5),
    // Omuz omuza: bütün oba aynı anda.
    { at: 30.4, id: "nara" },
    { at: 30.45, id: "ok" },
    { at: 30.5, id: "ocak" },
    { at: 30.55, id: "ayaz" },
    { at: 33.2, id: "patlama" },
    // Boss sakinleşti.
    { at: zafer.start + 0.3, id: "zafer" },
  ];
  return cues.filter((c) => c.at < RAID_DAY_LENGTH).sort((a, b) => a.at - b.at);
}

/** [from, to) aralığındaki sesler; tur başa sarıyorsa (to < from) iki parçaya bakar. */
export function cuesBetween(cues: readonly RaidCue[], from: number, to: number): RaidCue[] {
  if (to >= from) return cues.filter((c) => c.at >= from && c.at < to);
  return [...cues.filter((c) => c.at >= from), ...cues.filter((c) => c.at < to)];
}

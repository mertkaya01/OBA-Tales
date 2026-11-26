/**
 * AKIN GÜNÜ — "Akını izle" denince meydanda dönen ~42 saniyelik, videoya hazır akın gösterisi.
 *
 *   0–5   Toplanma      akıncılar meydanda, boss karşılarında
 *   5–9   Oba Narası    ön saftan arkaya dalga dalga
 *   9–16  Kalkan Duvarı Kalkaneriler: boss'un ayaz dalgası kalkan duvarında dağılır
 *   16–23 Buz Oku       Okyeliler: ok yağmuru boss'un çekirdeğine
 *   23–30 Ocak ışığı    Ocakcanlar: sıcak ışık küreleri buzu yumuşatır
 *   30–35 Omuz omuza    bütün oba aynı anda: son hamle
 *   35–42 Sakinleşti    boss uysallaşır; kimse yaralanmaz, boss dost olur
 *
 * Boss'un Öfke çubuğu dalgalarla iner ve finalde sıfırlanır. Her dalgada o sınıftan gerçek yoldaşların adları
 * ekranda anılır ("@ayaz_kiz çekirdeği vurdu!"); her turda başka kişiler seçilir. Saf fonksiyonlardır, Three.js bilmez.
 */
import { hashString } from "../../lib/random";
import type { Character, ClassId } from "../../types";

export const RAID_DAY_LENGTH = 42;

export type RaidActId = "toplanma" | "nara" | "kalkan" | "ok" | "ocak" | "final" | "zafer";

export interface RaidAct {
  id: RaidActId;
  start: number;
  end: number;
  title: string;
  /** {boss} ve {n} yerine boss adı ve akıncı sayısı gelir. */
  caption: string;
  /** Bu perdede öne çıkan sınıf. */
  cls: ClassId | null;
}

export const RAID_ACTS: readonly RaidAct[] = [
  { id: "toplanma", start: 0, end: 5, title: "Akın günü", caption: "{n} yoldaş meydanda, {boss} karşılarında.", cls: null },
  { id: "nara", start: 5, end: 9, title: "Oba Narası!", caption: "Ön saftan arkaya dalga dalga: hep bir ağızdan!", cls: null },
  { id: "kalkan", start: 9, end: 16, title: "Kalkan Duvarı!", caption: "Kalkaneriler kalkanlarını kenetledi; ayaz dalgası duvarda dağılıyor.", cls: "kalkaneri" },
  { id: "ok", start: 16, end: 23, title: "Buz Oku yağmuru!", caption: "Okyeliler {boss} adlı devin buz çekirdeğini hedefliyor.", cls: "okyeli" },
  { id: "ocak", start: 23, end: 30, title: "Ocak ışığı!", caption: "Ocakcanlar sıcak ışıkla buzu yumuşatıyor.", cls: "ocakcan" },
  { id: "final", start: 30, end: 35, title: "Omuz omuza!", caption: "Bütün oba aynı anda: son hamle!", cls: null },
  { id: "zafer", start: 35, end: 42, title: "{boss} sakinleşti!", caption: "Kimse yaralanmadı. Bu akına {n} yoldaş katıldı.", cls: null },
];

const wrap = (t: number) => ((t % RAID_DAY_LENGTH) + RAID_DAY_LENGTH) % RAID_DAY_LENGTH;

/** Şu anki perde ve perdenin ne kadarı geçti (0–1). */
export function actAt(t: number): { act: RaidAct; index: number; progress: number } {
  const time = wrap(t);
  const index = Math.max(0, RAID_ACTS.findIndex((a) => time >= a.start && time < a.end));
  const act = RAID_ACTS[index];
  return { act, index, progress: (time - act.start) / (act.end - act.start) };
}

/** Öfke (0–100): dalgalarla iner, finalde sıfırlanır, tur başında yeniden dolar. */
const RAGE: readonly [number, number][] = [
  [0, 100],
  [9, 100],
  [16, 72],
  [23, 45],
  [30, 22],
  [34, 0],
  [RAID_DAY_LENGTH, 0],
];

export function rageAt(t: number): number {
  const time = wrap(t);
  for (let i = 1; i < RAGE.length; i++) {
    const [t1, v1] = RAGE[i];
    const [t0, v0] = RAGE[i - 1];
    if (time <= t1) return Math.round(v0 + ((time - t0) / (t1 - t0)) * (v1 - v0));
  }
  return 0;
}

export interface Callout {
  /** Turun kaçıncı saniyesinde görünür. */
  at: number;
  text: string;
  cls: ClassId | null;
}

const LINES: Readonly<Partial<Record<RaidActId, readonly string[]>>> = {
  kalkan: ["@{h} kalkanı tuttu!", "@{h} ayaz dalgasını durdurdu!", "@{h} ön safta dimdik!"],
  ok: ["@{h} çekirdeği vurdu!", "@{h} ilk oku attı!", "@{h} tam isabet!"],
  ocak: ["@{h} ocak ışığı gönderdi!", "@{h} davulu çaldı!", "@{h} buzu yumuşattı!"],
  final: ["@{h} öne atıldı!", "@{h} son hamleyi yaptı!"],
};

/** Bu turda anılacak yoldaşlar: her dalgada o sınıftan (finalde herkesten) üç kişi; tura göre değişir. */
export function raidCallouts(raiders: readonly Character[], loop: number): Callout[] {
  const out: Callout[] = [];
  for (const act of RAID_ACTS) {
    const lines = LINES[act.id];
    if (!lines) continue;
    const pool = act.cls ? raiders.filter((c) => c.class.id === act.cls) : raiders;
    if (!pool.length) continue;
    const used = new Set<string>();
    const count = act.id === "final" ? 2 : 3;
    for (let k = 0; k < count && used.size < pool.length; k++) {
      let pick = pool[hashString(`akin:${loop}:${act.id}:${k}`) % pool.length];
      for (let step = 1; used.has(pick.id); step++) pick = pool[(hashString(`akin:${loop}:${act.id}:${k}`) + step) % pool.length];
      used.add(pick.id);
      const span = act.end - act.start;
      out.push({ at: act.start + 1 + (k * (span - 2)) / count, text: lines[k % lines.length].replace("{h}", pick.handle), cls: act.cls });
    }
  }
  return out;
}

/** Perde başlığı ve açıklamasındaki {boss} ve {n} alanlarını doldurur. */
export const fillAct = (text: string, boss: string, raiders: number) => text.replaceAll("{boss}", boss).replaceAll("{n}", raiders.toLocaleString("tr-TR"));

/**
 * GELİŞ SİNEMASI — bir kahraman Kut Kapısı'ndan doğduğunda bir kez oynayan ~9,5 saniyelik giriş (saf, testli).
 *
 *   0,0–1,0   kamera Kut Kapısı'na uçar, sinema bantları iner          "Kut Kapısı titriyor…"
 *   1,0–2,6   kapı parlar: girdap, runlar ve huzme güçlenir
 *   2,6–4,8   kapıdan bir ışık küresi yükselir, kavis çizerek kahramanın obasına iner   "Bir ışık doğuyor…"
 *   4,8       küre yere değer: ışık sütunu ve halka; kahraman belirir
 *   5,2–9,2   kart: "mhellingtr geldi!", unvanı ve imza sözü
 *   9,0–9,5   bantlar kalkar, kamera serbest
 *
 * Hangi gelişin oynayacağı: bu tarayıcının görmediği en son geliş, son 7 gün içindeyse. Daha eski gelişler sessizce
 * "görüldü" sayılır (siteye haftalar sonra gelen biri üç sinemayı art arda izlemesin).
 */
import type { StoryState } from "../../types";

export const ARRIVAL_LENGTH = 9.5;
export const ARRIVAL_SEEN_KEY = "oba-tales:gelisler:v1";
const MAX_AGE_DAYS = 7;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ramp = (t: number, from: number, to: number) => clamp01((t - from) / (to - from));

export interface ArrivalFrame {
  /** Kapının parlaması (0–1). */
  flare: number;
  /** Işık küresinin yolu (0–1), uçmuyorsa null. */
  orb: number | null;
  /** Varış sütunu ve halkasının gücü (0–1). */
  column: number;
  /** Kahraman görünür mü? */
  revealed: boolean;
  /** Kart görünür mü? */
  card: boolean;
  /** Sinema bantları (0–1). */
  letterbox: number;
  caption: string | null;
}

export function arrivalAt(t: number): ArrivalFrame {
  const flare = t < 4.8 ? ramp(t, 1, 2.6) : 1 - ramp(t, 4.8, 6.5);
  return {
    flare,
    orb: t >= 2.6 && t < 4.8 ? ramp(t, 2.6, 4.8) : null,
    column: t >= 4.8 ? 1 - ramp(t, 4.8, 6.8) : 0,
    revealed: t >= 4.8,
    card: t >= 5.2 && t < 9.2,
    letterbox: t < 9 ? ramp(t, 0, 0.5) : 1 - ramp(t, 9, ARRIVAL_LENGTH),
    caption: t < 2.6 ? "Kut Kapısı titriyor…" : t < 4.8 ? "Bir ışık doğuyor…" : null,
  };
}

/** Küre yolu: kapının tepesinden yükselip kahramanın yerine kavisle iner (x, yükseklik, z). */
export function orbPath(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, k: number): [number, number, number] {
  const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
  const arc = Math.sin(Math.PI * k) * 26;
  return [from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e + arc, from.z + (to.z - from.z) * e];
}

/** Oynayacak geliş: görülmemiş en son geliş (son 7 gün içinde). */
export function pendingArrival(story: StoryState, seen: ReadonlySet<string>, now: Date): string | null {
  const latest = [...story.arrivals].reverse().find((a) => !seen.has(a.id));
  if (!latest) return null;
  const age = (now.getTime() - new Date(latest.at).getTime()) / 86_400_000;
  return age <= MAX_AGE_DAYS ? latest.id : null;
}

/** Sahnenin paylaşılan sinema durumu: sinema (DOM) yazar, kapı ve küre efekti (3D) her karede okur. */
export interface ArrivalRuntime {
  active: boolean;
  /** Sinemanın saniyesi. */
  t: number;
  /** Kürenin çıktığı yer (kapının tepesi) ve indiği yer (kahramanın yanı), Three.js x/y/z. */
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
}

export function createArrivalRuntime(): ArrivalRuntime {
  return { active: false, t: 0, from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: 0, z: 0 } };
}

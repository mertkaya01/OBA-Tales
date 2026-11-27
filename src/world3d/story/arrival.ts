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
 * Karşılama (siteye ilk kez gelen): gelmiş kahramanların hepsi aynı sinemada doğar. Küreler kapıdan ORB_STAGGER
 * arayla kalkar, her biri kendi kahramanının yerine iner; kart hepsini birlikte gösterir (panelden "son gelen" ya da
 * "kapalı" da seçilebilir: openingCinematic).
 *
 * Geri gelen ziyaretçide: bu tarayıcının görmediği en son geliş, son 7 gün içindeyse. Daha eski gelişler sessizce
 * "görüldü" sayılır (siteye haftalar sonra gelen biri üç sinemayı art arda izlemesin).
 */
import { arrivedHeroIds } from "../../content/story";
import type { StoryState } from "../../types";

export const ARRIVAL_LENGTH = 9.5;
export const ARRIVAL_SEEN_KEY = "oba-tales:gelisler:v1";
/** İlk ziyaret karşılaması görüldü mü (bu tarayıcıda). */
export const WELCOME_SEEN_KEY = "oba-tales:karsilama:v1";
/** Birden çok kahraman doğarken kürelerin kapıdan kalkış arası (sn). */
export const ORB_STAGGER = 0.5;
const MAX_AGE_DAYS = 7;
/** Birden çok kahramanda kart biraz daha uzun kalır (adlar okunsun). */
const GROUP_CARD_BONUS = 1.2;

/** Sinemanın toplam süresi: kahraman sayısına göre. */
export function arrivalLength(count = 1): number {
  return count <= 1 ? ARRIVAL_LENGTH : ARRIVAL_LENGTH + (count - 1) * ORB_STAGGER + GROUP_CARD_BONUS;
}

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

const LIGHTS = ["Bir ışık", "İki ışık", "Üç ışık", "Dört ışık", "Beş ışık"];

/**
 * Sinemanın t. saniyesi. count > 1 ise (karşılama) kapı son küre kalkana kadar parlar, kart ve bantlar o kadar geç
 * gelir; orb/column/revealed ilk kürenindir (her kürenin kendisi için: orbAt).
 */
export function arrivalAt(t: number, count = 1): ArrivalFrame {
  const extra = Math.max(0, count - 1) * ORB_STAGGER;
  const bonus = count > 1 ? GROUP_CARD_BONUS : 0;
  const end = arrivalLength(count);
  const landed = 4.8 + extra;
  const flare = t < landed ? ramp(t, 1, 2.6) : 1 - ramp(t, landed, landed + 1.7);
  const first = orbAt(t, 0);
  return {
    flare,
    orb: first.orb,
    column: first.column,
    revealed: first.revealed,
    card: t >= 5.2 + extra && t < 9.2 + extra + bonus,
    letterbox: t < end - 0.5 ? ramp(t, 0, 0.5) : 1 - ramp(t, end - 0.5, end),
    caption: t < 2.6 ? "Kut Kapısı titriyor…" : t < landed ? `${LIGHTS[Math.min(count, LIGHTS.length) - 1]} doğuyor…` : null,
  };
}

/** i. kürenin durumu: kapıdan i × ORB_STAGGER sonra kalkar. */
export function orbAt(t: number, index: number): { orb: number | null; column: number; revealed: boolean } {
  const k = t - index * ORB_STAGGER;
  return {
    orb: k >= 2.6 && k < 4.8 ? ramp(k, 2.6, 4.8) : null,
    column: k >= 4.8 ? 1 - ramp(k, 4.8, 6.8) : 0,
    revealed: k >= 4.8,
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

/** Açılışta oynayacak sinema: karşılama (ilk ziyaret) ya da tek bir yeni geliş. */
export interface OpeningCinematic {
  kind: "karsilama" | "gelis";
  /** Doğacak kahramanlar, geliş sırasıyla. */
  heroes: string[];
}

/**
 * Açılışta ne oynar? `firstVisit`: bu tarayıcı siteyi ilk kez açıyor (karşılama ve tur görülmemiş).
 * İlk ziyarette karşılama (panel ayarına göre: hepsi / son gelen / yok) gelişlerin tarihine bakmaz; geri gelen
 * ziyaretçide görülmemiş en son geliş (son 7 gün).
 */
export function openingCinematic(story: StoryState, seen: ReadonlySet<string>, now: Date, firstVisit: boolean): OpeningCinematic | null {
  const arrived = arrivedHeroIds(story);
  if (firstVisit && arrived.length > 0) {
    const mode = story.welcome ?? "uclu";
    if (mode === "uclu") return { kind: "karsilama", heroes: [...arrived] };
    if (mode === "son") return { kind: "karsilama", heroes: [arrived[arrived.length - 1]] };
  }
  const id = pendingArrival(story, seen, now);
  return id ? { kind: "gelis", heroes: [id] } : null;
}

type Point3 = { x: number; y: number; z: number };

/** Sahnenin paylaşılan sinema durumu: sinema (DOM) yazar, kapı ve küre efekti (3D) her karede okur. */
export interface ArrivalRuntime {
  active: boolean;
  /** Sinemanın saniyesi. */
  t: number;
  /** Kürelerin çıktığı yer (kapının tepesi), Three.js x/y/z. */
  from: Point3;
  /** Her kürenin indiği yer (kahramanın yanı), geliş sırasıyla. */
  targets: Point3[];
}

export function createArrivalRuntime(): ArrivalRuntime {
  return { active: false, t: 0, from: { x: 0, y: 0, z: 0 }, targets: [] };
}

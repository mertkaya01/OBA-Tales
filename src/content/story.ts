/**
 * HİKÂYE — 1. günden başlayan akış.
 *
 * Ada boştur. Kahramanlar sırayla gelir (ARRIVAL_ORDER): önce mhellingtr, sonra egetunce, sonra BinTaş. Gelişleri
 * yönetim paneli world.json → story.arrivals listesine yazar; sitede o kahraman Kut Kapısı'ndan doğar.
 * Hikâye kadrosu (Baturay, Dede Toygar …) şimdilik haritada yok; kodda durur, ileride hikâyeyle gelebilir. Dede Toygar
 * haritada olmadan anlatıcıdır (tanıtım turu).
 */
import type { StoryState } from "../types";

/** Kahramanların geliş sırası. */
export const ARRIVAL_ORDER = ["mhellingtr", "egetunce", "bintas"] as const;
export type ArrivalHeroId = (typeof ARRIVAL_ORDER)[number];

/** Turu ve hikâyeyi anlatan (haritada değil, sesi ve portresiyle). */
export const NARRATOR_ID = "dede_toygar";

/**
 * Siteye ilk kez gelenin karşılaması (yönetim paneli → Hikâye): gelmiş kahramanların hepsi Kut Kapısı'ndan art arda
 * doğar (uclu), yalnızca son gelen doğar (son) ya da karşılama sineması yoktur (kapali). Ardından Dede'nin turu açılır.
 */
export const WELCOME_MODES = ["uclu", "son", "kapali"] as const;
export type WelcomeMode = (typeof WELCOME_MODES)[number];
export const WELCOME_LABELS: Readonly<Record<WelcomeMode, string>> = {
  uclu: "Kahramanların hepsi birden Kut Kapısı'ndan doğar",
  son: "Yalnızca son gelen kahraman doğar",
  kapali: "Sinema yok, doğrudan Dede'nin turu",
};

/** Gizli adaların ipucu. */
export const HIDDEN_LAND_HINT = "Sizlerin desteğiyle yakında";

/** Gelmiş kahramanlar, geliş sırasıyla. */
export function arrivedHeroIds(story: StoryState): ArrivalHeroId[] {
  const arrived = new Set(story.arrivals.map((a) => a.id));
  return ARRIVAL_ORDER.filter((id) => arrived.has(id));
}

/** Sıradaki kahraman (hepsi geldiyse null). */
export function nextArrival(story: StoryState): ArrivalHeroId | null {
  const arrived = new Set(story.arrivals.map((a) => a.id));
  return ARRIVAL_ORDER.find((id) => !arrived.has(id)) ?? null;
}

/** Sıradaki kahramanı getirir (yeni durum; hepsi geldiyse aynısı). */
export function withNextArrival(story: StoryState, at: Date): StoryState {
  const next = nextArrival(story);
  return next ? { ...story, arrivals: [...story.arrivals, { id: next, at: at.toISOString() }] } : story;
}

/** Son gelişi geri alır. */
export function withoutLastArrival(story: StoryState): StoryState {
  return { ...story, arrivals: story.arrivals.slice(0, -1) };
}

/** Gelişler doğru sırada mı? (world.json denetimi) */
export function arrivalsInOrder(story: StoryState): boolean {
  return story.arrivals.every((a, i) => a.id === ARRIVAL_ORDER[i]);
}

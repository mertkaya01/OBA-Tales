/**
 * HİKÂYENİN SAHNEDEKİ ORTAK DURUMU — gün düzeninin saati ve kahramanlara seslenme istekleri.
 *
 *   · StoryTicker (StoryLayer.tsx) her karede günü ve saniyeyi yazar; kahramanlar ve dünyadaki izler (devrilen
 *     ağaç, büyüyen istif) aynı andan okur.
 *   · Arama, tıklama ya da geliş sineması bir kahramana seslenince calls'a "ne zaman" yazılır; kahraman o anda
 *     tepki verir (reactions.ts).
 */
import { useWorldTime } from "../../state/useWorldTime";
import type { Coordinates } from "../../types";
import type { WorldScene } from "../useWorldScene";
import { ARRIVAL_ORDER, type ArrivalHeroId } from "../../content/story";
import { dayPlan, poseAt } from "./daySchedule";
import { kutadaSites } from "./kutadaSites";
import { storyTime } from "./storyClock";

export interface StoryRuntime {
  day: number;
  seconds: number;
  /** İlk kare yazıldı mı? */
  ready: boolean;
  /** Seslenilen kahraman → tepkinin başlayacağı an (dünya saati, saniye). */
  calls: Map<string, number>;
}

/** İlk çizimden önce de doğru günü bilsin diye şimdiki zamanla başlar. */
export function createStoryRuntime(): StoryRuntime {
  const now = storyTime(useWorldTime.getState().settings, Date.now(), 0);
  return { day: now.day, seconds: now.seconds, ready: true, calls: new Map() };
}

/** Bir kahramana seslen: kısa bir gecikmeyle (kamera uçarken) dönüp el sallar. */
export function callHero(scene: WorldScene, id: string, delay = 0.7): void {
  scene.story.calls.set(id, scene.motionUniforms.uTime.value + delay);
}

type StoryScene = Pick<WorldScene, "data" | "terrain" | "seed" | "story" | "motionUniforms">;

/** Gelmiş kahramanlar (geliş sırasıyla). */
export function arrivedHeroes(scene: StoryScene): ArrivalHeroId[] {
  return ARRIVAL_ORDER.filter((id) => scene.data.characterById.has(id));
}

/**
 * Kahramanın gün düzenine göre şu anki yeri (sahne henüz çizilmeden de): geliş sinemasının ışığı oraya iner.
 * Kahraman gün düzeninde değilse null.
 */
export function scheduledSpot(scene: StoryScene, id: string): Coordinates | null {
  const heroes = arrivedHeroes(scene);
  if (!(heroes as string[]).includes(id)) return null;
  const time = scene.story.ready
    ? { day: scene.story.day, seconds: scene.story.seconds }
    : storyTime(useWorldTime.getState().settings, Date.now(), scene.motionUniforms.uTime.value);
  const plan = dayPlan(kutadaSites(scene.terrain, scene.seed), heroes, time.day);
  const timeline = plan.timelines.get(id as ArrivalHeroId);
  if (!timeline) return null;
  const pose = poseAt(timeline, time.seconds);
  return { x: pose.x, y: pose.z };
}

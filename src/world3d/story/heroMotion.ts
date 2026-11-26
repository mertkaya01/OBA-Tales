/**
 * KAHRAMAN ADIMLARI — yürüyüş ve koşu kliplerinin yerde aldığı yol, hızdan klip seçimi.
 *
 *   · WALK_CLIP_SPEED / RUN_CLIP_SPEED: gün düzeni (daySchedule.ts) yürüyüş hızını ve klip zamanını bunlardan
 *     hesaplar ki ayaklar yerde kaymasın.
 *   · locomotion / wanderPose: hızdan klip seçimi ve evin çevresinde gezinme (gün düzeni olmayan bir kahraman için
 *     yedek; yer ve yön kalabalıkla aynı formülden, living/motion.ts → motionAt).
 *
 * Saf fonksiyonlardır, testleri heroMotion.test.ts içinde.
 */
import { motionAt, type MotionState } from "../living/motion";
import type { CharacterPlacement } from "../living/placement";
import type { HeroClip } from "./heroModel";

/**
 * Yürüyüş klibinin yerdeki hızı, model biriminde (ölçek 1). Bacak boyu ≈ 1,75; uyluk ±24° sallanır, bir adım
 * yarım saniye: 2 × 1,75 × sin 24° ≈ 1,42 birim / 0,5 sn.
 */
export const WALK_CLIP_SPEED = 2.85;
/** Koşu klibi: uyluk −25°…+55°, bir adım 0,31 sn: 1,75 × (sin 55° + sin 25°) ≈ 2,18 birim / 0,31 sn. */
export const RUN_CLIP_SPEED = 7.0;
/** Bu hızın altında (model birimi/sn) kahraman duruyor sayılır. */
const IDLE_BELOW = 0.12;
/** Bu hızın üstünde koşar. */
const RUN_ABOVE = WALK_CLIP_SPEED * 1.6;
/** Klip hızı bu aralıkta kalır: çok yavaş yürüyüş ağır çekim gibi, çok hızlısı telaşlı görünür. */
const MIN_RATE = 0.55;
const MAX_RATE = 1.5;
/** Hızı ölçmek için ileriye bakılan süre (saniye). */
const LOOK_AHEAD = 0.05;

export interface Locomotion {
  clip: HeroClip;
  /** Klibin oynama hızı (1 = Blender'daki hız). */
  timeScale: number;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Yerdeki hızdan (dünya birimi/sn) ve karakter ölçeğinden klip ve oynama hızı. */
export function locomotion(speed: number, scale: number): Locomotion {
  const modelSpeed = speed / Math.max(scale, 1e-6);
  if (modelSpeed < IDLE_BELOW) return { clip: "bosta", timeScale: 1 };
  if (modelSpeed > RUN_ABOVE) return { clip: "kos", timeScale: clamp(modelSpeed / RUN_CLIP_SPEED, MIN_RATE, MAX_RATE) };
  return { clip: "yuru", timeScale: clamp(modelSpeed / WALK_CLIP_SPEED, MIN_RATE, MAX_RATE) };
}

export interface HeroPose extends Locomotion {
  /** Ayak konumu (Three.js x ve z; y zeminden okunur). */
  x: number;
  z: number;
  /** Baktığı yön (radyan; 0 = güneye, kameraya). */
  yaw: number;
}

const now: MotionState = { dx: 0, dz: 0, yaw: 0, walk: 0, hop: 0 };
const ahead: MotionState = { dx: 0, dz: 0, yaw: 0, walk: 0, hop: 0 };

/** Evin çevresinde gezinen kahramanın t anındaki duruşu. */
export function wanderPose(placement: CharacterPlacement, t: number, out: HeroPose = { x: 0, z: 0, yaw: 0, clip: "bosta", timeScale: 1 }): HeroPose {
  motionAt(placement.motion, t, now);
  motionAt(placement.motion, t + LOOK_AHEAD, ahead);
  const speed = Math.hypot(ahead.dx - now.dx, ahead.dz - now.dz) / LOOK_AHEAD;
  const { clip, timeScale } = locomotion(speed, placement.scale);
  out.x = placement.home.x + now.dx;
  out.z = placement.home.y + now.dz;
  out.yaw = now.yaw;
  out.clip = clip;
  out.timeScale = timeScale;
  return out;
}

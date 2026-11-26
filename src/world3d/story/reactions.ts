/**
 * SESLENİNCE EL SALLAMA — aranan ya da tıklanan kahraman seni fark eder.
 *
 *   Uyanıkken: işini bırakır, kameraya döner, el sallar, bir söz söyler; sonra kaldığı yerden devam eder.
 *              (Ateş başında oturuyorsa kalkmaz: oturduğu yerden döner, el kol sallar.)
 *   Uyurken:   çadırından eğilerek çıkar, esner, kameraya döner ve el sallar ("Uyuyordum… Hoş geldin!"),
 *              sonra yine eğilerek çadırına girer.
 *
 * Tepki gün düzeninin üstüne geçici bir katmandır ve yalnızca arayanın ekranında oynar. Saf fonksiyonlardır;
 * testleri reactions.test.ts içinde.
 */
import type { Coordinates } from "../../types";
import type { HeroClip } from "./heroModel";

export interface Reaction {
  /** Başladığı an (dünya saati, saniye). */
  start: number;
  /** Uyurken mi seslenildi? */
  asleep: boolean;
  /** Oturuyorsa kalkmadan döner. */
  sitting: boolean;
  /** Tepki başladığında durduğu yer ve yön. */
  anchor: { x: number; z: number; yaw: number };
  /** Uyurken: çadırın eşiği ve kapı önü, çadıra girerken baktığı yön. */
  door?: Coordinates;
  front?: Coordinates;
  inYaw?: number;
  /** Balondaki söz. */
  line: string;
}

export interface ReactionFrame {
  x: number;
  z: number;
  /** Bakış yönü; null ise kameraya döner. */
  yaw: number | null;
  clip: HeroClip;
  clipTime: number;
  hidden: boolean;
  speech: string | null;
  /**
   * 0: tamamen tepki. 0–1: tepki bitti, kahraman gün düzenindeki yerine yetişiyor (konum bu oranda ona kayar).
   */
  catchUp: number;
}

// Uyanıkken (saniye)
export const AWAKE = { turn: 0.35, wave: 3.0, hold: 0.55, catchUp: 1.1 } as const;
// Uyurken (saniye)
export const ASLEEP = { exit: 2.8, yawn: 3.0, turn: 0.4, wave: 2.8, back: 0.4, enter: 2.8 } as const;

export const awakeLength = () => AWAKE.turn + AWAKE.wave + AWAKE.hold + AWAKE.catchUp;
export const asleepLength = () => ASLEEP.exit + ASLEEP.yawn + ASLEEP.turn + ASLEEP.wave + ASLEEP.back + ASLEEP.enter;

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** Eğilerek yürürken klibin zamanı: yol / adım (cadir klibi ≈ 1,06 birim/sn). */
const CROUCH_STRIDE = 0.62 * 1.8;

function frame(out: ReactionFrame | undefined): ReactionFrame {
  return out ?? { x: 0, z: 0, yaw: null, clip: "bosta", clipTime: 0, hidden: false, speech: null, catchUp: 0 };
}

/** Tepkinin t anındaki karesi; tepki bittiyse null. */
export function reactionFrame(r: Reaction, t: number, out?: ReactionFrame): ReactionFrame | null {
  const u = t - r.start;
  if (u < 0) return null;
  const f = frame(out);
  f.catchUp = 0;
  f.hidden = false;
  f.speech = null;

  if (!r.asleep || !r.door || !r.front || r.inYaw === undefined) {
    const total = awakeLength();
    if (u >= total) return null;
    f.x = r.anchor.x;
    f.z = r.anchor.z;
    const talking = AWAKE.turn + AWAKE.wave + AWAKE.hold;
    f.speech = u >= 0.3 && u < talking ? r.line : null;
    if (r.sitting) {
      // Oturduğu yerden döner, el kol sallayarak konuşur.
      f.yaw = u < talking ? null : r.anchor.yaw;
      f.clip = "sohbet";
      f.clipTime = u;
      f.catchUp = u < talking ? 0 : smooth((u - talking) / AWAKE.catchUp) * 0.999 + 0.001;
      return f;
    }
    if (u < AWAKE.turn) {
      f.yaw = null;
      f.clip = "bosta";
      f.clipTime = u;
    } else if (u < AWAKE.turn + AWAKE.wave) {
      f.yaw = null;
      f.clip = "selam";
      f.clipTime = u - AWAKE.turn;
    } else if (u < talking) {
      f.yaw = null;
      f.clip = "bosta";
      f.clipTime = u;
    } else {
      f.yaw = null;
      f.clip = "bosta";
      f.clipTime = u;
      f.catchUp = smooth((u - talking) / AWAKE.catchUp) * 0.999 + 0.001;
    }
    return f;
  }

  // Uyurken: çık → esne → dön → el salla → dön → gir.
  const { door, front, inYaw } = r;
  const outYaw = inYaw + Math.PI;
  const span = Math.hypot(front.x - door.x, front.y - door.y);
  const marks = [ASLEEP.exit, ASLEEP.yawn, ASLEEP.turn, ASLEEP.wave, ASLEEP.back, ASLEEP.enter];
  let k = 0;
  let local = u;
  while (k < marks.length && local >= marks[k]) {
    local -= marks[k];
    k++;
  }
  if (k >= marks.length) return null;
  const talkFrom = ASLEEP.exit + ASLEEP.yawn;
  const talkTo = talkFrom + ASLEEP.turn + ASLEEP.wave + 0.3;
  f.speech = u >= talkFrom && u < talkTo ? r.line : null;
  switch (k) {
    case 0: {
      const s = smooth(local / ASLEEP.exit);
      f.x = door.x + (front.x - door.x) * s;
      f.z = door.y + (front.y - door.y) * s;
      f.yaw = outYaw;
      f.clip = "cadir";
      f.clipTime = (s * span) / CROUCH_STRIDE;
      break;
    }
    case 1:
      f.x = front.x;
      f.z = front.y;
      f.yaw = outYaw;
      f.clip = "esne";
      f.clipTime = local;
      break;
    case 2:
    case 3:
      f.x = front.x;
      f.z = front.y;
      f.yaw = null;
      f.clip = k === 2 ? "bosta" : "selam";
      f.clipTime = local;
      break;
    case 4:
      f.x = front.x;
      f.z = front.y;
      f.yaw = inYaw;
      f.clip = "bosta";
      f.clipTime = local;
      break;
    default: {
      const s = smooth(local / ASLEEP.enter);
      f.x = front.x + (door.x - front.x) * s;
      f.z = front.y + (door.y - front.y) * s;
      f.yaw = inYaw;
      f.clip = "cadir";
      f.clipTime = (s * span) / CROUCH_STRIDE;
      f.hidden = s > 0.97;
    }
  }
  return f;
}

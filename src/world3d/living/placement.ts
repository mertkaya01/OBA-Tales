/**
 * YERLEŞİM — her karakter dünyada nerede durur, ne kadar gezinir?
 *
 *   · Akındakiler meydandaki saf yerlerinde durur ve boss'a bakar.
 *   · Diğerleri evlerinin (roster koordinatı) çevresinde gezinir. Tur genişliği, denize, dik yamaca,
 *     çadırlara ve yapılara çarpmayacak kadar küçültülür.
 *   · Evi akın meydanının içinde kalan gezginler meydanın kenarına çekilir; saflar arasında dolaşmazlar.
 *
 * Saf fonksiyonlardır; sonuç bir kez hesaplanır, hareket ekran kartında sürer (motion.ts).
 */
import { isWet, sampleHeightBilinear, type Terrain } from "../../game/terrain";
import { hashString } from "../../lib/random";
import type { Character, Coordinates } from "../../types";
import { characterFacing, characterScale } from "../characters/instanceData";
import { groundY, heightToY } from "../worldScale";
import { motionAt, type MotionParams, type MotionState } from "./motion";
import { cheerDelay, type RaidFormation } from "./raid";

/** Gezginlerin çarpmaması gereken daire (çadır, fener, tapınak…). */
export interface Obstacle {
  x: number;
  y: number;
  r: number;
}

export interface CharacterPlacement {
  /** Durduğu ya da etrafında gezindiği nokta (dünya birimi). */
  home: Coordinates;
  /** O noktadaki zemin yüksekliği (Three.js y). */
  groundY: number;
  scale: number;
  motion: MotionParams;
  /** Akın meydanında, sırasında duruyor. */
  inFormation: boolean;
}

export interface PlacementOptions {
  obstacles?: readonly Obstacle[];
  formation?: RaidFormation | null;
}

/** Hiç kımıldamayanların oranı. */
const STATIONARY_SHARE = 0.22;
const MIN_WANDER = 4;
const MAX_WANDER = 12;
const CAST_WANDER = 3;

const unit = (key: string) => (hashString(key) % 10007) / 10007;

/** Evin çevresinde, her yönde güvenle yürünebilen en büyük yarıçap (wanted'ı aşmaz). */
export function safeRadius(terrain: Terrain, home: Coordinates, wanted: number, obstacles: readonly Obstacle[]): number {
  if (wanted <= 0) return 0;
  const nearby = obstacles.filter((o) => Math.hypot(o.x - home.x, o.y - home.y) < o.r + wanted + 1);
  if (nearby.some((o) => Math.hypot(o.x - home.x, o.y - home.y) < o.r) || isWet(terrain, home)) return 0;
  const baseY = groundY(terrain, home);
  let safe = 0;
  for (let r = 2; r <= wanted + 1e-6; r += 2) {
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const p = { x: home.x + Math.cos(angle) * r, y: home.y + Math.sin(angle) * r };
      const h = sampleHeightBilinear(terrain, p);
      if (h < 0.05 || isWet(terrain, p) || Math.abs(heightToY(h) - baseY) > r * 1.2) return safe;
      if (nearby.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < o.r)) return safe;
    }
    safe = r;
  }
  return Math.min(safe, wanted);
}

function wantedRadius(c: Character): number {
  if (c.roleType !== "follower") return CAST_WANDER;
  const h = unit(`gez:${c.id}`);
  if (h < STATIONARY_SHARE) return 0;
  return MIN_WANDER + (MAX_WANDER - MIN_WANDER) * ((h - STATIONARY_SHARE) / (1 - STATIONARY_SHARE));
}

export function placeCharacters(
  characters: readonly Character[],
  terrain: Terrain,
  { obstacles = [], formation = null }: PlacementOptions = {},
): Map<string, CharacterPlacement> {
  const out = new Map<string, CharacterPlacement>();
  const square = formation?.ground.square;
  const blocked: Obstacle[] = square && formation ? [...obstacles, { x: square.x, y: square.y, r: formation.radius }] : [...obstacles];

  for (const c of characters) {
    const seed = unit(`ritim:${c.id}`);
    const slot = formation?.slots.get(c.id);
    if (slot && formation) {
      const home = { x: slot.x, y: slot.y };
      out.set(c.id, {
        home,
        groundY: groundY(terrain, home),
        scale: characterScale(c),
        motion: { radius: 0, seed, yaw: formation.facing, cheer: cheerDelay(slot.row) },
        inFormation: true,
      });
      continue;
    }

    let home: Coordinates = c.coordinates;
    // Evi bir yapının (çadır, ocak) içine düşen kişi yapının kenarına çıkar.
    for (const o of obstacles) {
      const dx = home.x - o.x;
      const dy = home.y - o.y;
      const d = Math.hypot(dx, dy);
      if (d >= o.r + 0.5) continue;
      const angle = d > 0.01 ? Math.atan2(dy, dx) : seed * Math.PI * 2;
      home = { x: o.x + Math.cos(angle) * (o.r + 1.2), y: o.y + Math.sin(angle) * (o.r + 1.2) };
    }
    if (square && formation) {
      const dx = home.x - square.x;
      const dy = home.y - square.y;
      const d = Math.hypot(dx, dy);
      if (d < formation.radius + 2) {
        // Meydanın kenarına, aynı yönde.
        const angle = d > 0.01 ? Math.atan2(dy, dx) : seed * Math.PI * 2;
        home = { x: square.x + Math.cos(angle) * (formation.radius + 3), y: square.y + Math.sin(angle) * (formation.radius + 3) };
      }
    }
    out.set(c.id, {
      home,
      groundY: groundY(terrain, home),
      scale: characterScale(c),
      motion: { radius: safeRadius(terrain, home, wantedRadius(c), blocked), seed, yaw: characterFacing(c), cheer: -1 },
      inFormation: false,
    });
  }
  return out;
}

export interface WorldPoint {
  x: number;
  y: number;
  z: number;
}

const scratch: MotionState = { dx: 0, dz: 0, yaw: 0, walk: 0, hop: 0 };

/** Karakterin t anındaki ayak konumu (Three.js x, y, z). */
export function currentPosition(placement: CharacterPlacement, terrain: Terrain, t: number, out: WorldPoint = { x: 0, y: 0, z: 0 }): WorldPoint {
  motionAt(placement.motion, t, scratch);
  out.x = placement.home.x + scratch.dx;
  out.z = placement.home.y + scratch.dz;
  out.y = groundY(terrain, { x: out.x, y: out.z }) + scratch.hop;
  return out;
}

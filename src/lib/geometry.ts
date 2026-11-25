/**
 * GEOMETRİ — dünya birimi üzerinde nokta, poligon ve sınır kutusu hesapları.
 * Bölge seçimi, pin yerleşimi ve kamera odağı bu fonksiyonları kullanır.
 */
import type { Bounds, Coordinates } from "../types";
import type { Rng } from "./random";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function distance(a: Coordinates, b: Coordinates): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Nokta poligonun içinde mi? (ışın atma yöntemi; kenarın tam üstü belirsizdir) */
export function pointInPolygon(point: Coordinates, polygon: readonly Coordinates[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = a.y > point.y !== b.y > point.y;
    if (crosses && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** Noktanın bir doğru parçasına en kısa uzaklığı. */
export function distanceToSegment(point: Coordinates, a: Coordinates, b: Coordinates): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return distance(point, a);
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq, 0, 1);
  return distance(point, { x: a.x + t * dx, y: a.y + t * dy });
}

/** Noktanın poligon kenarlarına en kısa uzaklığı. */
export function distanceToPolygonEdge(point: Coordinates, polygon: readonly Coordinates[]): number {
  let min = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    min = Math.min(min, distanceToSegment(point, polygon[j], polygon[i]));
  }
  return min;
}

export function polygonBounds(polygon: readonly Coordinates[]): Bounds {
  return boundsOf(polygon);
}

export function boundsOf(points: readonly Coordinates[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

export function mergeBounds(a: Bounds, b: Bounds): Bounds {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

export function padBounds(bounds: Bounds, padding: number): Bounds {
  return {
    minX: bounds.minX - padding,
    minY: bounds.minY - padding,
    maxX: bounds.maxX + padding,
    maxY: bounds.maxY + padding,
  };
}

export function boundsCenter(bounds: Bounds): Coordinates {
  return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
}

/** Poligon alanı (köşe sırası fark etmez). */
export function polygonArea(polygon: readonly Coordinates[]): number {
  let sum = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    sum += polygon[j].x * polygon[i].y - polygon[i].x * polygon[j].y;
  }
  return Math.abs(sum) / 2;
}

/** Poligonun ağırlık merkezi. */
export function polygonCentroid(polygon: readonly Coordinates[]): Coordinates {
  let cross = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const f = polygon[j].x * polygon[i].y - polygon[i].x * polygon[j].y;
    cross += f;
    cx += (polygon[j].x + polygon[i].x) * f;
    cy += (polygon[j].y + polygon[i].y) * f;
  }
  if (cross === 0) return boundsCenter(boundsOf(polygon));
  return { x: cx / (3 * cross), y: cy / (3 * cross) };
}

export interface RandomPointOptions {
  /** Kenarlara en az bu kadar uzak dur (dünya birimi). */
  margin?: number;
  maxTries?: number;
}

/**
 * Poligonun içinde tohumlu rastgele bir nokta seçer.
 * Uygun nokta bulunamazsa ağırlık merkezine döner.
 */
export function randomPointInPolygon(
  polygon: readonly Coordinates[],
  rng: Rng,
  { margin = 0, maxTries = 500 }: RandomPointOptions = {},
): Coordinates {
  const b = polygonBounds(polygon);
  for (let i = 0; i < maxTries; i++) {
    const p = { x: rng.float(b.minX, b.maxX), y: rng.float(b.minY, b.maxY) };
    if (pointInPolygon(p, polygon) && (margin <= 0 || distanceToPolygonEdge(p, polygon) >= margin)) {
      return p;
    }
  }
  return polygonCentroid(polygon);
}

/** Noktayı içeren ilk öğeyi bulur (ör. tıklanan yerdeki bölge). */
export function findContaining<T extends { polygon: readonly Coordinates[] }>(
  point: Coordinates,
  items: readonly T[],
): T | undefined {
  return items.find((item) => pointInPolygon(point, item.polygon));
}

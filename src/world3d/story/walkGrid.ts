/**
 * YÜRÜYÜŞ AĞI — kahramanlar Kutada'da bir yerden ötekine çadırlara, ocağa, ağaçlara çarpmadan nasıl gider?
 *
 *   · Konuk obasının çevresi 2 birimlik hücrelere bölünür. Su, deniz, Kutada dışı ve yapılar (pay bırakılarak)
 *     kapalıdır.
 *   · Yol A* ile bulunur, sonra ip çekme yöntemiyle düzleştirilir: görüş hattı açık olan en uzak noktaya düz gidilir.
 *   · Aynı iki nokta arasındaki yol bir kez hesaplanır (önbellek).
 *
 * Saf fonksiyonlardır; testleri kutadaSites.test.ts içinde.
 */
import { REGIONS } from "../../content/regions";
import { isWet, sampleTerrain, type Terrain } from "../../game/terrain";
import { pointInPolygon } from "../../lib/geometry";
import type { Coordinates } from "../../types";
import type { Obstacle } from "../living/placement";

export interface WalkGrid {
  x0: number;
  y0: number;
  cell: number;
  cols: number;
  rows: number;
  /** 1 = yürünemez. */
  blocked: Uint8Array;
  cache: Map<string, Coordinates[]>;
  // A* için yeniden kullanılan tamponlar.
  g: Float32Array;
  came: Int32Array;
  stamp: Uint32Array;
  closed: Uint32Array;
  generation: number;
}

/** Hücre boyu (dünya birimi). */
const CELL = 2;
/** Yapıların çevresinde bırakılan pay: kahraman omzuyla sürtünmesin. */
const MARGIN = 1.4;

export function buildWalkGrid(terrain: Terrain, center: Coordinates, reach: number, obstacles: readonly Obstacle[]): WalkGrid {
  const cols = Math.ceil((reach * 2) / CELL);
  const rows = cols;
  const x0 = center.x - reach;
  const y0 = center.y - reach;
  const blocked = new Uint8Array(cols * rows);
  const polygon = REGIONS.kutada.polygon;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = { x: x0 + (c + 0.5) * CELL, y: y0 + (r + 0.5) * CELL };
      if (sampleTerrain(terrain, p).height < 0.03 || isWet(terrain, p) || !pointInPolygon(p, polygon)) blocked[r * cols + c] = 1;
    }
  }
  for (const o of obstacles) {
    const radius = o.r + MARGIN;
    const c0 = Math.max(0, Math.floor((o.x - radius - x0) / CELL));
    const c1 = Math.min(cols - 1, Math.floor((o.x + radius - x0) / CELL));
    const r0 = Math.max(0, Math.floor((o.y - radius - y0) / CELL));
    const r1 = Math.min(rows - 1, Math.floor((o.y + radius - y0) / CELL));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const dx = x0 + (c + 0.5) * CELL - o.x;
        const dy = y0 + (r + 0.5) * CELL - o.y;
        if (dx * dx + dy * dy < radius * radius) blocked[r * cols + c] = 1;
      }
    }
  }
  const n = cols * rows;
  return {
    x0,
    y0,
    cell: CELL,
    cols,
    rows,
    blocked,
    cache: new Map(),
    g: new Float32Array(n),
    came: new Int32Array(n),
    stamp: new Uint32Array(n),
    closed: new Uint32Array(n),
    generation: 0,
  };
}

const cellOf = (grid: WalkGrid, p: Coordinates) => {
  const c = Math.min(grid.cols - 1, Math.max(0, Math.floor((p.x - grid.x0) / grid.cell)));
  const r = Math.min(grid.rows - 1, Math.max(0, Math.floor((p.y - grid.y0) / grid.cell)));
  return r * grid.cols + c;
};
const centerOf = (grid: WalkGrid, i: number): Coordinates => ({
  x: grid.x0 + ((i % grid.cols) + 0.5) * grid.cell,
  y: grid.y0 + (Math.floor(i / grid.cols) + 0.5) * grid.cell,
});

/** Nokta yürünebilir bir hücrede mi? */
export function isWalkable(grid: WalkGrid, p: Coordinates): boolean {
  if (p.x < grid.x0 || p.y < grid.y0 || p.x >= grid.x0 + grid.cols * grid.cell || p.y >= grid.y0 + grid.rows * grid.cell) return false;
  return grid.blocked[cellOf(grid, p)] === 0;
}

/** Kapalı bir hücrede başlayan/biten yol için en yakın açık hücre. */
function nearestOpen(grid: WalkGrid, i: number): number {
  if (!grid.blocked[i]) return i;
  const c0 = i % grid.cols;
  const r0 = Math.floor(i / grid.cols);
  for (let d = 1; d < 8; d++) {
    for (let dr = -d; dr <= d; dr++) {
      for (let dc = -d; dc <= d; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== d) continue;
        const c = c0 + dc;
        const r = r0 + dr;
        if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) continue;
        const j = r * grid.cols + c;
        if (!grid.blocked[j]) return j;
      }
    }
  }
  return i;
}

/** İkili yığın (f değerine göre en küçük önde). */
class Heap {
  private items: number[] = [];
  private keys: number[] = [];
  get size() {
    return this.items.length;
  }
  push(item: number, key: number) {
    const items = this.items;
    const keys = this.keys;
    let i = items.length;
    items.push(item);
    keys.push(key);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (keys[parent] <= key) break;
      items[i] = items[parent];
      keys[i] = keys[parent];
      i = parent;
    }
    items[i] = item;
    keys[i] = key;
  }
  pop(): number {
    const items = this.items;
    const keys = this.keys;
    const top = items[0];
    const lastItem = items.pop()!;
    const lastKey = keys.pop()!;
    if (items.length > 0) {
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        let mKey = lastKey;
        if (l < items.length && keys[l] < mKey) {
          m = l;
          mKey = keys[l];
        }
        if (r < items.length && keys[r] < mKey) {
          m = r;
          mKey = keys[r];
        }
        if (m === i) break;
        items[i] = items[m];
        keys[i] = keys[m];
        i = m;
      }
      items[i] = lastItem;
      keys[i] = lastKey;
    }
    return top;
  }
}

const SQRT2 = Math.SQRT2;

function astar(grid: WalkGrid, start: number, goal: number): number[] | null {
  const { cols, rows, blocked, g, came, stamp, closed } = grid;
  const gen = ++grid.generation;
  const gc = goal % cols;
  const gr = Math.floor(goal / cols);
  const h = (i: number) => {
    const dx = Math.abs((i % cols) - gc);
    const dy = Math.abs(Math.floor(i / cols) - gr);
    return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
  };
  const heap = new Heap();
  stamp[start] = gen;
  g[start] = 0;
  came[start] = -1;
  heap.push(start, h(start));
  while (heap.size > 0) {
    const i = heap.pop();
    if (closed[i] === gen) continue;
    closed[i] = gen;
    if (i === goal) {
      const path: number[] = [];
      for (let k = i; k >= 0; k = came[k]) path.push(k);
      return path.reverse();
    }
    const c = i % cols;
    const r = Math.floor(i / cols);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const j = nr * cols + nc;
        if (blocked[j] || closed[j] === gen) continue;
        // Köşe kesme yok: çapraz adımda iki yanı da açık olmalı.
        if (dr && dc && (blocked[r * cols + nc] || blocked[nr * cols + c])) continue;
        const cost = g[i] + (dr && dc ? SQRT2 : 1);
        if (stamp[j] === gen && cost >= g[j]) continue;
        stamp[j] = gen;
        g[j] = cost;
        came[j] = i;
        heap.push(j, cost + h(j));
      }
    }
  }
  return null;
}

/** a ile b arasındaki düz çizgi kapalı hücreye değmiyor mu? (Uçlardaki hücreler sayılmaz.) */
function lineOpen(grid: WalkGrid, a: Coordinates, b: Coordinates, skipA: number, skipB: number): boolean {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(length / (grid.cell * 0.25)));
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const i = cellOf(grid, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    if (i === skipA || i === skipB) continue;
    if (grid.blocked[i]) return false;
  }
  return true;
}

const keyOf = (p: Coordinates) => `${Math.round(p.x * 4)},${Math.round(p.y * 4)}`;

/**
 * from'dan to'ya yürüyüş yolu (köşe noktaları; ilk nokta from, son nokta to). Yol bulunamazsa düz çizgi.
 * Uçlar kapalı hücredeyse (oturak, ağaç dibi) en yakın açık hücreden çıkılır.
 */
export function findWalk(grid: WalkGrid, from: Coordinates, to: Coordinates): Coordinates[] {
  const key = `${keyOf(from)}>${keyOf(to)}`;
  const cached = grid.cache.get(key);
  if (cached) return cached;
  const startCell = cellOf(grid, from);
  const goalCell = cellOf(grid, to);
  const start = nearestOpen(grid, startCell);
  const goal = nearestOpen(grid, goalCell);
  let result: Coordinates[];
  if (lineOpen(grid, from, to, startCell, goalCell)) {
    result = [from, to];
  } else {
    const cells = astar(grid, start, goal);
    if (!cells) {
      result = [from, to];
    } else {
      const points = [from, ...cells.slice(1, -1).map((i) => centerOf(grid, i)), to];
      result = [from];
      let i = 0;
      while (i < points.length - 1) {
        let j = points.length - 1;
        while (j > i + 1 && !lineOpen(grid, points[i], points[j], startCell, goalCell)) j--;
        result.push(points[j]);
        i = j;
      }
    }
  }
  grid.cache.set(key, result);
  return result;
}

/** Yolun toplam uzunluğu. */
export function walkLength(path: readonly Coordinates[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  return total;
}

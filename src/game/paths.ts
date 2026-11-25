/**
 * PATİKALAR — obaları, akın meydanlarını ve yapıları birbirine bağlayan toprak yollar.
 *
 *   · Aynı karada duran duraklar en kısa ağaçla (Prim) bağlanır; ayrı adalar ayrı ağlar kurar.
 *     Ağlar köprü ayaklarında birleşir: ana ada ↔ Batı Kemeri ↔ Kutada (Kut Kapısı) ↔ Kadim Kemer ↔ Pusluada.
 *   · Her bağlantı arazide A* ile çizilir: dik yokuş pahalı, deniz ve göl geçilmez, nehir geçişi
 *     köprü kurulacağı için biraz pahalı. Böylece yollar vadileri izler, nehri tek yerden geçer.
 *   · Nehri kestikleri yerde ahşap köprü durur (bridges).
 *
 * Saf fonksiyonlardır: boyacı (haritaya çizer), 3D (köprüler) ve ağaç serpme (yolu boş bırakır) kullanır.
 */
import { MONUMENTS, LANDMARKS, RAID_GROUNDS, VILLAGES } from "../content/sites";
import { clamp, distance } from "../lib/geometry";
import type { Coordinates } from "../types";
import type { Terrain } from "./terrain";

export interface TrailBridge {
  center: Coordinates;
  /** Köprünün uzandığı yön (radyan, dünya düzleminde x'ten y'ye). */
  angle: number;
  /** Köprü boyu (dünya birimi). */
  length: number;
}

export interface Trails {
  /** Yumuşatılmış yol çizgileri (obaların içine girmeden biter). */
  paths: Coordinates[][];
  bridges: TrailBridge[];
  /** Yolun geçtiği hücreler (ağaç ve kaya basmasın diye). */
  mask: Uint8Array;
}

/** Yolun genişliği (dünya birimi). */
export const TRAIL_WIDTH = 3.4;

interface Stop {
  point: Coordinates;
  /** Yol bu yarıçapın içinde çizilmez (oba çadırları, tapınak platformu). */
  clear: number;
}

function stops(): Stop[] {
  return [
    ...VILLAGES.map((v) => ({ point: v.center, clear: v.radius * 0.55 })),
    ...Object.values(RAID_GROUNDS).map((g) => ({ point: g.square, clear: 0 })),
    { point: LANDMARKS.tapinak, clear: 16 },
    { point: LANDMARKS.fener, clear: 5 },
    { point: LANDMARKS.kadimKemer.from, clear: 0 },
    { point: LANDMARKS.kadimKemer.to, clear: 0 },
    { point: LANDMARKS.batiKemer.from, clear: 0 },
    { point: LANDMARKS.batiKemer.to, clear: 0 },
    { point: LANDMARKS.kutKapisi, clear: 32 },
    { point: MONUMENTS.ataHeykeli, clear: 8 },
    { point: MONUMENTS.dilekAgaci, clear: 6 },
    ...MONUMENTS.gozcuKuleleri.map((p) => ({ point: p, clear: 4 })),
  ];
}

/** Kara hücrelerini bağlı parçalara ayırır (4 komşuluk): her ada bir numara. */
function landComponents(terrain: Terrain): Int32Array {
  const { cols, rows, heights } = terrain;
  const comp = new Int32Array(cols * rows).fill(-1);
  let next = 0;
  const stack: number[] = [];
  for (let i = 0; i < comp.length; i++) {
    if (heights[i] < 0 || comp[i] >= 0) continue;
    comp[i] = next;
    stack.push(i);
    while (stack.length > 0) {
      const c = stack.pop()!;
      const col = c % cols;
      const row = (c / cols) | 0;
      const visit = (j: number) => {
        if (heights[j] >= 0 && comp[j] < 0) {
          comp[j] = next;
          stack.push(j);
        }
      };
      if (col > 0) visit(c - 1);
      if (col < cols - 1) visit(c + 1);
      if (row > 0) visit(c - cols);
      if (row < rows - 1) visit(c + cols);
    }
    next++;
  }
  return comp;
}

const cellOf = (terrain: Terrain, p: Coordinates) =>
  clamp(Math.floor(p.y / terrain.cellSize), 0, terrain.rows - 1) * terrain.cols + clamp(Math.floor(p.x / terrain.cellSize), 0, terrain.cols - 1);

/** Arazide A*: hücre dizisi (başlangıçtan bitişe), yol yoksa null. */
function findPath(terrain: Terrain, from: number, to: number): number[] | null {
  const { cols, rows, heights, river, lakeIds, cellSize } = terrain;
  const n = cols * rows;
  const cost = new Float32Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const keys: number[] = [];
  const values: number[] = [];
  const push = (key: number, value: number) => {
    let i = keys.length;
    keys.push(key);
    values.push(value);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= key) break;
      keys[i] = keys[p];
      values[i] = values[p];
      i = p;
    }
    keys[i] = key;
    values[i] = value;
  };
  const pop = () => {
    const top = values[0];
    const key = keys.pop()!;
    const value = values.pop()!;
    if (keys.length > 0) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= keys.length) break;
        if (c + 1 < keys.length && keys[c + 1] < keys[c]) c++;
        if (keys[c] >= key) break;
        keys[i] = keys[c];
        values[i] = values[c];
        i = c;
      }
      keys[i] = key;
      values[i] = value;
    }
    return top;
  };
  const tx = to % cols;
  const ty = (to / cols) | 0;
  const heuristic = (i: number) => Math.hypot((i % cols) - tx, ((i / cols) | 0) - ty) * cellSize;
  cost[from] = 0;
  push(heuristic(from), from);
  while (keys.length > 0) {
    const c = pop();
    if (c === to) break;
    if (closed[c]) continue;
    closed[c] = 1;
    const col = c % cols;
    const row = (c / cols) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nc = col + dx;
        const nr = row + dy;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const j = nr * cols + nc;
        if (closed[j] || heights[j] < 0 || lakeIds[j] >= 0) continue;
        const step = (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1) * cellSize;
        const slope = (Math.abs(heights[j] - heights[c]) * 42) / step;
        let g = cost[c] + step * (1 + 10 * slope * slope);
        // Nehre giriş ya da çapraz adımla iki nehir hücresinin arasından geçiş: köprü gerekir.
        const slip = dx !== 0 && dy !== 0 && river[c + dx] > 0 && river[c + dy * cols] > 0;
        if ((river[j] > 0 && river[c] <= 0) || slip) g += 8;
        if (g < cost[j]) {
          cost[j] = g;
          came[j] = c;
          push(g + heuristic(j), j);
        }
      }
    }
  }
  if (came[to] < 0 && from !== to) return null;
  const out: number[] = [];
  for (let c = to; c >= 0; c = came[c]) {
    out.push(c);
    if (c === from) break;
  }
  return out.reverse();
}

function chaikin(points: Coordinates[], iterations: number): Coordinates[] {
  let out = points;
  for (let k = 0; k < iterations && out.length > 2; k++) {
    const next: Coordinates[] = [out[0]];
    for (let i = 0; i < out.length - 1; i++) {
      const a = out[i];
      const b = out[i + 1];
      next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
}

export function planTrails(terrain: Terrain): Trails {
  const { cols, cellSize, river } = terrain;
  const comp = landComponents(terrain);
  const all = stops();
  const center = (i: number): Coordinates => ({ x: ((i % cols) + 0.5) * cellSize, y: (((i / cols) | 0) + 0.5) * cellSize });

  // Durakları adalara göre grupla, her grupta en kısa ağacı kur (Prim).
  const groups = new Map<number, Stop[]>();
  for (const stop of all) {
    const c = comp[cellOf(terrain, stop.point)];
    if (c < 0) continue;
    if (!groups.has(c)) groups.set(c, []);
    groups.get(c)!.push(stop);
  }
  const edges: [Stop, Stop][] = [];
  for (const group of groups.values()) {
    const inTree = [group[0]];
    const rest = group.slice(1);
    while (rest.length > 0) {
      let best = 0;
      let bestFrom = inTree[0];
      let bestDistance = Infinity;
      rest.forEach((candidate, k) => {
        for (const member of inTree) {
          const d = distance(candidate.point, member.point);
          if (d < bestDistance) {
            bestDistance = d;
            best = k;
            bestFrom = member;
          }
        }
      });
      const [next] = rest.splice(best, 1);
      edges.push([bestFrom, next]);
      inTree.push(next);
    }
  }

  const mask = new Uint8Array(terrain.heights.length);
  const paths: Coordinates[][] = [];
  const bridges: TrailBridge[] = [];
  const clears = all.filter((s) => s.clear > 0);
  for (const [a, b] of edges) {
    const cells = findPath(terrain, cellOf(terrain, a.point), cellOf(terrain, b.point));
    if (!cells) continue;
    // Köprüler: nehir hücrelerinin kesintisiz dizisi ya da iki nehir hücresinin arasından çapraz geçiş.
    for (let k = 0; k < cells.length; k++) {
      if (river[cells[k]] <= 0) {
        const nextCell = cells[k + 1];
        if (nextCell === undefined || river[nextCell] > 0) continue;
        const dx = (nextCell % cols) - (cells[k] % cols);
        const dy = ((nextCell / cols) | 0) - ((cells[k] / cols) | 0);
        if (dx !== 0 && dy !== 0 && river[cells[k] + dx] > 0 && river[cells[k] + dy * cols] > 0) {
          const a = center(cells[k]);
          const c2 = center(nextCell);
          bridges.push({ center: { x: (a.x + c2.x) / 2, y: (a.y + c2.y) / 2 }, angle: Math.atan2(c2.y - a.y, c2.x - a.x), length: distance(a, c2) + 7 });
        }
        continue;
      }
      let end = k;
      while (end + 1 < cells.length && river[cells[end + 1]] > 0) end++;
      const before = center(cells[Math.max(0, k - 1)]);
      const after = center(cells[Math.min(cells.length - 1, end + 1)]);
      bridges.push({
        center: { x: (before.x + after.x) / 2, y: (before.y + after.y) / 2 },
        angle: Math.atan2(after.y - before.y, after.x - before.x),
        length: distance(before, after) + 3,
      });
      k = end;
    }
    const smooth = chaikin(cells.map(center), 2);
    // Obaların ve tapınağın içine girmeden kes: kalan parçalar ayrı çizgiler olur.
    let piece: Coordinates[] = [];
    for (const p of smooth) {
      const blocked = clears.some((s) => distance(p, s.point) < s.clear);
      if (blocked) {
        if (piece.length > 1) paths.push(piece);
        piece = [];
      } else {
        piece.push(p);
      }
    }
    if (piece.length > 1) paths.push(piece);
    for (const c of cells) mask[c] = 1;
  }
  return { paths, bridges, mask };
}

const cache = new WeakMap<Terrain, Trails>();

/** Arazinin patikaları (arazi başına bir kez hesaplanır). */
export function getTrails(terrain: Terrain): Trails {
  let trails = cache.get(terrain);
  if (!trails) {
    trails = planTrails(terrain);
    cache.set(terrain, trails);
  }
  return trails;
}

/** Arka planda hesaplanmış patikaları önbelleğe koyar (terrainCache.primeTerrain). */
export function primeTrails(terrain: Terrain, trails: Trails): void {
  cache.set(terrain, trails);
}

/** Nokta bir patikanın üstünde ya da hemen yanında mı? */
export function onTrail(terrain: Terrain, point: Coordinates): boolean {
  const { mask, cols, rows } = { mask: getTrails(terrain).mask, cols: terrain.cols, rows: terrain.rows };
  const col = Math.floor(point.x / terrain.cellSize);
  const row = Math.floor(point.y / terrain.cellSize);
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const c = col + dc;
      const r = row + dr;
      if (c >= 0 && r >= 0 && c < cols && r < rows && mask[r * cols + c]) return true;
    }
  }
  return false;
}

/**
 * GÖRÜNÜRLÜK — hangi kara görünür, hangisi karartılı?
 *
 * Hikâyede yalnızca açılmış bölgeler (world.json → revealedRegions) ve yabani adalar (revealedIslands) görünür.
 * Kalan bütün kara karartılır: arazi koyu bir silüete döner, üstündeki ağaç, oba, köprü ve etiketler çizilmez,
 * ortasında "?" durur. Arazinin her kara hücresi bir bölgeye ya da yabani adaya aittir (terrain.regions / islands).
 * Saf fonksiyonlardır; 3D dünya, 2D harita ve testler aynısını kullanır.
 */
import { ISLAND_IDS, ISLANDS, type IslandId } from "../content/islands";
import { REGIONS } from "../content/regions";
import { REGION_IDS, WORLD_SIZE } from "../types";
import type { Bounds, Coordinates, RegionId } from "../types";
import type { Terrain } from "./terrain";

export interface LandVisibility {
  regions: ReadonlySet<string>;
  islands: ReadonlySet<string>;
}

export type LandOwner = { kind: "bolge"; id: RegionId } | { kind: "ada"; id: IslandId };

export function createVisibility(regions: Iterable<string>, islands: Iterable<string>): LandVisibility {
  return { regions: new Set(regions), islands: new Set(islands) };
}

/** Dünya noktasının hücre sırası (dünya dışında -1). */
export function cellIndexAt(terrain: Terrain, point: Coordinates): number {
  if (point.x < 0 || point.y < 0 || point.x >= WORLD_SIZE.width || point.y >= WORLD_SIZE.height) return -1;
  const col = Math.min(terrain.cols - 1, Math.floor(point.x / terrain.cellSize));
  const row = Math.min(terrain.rows - 1, Math.floor(point.y / terrain.cellSize));
  return row * terrain.cols + col;
}

/** Hücrenin sahibi: bölge, yabani ada ya da (suysa) null. */
export function ownerAtIndex(terrain: Terrain, index: number): LandOwner | null {
  if (index < 0) return null;
  const region = terrain.regions[index];
  if (region >= 0) return { kind: "bolge", id: REGION_IDS[region] };
  const island = terrain.islands[index];
  if (island >= 0) return { kind: "ada", id: ISLAND_IDS[island] };
  return null;
}

export function ownerAt(terrain: Terrain, point: Coordinates): LandOwner | null {
  return ownerAtIndex(terrain, cellIndexAt(terrain, point));
}

/** Sahibi görünür mü? */
export function isOwnerVisible(owner: LandOwner, visibility: LandVisibility): boolean {
  return owner.kind === "bolge" ? visibility.regions.has(owner.id) : visibility.islands.has(owner.id);
}

/** Karartılı kara mı? (Su hiçbir zaman karartılmaz.) */
export function isHiddenIndex(terrain: Terrain, visibility: LandVisibility, index: number): boolean {
  const owner = ownerAtIndex(terrain, index);
  return owner !== null && !isOwnerVisible(owner, visibility);
}

/**
 * Nokta karartılı karada mı? Kıyıdaki yapılar için `reach` kadar çevresine de bakar: yarısı suya taşan bir iskele ya da
 * kıyıdaki bir sürü de karartılı adaya aitse gizlenir.
 */
export function isHiddenAt(terrain: Terrain, visibility: LandVisibility, point: Coordinates, reach = 0): boolean {
  if (isHiddenIndex(terrain, visibility, cellIndexAt(terrain, point))) return true;
  if (reach <= 0) return false;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const p = { x: point.x + Math.cos(a) * reach, y: point.y + Math.sin(a) * reach };
    if (isHiddenIndex(terrain, visibility, cellIndexAt(terrain, p))) return true;
  }
  return false;
}

/** Karartılı kara hücreleri (1) — arazi boyası ve gölgelendirici için. */
export function hiddenMask(terrain: Terrain, visibility: LandVisibility): Uint8Array {
  const mask = new Uint8Array(terrain.cols * terrain.rows);
  for (let i = 0; i < mask.length; i++) mask[i] = isHiddenIndex(terrain, visibility, i) ? 1 : 0;
  return mask;
}

/** Karartılı bölge ve adalar ("?" etiketleri için). */
export function hiddenLands(visibility: LandVisibility): LandOwner[] {
  return [
    ...REGION_IDS.filter((id) => !visibility.regions.has(id)).map((id): LandOwner => ({ kind: "bolge", id })),
    ...ISLAND_IDS.filter((id) => !visibility.islands.has(id)).map((id): LandOwner => ({ kind: "ada", id })),
  ];
}

/**
 * Karartılı kara parçaları: birbirine bitişik karartılı hücrelerden oluşan her ada (ya da adanın karartılı kısmı) için
 * bir nokta. Nokta parçanın kıyıdan en uzak yeridir, yani "?" işareti hep adanın göbeğinde durur. Ana ada beş bölgeden
 * oluşsa da tek işaret alır; bölgeleri birer birer açıldıkça kalan kısmın işareti kendiliğinden yer değiştirir.
 * Birkaç parçadan oluşan yabani ada (Üçkardeş, Martı Adacıkları) yalnızca en büyük parçasında işaret alır.
 * `minCells` altındaki kayalıklar ve adacıklar sayılmaz.
 */
export function hiddenLandmasses(terrain: Terrain, visibility: LandVisibility, minCells = 300): Coordinates[] {
  const { cols, rows, cellSize, shore } = terrain;
  const mask = hiddenMask(terrain, visibility);
  const seen = new Uint8Array(mask.length);
  const found: { point: Coordinates; count: number; island: string | null }[] = [];
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    seen[start] = 1;
    stack.push(start);
    let count = 0;
    let best = start;
    while (stack.length) {
      const i = stack.pop()!;
      count++;
      if (shore[i] > shore[best]) best = i;
      const col = i % cols;
      const row = (i / cols) | 0;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const c = col + dc;
        const r = row + dr;
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
        const j = r * cols + c;
        if (mask[j] && !seen[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    if (count < minCells) continue;
    const owner = ownerAtIndex(terrain, best);
    found.push({ point: { x: ((best % cols) + 0.5) * cellSize, y: (((best / cols) | 0) + 0.5) * cellSize }, count, island: owner?.kind === "ada" ? owner.id : null });
  }
  // Aynı yabani adanın parçalarından yalnızca en büyüğü.
  const biggest = new Map<string, number>();
  for (const f of found) if (f.island) biggest.set(f.island, Math.max(biggest.get(f.island) ?? 0, f.count));
  return found.filter((f) => !f.island || biggest.get(f.island) === f.count).map((f) => f.point);
}

/**
 * Ev görünümünün alanı: görünen bölge ve adaların sınırı, en uzun kenarın `pad` katı kadar genişletilmiş (çevredeki
 * "?" adaların kıyıları da kadraja girsin). Hiçbir yer açık değilse null.
 */
export function visibleBounds(visibility: LandVisibility, pad = 0.28): Bounds | null {
  const polygons = [
    ...REGION_IDS.filter((id) => visibility.regions.has(id)).map((id) => REGIONS[id].polygon),
    ...ISLAND_IDS.filter((id) => visibility.islands.has(id)).flatMap((id) => ISLANDS[id].polygons),
  ];
  if (polygons.length === 0) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const polygon of polygons)
    for (const p of polygon) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
  const margin = Math.max(maxX - minX, maxY - minY) * pad;
  return { minX: minX - margin, maxX: maxX + margin, minY: minY - margin, maxY: maxY + margin };
}

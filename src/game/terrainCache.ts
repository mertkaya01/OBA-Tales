/**
 * ARAZİ ÖNBELLEĞİ — aynı tohum için arazi, patikalar ve boyalı harita bir kez üretilir.
 * Leaflet haritası ve 3D dünya aynı araziyi paylaşır; görünümler arasında geçerken yeniden hesaplanmaz.
 * Boyalı harita üsluba göre ayrı saklanır: 3D dünya "dunya", Leaflet "harita" üslubunu ister.
 *
 * Normalde her şey açılışta arka planda hazırlanır (terrainWorker.ts → primeTerrain); hazır değilse
 * ilk istendiğinde burada üretilir.
 */
import { getTrails, primeTrails, type Trails } from "./paths";
import { generateTerrain, type Terrain } from "./terrain";
import { paintTerrain, type PaintStyle, type PaintedImage } from "./terrainPaint";

/** Haritada ve 3D dünyada kullanılan arazi çözünürlüğü (dünya birimi). */
export const TERRAIN_CELL_SIZE = 4;

const terrains = new Map<number, Terrain>();
const paintings = new Map<string, PaintedImage>();

export function hasTerrain(seed: number): boolean {
  return terrains.has(seed);
}

export function getTerrain(seed: number): Terrain {
  let terrain = terrains.get(seed);
  if (!terrain) {
    terrain = generateTerrain({ seed, cellSize: TERRAIN_CELL_SIZE });
    terrains.set(seed, terrain);
  }
  return terrain;
}

export function getPaintedTerrain(seed: number, style: PaintStyle): PaintedImage {
  const key = `${seed}:${style}`;
  let painting = paintings.get(key);
  if (!painting) {
    const terrain = getTerrain(seed);
    painting = paintTerrain(terrain, { style, trails: getTrails(terrain).paths });
    paintings.set(key, painting);
  }
  return painting;
}

/** Arka planda üretilmiş sonucu önbelleğe yerleştirir. */
export function primeTerrain(seed: number, terrain: Terrain, trails: Trails, painted: readonly { style: PaintStyle; image: PaintedImage }[]): void {
  terrains.set(seed, terrain);
  primeTrails(terrain, trails);
  for (const { style, image } of painted) paintings.set(`${seed}:${style}`, image);
}

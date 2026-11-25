/**
 * Araziyi arka planda hazırlar (terrain.worker.ts) ve önbelleğe yerleştirir.
 * İşçi açılamazsa (eski tarayıcı, test ortamı) sessizce geçer: arazi ilk istendiğinde ana iş parçacığında üretilir.
 */
import type { Trails } from "./paths";
import type { Terrain } from "./terrain";
import { TERRAIN_CELL_SIZE, hasTerrain, primeTerrain } from "./terrainCache";
import type { PaintStyle, PaintedImage } from "./terrainPaint";
import type { TerrainJob } from "./terrain.worker";

interface TerrainResult {
  terrain: Terrain;
  trails: Trails;
  paintings: { style: PaintStyle; image: PaintedImage }[];
}

const pending = new Map<number, Promise<void>>();

export function prepareTerrain(seed: number): Promise<void> {
  if (hasTerrain(seed)) return Promise.resolve();
  const running = pending.get(seed);
  if (running) return running;
  const job = new Promise<void>((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./terrain.worker.ts", import.meta.url), { type: "module" });
    } catch {
      resolve();
      return;
    }
    worker.onmessage = (event: MessageEvent<TerrainResult>) => {
      const { terrain, trails, paintings } = event.data;
      primeTerrain(seed, terrain, trails, paintings);
      worker.terminate();
      resolve();
    };
    worker.onerror = () => {
      worker.terminate();
      resolve();
    };
    const message: TerrainJob = { seed, cellSize: TERRAIN_CELL_SIZE, styles: ["dunya", "harita"] };
    worker.postMessage(message);
  });
  pending.set(seed, job);
  return job;
}

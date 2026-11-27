/**
 * Araziyi arka planda hazırlar (terrain.worker.ts) ve önbelleğe yerleştirir.
 * İşçi açılamazsa (eski tarayıcı, test ortamı) sessizce geçer: arazi ilk istendiğinde ana iş parçacığında üretilir.
 *
 * Söz (promise), arazi ve 3D dünyanın boyası gelince çözülür: harita o an açılır. 2D haritanın boyası işçide
 * ardından üretilip önbelleğe eklenir (Harita görünümüne geçen ondan önce geçerse boya ana iş parçacığında yapılır).
 */
import { TERRAIN_CELL_SIZE, hasPainting, hasTerrain, primePainting, primeTerrain } from "./terrainCache";
import type { TerrainJob, TerrainMessage } from "./terrain.worker";
import type { PaintStyle } from "./terrainPaint";

const pending = new Map<number, Promise<void>>();

/** first: arazinin yanında hemen boyanacak üslup (açılan görünüm); öbürü ardından arka planda boyanır. */
export function prepareTerrain(seed: number, first: PaintStyle = "dunya"): Promise<void> {
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
    worker.onmessage = (event: MessageEvent<TerrainMessage>) => {
      const message = event.data;
      if (message.kind === "arazi") {
        primeTerrain(seed, message.terrain, message.trails, message.paintings);
        resolve();
        return;
      }
      if (!hasPainting(seed, message.style)) primePainting(seed, message.style, message.image);
      if (message.last) worker.terminate();
    };
    worker.onerror = () => {
      worker.terminate();
      resolve();
    };
    const message: TerrainJob = { seed, cellSize: TERRAIN_CELL_SIZE, styles: first === "dunya" ? ["dunya", "harita"] : ["harita", "dunya"] };
    worker.postMessage(message);
  });
  pending.set(seed, job);
  return job;
}

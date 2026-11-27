/**
 * Araziyi arka planda hazırlar (terrain.worker.ts) ve önbelleğe yerleştirir.
 * İşçi açılamazsa (eski tarayıcı, test ortamı) sessizce geçer: arazi ilk istendiğinde ana iş parçacığında üretilir.
 *
 * Söz (promise), arazi ve açılan görünümün boyası gelince çözülür: harita o an açılır. Öbür boya işçide ardından
 * üretilip önbelleğe eklenir (Harita görünümüne ondan önce geçilirse boya ana iş parçacığında yapılır).
 *
 * Yayındaki sitede sonuç tarayıcıda da saklanır (terrainStore, IndexedDB): yeniden gelen ziyaretçi araziyi beklemez.
 * Anahtar, bu modülün derleme dosyasının adını içerir; site yeniden derlenip değişince eski kayıt kullanılmaz.
 */
import { TERRAIN_CELL_SIZE, hasPainting, hasTerrain, primePainting, primeTerrain } from "./terrainCache";
import { loadStoredTerrain, storeTerrain, type StoredTerrain } from "./terrainStore";
import type { TerrainJob, TerrainMessage } from "./terrain.worker";
import type { PaintStyle } from "./terrainPaint";

const pending = new Map<number, Promise<void>>();

/** Geliştirmede kalıcı önbellek kapalı (kaynak dosyanın adı değişmez; eski arazi kalabilirdi). */
const PERSIST = !import.meta.env.DEV && typeof indexedDB !== "undefined";
const storeKey = (seed: number) => `${seed}|${TERRAIN_CELL_SIZE}|${import.meta.url}`;

function runWorker(seed: number, first: PaintStyle): Promise<void> {
  return new Promise<void>((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./terrain.worker.ts", import.meta.url), { type: "module" });
    } catch {
      resolve();
      return;
    }
    let collected: StoredTerrain | null = null;
    worker.onmessage = (event: MessageEvent<TerrainMessage>) => {
      const message = event.data;
      if (message.kind === "arazi") {
        primeTerrain(seed, message.terrain, message.trails, message.paintings);
        collected = { terrain: message.terrain, trails: message.trails, paintings: [...message.paintings] };
        resolve();
        return;
      }
      if (!hasPainting(seed, message.style)) primePainting(seed, message.style, message.image);
      collected?.paintings.push({ style: message.style, image: message.image });
      if (message.last) {
        worker.terminate();
        // Hepsi gelince tarayıcıya yazılır (harita açıldıktan sonra, boşta).
        if (PERSIST && collected) void storeTerrain(storeKey(seed), collected);
      }
    };
    worker.onerror = () => {
      worker.terminate();
      resolve();
    };
    const message: TerrainJob = { seed, cellSize: TERRAIN_CELL_SIZE, styles: first === "dunya" ? ["dunya", "harita"] : ["harita", "dunya"] };
    worker.postMessage(message);
  });
}

/** first: arazinin yanında hemen boyanacak üslup (açılan görünüm); öbürü ardından arka planda boyanır. */
export function prepareTerrain(seed: number, first: PaintStyle = "dunya"): Promise<void> {
  if (hasTerrain(seed)) return Promise.resolve();
  const running = pending.get(seed);
  if (running) return running;
  const job = (async () => {
    if (PERSIST) {
      const stored = await loadStoredTerrain(storeKey(seed));
      if (stored) {
        primeTerrain(seed, stored.terrain, stored.trails, stored.paintings);
        return;
      }
    }
    await runWorker(seed, first);
  })();
  pending.set(seed, job);
  return job;
}

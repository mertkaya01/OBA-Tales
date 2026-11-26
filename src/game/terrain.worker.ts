/**
 * ARAZİ İŞÇİSİ — araziyi, patikaları ve iki üsluptaki boyalı haritayı arka planda üretir.
 * Ana iş parçacığı bu sırada yükleniyor ekranını akıcı tutar; sonuç terrainCache'e yerleştirilir.
 */
/// <reference lib="webworker" />
import { planTrails } from "./paths";
import { generateTerrain } from "./terrain";
import { paintTerrain, type PaintStyle } from "./terrainPaint";

export interface TerrainJob {
  seed: number;
  cellSize: number;
  styles: PaintStyle[];
}

self.onmessage = (event: MessageEvent<TerrainJob>) => {
  const { seed, cellSize, styles } = event.data;
  const terrain = generateTerrain({ seed, cellSize });
  const trails = planTrails(terrain);
  const paintings = styles.map((style) => ({ style, image: paintTerrain(terrain, { style, trails: trails.paths }) }));
  const transfer: Transferable[] = [
    terrain.heights.buffer,
    terrain.regions.buffer,
    terrain.islands.buffer,
    terrain.kinds.buffer,
    terrain.shore.buffer,
    terrain.river.buffer,
    terrain.lakeIds.buffer,
    trails.mask.buffer,
    ...paintings.map((p) => p.image.data.buffer),
  ];
  (self as unknown as DedicatedWorkerGlobalScope).postMessage({ terrain, trails, paintings }, transfer);
};

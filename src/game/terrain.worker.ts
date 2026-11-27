/**
 * ARAZİ İŞÇİSİ — araziyi, patikaları ve boyalı haritaları arka planda üretir.
 * Ana iş parçacığı bu sırada yükleniyor ekranını akıcı tutar; sonuç terrainCache'e yerleştirilir.
 *
 * İki aşamada yanıt verir: önce arazi, patikalar ve ilk üslup (açılışta gereken: 3D dünyanın "dunya" boyası) gider,
 * harita hemen açılır; kalan üsluplar ("harita": 2D görünüm ve yönetim panelinin küçük haritası) ardından tek tek
 * gönderilir. Arazi dizileri ilk mesajda kopyalanır (aktarılmaz), çünkü kalan boyamalar için işçide de lazım.
 */
/// <reference lib="webworker" />
import { planTrails } from "./paths";
import { generateTerrain } from "./terrain";
import { paintTerrain, type PaintStyle, type PaintedImage } from "./terrainPaint";

export interface TerrainJob {
  seed: number;
  cellSize: number;
  /** Boyanacak üsluplar; ilki arazinin yanında hemen gönderilir. */
  styles: PaintStyle[];
}

export type TerrainMessage =
  | { kind: "arazi"; terrain: ReturnType<typeof generateTerrain>; trails: ReturnType<typeof planTrails>; paintings: { style: PaintStyle; image: PaintedImage }[] }
  | { kind: "boya"; style: PaintStyle; image: PaintedImage; last: boolean };

const scope = self as unknown as DedicatedWorkerGlobalScope;

self.onmessage = (event: MessageEvent<TerrainJob>) => {
  const { seed, cellSize, styles } = event.data;
  const terrain = generateTerrain({ seed, cellSize });
  const trails = planTrails(terrain);
  const [first, ...rest] = styles;
  const firstPainting = first ? [{ style: first, image: paintTerrain(terrain, { style: first, trails: trails.paths }) }] : [];
  const ready: TerrainMessage = { kind: "arazi", terrain, trails, paintings: firstPainting };
  scope.postMessage(ready, firstPainting.map((p) => p.image.data.buffer));
  rest.forEach((style, i) => {
    const image = paintTerrain(terrain, { style, trails: trails.paths });
    const message: TerrainMessage = { kind: "boya", style, image, last: i === rest.length - 1 };
    scope.postMessage(message, [image.data.buffer]);
  });
};

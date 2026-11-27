/**
 * Yükseklik haritasından 3D arazi ağı: düzenli ızgara, köşeleri bilinear yükseklikle,
 * UV'leri dünya koordinatından (boyalı harita dokusu tam oturur).
 *
 * Ağ parçalara (CHUNK_CELLS × CHUNK_CELLS kare) bölünür: her parçanın kendi sınır küresi olur, ekranda olmayan parçalar
 * çizilmez (yakınlaşınca arazinin çoğu atlanır) ve tıklamada ışın yalnızca ilgili parçalarda denenir. Komşu parçalar
 * kenar köşelerini paylaşır (aynı yükseklik): dikiş yok; yüzeyler düz gölgeli olduğu için ışıkta da iz kalmaz.
 */
import { BufferAttribute, BufferGeometry } from "three";
import type { Terrain } from "../game/terrain";
import { WORLD_SIZE } from "../types";
import { groundY } from "./worldScale";

/** Ağın kare boyu (dünya birimi): büyüdükçe daha iri ve köşeli yüzeyler. */
export const MESH_STEP = 5;
/** Bir parçanın kenarındaki kare sayısı (5 birimlik karelerle 400 × 400 dünya birimi). */
export const CHUNK_CELLS = 80;

/** Arazi ağının parçaları (soldan sağa, yukarıdan aşağıya). */
export function buildTerrainChunks(terrain: Terrain, step = MESH_STEP, chunkCells = CHUNK_CELLS): BufferGeometry[] {
  const cols = Math.round(WORLD_SIZE.width / step) + 1;
  const rows = Math.round(WORLD_SIZE.height / step) + 1;
  // Yükseklikler bir kez örneklenir; parçalar kenarlarını buradan paylaşır.
  const heights = new Float32Array(cols * rows);
  const xAt = (c: number) => Math.min(WORLD_SIZE.width, c * step);
  const zAt = (r: number) => Math.min(WORLD_SIZE.height, r * step);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) heights[r * cols + c] = groundY(terrain, { x: xAt(c), y: zAt(r) });

  const chunks: BufferGeometry[] = [];
  for (let r0 = 0; r0 < rows - 1; r0 += chunkCells) {
    for (let c0 = 0; c0 < cols - 1; c0 += chunkCells) {
      const r1 = Math.min(rows - 1, r0 + chunkCells);
      const c1 = Math.min(cols - 1, c0 + chunkCells);
      const w = c1 - c0 + 1;
      const h = r1 - r0 + 1;
      const positions = new Float32Array(w * h * 3);
      const uvs = new Float32Array(w * h * 2);
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          const i = r * w + c;
          const x = xAt(c0 + c);
          const z = zAt(r0 + r);
          positions[i * 3] = x;
          positions[i * 3 + 1] = heights[(r0 + r) * cols + (c0 + c)];
          positions[i * 3 + 2] = z;
          uvs[i * 2] = x / WORLD_SIZE.width;
          uvs[i * 2 + 1] = z / WORLD_SIZE.height;
        }
      }
      const indices = new Uint32Array((w - 1) * (h - 1) * 6);
      let k = 0;
      for (let r = 0; r < h - 1; r++) {
        for (let c = 0; c < w - 1; c++) {
          const a = r * w + c;
          const b = a + 1;
          const d = a + w;
          const e = d + 1;
          indices[k++] = a;
          indices[k++] = d;
          indices[k++] = b;
          indices[k++] = b;
          indices[k++] = d;
          indices[k++] = e;
        }
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
      geometry.setIndex(new BufferAttribute(indices, 1));
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      chunks.push(geometry);
    }
  }
  return chunks;
}

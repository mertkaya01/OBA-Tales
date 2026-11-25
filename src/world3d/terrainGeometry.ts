/**
 * Yükseklik haritasından 3D arazi ağı: düzenli ızgara, köşeleri bilinear yükseklikle,
 * UV'leri dünya koordinatından (boyalı harita dokusu tam oturur).
 */
import { BufferAttribute, BufferGeometry } from "three";
import type { Terrain } from "../game/terrain";
import { WORLD_SIZE } from "../types";
import { groundY } from "./worldScale";

/** Ağın kare boyu (dünya birimi): büyüdükçe daha iri ve köşeli yüzeyler. */
export const MESH_STEP = 5;

export function buildTerrainGeometry(terrain: Terrain, step = MESH_STEP): BufferGeometry {
  const cols = Math.round(WORLD_SIZE.width / step) + 1;
  const rows = Math.round(WORLD_SIZE.height / step) + 1;
  const positions = new Float32Array(cols * rows * 3);
  const uvs = new Float32Array(cols * rows * 2);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const x = Math.min(WORLD_SIZE.width, c * step);
      const z = Math.min(WORLD_SIZE.height, r * step);
      positions[i * 3] = x;
      positions[i * 3 + 1] = groundY(terrain, { x, y: z });
      positions[i * 3 + 2] = z;
      uvs[i * 2] = x / WORLD_SIZE.width;
      uvs[i * 2 + 1] = z / WORLD_SIZE.height;
    }
  }
  const indices = new Uint32Array((cols - 1) * (rows - 1) * 6);
  let k = 0;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = a + cols;
      const e = d + 1;
      indices.set([a, d, b, b, d, e], k);
      k += 6;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

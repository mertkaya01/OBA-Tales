/**
 * TATLI SULAR — nehirler ve göller (game/terrain.ts üretir).
 *
 *   · Nehir: araziyi izleyen ince şerit. Soğuk arazide buzlu açık mavi, ılıman arazide koyu mavi.
 *   · Göl: kendi su seviyesinde düz bir yüzey. Yüzey göl hücrelerini ve bir hücre çevresini kaplar;
 *     kıyıdaki yüksek zemin yüzeyin üstüne çıktığı için kıyı çizgisi arazinin kendisiyle yumuşakça kesilir.
 *     Donmuş göller buz rengindedir.
 * Hepsi tek çizim çağrısında (köşe renkli tek ağ), açılmamış bölgelerde sisin rengini alır.
 */
import { useEffect, useMemo } from "react";
import { isHiddenAt, isHiddenIndex, type LandVisibility } from "../game/visibility";
import { BufferAttribute, BufferGeometry, Color } from "three";
import { COLD_KINDS, sampleTerrain, type Terrain } from "../game/terrain";
import { TERRAIN_COLORS } from "../game/palette";
import { foggedLambert } from "./materials";
import type { FogUniforms } from "./shaders/fog";
import { groundY, heightToY } from "./worldScale";

const RIVER = new Color(TERRAIN_COLORS.river);
const RIVER_ICE = new Color(TERRAIN_COLORS.riverIce).lerp(RIVER, 0.25);
const LAKE = new Color(TERRAIN_COLORS.lake);
const LAKE_ICE = new Color(TERRAIN_COLORS.lakeIce);

/** Nehir şeridinin zeminden yüksekliği: alçak poligonlu arazinin üstünde kalsın. */
const RIVER_LIFT = 0.45;

function buildWaterGeometry(terrain: Terrain, visibility: LandVisibility): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const push = (x: number, y: number, z: number, color: Color) => {
    positions.push(x, y, z);
    colors.push(color.r, color.g, color.b);
    return positions.length / 3 - 1;
  };

  // Nehirler: her noktada sola ve sağa yarım genişlik.
  for (const path of terrain.rivers) {
    const { points, widths } = path;
    let previous: [number, number] | null = null;
    for (let k = 0; k < points.length; k++) {
      const a = points[Math.max(0, k - 1)];
      const b = points[Math.min(points.length - 1, k + 1)];
      let tx = b.x - a.x;
      let ty = b.y - a.y;
      const len = Math.hypot(tx, ty) || 1;
      tx /= len;
      ty /= len;
      const half = widths[k] / 2;
      const p = points[k];
      // Karartılı karadaki nehir çizilmez (şerit orada kesilir).
      if (isHiddenAt(terrain, visibility, p)) {
        previous = null;
        continue;
      }
      const sample = sampleTerrain(terrain, p);
      const cold = sample.kind !== null && COLD_KINDS.has(sample.kind) && sample.height > 0.2;
      const color = cold ? RIVER_ICE : RIVER;
      // Ağız denizde biter: su yüzeyinin altına inmesin.
      const y = Math.max(groundY(terrain, p), heightToY(0)) + RIVER_LIFT;
      const left = push(p.x - ty * half, y, p.y + tx * half, color);
      const right = push(p.x + ty * half, y, p.y - tx * half, color);
      if (previous) indices.push(previous[0], left, previous[1], previous[1], left, right);
      previous = [left, right];
    }
  }

  // Göller: göl hücreleri ve bir hücrelik çevresi, su seviyesinde.
  const { cols, rows, cellSize, lakeIds, lakes } = terrain;
  const covered = new Int32Array(cols * rows).fill(-1);
  for (let i = 0; i < lakeIds.length; i++) {
    const lake = lakeIds[i];
    if (lake < 0 || isHiddenIndex(terrain, visibility, i)) continue;
    const col = i % cols;
    const row = (i / cols) | 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const c = col + dc;
        const r = row + dr;
        if (c >= 0 && r >= 0 && c < cols && r < rows && covered[r * cols + c] < 0) covered[r * cols + c] = lake;
      }
    }
  }
  for (let i = 0; i < covered.length; i++) {
    const lake = covered[i];
    if (lake < 0) continue;
    const x0 = (i % cols) * cellSize;
    const z0 = ((i / cols) | 0) * cellSize;
    const y = heightToY(lakes[lake].level) + 0.08;
    const color = lakes[lake].frozen ? LAKE_ICE : LAKE;
    const a = push(x0, y, z0, color);
    const b = push(x0 + cellSize, y, z0, color);
    const c = push(x0, y, z0 + cellSize, color);
    const d = push(x0 + cellSize, y, z0 + cellSize, color);
    indices.push(a, c, b, b, c, d);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function Waters({ terrain, fogUniforms, visibility }: { terrain: Terrain; fogUniforms: FogUniforms; visibility: LandVisibility }) {
  const geometry = useMemo(() => buildWaterGeometry(terrain, visibility), [terrain, visibility]);
  const material = useMemo(
    () =>
      foggedLambert(fogUniforms, {
        vertexColors: true,
        flatShading: false,
        emissive: new Color("#0d2a44"),
        // Arazinin hemen üstünde: derinlik çatışması olmasın.
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    [fogUniforms],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  return <mesh geometry={geometry} material={material} receiveShadow />;
}

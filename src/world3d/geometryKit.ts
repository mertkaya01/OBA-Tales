/**
 * Geometri yardımcıları: basit şekilleri yerleştirip tek geometride birleştirir.
 * Yapılar ve anıtlar (Settlements.tsx) bu yardımcılarla, her biri tek çizim olacak şekilde kurulur.
 */
import { BoxGeometry, ConeGeometry, CylinderGeometry, DodecahedronGeometry, IcosahedronGeometry, type BufferGeometry } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export type Transform = { at?: [number, number, number]; rx?: number; ry?: number; rz?: number; scale?: [number, number, number] };

/** Geometriyi ölçekler, döndürür (x, y, z sırasıyla) ve taşır. */
export function place(geometry: BufferGeometry, { at = [0, 0, 0], rx = 0, ry = 0, rz = 0, scale }: Transform = {}): BufferGeometry {
  if (scale) geometry.scale(scale[0], scale[1], scale[2]);
  if (rx) geometry.rotateX(rx);
  if (ry) geometry.rotateY(ry);
  if (rz) geometry.rotateZ(rz);
  return geometry.translate(at[0], at[1], at[2]);
}

/** Birden çok parçayı tek geometride birleştirir. */
export function merge(...geometries: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(geometries.map((g) => (g.index ? g.toNonIndexed() : g)));
  if (!merged) throw new Error("Geometriler birleştirilemedi");
  merged.computeVertexNormals();
  return merged;
}

export const box = (w: number, h: number, d: number, t?: Transform) => place(new BoxGeometry(w, h, d), t);
export const cylinder = (rTop: number, rBottom: number, h: number, segments: number, t?: Transform) =>
  place(new CylinderGeometry(rTop, rBottom, h, segments), t);
export const cone = (r: number, h: number, segments: number, t?: Transform) => place(new ConeGeometry(r, h, segments), t);
export const ico = (r: number, t?: Transform) => place(new IcosahedronGeometry(r, 0), t);
export const dodeca = (r: number, t?: Transform) => place(new DodecahedronGeometry(r, 0), t);

/** Çember üzerinde eşit aralıklı noktalar (açı, x, z). */
export function ring(count: number, radius: number, phase = 0): { angle: number; x: number; z: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = phase + (i / count) * Math.PI * 2;
    return { angle, x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
  });
}

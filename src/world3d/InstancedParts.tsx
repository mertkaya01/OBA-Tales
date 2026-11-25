/**
 * Aynı geometriden yüzlerce kopyayı (ağaç, çadır, kaya…) tek çizimde gösterir.
 * Her kopyanın konumu, Y ekseni etrafında dönüşü, ölçeği ve isteğe bağlı rengi olur.
 */
import { useLayoutEffect, useRef } from "react";
import { Color, Euler, Matrix4, Quaternion, Vector3, type BufferGeometry, type InstancedMesh, type Material } from "three";

export interface InstanceTransform {
  position: readonly [number, number, number];
  rotationY?: number;
  scale?: number | readonly [number, number, number];
  color?: string;
}

interface InstancedPartsProps {
  geometry: BufferGeometry;
  material: Material;
  items: readonly InstanceTransform[];
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export function InstancedParts({ geometry, material, items, castShadow = true, receiveShadow = false }: InstancedPartsProps) {
  const ref = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const euler = new Euler();
    const position = new Vector3();
    const scale = new Vector3();
    const color = new Color();
    items.forEach((item, i) => {
      position.set(item.position[0], item.position[1], item.position[2]);
      quaternion.setFromEuler(euler.set(0, item.rotationY ?? 0, 0));
      const s = item.scale ?? 1;
      if (typeof s === "number") scale.setScalar(s);
      else scale.set(s[0], s[1], s[2]);
      mesh.setMatrixAt(i, matrix.compose(position, quaternion, scale));
      if (item.color) mesh.setColorAt(i, color.set(item.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);

  if (items.length === 0) return null;
  return (
    <instancedMesh
      // Kopya sayısı değişirse yeniden kurulmalı (InstancedMesh boyutu sabittir).
      key={items.length}
      ref={ref}
      args={[geometry, material, items.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
}

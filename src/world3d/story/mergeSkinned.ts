/**
 * İSKELETLİ PARÇALARI BİRLEŞTİRME — bir kahraman ya da hayvan, renk parçası başına ayrı çizilmesin.
 *
 * Blender'dan gelen modelde her renk ayrı bir alt ağdır (geyikte 20, mhellingtr'de 48): her biri bir çizim, gölgede
 * bir çizim daha. Burada aynı gruptaki parçalar tek iskeletli ağda birleşir, renkleri köşe rengine yazılır. Ayrı
 * kalması gereken parçalar (gizlenen kılıç ve yay, kendi ışığıyla parlayanlar, dişi geyikte gizli boynuz) kendi
 * gruplarında kalır. Kopya başına yapılır: kahramanın renkleri kendine özgüdür.
 */
import { BufferAttribute, SkinnedMesh, type Color, type Material, type MeshStandardMaterial, type Object3D } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export interface PartPaint {
  /** Birleşeceği grup ("govde", "parilti", "silah"…). */
  group: string;
  color: Color;
}

/**
 * root içindeki iskeletli alt ağları gruplarına göre birleştirir. Yeni ağların `userData.oba` alanı grup adıdır.
 * Dönüş: grup → birleşmiş ağ.
 */
export function mergeSkinnedParts(root: Object3D, paint: (materialName: string, source: MeshStandardMaterial) => PartPaint, material: (group: string) => Material): Map<string, SkinnedMesh> {
  const parts: SkinnedMesh[] = [];
  root.traverse((o) => {
    if ((o as SkinnedMesh).isSkinnedMesh) parts.push(o as SkinnedMesh);
  });
  const groups = new Map<string, { meshes: SkinnedMesh[]; colors: Color[] }>();
  for (const mesh of parts) {
    const source = mesh.material as MeshStandardMaterial;
    const { group, color } = paint(source.name, source);
    const entry = groups.get(group) ?? { meshes: [], colors: [] };
    entry.meshes.push(mesh);
    entry.colors.push(color);
    groups.set(group, entry);
  }
  const out = new Map<string, SkinnedMesh>();
  for (const [group, { meshes, colors }] of groups) {
    const first = meshes[0];
    const geometries = meshes.map((mesh, i) => {
      const g = mesh.geometry.clone();
      // Oyunda malzeme köşeli: normal gerekmez (bazı dosyalarda olabilir, hepsinde aynı öznitelikler kalsın).
      if (g.getAttribute("normal")) g.deleteAttribute("normal");
      for (const name of Object.keys(g.attributes)) if (!["position", "skinIndex", "skinWeight"].includes(name)) g.deleteAttribute(name);
      const count = g.getAttribute("position").count;
      const rgb = new Float32Array(count * 3);
      const c = colors[i];
      for (let k = 0; k < count; k++) {
        rgb[k * 3] = c.r;
        rgb[k * 3 + 1] = c.g;
        rgb[k * 3 + 2] = c.b;
      }
      g.setAttribute("color", new BufferAttribute(rgb, 3));
      return g;
    });
    const merged = mergeGeometries(geometries, false);
    geometries.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new SkinnedMesh(merged, material(group));
    mesh.name = group;
    mesh.userData.oba = group;
    mesh.position.copy(first.position);
    mesh.quaternion.copy(first.quaternion);
    mesh.scale.copy(first.scale);
    first.parent?.add(mesh);
    mesh.bind(first.skeleton, first.bindMatrix);
    mesh.frustumCulled = false;
    for (const m of meshes) m.parent?.remove(m);
    out.set(group, mesh);
  }
  return out;
}

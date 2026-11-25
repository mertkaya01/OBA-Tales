/**
 * BLENDER KİTİ — `public/models/karakter-kit.glb` varsa karakter parçalarının şekli oradan gelir.
 *
 *   · Dosya Blender'da düzenlenen kitten aktarılır (modeller/README.md, `npm run blender:aktar`).
 *   · Her ağ, nesne özelliği `oba_parca` (glTF extras) ya da adı ("kafa", "kafa.001" → kafa) ile bir parçaya
 *     bağlanır; aynı parçaya giden ağlar birleşir. Adı tanınmayan ağ yok sayılır.
 *   · Yalnızca şekil gelir: renk, hangi takipçide hangi parçanın görüneceği, kademeler (LOD), yürüyüş ve
 *     narada kol kaldırma koddaki kurallarla aynı kalır. Dosyada olmayan parça koddaki şekliyle çizilir.
 *   · İndirme ve React kancası useKitModel.ts içinde; bu dosya Node betiklerinde de (blender:kontrol) çalışır.
 */
import { BufferAttribute, BufferGeometry, type Mesh, type Object3D } from "three";
import { PARTS } from "./characterKit";

export type KitGeometries = ReadonlyMap<string, BufferGeometry>;

const KNOWN_IDS = new Set(PARTS.map((p) => p.id));

/** Ağın bağlı olduğu parça: kendisinde ya da bir üstündeki `oba_parca` özelliği, yoksa adı. */
export function partIdOf(object: Object3D): string | null {
  for (let o: Object3D | null = object; o; o = o.parent) {
    const tag: unknown = o.userData?.oba_parca;
    if (typeof tag === "string" && KNOWN_IDS.has(tag)) return tag;
    // Blender kopyaları "kafa.001" olur; glTF yükleyici noktayı atar → "kafa001".
    const base = o.name.replace(/(?:[._]?\d{3})+$/, "");
    if (KNOWN_IDS.has(base)) return base;
  }
  return null;
}

/** Sahnedeki ağları dünya dönüşümleri uygulanmış, parça başına tek geometriye çevirir. */
export function geometriesFromScene(scene: Object3D): Map<string, BufferGeometry> {
  scene.updateMatrixWorld(true);
  const chunks = new Map<string, Float32Array[]>();
  scene.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const id = partIdOf(mesh);
    if (!id) return;
    const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    source.applyMatrix4(mesh.matrixWorld);
    const position = source.getAttribute("position");
    const array = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      array[i * 3] = position.getX(i);
      array[i * 3 + 1] = position.getY(i);
      array[i * 3 + 2] = position.getZ(i);
    }
    source.dispose();
    const list = chunks.get(id) ?? [];
    list.push(array);
    chunks.set(id, list);
  });
  const result = new Map<string, BufferGeometry>();
  for (const [id, list] of chunks) {
    const merged = new Float32Array(list.reduce((n, a) => n + a.length, 0));
    let offset = 0;
    for (const a of list) {
      merged.set(a, offset);
      offset += a.length;
    }
    if (merged.length < 9) continue;
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(merged, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    result.set(id, geometry);
  }
  return result;
}

/** GLB baytlarını parça geometrilerine çevirir (yükleyici yalnızca gerektiğinde indirilir). */
export async function parseKitModel(data: ArrayBuffer): Promise<Map<string, BufferGeometry>> {
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const gltf = await new GLTFLoader().parseAsync(data, "");
  return geometriesFromScene(gltf.scene);
}

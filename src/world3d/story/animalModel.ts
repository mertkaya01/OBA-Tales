/**
 * HAYVAN MODELLERİ — `public/models/hayvan-<tür>.glb` (Blender: `npm run blender:hayvanlar`).
 *
 *   · Her dosyada tek bir iskeletli ağ ve beş klip var (animals.ts → ANIMALS[tür].lengths).
 *   · Renkler dosyadaki malzemeden gelir; oyunda köşeli, ışıktan etkilenen Lambert'e çevrilir.
 *   · Dosya yoksa ya da bozuksa o tür çizilmez, hata gösterilmez.
 */
import { useEffect, useState } from "react";
import { AnimationMixer, Box3, Group, LoopOnce, MeshLambertMaterial, Vector3, type AnimationClip, type Material, type Object3D, type SkinnedMesh } from "three";
import { mergeSkinnedParts } from "./mergeSkinned";
import { ANIMAL_KINDS, ANIMAL_ONE_SHOT, ANIMALS, type AnimalKind } from "./animals";

export interface AnimalModel {
  clips: ReadonlyMap<string, AnimationClip>;
  instantiate: () => Object3D;
}

const isGlb = (data: ArrayBuffer) =>
  data.byteLength > 20 && new TextDecoder().decode(new Uint8Array(data, 0, 4)) === "glTF";

export async function parseAnimalModel(data: ArrayBuffer): Promise<AnimalModel> {
  const [{ GLTFLoader }, { clone }] = await Promise.all([
    import("three/examples/jsm/loaders/GLTFLoader.js"),
    import("three/examples/jsm/utils/SkeletonUtils.js"),
  ]);
  const gltf = await new GLTFLoader().parseAsync(data, "");
  return { clips: new Map(gltf.animations.map((c) => [c.name, c])), instantiate: () => clone(gltf.scene) };
}

const pending = new Map<AnimalKind, Promise<AnimalModel | null>>();

export function loadAnimalModel(kind: AnimalKind): Promise<AnimalModel | null> {
  let promise = pending.get(kind);
  if (!promise) {
    promise = (async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}models/hayvan-${kind}.glb`);
        if (!response.ok) return null;
        const data = await response.arrayBuffer();
        if (!isGlb(data)) return null;
        const model = await parseAnimalModel(data);
        const needed = Object.keys(ANIMALS[kind].lengths);
        return needed.every((name) => model.clips.has(name)) ? model : null;
      } catch (error) {
        console.warn(`[OBA-Tales] hayvan-${kind}.glb okunamadı.`, error);
        return null;
      }
    })();
    pending.set(kind, promise);
  }
  return promise;
}

const NONE: ReadonlyMap<AnimalKind, AnimalModel> = new Map();

/** Üç türün modelini indirir; yüklenenleri verir. */
export function useAnimalModels(): ReadonlyMap<AnimalKind, AnimalModel> {
  const [models, setModels] = useState(NONE);
  useEffect(() => {
    let live = true;
    void Promise.all(ANIMAL_KINDS.map((k) => loadAnimalModel(k))).then((loaded) => {
      if (!live) return;
      const map = new Map<AnimalKind, AnimalModel>();
      loaded.forEach((m, i) => {
        if (m) map.set(ANIMAL_KINDS[i], m);
      });
      setModels(map);
    });
    return () => {
      live = false;
    };
  }, []);
  return models;
}

/**
 * Kopyayı oyunun boyasıyla giydirir (köşeli Lambert, dosyadaki renk). Boynuzsuz geyikte boynuz parçaları gizlenir.
 * Oluşturulan malzemeleri döndürür.
 */
export function dressAnimal(root: Object3D, options: { antlers?: boolean; shadow?: boolean } = {}): Material[] {
  // Bütün parçalar tek ağda (renk köşelerde); boynuz ayrı kalır ki dişi geyikte gizlensin.
  const material = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const meshes = mergeSkinnedParts(
    root,
    (name, source) => ({ group: name.startsWith("geyik-boynuz") ? "boynuz" : "govde", color: source.color.clone() }),
    () => material,
  );
  for (const [group, mesh] of meshes) {
    mesh.castShadow = options.shadow ?? true;
    if (group === "boynuz") mesh.visible = options.antlers !== false;
  }
  return [material];
}

/**
 * Yığılma klibinin son karesinde donmuş bir kopya (sırtta taşınan ya da asacakta asılı av için).
 * Kopya, yığılmış gövdenin ortası kabın merkezinde duracak şekilde kaydırılır; kaba istenen dönüş ve ölçek verilir.
 * Yığılmış hayvan sol yanına yatar, bacakları −x yönüne uzanır (kabın z ekseninde +90° → bacaklar aşağı, −90° → yukarı).
 */
export function frozenCatch(model: AnimalModel): { object: Object3D; materials: Material[]; size: Vector3 } {
  const root = model.instantiate();
  const materials = dressAnimal(root, { antlers: false });
  const mixer = new AnimationMixer(root);
  const clip = model.clips.get(ANIMAL_ONE_SHOT);
  if (clip) {
    const action = mixer.clipAction(clip);
    action.setLoop(LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    mixer.update(clip.duration);
  }
  root.updateMatrixWorld(true);
  const box = new Box3();
  root.traverse((o) => {
    const skinned = o as SkinnedMesh;
    if (skinned.isSkinnedMesh) {
      if (!skinned.visible) return;
      skinned.computeBoundingBox();
      if (skinned.boundingBox) box.union(skinned.boundingBox.clone().applyMatrix4(skinned.matrixWorld));
    }
  });
  const center = box.getCenter(new Vector3());
  root.position.sub(center);
  const size = box.getSize(new Vector3());
  const holder = new Group();
  holder.add(root);
  return { object: holder, materials, size };
}

/**
 * İSKELETLİ KAHRAMANLAR — `public/models/kahraman-<kimlik>.glb` (Blender: `npm run blender:kahramanlar`).
 *
 *   · Her dosyada tek bir iskeletli ağ ve 13 klip var (HERO_CLIPS). Klipler yerinde oynar; kahramanı dünyada
 *     yürüten AnimatedHero.tsx'tir.
 *   · Ağın her alt parçasının malzeme adı oyundaki parça kimliğidir ("okyeli-kafa", "bintas-alev-kuresi"):
 *     renk ve parıltı oyundaki parça listesinden (characterKit.ts → PARTS) gelir, Blender'daki renk yalnızca yedektir.
 *   · Dosya yoksa ya da bozuksa kahraman eskisi gibi kalabalık çiziminde (FollowerInstances) kalır, hata gösterilmez.
 *   · Yükleyici ayrı parçada gelir; yalnızca haritada gelmiş bir kahraman varken indirilir.
 */
import { useEffect, useState } from "react";
import {
  Color,
  MeshBasicMaterial,
  MeshLambertMaterial,
  type AnimationClip,
  type Material,
  type Object3D,
} from "three";
import { resolveLook } from "../../game/sprites/composeSprite";
import type { Character } from "../../types";
import { PARTS } from "../characters/characterKit";
import { mergeSkinnedParts } from "./mergeSkinned";

/** Blender betiğinin (scripts/blender/kahraman_iskelet.py → CLIPS) yazdığı klipler. */
export const HERO_CLIPS = ["bosta", "yuru", "kos", "balta", "yay", "topla", "tasi", "otur", "sohbet", "selam", "esne", "cadir", "yika"] as const;
export type HeroClip = (typeof HERO_CLIPS)[number];

/** Bir kez bitip son karesinde kalan klipler; diğerleri döngüdür. */
export const ONE_SHOT_CLIPS: ReadonlySet<HeroClip> = new Set(["esne"]);

export interface HeroModel {
  /** Dosyadaki klipler (adına göre). */
  clips: ReadonlyMap<HeroClip, AnimationClip>;
  /** Sahneye konacak yeni bir kopya (kemikleriyle birlikte). */
  instantiate: () => Object3D;
}

const PART_BY_ID = new Map(PARTS.map((p) => [p.id, p]));
const isClip = (name: string): name is HeroClip => (HERO_CLIPS as readonly string[]).includes(name);

const isGlb = (data: ArrayBuffer) =>
  data.byteLength > 20 && new TextDecoder().decode(new Uint8Array(data, 0, 4)) === "glTF";

/** GLB baytlarını iskeletli modele çevirir (yükleyici ve iskelet kopyalayıcı yalnızca gerektiğinde indirilir). */
export async function parseHeroModel(data: ArrayBuffer): Promise<HeroModel> {
  const [{ GLTFLoader }, { clone }] = await Promise.all([
    import("three/examples/jsm/loaders/GLTFLoader.js"),
    import("three/examples/jsm/utils/SkeletonUtils.js"),
  ]);
  const gltf = await new GLTFLoader().parseAsync(data, "");
  const clips = new Map<HeroClip, AnimationClip>();
  for (const clip of gltf.animations) if (isClip(clip.name)) clips.set(clip.name, clip);
  return { clips, instantiate: () => clone(gltf.scene) };
}

const pending = new Map<string, Promise<HeroModel | null>>();

/** Kahramanın modelini bir kez indirir; dosya yoksa, bozuksa ya da klipleri eksikse null. */
export function loadHeroModel(id: string): Promise<HeroModel | null> {
  let promise = pending.get(id);
  if (!promise) {
    promise = (async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}models/kahraman-${id}.glb`);
        if (!response.ok) return null;
        const data = await response.arrayBuffer();
        if (!isGlb(data)) return null;
        const model = await parseHeroModel(data);
        // Yürüyüş ve duruş olmadan kahraman kayar: eksik dosyada eski çizim daha iyi.
        return model.clips.has("bosta") && model.clips.has("yuru") ? model : null;
      } catch (error) {
        console.warn(`[OBA-Tales] kahraman-${id}.glb okunamadı, kahraman kalabalık çiziminde kalıyor.`, error);
        return null;
      }
    })();
    pending.set(id, promise);
  }
  return promise;
}

const NO_MODELS: ReadonlyMap<string, HeroModel> = new Map();

/**
 * Verilen kahramanların modellerini indirir ve yüklenenleri kimliğe göre verir. Liste değişmedikçe aynı Map döner
 * (kalabalık çizimi her yeni Map'te yeniden kurulduğu için önemli). Listeden çıkan bir kahraman Map'te bir süre
 * kalabilir; kullanan taraf zaten haritadaki karakterlere göre süzer.
 */
export function useHeroModels(ids: readonly string[]): ReadonlyMap<string, HeroModel> {
  const key = ids.join(",");
  const [models, setModels] = useState(NO_MODELS);
  useEffect(() => {
    if (!key) return;
    let live = true;
    const wanted = key.split(",");
    void Promise.all(wanted.map((id) => loadHeroModel(id))).then((loaded) => {
      if (!live) return;
      const map = new Map<string, HeroModel>();
      loaded.forEach((model, i) => {
        if (model) map.set(wanted[i], model);
      });
      setModels(map);
    });
    return () => {
      live = false;
    };
  }, [key]);
  return models;
}

/**
 * Kopyanın malzemelerini oyunun boyasıyla değiştirir: köşeli, ışıktan etkilenen Lambert; parlayan parçalar kendi
 * ışığıyla (Basic). Renkler oyundaki parça listesinden gelir, böylece kalabalık çizimiyle aynı görünür.
 * Oluşturulan malzemeleri döndürür (bileşen kalkınca atılsın diye).
 */
export function dressHero(root: Object3D, character: Character): Material[] {
  const look = resolveLook(character);
  const made: Material[] = [];
  // Parçalar dört grupta birleşir (çizim başına bir grup): gövde, parlayanlar, silah (balta tutunca gizlenir) ve
  // silahın parlayan kısmı. Renk köşelere yazılır (mergeSkinned.ts).
  const meshes = mergeSkinnedParts(
    root,
    (name, source) => {
      const spec = PART_BY_ID.get(name);
      const weapon = WEAPON_PARTS.some((p) => name.startsWith(p));
      const group = `${weapon ? "silah" : "govde"}${spec?.glow ? "-parilti" : ""}`;
      return { group, color: spec ? new Color(spec.color(look, character)) : source.color.clone() };
    },
    (group) => {
      const material = group.endsWith("-parilti") ? new MeshBasicMaterial({ vertexColors: true }) : new MeshLambertMaterial({ vertexColors: true, flatShading: true });
      material.name = group;
      made.push(material);
      return material;
    },
  );
  for (const [group, mesh] of meshes) mesh.castShadow = !group.endsWith("-parilti");
  return made;
}

/** Balta tutunca gizlenen silah parçaları (malzeme adının başı). */
export const WEAPON_PARTS: readonly string[] = ["egetunce-kilic", "okyeli-yay", "mhellingtr-yay-uclari"];

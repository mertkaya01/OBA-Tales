/**
 * TAKİPÇİLER — filtreden geçen bütün karakterler, low-poly 3D ve canlı.
 *
 *   · Her parça (gövde, kafa, kalkan, yay…) tek bir InstancedMesh: binlerce karakter ≈ 25 çizim.
 *   · Gezinme, yürüyüş, nefes ve Oba Narası ekran kartında hesaplanır (living/motion.ts); gölgeler de yürür.
 *   · Üç kademe: en uzakta yalnızca gövde, kafa, atkı, başlık ve pelerin; orta mesafede kollar, saç, ekipman;
 *     yakında yüz, toka, eller ve runlar gibi ayrıntılar.
 *   · Görünmez bir silindir katmanı tıklama ve üzerine gelmeyi yakalar; ışın testinden hemen önce
 *     silindirler karakterlerin o anki yerine taşınır.
 */
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  BufferGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  type Intersection,
  type Material,
  type Raycaster,
} from "three";
import type { Terrain } from "../game/terrain";
import type { Character } from "../types";
import { HIT_GEOMETRY } from "./characters/characterKit";
import { createCharacterMaterials, type CharacterMaterials, type CharacterUniforms } from "./characters/characterMaterials";
import { buildInstanceData, type PartInstances } from "./characters/instanceData";
import { currentPosition, type CharacterPlacement, type WorldPoint } from "./living/placement";
import { worldZoomOf } from "./worldScale";

/** Bu dünya zoom'unun altında ayrıntı parçaları gizlenir. */
const DETAIL_ZOOM = 2.4;
/** Bu dünya zoom'unun altında yalnızca çekirdek parçalar çizilir (karakterler birkaç piksel boyunda). */
const SILHOUETTE_ZOOM = 1.1;
/** Tıklama silindirleri en fazla bu kadar saniyede bir yeniden konumlanır. */
const HIT_SYNC_SECONDS = 0.08;

/** Parçanın geometrisi + kopya başına hareket bilgisi (köşe verisi paylaşılır, kopyalanmaz). */
function withMotionAttribute(source: BufferGeometry, motion: Float32Array): BufferGeometry {
  const geometry = new BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, attribute);
  if (source.index) geometry.setIndex(source.index);
  geometry.setAttribute("aMotion", new InstancedBufferAttribute(motion, 4));
  return geometry;
}

function PartMesh({ part, materials }: { part: PartInstances; materials: CharacterMaterials }) {
  const ref = useRef<InstancedMesh>(null);
  const { size } = useThree();
  const geometry = useMemo(() => withMotionAttribute(part.spec.geometry, part.motion), [part]);
  const { glow, legs, arms } = part.spec;
  const material: Material = glow ? (arms ? materials.glowArms : materials.glow) : legs ? materials.legs : arms ? materials.arms : materials.tinted;

  useEffect(() => () => geometry.dispose(), [geometry]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.instanceMatrix.array.set(part.matrices);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor = new InstancedBufferAttribute(part.colors, 3);
    if (part.spec.shadow) mesh.customDepthMaterial = part.spec.arms ? materials.depthArms : materials.depth;
    mesh.computeBoundingSphere();
    // Gezinenler evlerinden biraz uzaklaşır: sınır küresi buna yer bıraksın.
    if (mesh.boundingSphere) mesh.boundingSphere.radius += 16;
  }, [part, materials]);

  useFrame(({ camera }) => {
    if (part.spec.core || !ref.current) return;
    ref.current.visible = worldZoomOf((camera as { zoom: number }).zoom, size) >= (part.spec.detail ? DETAIL_ZOOM : SILHOUETTE_ZOOM);
  });

  if (part.count === 0) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, part.count]}
      castShadow={part.spec.shadow ?? false}
      // Işın testine yalnızca tıklama katmanı girsin.
      raycast={() => null}
    />
  );
}

interface FollowerInstancesProps {
  characters: readonly Character[];
  placements: ReadonlyMap<string, CharacterPlacement>;
  terrain: Terrain;
  uniforms: CharacterUniforms;
  activeParticipantIds: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

export function FollowerInstances({ characters, placements, terrain, uniforms, activeParticipantIds, onSelect, onHover }: FollowerInstancesProps) {
  const { gl } = useThree();
  const materials = useMemo(() => createCharacterMaterials(uniforms), [uniforms]);
  const data = useMemo(() => buildInstanceData(characters, placements, activeParticipantIds), [characters, placements, activeParticipantIds]);
  const hitRef = useRef<InstancedMesh>(null);
  const lastSync = useRef(Number.NEGATIVE_INFINITY);

  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);

  useLayoutEffect(() => {
    const mesh = hitRef.current;
    if (!mesh) return;
    mesh.instanceMatrix.array.set(data.matrices);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    if (mesh.boundingSphere) mesh.boundingSphere.radius += 16;
    lastSync.current = Number.NEGATIVE_INFINITY;
  }, [data]);

  /** Işın testinden önce tıklama silindirlerini karakterlerin şu anki yerine taşır. */
  const hitRaycast = useMemo(() => {
    const point: WorldPoint = { x: 0, y: 0, z: 0 };
    return (raycaster: Raycaster, intersects: Intersection[]) => {
      const mesh = hitRef.current;
      if (!mesh) return;
      const t = uniforms.uTime.value;
      if (Math.abs(t - lastSync.current) > HIT_SYNC_SECONDS) {
        const array = mesh.instanceMatrix.array as Float32Array;
        data.ids.forEach((id, i) => {
          const placement = placements.get(id);
          if (!placement) return;
          currentPosition(placement, terrain, t, point);
          array[i * 16 + 12] = point.x;
          array[i * 16 + 13] = point.y;
          array[i * 16 + 14] = point.z;
        });
        mesh.instanceMatrix.needsUpdate = true;
        lastSync.current = t;
      }
      InstancedMesh.prototype.raycast.call(mesh, raycaster, intersects);
    };
  }, [data, placements, terrain, uniforms]);

  const idAt = (event: ThreeEvent<PointerEvent | MouseEvent>) =>
    event.instanceId === undefined ? undefined : data.ids[event.instanceId];

  return (
    <group>
      {data.parts.map((part) => (
        <PartMesh key={`${part.spec.id}:${part.count}`} part={part} materials={materials} />
      ))}
      {data.ids.length > 0 && (
        <instancedMesh
          key={`tiklama:${data.ids.length}`}
          ref={hitRef}
          args={[HIT_GEOMETRY, materials.hit, data.ids.length]}
          raycast={hitRaycast}
          onClick={(event) => {
            if (event.delta > 6) return;
            event.stopPropagation();
            const id = idAt(event);
            if (id) onSelect(id);
          }}
          onPointerMove={(event) => {
            event.stopPropagation();
            onHover(idAt(event) ?? null);
            gl.domElement.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            onHover(null);
            gl.domElement.style.cursor = "";
          }}
        />
      )}
    </group>
  );
}

/**
 * TAKİPÇİLER — filtreden geçen bütün karakterler, low-poly 3D ve canlı.
 *
 *   · Her parça (gövde, kafa, kalkan, yay…) tek bir InstancedMesh: binlerce karakter ≈ 25 çizim.
 *   · Gezinme, yürüyüş, nefes ve Oba Narası ekran kartında hesaplanır (living/motion.ts); gölgeler de yürür.
 *   · Üç kademe: en uzakta yalnızca gövde, kafa, atkı, başlık ve pelerin; orta mesafede kollar, saç, ekipman;
 *     yakında yüz, toka, eller ve runlar gibi ayrıntılar.
 *   · Parçaların şekli koddan gelir; public/models/karakter-kit.glb varsa (Blender kiti) oradan.
 *   · Uzakta takipçi modelleri yerine sınıf ve kademe renginde basit siluetler çizilir (`far` parçalar).
 *   · Kamera dışındakiler ayıklanır: görüş alanındaki karakterler her parçanın tamponunun başına toplanır,
 *     kalanı hiç çizilmez (kamera kıpırdayınca birkaç karede bir yeniden hesaplanır).
 *   · Görünmez bir silindir katmanı tıklama ve üzerine gelmeyi yakalar; ışın testinden hemen önce
 *     silindirler karakterlerin o anki yerine taşınır.
 */
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  BufferGeometry,
  Frustum,
  Matrix4,
  Sphere,
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
import type { KitGeometries } from "./characters/kitModel";
import { useKitModel } from "./characters/useKitModel";
import { currentPosition, type CharacterPlacement, type WorldPoint } from "./living/placement";
import { worldZoomOf } from "./worldScale";

/** Bu dünya zoom'unun altında ayrıntı parçaları gizlenir. */
const DETAIL_ZOOM = 2.4;
/** Bu dünya zoom'unun altında yalnızca çekirdek parçalar çizilir (karakterler birkaç piksel boyunda). */
const SILHOUETTE_ZOOM = 1.1;
/** Kamera dışı ayıklamada karakterin çevresine bırakılan pay (dünya birimi): gezinme yarıçapı ve gölgesi sığsın. */
const CULL_MARGIN = 16;
/** Kamera kıpırdarken görünürlük en fazla bu kadar karede bir yeniden hesaplanır. */
const CULL_EVERY = 3;

/** Hangi karakterlerin görüş alanında olduğu (karakter sırasına göre); sürüm değişince parçalar tamponlarını toplar. */
interface Visibility {
  flags: Uint8Array;
  version: number;
  /** Neredeyse herkes görünüyorsa ayıklama yapılmaz, tam tampon çizilir. */
  all: boolean;
}

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

interface PartWork {
  colors: Float32Array;
  motion: Float32Array;
  version: number;
  full: boolean;
}

/** Görüş alanındaki kopyaları tamponun başına toplar (ya da herkes görünüyorsa tam tamponu geri koyar). */
function compact(mesh: InstancedMesh, part: PartInstances, work: PartWork, visibility: Visibility): void {
  const matrix = mesh.instanceMatrix;
  const color = mesh.instanceColor;
  const motion = mesh.geometry.getAttribute("aMotion") as InstancedBufferAttribute;
  if (!color) return;
  const attributes = [matrix, color, motion] as const;
  if (visibility.all) {
    if (work.full) return;
    (matrix.array as Float32Array).set(part.matrices);
    work.colors.set(part.colors);
    work.motion.set(part.motion);
    mesh.count = part.count;
    work.full = true;
    for (const a of attributes) {
      a.clearUpdateRanges();
      a.needsUpdate = true;
    }
    return;
  }
  const m = matrix.array as Float32Array;
  let n = 0;
  for (let k = 0; k < part.count; k++) {
    if (!visibility.flags[part.members[k]]) continue;
    m.set(part.matrices.subarray(k * 16, k * 16 + 16), n * 16);
    work.colors.set(part.colors.subarray(k * 3, k * 3 + 3), n * 3);
    work.motion.set(part.motion.subarray(k * 4, k * 4 + 4), n * 4);
    n++;
  }
  mesh.count = n;
  work.full = false;
  if (n === 0) return;
  for (const a of attributes) {
    a.clearUpdateRanges();
    a.addUpdateRange(0, n * a.itemSize);
    a.needsUpdate = true;
  }
}

function PartMesh({
  part,
  materials,
  kit,
  visibility,
}: {
  part: PartInstances;
  materials: CharacterMaterials;
  kit: KitGeometries | null;
  visibility: { current: Visibility };
}) {
  const ref = useRef<InstancedMesh>(null);
  const { size } = useThree();
  // Blender kiti (public/models/karakter-kit.glb) bu parçanın şeklini veriyorsa o, yoksa koddaki şekil.
  const source = kit?.get(part.spec.id) ?? part.spec.geometry;
  // Kopya bilgisi kendi tamponlarında: kamera dışındakiler ayıklanınca görünenler başa toplanır, kaynak bozulmaz.
  const work = useMemo<PartWork>(() => ({ colors: Float32Array.from(part.colors), motion: Float32Array.from(part.motion), version: -1, full: true }), [part]);
  const geometry = useMemo(() => withMotionAttribute(source, work.motion), [source, work]);
  const { glow, legs, arms, rig } = part.spec;
  // Takipçi modellerinin kolları ve bacakları kendi iskeletlerinin eklemlerinden döner.
  const material: Material =
    rig === "takipci"
      ? glow
        ? arms
          ? materials.followerGlowArms
          : materials.followerGlow
        : legs
          ? materials.followerLegs
          : arms
            ? materials.followerArms
            : materials.followerTinted
      : glow
        ? arms
          ? materials.glowArms
          : materials.glow
        : legs
          ? materials.legs
          : arms
            ? materials.arms
            : materials.tinted;

  useEffect(() => () => geometry.dispose(), [geometry]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.instanceMatrix.array.set(part.matrices);
    mesh.instanceMatrix.needsUpdate = true;
    work.colors.set(part.colors);
    work.motion.set(part.motion);
    mesh.instanceColor = new InstancedBufferAttribute(work.colors, 3);
    mesh.count = part.count;
    work.version = -1;
    work.full = true;
    if (part.spec.shadow)
      mesh.customDepthMaterial =
        part.spec.rig === "takipci" ? (part.spec.arms ? materials.followerDepthArms : materials.followerDepth) : part.spec.arms ? materials.depthArms : materials.depth;
    mesh.computeBoundingSphere();
    // Gezinenler evlerinden biraz uzaklaşır: sınır küresi buna yer bıraksın.
    if (mesh.boundingSphere) mesh.boundingSphere.radius += 16;
    // Geometri değişince (Blender kiti geldi) InstancedMesh yeniden kurulur: kopya bilgisi yeniden yazılır.
  }, [part, materials, geometry, work]);

  useFrame(({ camera }) => {
    const mesh = ref.current;
    if (!mesh) return;
    if (!part.spec.core) {
      const zoom = worldZoomOf((camera as { zoom: number }).zoom, size);
      mesh.visible = part.spec.far ? zoom < SILHOUETTE_ZOOM : zoom >= (part.spec.detail ? DETAIL_ZOOM : SILHOUETTE_ZOOM);
    }
    if (!mesh.visible || work.version === visibility.current.version) return;
    work.version = visibility.current.version;
    compact(mesh, part, work, visibility.current);
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
  const kit = useKitModel();
  const data = useMemo(() => buildInstanceData(characters, placements, activeParticipantIds), [characters, placements, activeParticipantIds]);
  const hitRef = useRef<InstancedMesh>(null);
  const lastSync = useRef(Number.NEGATIVE_INFINITY);
  const visibility = useRef<Visibility>({ flags: new Uint8Array(0), version: 0, all: true });
  const cull = useMemo(() => ({ frustum: new Frustum(), matrix: new Matrix4(), sphere: new Sphere(), camera: new Matrix4(), zoom: 0, pending: true, since: CULL_EVERY }), []);

  // Veri değişince herkes görünür sayılır; ilk karede görüş alanı yeniden hesaplanır.
  useLayoutEffect(() => {
    visibility.current = { flags: new Uint8Array(data.ids.length).fill(1), version: visibility.current.version + 1, all: true };
    cull.pending = true;
  }, [data, cull]);

  useFrame(({ camera }) => {
    const zoom = (camera as { zoom: number }).zoom;
    if (!cull.camera.equals(camera.matrixWorld) || cull.zoom !== zoom) {
      cull.camera.copy(camera.matrixWorld);
      cull.zoom = zoom;
      cull.pending = true;
    }
    cull.since++;
    if (!cull.pending || cull.since < CULL_EVERY) return;
    cull.pending = false;
    cull.since = 0;
    cull.frustum.setFromProjectionMatrix(cull.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const { flags } = visibility.current;
    const m = data.matrices;
    let seen = 0;
    for (let i = 0; i < flags.length; i++) {
      const o = i * 16;
      const scale = m[o];
      cull.sphere.center.set(m[o + 12], m[o + 13] + 2.5 * scale, m[o + 14]);
      cull.sphere.radius = 3.5 * scale + CULL_MARGIN;
      const inside = cull.frustum.intersectsSphere(cull.sphere) ? 1 : 0;
      flags[i] = inside;
      seen += inside;
    }
    visibility.current = { flags, version: visibility.current.version + 1, all: seen > flags.length * 0.9 };
  });

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
        <PartMesh key={`${part.spec.id}:${part.count}`} part={part} materials={materials} kit={kit} visibility={visibility} />
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

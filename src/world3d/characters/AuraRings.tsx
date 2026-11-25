/**
 * Aura halkaları — destansı ve efsanevi karakterlerin ayaklarının altında nabız gibi atan ışık.
 * Alev ya da ışık aurası olanlarda halkanın rengi elemente göre değişir (turuncu / buz beyazı).
 * Halka karakterle birlikte yürür (aynı hareket hesabı), ama zıplamaz: ışık hep yerde kalır.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  InstancedBufferAttribute,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  RingGeometry,
  Vector3,
  type InstancedMesh,
} from "three";
import type { Character } from "../../types";
import type { CharacterPlacement } from "../living/placement";
import { auraColor, hasAura } from "./aura";
import { withCharacterMotion, type CharacterUniforms } from "./characterMaterials";

const RING = new RingGeometry(1.15, 1.75, 14).rotateX(-Math.PI / 2).translate(0, 0.12, 0);

interface AuraRingsProps {
  characters: readonly Character[];
  placements: ReadonlyMap<string, CharacterPlacement>;
  uniforms: CharacterUniforms;
}

export function AuraRings({ characters, placements, uniforms }: AuraRingsProps) {
  const ref = useRef<InstancedMesh>(null);
  const material = useMemo(
    () =>
      withCharacterMotion(
        new MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.6, blending: AdditiveBlending, depthWrite: false }),
        uniforms,
        { key: "aura", before: "transformed.xz *= 1.0 + 0.14 * sin( uTime * 2.4 + aMotion.y * 37.0 );" },
      ),
    [uniforms],
  );
  useEffect(() => () => material.dispose(), [material]);

  const glowing = useMemo(() => characters.filter((c) => hasAura(c) && placements.has(c.id)), [characters, placements]);

  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    for (const [name, attribute] of Object.entries(RING.attributes)) g.setAttribute(name, attribute);
    if (RING.index) g.setIndex(RING.index);
    const motion = new Float32Array(glowing.length * 4);
    glowing.forEach((c, i) => {
      const m = placements.get(c.id)!.motion;
      motion.set([m.radius, m.seed, m.yaw, m.cheer], i * 4);
    });
    g.setAttribute("aMotion", new InstancedBufferAttribute(motion, 4));
    return g;
  }, [glowing, placements]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new Matrix4();
    const position = new Vector3();
    const scale = new Vector3();
    const identity = new Quaternion();
    const colors = new Float32Array(glowing.length * 3);
    const color = new Color();
    glowing.forEach((c, i) => {
      const p = placements.get(c.id)!;
      position.set(p.home.x, p.groundY, p.home.y);
      mesh.setMatrixAt(i, matrix.compose(position, identity, scale.setScalar(p.scale)));
      color.set(auraColor(c)).toArray(colors, i * 3);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
    mesh.computeBoundingSphere();
    if (mesh.boundingSphere) mesh.boundingSphere.radius += 16;
  }, [glowing, placements, geometry]);

  if (glowing.length === 0) return null;
  return <instancedMesh key={glowing.length} ref={ref} args={[geometry, material, glowing.length]} raycast={() => null} />;
}

/**
 * KUT KAPISI — Kutada'nın ortasındaki portal. Obaya katılan her yeni yoldaş buradan gelir.
 *
 *   · Basamaklı taş meydan, kenarında parlayan run halkası ve sekiz runlu dikili taş.
 *   · Dikey taş halka; içinde altın, buz mavisi ve mor ışıkla dönen bir girdap (shader).
 *   · Halkanın çevresinde sarmal çizerek yükselen ışık kıvılcımları ve gökyüzüne uzanan soluk bir huzme.
 *   · Birkaç saniyede bir yerde yayılan ışık halkası: "biri daha geldi".
 * Gece bütün ışıklar güçlenir. Hareket azaltılınca girdap ve kıvılcımlar durur.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  CircleGeometry,
  DoubleSide,
  type InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshLambertMaterial,
  type Mesh,
  OctahedronGeometry,
  Quaternion,
  RingGeometry,
  ShaderMaterial,
  TorusGeometry,
  Vector3,
} from "three";
import { LANDMARKS } from "../content/sites";
import type { Terrain } from "../game/terrain";
import { box, cone, cylinder, merge, ring } from "./geometryKit";
import type { SkyRuntime } from "./living/sky";
import { foggedLambert } from "./materials";
import type { FogUniforms } from "./shaders/fog";
import { groundY } from "./worldScale";

const PLAZA = merge(cylinder(13, 13.6, 1.2, 16, { at: [0, 0.6, 0] }), cylinder(10, 10.6, 0.9, 16, { at: [0, 1.6, 0] }), cylinder(7, 7.4, 0.6, 12, { at: [0, 2.3, 0] }));
const RUNE_RING = merge(...ring(16, 11.8).map((p) => box(1.4, 0.12, 0.35, { at: [p.x, 1.24, p.z], ry: -p.angle + Math.PI / 2 })));
const MENHIR = merge(box(1.6, 7, 1.1, { at: [0, 3.5, 0] }), cone(1.1, 1.2, 4, { at: [0, 7.6, 0], ry: Math.PI / 4, scale: [1, 1, 0.7] }));
const MENHIR_RUNES = merge(box(0.7, 0.2, 0.08, { at: [0, 5.2, 0.58] }), box(0.18, 1.8, 0.08, { at: [0, 4, 0.58] }), box(0.6, 0.2, 0.08, { at: [0, 2.8, 0.58] }));
const PEDESTALS = merge(box(3.2, 3, 3.2, { at: [-7.4, 3.9, 0] }), box(3.2, 3, 3.2, { at: [7.4, 3.9, 0] }));
const GATE_RING = new TorusGeometry(7.2, 1.1, 6, 18).translate(0, 11.6, 0);
const GATE_KEYSTONE = merge(box(2.4, 2.4, 2.8, { at: [0, 19.3, 0] }), cone(1.2, 2, 4, { at: [0, 21.4, 0], ry: Math.PI / 4 }));
const VORTEX = new CircleGeometry(6.4, 32).translate(0, 11.6, 0);
const BEAM = cylinder(3.5, 6, 70, 12, { at: [0, 46, 0] });
const MOTE = new OctahedronGeometry(0.45, 0);
const PULSE = new RingGeometry(0.85, 1, 32).rotateX(-Math.PI / 2);
const MOTES = 28;
const PULSE_PERIOD = 5;
/** Kapının boyu: karakterlerin yaklaşık 4,5 katı (taş halka ≈ 39 birim). */
const PORTAL_SCALE = 1.7;

const VORTEX_VERTEX = /* glsl */ `
varying vec2 vLocal;
void main() {
  vLocal = position.xy - vec2(0.0, 11.6);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const VORTEX_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uPower;
varying vec2 vLocal;
void main() {
  vec2 p = vLocal / 6.4;
  float r = length(p);
  if (r > 1.0) discard;
  float a = atan(p.y, p.x);
  float swirl = sin(a * 3.0 + r * 11.0 - uTime * 2.6) * 0.5 + 0.5;
  float inner = sin(a * 5.0 - r * 7.0 + uTime * 1.7) * 0.5 + 0.5;
  vec3 gold = vec3(1.0, 0.82, 0.42);
  vec3 ice = vec3(0.45, 0.9, 1.0);
  vec3 violet = vec3(0.62, 0.45, 1.0);
  vec3 color = mix(ice, gold, swirl * (1.0 - r * 0.5));
  color = mix(color, violet, smoothstep(0.55, 1.0, r) * 0.65 + inner * 0.15);
  color *= 0.7 + 0.9 * (1.0 - r);
  float alpha = (0.5 + 0.5 * swirl) * smoothstep(1.0, 0.82, r);
  gl_FragColor = vec4(color * uPower, alpha);
}
`;

interface PortalProps {
  terrain: Terrain;
  fogUniforms: FogUniforms;
  animate: boolean;
  sky: SkyRuntime;
}

export function Portal({ terrain, fogUniforms, animate, sky }: PortalProps) {
  const center = LANDMARKS.kutKapisi;
  const baseY = groundY(terrain, center) - 0.4;

  const m = useMemo(
    () => ({
      stone: foggedLambert(fogUniforms, { color: "#b9b1a3" }),
      stoneDark: foggedLambert(fogUniforms, { color: "#857d70" }),
      rune: new MeshLambertMaterial({ color: "#8fe9ff", emissive: "#3fc6ff", emissiveIntensity: 0.8, flatShading: true }),
      mote: new MeshBasicMaterial({ color: "#ffe9a8", transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false }),
      beam: new MeshBasicMaterial({ color: "#9fe8ff", transparent: true, opacity: 0.08, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
      pulse: new MeshBasicMaterial({ color: "#bff3ff", transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
      vortex: new ShaderMaterial({
        vertexShader: VORTEX_VERTEX,
        fragmentShader: VORTEX_FRAGMENT,
        uniforms: { uTime: { value: 0 }, uPower: { value: 1.2 } },
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    }),
    [fogUniforms],
  );
  useEffect(() => () => Object.values(m).forEach((material) => material.dispose()), [m]);

  const menhirs = useMemo(() => ring(8, 16.5, Math.PI / 8), []);
  const motesRef = useRef<InstancedMesh>(null);
  const pulseRef = useRef<Mesh>(null);
  const work = useMemo(() => ({ matrix: new Matrix4(), q: new Quaternion(), p: new Vector3(), s: new Vector3(), axis: new Vector3(0, 1, 0) }), []);

  useFrame(({ clock }) => {
    const t = animate ? clock.elapsedTime : 0;
    const night = sky.lamp;
    m.vortex.uniforms.uTime.value = t;
    m.vortex.uniforms.uPower.value = 1.1 + night * 0.9;
    m.rune.emissiveIntensity = 0.8 + night * 2.4;
    m.beam.opacity = 0.05 + night * 0.12;
    // Işık kıvılcımları: halkanın çevresinde sarmal çizerek yükselir, tepede söner, dipten yeniden doğar.
    const motes = motesRef.current;
    if (motes) {
      const { matrix, q, p, s } = work;
      for (let i = 0; i < MOTES; i++) {
        const phase = (t * 0.16 + i / MOTES) % 1;
        const angle = i * 2.4 + t * 0.9;
        const radius = 9 - phase * 4;
        const size = Math.sin(phase * Math.PI) * 1.1 + 0.1;
        p.set(Math.cos(angle) * radius, 2.5 + phase * 22, Math.sin(angle) * radius * 0.6);
        q.setFromAxisAngle(work.axis, angle * 2);
        motes.setMatrixAt(i, matrix.compose(p, q, s.setScalar(size)));
      }
      motes.instanceMatrix.needsUpdate = true;
    }
    // Varış halkası: her PULSE_PERIOD saniyede bir meydandan dışarı yayılır.
    const pulse = pulseRef.current;
    if (pulse) {
      const k = animate ? (t % PULSE_PERIOD) / PULSE_PERIOD : 0.35;
      const radius = 4 + k * 26;
      pulse.scale.set(radius, 1, radius);
      m.pulse.opacity = (1 - k) * (0.35 + night * 0.4);
    }
  });

  return (
    <group position={[center.x, baseY, center.y]} scale={PORTAL_SCALE}>
      <mesh geometry={PLAZA} material={m.stone} castShadow receiveShadow />
      <mesh geometry={RUNE_RING} material={m.rune} />
      {menhirs.map((p, i) => (
        <group key={i} position={[p.x, 0.6, p.z]} rotation-y={-p.angle - Math.PI / 2}>
          <mesh geometry={MENHIR} material={m.stoneDark} castShadow />
          <mesh geometry={MENHIR_RUNES} material={m.rune} />
        </group>
      ))}
      <mesh geometry={PEDESTALS} material={m.stoneDark} castShadow receiveShadow />
      <mesh geometry={GATE_RING} material={m.stone} castShadow />
      <mesh geometry={GATE_KEYSTONE} material={m.stoneDark} castShadow />
      <mesh geometry={VORTEX} material={m.vortex} />
      <mesh geometry={BEAM} material={m.beam} />
      <instancedMesh ref={motesRef} args={[MOTE, m.mote, MOTES]} frustumCulled={false} />
      <mesh ref={pulseRef} geometry={PULSE} material={m.pulse} position-y={2.7} />
    </group>
  );
}

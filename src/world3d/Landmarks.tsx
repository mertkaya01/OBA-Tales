/**
 * Yapılar — hepsi kodla, basit geometrik parçalardan:
 *   oba çadırları · Akınburnu feneri · rüzgâr gülleri · iskele ve tekneler
 *   Günözü Tapınağı ve Günözü Taşı · Pusluada taş kemerleri · Kadim Kemer
 * (Oba ateşleri, şenlik ocağı ve anıtlar Settlements.tsx içinde.)
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import {
  AdditiveBlending,
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  MeshBasicMaterial,
  MeshLambertMaterial,
  OctahedronGeometry,
  type Group,
  type Mesh,
} from "three";
import type { Terrain } from "../game/terrain";
import type { Coordinates } from "../types";
import { InstancedParts, type InstanceTransform } from "./InstancedParts";
import type { SkyRuntime } from "./living/sky";
import { LANDMARKS, YURT_SIZE, boatPlacements, pierPlacement, yurtPlacements } from "./layout";
import { isHiddenAt, type LandVisibility } from "../game/visibility";
import { foggedLambert, pickByPosition } from "./materials";
import type { FogUniforms } from "./shaders/fog";
import { WATER_LEVEL, groundY } from "./worldScale";

// ── Geometriler (tabanları y=0) ─────────────────────────────────────

const YURT_WALL = new CylinderGeometry(3.2, 3.4, 2.6, 8).translate(0, 1.3, 0);
const YURT_BAND = new CylinderGeometry(3.47, 3.47, 0.45, 8).translate(0, 1.7, 0);
const YURT_ROOF = new ConeGeometry(3.9, 2.4, 8).translate(0, 2.6 + 1.2, 0);
const YURT_DOOR = new BoxGeometry(1.3, 1.7, 0.4).translate(0, 0.85, 3.3);
const ROOF_COLORS = ["#c4413a", "#3f6f8a", "#d9a12a", "#5a7f6b"];

const BEAM = new ConeGeometry(2.2, 28, 10, 1, true).rotateZ(Math.PI / 2).translate(14, 0, 0);
const BLADE = new BoxGeometry(0.55, 6, 0.15).translate(0, 3, 0);
const STONE_GEM = new OctahedronGeometry(2, 0);

type Materials = ReturnType<typeof createMaterials>;

function createMaterials(fog: FogUniforms) {
  return {
    felt: foggedLambert(fog, { color: "#efe6d4" }),
    kilim: foggedLambert(fog, { color: "#c4413a" }),
    tinted: foggedLambert(fog, { color: "#ffffff" }),
    // Gece kapı aralığından sıcak ışık sızar (emissiveIntensity gökyüzüne göre değişir).
    door: foggedLambert(fog, { color: "#5c4a2c", emissive: "#ffae47", emissiveIntensity: 0 }),
    stone: foggedLambert(fog, { color: "#a49c8e" }),
    stoneDark: foggedLambert(fog, { color: "#7d766b" }),
    wood: foggedLambert(fog, { color: "#7a4a26" }),
    white: foggedLambert(fog, { color: "#f3efe6" }),
    red: foggedLambert(fog, { color: "#b8332c" }),
    sail: foggedLambert(fog, { color: "#f1e9d2", side: DoubleSide }),
    glow: new MeshLambertMaterial({ color: "#ffd76a", emissive: "#ffb53d", emissiveIntensity: 1.2 }),
    gold: new MeshLambertMaterial({ color: "#f6d36f", emissive: "#e2a52a", emissiveIntensity: 0.9, flatShading: true }),
    beam: new MeshBasicMaterial({ color: "#fff1b8", transparent: true, opacity: 0.18, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
  };
}

interface LandmarksProps {
  terrain: Terrain;
  seed: number;
  fogUniforms: FogUniforms;
  animate: boolean;
  sky: SkyRuntime;
  /** Karartılı karadaki yapılar çizilmez; taş köprü iki yakası da açıksa görünür. */
  visibility: LandVisibility;
}

export function Landmarks({ terrain, seed, fogUniforms, animate, sky, visibility }: LandmarksProps) {
  const m = useMemo(() => createMaterials(fogUniforms), [fogUniforms]);
  useEffect(() => () => Object.values(m).forEach((material) => material.dispose()), [m]);

  const beamRef = useRef<Group>(null);
  const bladesRef = useRef<Group[]>([]);
  const gemRef = useRef<Mesh>(null);
  const boatsRef = useRef<Group[]>([]);

  useFrame(({ clock }, delta) => {
    // Akşam olunca: kapılar ışır, fener huzmesi ve kandiller güçlenir.
    m.door.emissiveIntensity = sky.lamp * 1.6;
    m.beam.opacity = 0.16 + sky.lamp * 0.3;
    m.glow.emissiveIntensity = 1.2 + sky.lamp * 1.2;
    if (!animate) return;
    const t = clock.elapsedTime;
    if (beamRef.current) beamRef.current.rotation.y += delta * 0.7;
    for (const blades of bladesRef.current) if (blades) blades.rotation.z += delta * 1.4;
    if (gemRef.current) {
      gemRef.current.rotation.y += delta * 0.8;
      gemRef.current.position.y = 10 + Math.sin(t * 1.5) * 0.5;
    }
    boatsRef.current.forEach((boat, i) => {
      if (!boat) return;
      boat.position.y = WATER_LEVEL + 0.15 + Math.sin(t * 1.3 + i) * 0.18;
      boat.rotation.z = Math.sin(t * 0.9 + i * 2) * 0.05;
    });
  });

  const at = (p: Coordinates, lift = 0): [number, number, number] => [p.x, groundY(terrain, p) + lift, p.y];
  const show = (p: Coordinates, reach = 0) => !isHiddenAt(terrain, visibility, p, reach);

  return (
    <group>
      <Yurts terrain={terrain} seed={seed} m={m} visibility={visibility} />

      {/* Akınburnu feneri: beyaz-kırmızı kule, sıcak kandil, dönen ışık huzmesi */}
      {show(LANDMARKS.fener) && (
        <group position={at(LANDMARKS.fener, -0.3)}>
          <mesh material={m.stone} position-y={0.8} castShadow receiveShadow>
            <cylinderGeometry args={[3, 3.4, 1.6, 8]} />
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} material={i % 2 === 0 ? m.white : m.red} position-y={1.6 + i * 2.6 + 1.3} castShadow>
              <cylinderGeometry args={[1.9 - (i + 1) * 0.12, 1.9 - i * 0.12, 2.6, 8]} />
            </mesh>
          ))}
          <mesh material={m.glow} position-y={12.8}>
            <cylinderGeometry args={[1.45, 1.45, 1.6, 8]} />
          </mesh>
          <mesh material={m.red} position-y={14.4} castShadow>
            <coneGeometry args={[1.9, 1.6, 8]} />
          </mesh>
          <group ref={beamRef} position-y={12.8}>
            <mesh geometry={BEAM} material={m.beam} />
          </group>
        </group>
      )}

      {/* Rüzgâr gülleri */}
      {LANDMARKS.ruzgarGulleri.map((p, i) => show(p) && (
        <group key={i} position={at(p, -0.2)}>
          <mesh material={m.wood} position-y={3.5} castShadow>
            <cylinderGeometry args={[0.9, 1.5, 7, 4]} />
          </mesh>
          <mesh material={m.red} position-y={7.6} castShadow>
            <coneGeometry args={[1.3, 1.4, 4]} />
          </mesh>
          <group
            ref={(el) => {
              if (el) bladesRef.current[i] = el;
            }}
            position={[0, 6.4, 1.1]}
          >
            {[0, 1, 2, 3].map((k) => (
              <mesh key={k} geometry={BLADE} material={m.sail} rotation-z={(k * Math.PI) / 2} castShadow />
            ))}
          </group>
        </group>
      ))}

      {/* Günözü Tapınağı: basamaklı taş platform, sütun halkası, ortada parlayan Günözü Taşı */}
      {show(LANDMARKS.tapinak) && (
        <group position={at(LANDMARKS.tapinak, -0.6)}>
          {[
            [26, 0.8],
            [19, 2.4],
            [12, 4.0],
          ].map(([size, y]) => (
            <mesh key={size} material={m.stone} position-y={y} castShadow receiveShadow>
              <boxGeometry args={[size, 1.6, size]} />
            </mesh>
          ))}
          {Array.from({ length: 8 }, (_, k) => {
            const a = (k / 8) * Math.PI * 2;
            return (
              <mesh key={k} material={m.white} position={[Math.cos(a) * 7.6, 6.2, Math.sin(a) * 7.6]} castShadow>
                <cylinderGeometry args={[0.75, 0.9, 6, 6]} />
              </mesh>
            );
          })}
          <mesh material={m.stoneDark} position-y={9.5} rotation-x={Math.PI / 2}>
            <torusGeometry args={[7.6, 0.45, 4, 16]} />
          </mesh>
          <mesh material={m.stoneDark} position-y={5.8} castShadow>
            <cylinderGeometry args={[1.6, 2, 2, 8]} />
          </mesh>
          <mesh ref={gemRef} geometry={STONE_GEM} material={m.gold} position-y={10} castShadow />
        </group>
      )}

      {/* Pusluada'nın taş kemerleri */}
      {LANDMARKS.kemerler.map((p, i) => show(p) && (
        <group key={i} position={at(p, -0.5)} rotation-y={[0, 0.9, -0.6][i]}>
          {[-3.2, 3.2].map((x) => (
            <mesh key={x} material={m.stoneDark} position={[x, 4, 0]} castShadow>
              <boxGeometry args={[1.8, 8, 1.8]} />
            </mesh>
          ))}
          <mesh material={m.stoneDark} position-y={8.6} castShadow>
            <boxGeometry args={[9, 1.6, 2.2]} />
          </mesh>
        </group>
      ))}

      {show(LANDMARKS.kadimKemer.from) && show(LANDMARKS.kadimKemer.to) && <Bridge terrain={terrain} m={m} span={LANDMARKS.kadimKemer} />}
      {show(LANDMARKS.batiKemer.from) && show(LANDMARKS.batiKemer.to) && <Bridge terrain={terrain} m={m} span={LANDMARKS.batiKemer} />}
      <PierAndBoats terrain={terrain} m={m} boatsRef={boatsRef} show={show} />
    </group>
  );
}

// ── Oba çadırları ──────────────────────────────────────────────────

function Yurts({ terrain, seed, m, visibility }: { terrain: Terrain; seed: number; m: Materials; visibility: LandVisibility }) {
  const parts = useMemo(() => {
    const placements = yurtPlacements(terrain, seed).filter((p) => !isHiddenAt(terrain, visibility, p));
    const base = placements.map<InstanceTransform>((p) => ({
      position: [p.x, groundY(terrain, p) - 0.3, p.y],
      rotationY: p.rotation,
      scale: p.scale * YURT_SIZE,
    }));
    return {
      base,
      roofs: base.map((b, i) => ({ ...b, color: pickByPosition(ROOF_COLORS, placements[i].x, placements[i].y) })),
    };
  }, [terrain, seed, visibility]);

  return (
    <group>
      <InstancedParts geometry={YURT_WALL} material={m.felt} items={parts.base} receiveShadow />
      <InstancedParts geometry={YURT_BAND} material={m.kilim} items={parts.base} />
      <InstancedParts geometry={YURT_ROOF} material={m.tinted} items={parts.roofs} />
      <InstancedParts geometry={YURT_DOOR} material={m.door} items={parts.base} />
    </group>
  );
}

// ── Taş köprüler (Kadim Kemer, Batı Kemeri) ────────────────────────────────────────────────────

function Bridge({ terrain, m, span }: { terrain: Terrain; m: Materials; span: { from: Coordinates; to: Coordinates } }) {
  const segments = useMemo(() => {
    const { from, to } = span;
    const y1 = groundY(terrain, from);
    const y2 = groundY(terrain, to);
    const count = 12;
    const deckY = (t: number) => y1 + (y2 - y1) * t + Math.sin(Math.PI * t) * 5 + 0.6;
    return Array.from({ length: count }, (_, i) => {
      const t0 = i / count;
      const t1 = (i + 1) / count;
      const x0 = from.x + (to.x - from.x) * t0;
      const x1 = from.x + (to.x - from.x) * t1;
      const yA = deckY(t0);
      const yB = deckY(t1);
      return {
        position: [(x0 + x1) / 2, (yA + yB) / 2, from.y] as [number, number, number],
        length: Math.hypot(x1 - x0, yB - yA) + 0.3,
        angle: Math.atan2(yB - yA, x1 - x0),
      };
    });
  }, [terrain, span]);

  return (
    <group>
      {segments.map((s, i) => (
        <mesh key={i} material={m.stone} position={s.position} rotation-z={s.angle} castShadow receiveShadow>
          <boxGeometry args={[s.length, 0.9, 4.4]} />
        </mesh>
      ))}
      {[4, 8].map((i) => (
        <mesh key={i} material={m.stoneDark} position={[segments[i].position[0], (segments[i].position[1] - 7) / 2, segments[i].position[2]]} castShadow>
          <boxGeometry args={[1.6, segments[i].position[1] + 7, 3.4]} />
        </mesh>
      ))}
    </group>
  );
}

// ── İskele ve tekneler ─────────────────────────────────────────────

function PierAndBoats({ terrain, m, boatsRef, show }: { terrain: Terrain; m: Materials; boatsRef: RefObject<Group[]>; show: (p: Coordinates, reach?: number) => boolean }) {
  const { pier, boats } = useMemo(() => ({ pier: pierPlacement(terrain), boats: boatPlacements(terrain) }), [terrain]);
  // İskele ve kayıklar kıyıdaki obanın; ada karartılıysa onlar da yok.
  if (!show(pier.start, 12)) return null;
  const length = pier.end.y - pier.start.y;
  const deckY = WATER_LEVEL + 1.3;

  return (
    <group>
      <mesh material={m.wood} position={[pier.start.x, deckY, pier.start.y + length / 2]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 0.4, length]} />
      </mesh>
      {Array.from({ length: Math.floor(length / 5) + 1 }, (_, i) =>
        [-1.5, 1.5].map((dx) => (
          <mesh key={`${i}-${dx}`} material={m.wood} position={[pier.start.x + dx, deckY - 2.5, pier.start.y + i * 5]}>
            <cylinderGeometry args={[0.25, 0.25, 5, 5]} />
          </mesh>
        )),
      )}
      {boats.map((b, i) => (
        <group
          key={i}
          ref={(el) => {
            if (el) boatsRef.current[i] = el;
          }}
          position={[b.x, WATER_LEVEL + 0.15, b.y]}
          rotation-y={i * 1.3}
        >
          <mesh material={m.wood} position-y={0.4} castShadow>
            <boxGeometry args={[2.4, 1.2, 5.4]} />
          </mesh>
          <mesh material={m.wood} position-y={3.2}>
            <cylinderGeometry args={[0.12, 0.12, 5, 4]} />
          </mesh>
          <mesh material={m.sail} position={[0, 3.6, -0.9]} castShadow>
            <boxGeometry args={[0.08, 3.2, 2.2]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

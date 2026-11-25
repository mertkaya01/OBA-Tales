/**
 * AKIN MEYDANI SAHNESİ — aktif bölümün meydanında tuğlar dalgalanır, boss'lu bölümde boss bekler.
 *
 *   Buzkıran Tekgöz: tek kocaman gözüyle şaşkın şaşkın etrafına bakan, göğsünde mavi buz çekirdeği
 *   nabız gibi atan hantal buz devi. Arada bir gözünü kırpar, kollarını sallar, omuzlarında buz sarkıtları.
 *   Diğer üç boss bossModels.tsx içinde (gölge gemisi, fırtına kurdu, kadim muhafız); hangisi aktif bölümdeyse o görünür.
 *
 * Her şey kodla, basit geometrik parçalardan; karakterler gibi sis ekini almaz.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { DoubleSide, MeshBasicMaterial, MeshLambertMaterial, type Group, type Mesh } from "three";
import type { Terrain } from "../../game/terrain";
import type { BossId, Coordinates } from "../../types";
import { groundY } from "../worldScale";
import { Ayazkurt, Karacay, KisgolgesiHan } from "./bossModels";
import { COLUMN_SPACING, type BattleRuntime, type RaidFormation } from "./raid";

interface RaidGroundProps {
  formation: RaidFormation;
  bossId: BossId | null;
  terrain: Terrain;
  animate: boolean;
  /** Canlı akın: oklar isabet edince boss irkilir. */
  battle?: BattleRuntime;
}

export function RaidGround({ formation, bossId, terrain, animate, battle }: RaidGroundProps) {
  const shakeRef = useRef<Group>(null);
  useFrame((_, delta) => {
    const group = shakeRef.current;
    if (!group || !battle) return;
    battle.flinch = Math.max(0, battle.flinch - delta);
    // İrkilme: kısa, küçük bir titreme (yalnızca hareket açıkken)
    const k = animate ? battle.flinch * 1.6 : 0;
    group.position.set(Math.sin(battle.flinch * 90) * k, 0, Math.cos(battle.flinch * 70) * k * 0.5);
  });
  const { ground, facing } = formation;
  const at = (p: Coordinates): [number, number, number] => [p.x, groundY(terrain, p), p.y];

  // Tuğlar saf düzeninin ön köşelerinde.
  const banners = useMemo(() => {
    const fx = Math.sin(facing);
    const fz = Math.cos(facing);
    let front = 0;
    let halfWidth = 0;
    for (const slot of formation.slots.values()) {
      const dx = slot.x - ground.square.x;
      const dz = slot.y - ground.square.y;
      front = Math.max(front, dx * fx + dz * fz);
      halfWidth = Math.max(halfWidth, Math.abs(dx * -fz + dz * fx));
    }
    halfWidth += COLUMN_SPACING;
    return [-1, 1].map((side) => ({
      x: ground.square.x + fx * front - fz * halfWidth * side,
      y: ground.square.y + fz * front + fx * halfWidth * side,
    }));
  }, [formation, facing, ground]);

  return (
    <group>
      {banners.map((p, i) => (
        <Banner key={i} position={at(p)} rotation={facing} animate={animate} phase={i * 1.7} />
      ))}
      {bossId && (
        // Boss akıncılara döner.
        <group position={at(ground.focus)} rotation-y={facing + Math.PI}>
          <group ref={shakeRef}>
            {bossId === "buzkiran_tekgoz" && <Tekgoz animate={animate} />}
            {bossId === "sisci_karacay" && <Karacay animate={animate} />}
            {bossId === "ayazkurt" && <Ayazkurt animate={animate} />}
            {bossId === "kisgolgesi_han" && <KisgolgesiHan animate={animate} />}
          </group>
        </group>
      )}
    </group>
  );
}

// ── Tuğ ────────────────────────────────────────────────────────────

function Banner({ position, rotation, animate, phase }: { position: [number, number, number]; rotation: number; animate: boolean; phase: number }) {
  const clothRef = useRef<Group>(null);
  const m = useMemo(
    () => ({
      pole: new MeshLambertMaterial({ color: "#6b4424", flatShading: true }),
      gold: new MeshLambertMaterial({ color: "#f6d36f", emissive: "#a8741c", emissiveIntensity: 0.6, flatShading: true }),
      hair: new MeshLambertMaterial({ color: "#3a2a26", flatShading: true }),
      cloth: new MeshLambertMaterial({ color: "#c4413a", side: DoubleSide, flatShading: true }),
      sun: new MeshLambertMaterial({ color: "#f6d36f", side: DoubleSide, flatShading: true }),
    }),
    [],
  );
  useEffect(() => () => Object.values(m).forEach((material) => material.dispose()), [m]);

  useFrame(({ clock }) => {
    if (!animate || !clothRef.current) return;
    clothRef.current.rotation.y = Math.sin(clock.elapsedTime * 2.1 + phase) * 0.35;
  });

  return (
    <group position={position} rotation-y={rotation}>
      <mesh material={m.pole} position-y={6.5} castShadow>
        <cylinderGeometry args={[0.28, 0.34, 13, 6]} />
      </mesh>
      <mesh material={m.gold} position-y={13.6}>
        <coneGeometry args={[0.55, 1.6, 4]} />
      </mesh>
      <mesh material={m.hair} position-y={11.9}>
        <coneGeometry args={[0.95, 2.2, 7]} />
      </mesh>
      <group ref={clothRef} position-y={10.3}>
        <mesh material={m.cloth} position={[2.1, -1.4, 0]} castShadow>
          <boxGeometry args={[4.2, 2.8, 0.12]} />
        </mesh>
        <mesh material={m.sun} position={[2.1, -1.4, 0.08]}>
          <circleGeometry args={[0.75, 8]} />
        </mesh>
      </group>
    </group>
  );
}

// ── Buzkıran Tekgöz ────────────────────────────────────────────────

function Tekgoz({ animate }: { animate: boolean }) {
  const bodyRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const eyeRef = useRef<Group>(null);
  const pupilRef = useRef<Mesh>(null);
  const coreRef = useRef<Mesh>(null);

  const m = useMemo(
    () => ({
      ice: new MeshLambertMaterial({ color: "#a9d4ee", flatShading: true }),
      deep: new MeshLambertMaterial({ color: "#6fa8cf", flatShading: true }),
      frost: new MeshLambertMaterial({ color: "#eaf6ff", flatShading: true }),
      eye: new MeshBasicMaterial({ color: "#fbf7ef" }),
      pupil: new MeshBasicMaterial({ color: "#1b2a4a" }),
      core: new MeshBasicMaterial({ color: "#59c2ff" }),
    }),
    [],
  );
  useEffect(() => () => Object.values(m).forEach((material) => material.dispose()), [m]);

  useFrame(({ clock }) => {
    if (!animate) return;
    const t = clock.elapsedTime;
    if (bodyRef.current) {
      bodyRef.current.rotation.z = Math.sin(t * 0.6) * 0.035;
      bodyRef.current.position.y = Math.sin(t * 1.2) * 0.25;
    }
    if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(t * 0.9) * 0.14;
    if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(t * 0.9 + 2.2) * 0.14;
    // Şaşkın bakış: göz bebeği bir sağa bir sola, arada bir göz kırpma.
    if (pupilRef.current) pupilRef.current.position.set(Math.sin(t * 0.7) * 0.75, Math.cos(t * 0.45) * 0.35, 0.2);
    if (eyeRef.current) eyeRef.current.scale.y = t % 4.3 < 0.16 ? 0.12 : 1;
    if (coreRef.current) {
      coreRef.current.scale.setScalar(1 + Math.sin(t * 2.4) * 0.14);
      coreRef.current.rotation.y = t * 0.8;
    }
  });

  return (
    <group>
      {/* Bacaklar */}
      {[-2.7, 2.7].map((x) => (
        <mesh key={x} material={m.deep} position={[x, 3, 0]} castShadow>
          <boxGeometry args={[3.3, 6, 3.4]} />
        </mesh>
      ))}
      <group ref={bodyRef}>
        {/* Gövde: yontulmuş buz kütlesi */}
        <mesh material={m.ice} position-y={11} scale={[1, 1.12, 0.8]} castShadow>
          <icosahedronGeometry args={[6.4, 0]} />
        </mesh>
        {/* Göğüsteki mavi buz çekirdeği (zayıf noktası) */}
        <mesh ref={coreRef} material={m.core} position={[0, 12, 4.7]}>
          <octahedronGeometry args={[1.35, 0]} />
        </mesh>
        {/* Kafa ve tek kocaman göz */}
        <mesh material={m.ice} position-y={19.2} castShadow>
          <boxGeometry args={[7, 6, 6]} />
        </mesh>
        <group ref={eyeRef} position={[0, 19.6, 3.02]}>
          <mesh material={m.eye} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[2.1, 2.1, 0.3, 12]} />
          </mesh>
          <mesh ref={pupilRef} material={m.pupil} rotation-x={Math.PI / 2} position-z={0.2}>
            <cylinderGeometry args={[0.95, 0.95, 0.3, 10]} />
          </mesh>
        </group>
        {/* Bir kaşı havada: şaşkın */}
        <mesh material={m.deep} position={[-1.4, 22.5, 3.1]} rotation-z={0.35}>
          <boxGeometry args={[2.8, 0.7, 0.9]} />
        </mesh>
        <mesh material={m.deep} position={[1.5, 22.0, 3.1]} rotation-z={-0.12}>
          <boxGeometry args={[2.6, 0.7, 0.9]} />
        </mesh>
        {/* Kollar: omuzdan sarkar, hafifçe sallanır */}
        {[
          { ref: leftArmRef, x: -7.3, tilt: 0.12 },
          { ref: rightArmRef, x: 7.3, tilt: -0.12 },
        ].map(({ ref, x, tilt }) => (
          <group key={x} ref={ref} position={[x, 15.5, 0]} rotation-z={tilt}>
            <mesh material={m.ice} position-y={-4.6} castShadow>
              <boxGeometry args={[2.9, 9.2, 2.9]} />
            </mesh>
            <mesh material={m.deep} position-y={-9.8}>
              <icosahedronGeometry args={[2, 0]} />
            </mesh>
          </group>
        ))}
        {/* Omuz ve sırttaki buz sarkıtları */}
        {[
          [-5.5, 17.5, -1, -0.5],
          [-3.5, 18.2, -2.6, -0.2],
          [4.8, 17.8, -1.5, 0.45],
          [2.2, 23.6, -1.2, 0.1],
          [0, 16, -4.8, 0],
        ].map(([x, y, z, rz], i) => (
          <mesh key={i} material={m.frost} position={[x, y, z]} rotation={[-0.4, 0, rz]} castShadow>
            <coneGeometry args={[1.1, 4.2, 5]} />
          </mesh>
        ))}
      </group>
      {/* Ayak dibinde yuvarladığı buz kütleleri */}
      {[
        [7, 1.6, 6, 2.2],
        [-8.5, 1.2, 4, 1.7],
        [4, 1, 10, 1.3],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} material={m.frost} position={[x, y, z]} castShadow>
          <dodecahedronGeometry args={[r, 0]} />
        </mesh>
      ))}
    </group>
  );
}


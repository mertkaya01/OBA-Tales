/**
 * CANLI AKIN — akın meydanında süren, çocuk dostu 3D savaş döngüsü. Kimse yaralanmaz: boss irkilir ve sakinleşir.
 *
 *   Buz Oku     arka saftaki Okyeliler boss'un çekirdeğine kavisli oklar atar; isabet eden ok buz kıvılcımı saçar,
 *               boss irkilir
 *   Ocak ışığı  ortadaki Ocakcanlar boss'a süzülen sıcak ışık küreleri gönderir; çekirdekte turuncu bir parıltı açılır
 *   Ayaz dalgası boss yerden bir buz halkası yayar; halka ön saftaki Kalkanerilerin parlayan kalkan duvarında durur
 *
 * Her şey önceden ayrılmış küçük havuzlardan (InstancedMesh) çizilir; döngü yalnızca kamera meydana yakınken döner.
 * İzleme modunda (BattleRuntime.intense) hamleler daha sık gelir.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BoxGeometry,
  ConeGeometry,
  DoubleSide,
  IcosahedronGeometry,
  Matrix4,
  MeshBasicMaterial,
  OctahedronGeometry,
  Quaternion,
  Vector3,
  type InstancedMesh,
  type Mesh,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Terrain } from "../../game/terrain";
import type { BossId, Character, ClassId } from "../../types";
import { groundY, worldZoomOf } from "../worldScale";
import { BOSS_CORE_HEIGHT, type BattleRuntime, type RaidFormation } from "./raid";

const ARROWS = 28;
const SPARKS = 90;
const ORBS = 12;
/** Bu dünya yakınlığının altında döngü durur (uzaktan görünmez). */
const MIN_ZOOM = 2.2;

// Buz Oku: +z yönünde uzanır (sap, buz ucu, tüy). Piksel hattında kaybolmasın diye kalın ve parlak.
const ARROW = mergeGeometries([
  new BoxGeometry(0.45, 0.45, 4.2).toNonIndexed(),
  new ConeGeometry(0.8, 1.6, 4).rotateX(Math.PI / 2).translate(0, 0, 2.9).toNonIndexed(),
  new BoxGeometry(0.15, 1.1, 1.2).translate(0, 0, -1.8).toNonIndexed(),
])!;
const SPARK = new OctahedronGeometry(0.7, 0);
const ORB = new IcosahedronGeometry(1.1, 0);

interface Arrow {
  from: Vector3;
  to: Vector3;
  age: number;
  duration: number;
  arc: number;
  delay: number;
}
interface Spark {
  pos: Vector3;
  vel: Vector3;
  age: number;
  life: number;
}
interface Orb {
  from: Vector3;
  to: Vector3;
  age: number;
  duration: number;
  delay: number;
}

interface RaidBattleProps {
  formation: RaidFormation;
  bossId: BossId;
  characterById: ReadonlyMap<string, Character>;
  terrain: Terrain;
  battle: BattleRuntime;
  animate: boolean;
}

export function RaidBattle({ formation, bossId, characterById, terrain, battle, animate }: RaidBattleProps) {
  const { size } = useThree();
  const arrowsRef = useRef<InstancedMesh>(null);
  const sparksRef = useRef<InstancedMesh>(null);
  const orbsRef = useRef<InstancedMesh>(null);
  const novaRef = useRef<Mesh>(null);
  const wallRef = useRef<Mesh>(null);
  const flashRef = useRef<Mesh>(null);

  const m = useMemo(
    () => ({
      arrow: new MeshBasicMaterial({ color: "#9fe0ff" }),
      spark: new MeshBasicMaterial({ color: "#dff6ff" }),
      orb: new MeshBasicMaterial({ color: "#ffb45c", transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false }),
      nova: new MeshBasicMaterial({ color: "#bfe9ff", transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
      wall: new MeshBasicMaterial({ color: "#5fb8f0", transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
      flash: new MeshBasicMaterial({ color: "#ffc970", transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }),
    }),
    [],
  );
  useEffect(() => () => Object.values(m).forEach((material) => material.dispose()), [m]);

  // Meydanın geometrisi: saflar sınıfa göre, ön çizgi, boss'un hedef noktası.
  const layout = useMemo(() => {
    const byClass: Record<ClassId, Vector3[]> = { kalkaneri: [], okyeli: [], ocakcan: [] };
    for (const [id, slot] of formation.slots) {
      const c = characterById.get(id);
      if (!c) continue;
      byClass[c.class.id].push(new Vector3(slot.x, groundY(terrain, slot), slot.y));
    }
    const fx = Math.sin(formation.facing);
    const fz = Math.cos(formation.facing);
    const { square, focus } = formation.ground;
    let front = 0;
    let halfWidth = 0;
    for (const slot of formation.slots.values()) {
      const dx = slot.x - square.x;
      const dz = slot.y - square.y;
      front = Math.max(front, dx * fx + dz * fz);
      halfWidth = Math.max(halfWidth, Math.abs(-dx * fz + dz * fx));
    }
    const wallCenter = { x: square.x + fx * (front + 3), y: square.y + fz * (front + 3) };
    const focusY = groundY(terrain, focus);
    return {
      byClass,
      core: new Vector3(focus.x, focusY + BOSS_CORE_HEIGHT[bossId], focus.y),
      focus: new Vector3(focus.x, focusY + 0.4, focus.y),
      wall: new Vector3(wallCenter.x, groundY(terrain, wallCenter) + 3.5, wallCenter.y),
      wallWidth: halfWidth * 2 + 6,
      // Halka boss'tan kalkan duvarına kadar yayılır.
      reach: Math.max(6, Math.hypot(wallCenter.x - focus.x, wallCenter.y - focus.y)),
      facing: formation.facing,
    };
  }, [formation, characterById, terrain, bossId]);

  const sim = useRef({ arrows: [] as Arrow[], sparks: [] as Spark[], orbs: [] as Orb[], volley: 1.5, warmth: 3.5, nova: 6, novaAge: -1, wallAge: -1, flashAge: -1 });

  useFrame(({ camera }, rawDelta) => {
    const s = sim.current;
    const near = worldZoomOf((camera as { zoom: number }).zoom, size) >= MIN_ZOOM;
    const active = animate && near;
    const delta = Math.min(rawDelta, 0.1);
    const pace = battle.intense ? 1.7 : 1;
    const pick = (list: Vector3[], n: number) => Array.from({ length: Math.min(n, list.length) }, () => list[Math.floor(Math.random() * list.length)]);

    if (active) {
      s.volley -= delta * pace;
      s.warmth -= delta * pace;
      s.nova -= delta * pace;
      // Buz Oku yağmuru
      if (s.volley <= 0) {
        s.volley = 5.5;
        pick(layout.byClass.okyeli, 10).forEach((archer, i) => {
          if (s.arrows.length >= ARROWS) return;
          const from = archer.clone().add(new Vector3(0, 5.5, 0));
          const to = layout.core.clone().add(new Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2));
          s.arrows.push({ from, to, age: 0, duration: 1 + Math.random() * 0.3, arc: from.distanceTo(to) * 0.22, delay: i * 0.08 });
        });
      }
      // Ocak ışığı
      if (s.warmth <= 0) {
        s.warmth = 7;
        pick(layout.byClass.ocakcan, 4).forEach((healer, i) => {
          if (s.orbs.length >= ORBS) return;
          s.orbs.push({ from: healer.clone().add(new Vector3(0, 4.5, 0)), to: layout.core.clone(), age: 0, duration: 1.8, delay: i * 0.25 });
        });
      }
      // Ayaz dalgası → kalkan duvarı
      if (s.nova <= 0) {
        s.nova = 10;
        s.novaAge = 0;
      }
    }

    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    const position = new Vector3();
    const forward = new Vector3(0, 0, 1);
    const up = new Vector3(0, 1, 0);

    // Oklar
    const arrows = arrowsRef.current;
    if (arrows) {
      let n = 0;
      s.arrows = s.arrows.filter((a) => {
        if (a.delay > 0) {
          a.delay -= delta;
          return true;
        }
        a.age += delta;
        const u = a.age / a.duration;
        if (u >= 1) {
          // İsabet: buz kıvılcımları ve irkilme
          for (let k = 0; k < 4 && s.sparks.length < SPARKS; k++) {
            s.sparks.push({ pos: a.to.clone(), vel: new Vector3((Math.random() - 0.5) * 10, Math.random() * 8, (Math.random() - 0.5) * 10), age: 0, life: 0.5 + Math.random() * 0.3 });
          }
          battle.flinch = Math.max(battle.flinch, 0.25);
          return false;
        }
        const at = (v: number) => new Vector3().lerpVectors(a.from, a.to, v).add(new Vector3(0, Math.sin(Math.PI * v) * a.arc, 0));
        position.copy(at(u));
        const ahead = at(Math.min(1, u + 0.02)).sub(position).normalize();
        quaternion.setFromUnitVectors(forward, ahead);
        arrows.setMatrixAt(n++, matrix.compose(position, quaternion, scale.setScalar(1)));
        return true;
      });
      arrows.count = n;
      arrows.instanceMatrix.needsUpdate = true;
    }

    // Kıvılcımlar
    const sparks = sparksRef.current;
    if (sparks) {
      let n = 0;
      s.sparks = s.sparks.filter((p) => {
        p.age += delta;
        if (p.age >= p.life) return false;
        p.vel.y -= 18 * delta;
        p.pos.addScaledVector(p.vel, delta);
        quaternion.identity();
        sparks.setMatrixAt(n++, matrix.compose(p.pos, quaternion, scale.setScalar(1 - p.age / p.life)));
        return true;
      });
      sparks.count = n;
      sparks.instanceMatrix.needsUpdate = true;
    }

    // Ocak ışıkları
    const orbs = orbsRef.current;
    if (orbs) {
      let n = 0;
      s.orbs = s.orbs.filter((o) => {
        if (o.delay > 0) {
          o.delay -= delta;
          return true;
        }
        o.age += delta;
        const u = o.age / o.duration;
        if (u >= 1) {
          s.flashAge = 0;
          battle.flinch = Math.max(battle.flinch, 0.15);
          return false;
        }
        position.lerpVectors(o.from, o.to, u * u * (3 - 2 * u));
        position.y += Math.sin(Math.PI * u) * 7 + Math.sin(o.age * 9) * 0.3;
        quaternion.setFromAxisAngle(up, o.age * 3);
        orbs.setMatrixAt(n++, matrix.compose(position, quaternion, scale.setScalar(0.8 + Math.sin(o.age * 12) * 0.15)));
        return true;
      });
      orbs.count = n;
      orbs.instanceMatrix.needsUpdate = true;
    }

    // Ayaz dalgası ve kalkan duvarı
    const nova = novaRef.current;
    if (nova) {
      if (s.novaAge >= 0) {
        s.novaAge += delta;
        const u = Math.min(1, s.novaAge / 1.3);
        const radius = 2 + (layout.reach - 2) * u;
        nova.scale.set(radius, radius, radius);
        m.nova.opacity = 0.85 * (1 - u * 0.6);
        if (u >= 1) {
          s.novaAge = -1;
          s.wallAge = 0;
        }
      } else m.nova.opacity = 0;
      nova.visible = m.nova.opacity > 0.01;
    }
    const wall = wallRef.current;
    if (wall) {
      if (s.wallAge >= 0) {
        s.wallAge += delta;
        const u = s.wallAge / 1;
        m.wall.opacity = u < 0.15 ? (u / 0.15) * 0.45 : 0.45 * Math.max(0, 1 - (u - 0.15) / 0.85);
        if (u >= 1) s.wallAge = -1;
      } else m.wall.opacity = 0;
      wall.visible = m.wall.opacity > 0.01;
    }
    const flash = flashRef.current;
    if (flash) {
      if (s.flashAge >= 0) {
        s.flashAge += delta;
        const u = s.flashAge / 0.6;
        flash.scale.setScalar(1 + u * 3);
        m.flash.opacity = 0.8 * (1 - u);
        if (u >= 1) s.flashAge = -1;
      } else m.flash.opacity = 0;
      flash.visible = m.flash.opacity > 0.01;
    }
  });

  return (
    <group>
      <instancedMesh ref={arrowsRef} args={[ARROW, m.arrow, ARROWS]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={sparksRef} args={[SPARK, m.spark, SPARKS]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={orbsRef} args={[ORB, m.orb, ORBS]} frustumCulled={false} raycast={() => null} />
      <mesh ref={novaRef} position={layout.focus} rotation-x={-Math.PI / 2} material={m.nova} visible={false} raycast={() => null}>
        <ringGeometry args={[0.82, 1, 40]} />
      </mesh>
      <mesh ref={wallRef} position={layout.wall} rotation-y={layout.facing} material={m.wall} visible={false} raycast={() => null}>
        <boxGeometry args={[layout.wallWidth, 7, 0.3]} />
      </mesh>
      <mesh ref={flashRef} position={layout.core} material={m.flash} visible={false} raycast={() => null}>
        <icosahedronGeometry args={[1.4, 1]} />
      </mesh>
    </group>
  );
}


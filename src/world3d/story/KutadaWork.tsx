/**
 * KUTADA'NIN İŞ YERLERİ SAHNEDE — koru, çalılar, ot öbekleri, büyüyen istif, ateş başı oturakları, ot kurutma
 * sehpası ve uyuyan kahramanların çadırlarının üstündeki "Zzz"ler.
 *
 *   · Hepsi o günün planından okunur (worldMarks.ts): ağaç baltayla sarsılır, devrilir, yarılır, kütük kalır;
 *     her vuruşta yongalar sıçrar; istif büyür; çalının meyvesi azalır.
 *   · Kahraman henüz gelmemişse koru, çalılar ve oturaklar yine yerinde durur (oba boş görünmesin).
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  NearestFilter,
  Object3D,
  OctahedronGeometry,
  SpriteMaterial,
  type Group,
  type Mesh,
  type Sprite,
} from "three";
import { ARRIVAL_ORDER, type ArrivalHeroId } from "../../content/story";
import type { CharacterPlacement } from "../living/placement";
import { merge } from "../geometryKit";
import { YURT_SIZE } from "../layout";
import { groundY } from "../worldScale";
import type { HeroWorld } from "./AnimatedHero";
import { dayPlan, type DayPlan } from "./daySchedule";
import { yawTo } from "./kutadaSites";
import { impactBetween, pickedFruit, stackCountAt, treeStateAt } from "./worldMarks";

const TREE_SIZE = 1.35;
const TRUNK = new CylinderGeometry(0.32, 0.5, 2.2, 5).translate(0, 1.1, 0);
const LEAVES = merge(
  new IcosahedronGeometry(2.2, 0).translate(0, 3.6, 0),
  new IcosahedronGeometry(1.6, 0).translate(1.35, 3.1, 0.4),
  new IcosahedronGeometry(1.5, 0).translate(-1.15, 3.35, -0.6),
  new IcosahedronGeometry(1.3, 0).translate(0.2, 4.95, 0.1),
);
const STUMP = new CylinderGeometry(0.42, 0.55, 0.6, 6).translate(0, 0.3, 0);
const STUMP_TOP = new CylinderGeometry(0.42, 0.42, 0.05, 6).translate(0, 0.62, 0);
const LOG = new CylinderGeometry(0.24, 0.24, 2.0, 6).rotateZ(Math.PI / 2);
const SEAT = new CylinderGeometry(0.82, 0.88, 3.2, 7).rotateZ(Math.PI / 2).translate(0, 0.84, 0);
const BUSH = merge(
  new IcosahedronGeometry(1.25, 0).translate(0, 1.0, 0),
  new IcosahedronGeometry(0.95, 0).translate(0.9, 0.75, 0.3),
  new IcosahedronGeometry(0.9, 0).translate(-0.8, 0.8, -0.35),
);
const BERRY = new BoxGeometry(0.26, 0.26, 0.26);
const TUFT = merge(
  new ConeGeometry(0.22, 1.2, 4).translate(0, 0.6, 0),
  new ConeGeometry(0.2, 1.0, 4).translate(0.35, 0.5, 0.15),
  new ConeGeometry(0.2, 1.05, 4).translate(-0.3, 0.52, -0.2),
);
const FLOWER = new OctahedronGeometry(0.2, 0);
const POST = new CylinderGeometry(0.12, 0.15, 3.6, 5).translate(0, 1.8, 0);
const BAR = new CylinderGeometry(0.09, 0.09, 4.0, 5).rotateZ(Math.PI / 2).translate(0, 3.4, 0);
const HANGING = new ConeGeometry(0.28, 1.0, 5).rotateX(Math.PI).translate(0, 2.75, 0);
const CHIP = new BoxGeometry(0.22, 0.12, 0.16);

const BERRIES_PER_BUSH = 7;
const FLOWERS_PER_HERB = 3;
const CHIP_COUNT = 24;
const CHIP_LIFE = 0.55;
const STACK_SLOTS = (() => {
  const slots: [number, number, number][] = [];
  for (const offset of [-1.15, 1.15]) {
    for (let layer = 0; layer < 6; layer++) {
      for (let k = 0; k < 6 - layer; k++) slots.push([offset, 0.24 + layer * 0.42, (k - (5 - layer) / 2) * 0.5]);
    }
  }
  // Önce iki yığının alt sıraları dolsun: yüksekliğe göre sırala.
  return slots.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
})();

const lambert = (color: string) => new MeshLambertMaterial({ color, flatShading: true });

const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

function zTexture(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const g = canvas.getContext("2d");
  if (!g) return null;
  g.font = "bold 26px monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = 5;
  g.strokeStyle = "#0d1b2e";
  g.strokeText("Z", 16, 17);
  g.fillStyle = "#e8f1ff";
  g.fillText("Z", 16, 17);
  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  return texture;
}

interface KutadaWorkProps {
  world: HeroWorld;
  heroes: readonly ArrivalHeroId[];
  placements: ReadonlyMap<string, CharacterPlacement>;
}

export function KutadaWork({ world, heroes, placements }: KutadaWorkProps) {
  const { sites, terrain, story } = world;
  const m = useMemo(
    () => ({
      trunk: lambert("#6b4a2e"),
      leaves: [lambert("#5f8f4a"), lambert("#6fa055"), lambert("#7aa860")],
      stumpTop: lambert("#d4ae74"),
      log: lambert("#7a5232"),
      seat: lambert("#6e4b2c"),
      bush: lambert("#3f6d3a"),
      berry: lambert("#c23a4e"),
      tuft: lambert("#6f9e48"),
      flower: [lambert("#8e6ad8"), lambert("#e5c348")],
      rack: lambert("#8a6240"),
      hanging: [lambert("#6c9a4b"), lambert("#b9a35a")],
      chip: lambert("#d8b07a"),
    }),
    [],
  );
  useEffect(
    () => () => {
      for (const v of Object.values(m)) (Array.isArray(v) ? v : [v]).forEach((x) => x.dispose());
    },
    [m],
  );
  // Her "Z" kendi saydamlığıyla söner: kahraman başına üç malzeme, tek doku.
  const zMaterials = useMemo(() => {
    const map = zTexture();
    return map ? ARRIVAL_ORDER.map(() => [0, 1, 2].map(() => new SpriteMaterial({ map, transparent: true, depthWrite: false }))) : null;
  }, []);
  useEffect(
    () => () => {
      zMaterials?.[0]?.[0]?.map?.dispose();
      zMaterials?.flat().forEach((z) => z.dispose());
    },
    [zMaterials],
  );

  const ground = (p: { x: number; y: number }) => groundY(terrain, p);

  const treeRefs = useRef<{ outer: Group | null; tilt: Group | null; stump: Group | null; bundles: (Group | null)[] }[]>([]);
  const berryRefs = useRef<(Mesh | null)[][]>([]);
  const flowerRefs = useRef<(Mesh | null)[][]>([]);
  const stackRef = useRef<InstancedMesh>(null);
  const chipRef = useRef<InstancedMesh>(null);
  const zRefs = useRef<(Sprite | null)[][]>([]);
  const chips = useMemo(() => Array.from({ length: CHIP_COUNT }, () => ({ born: -1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 })), []);
  const scratch = useMemo(() => ({ obj: new Object3D(), matrix: new Matrix4(), last: Number.NaN, nextChip: 0, yesterday: null as { day: number; plan: DayPlan } | null }), []);

  // İstif kütükleri yerleşik: yalnızca kaç tanesinin çizileceği değişir.
  useEffect(() => {
    const mesh = stackRef.current;
    if (!mesh) return;
    const { obj } = scratch;
    STACK_SLOTS.forEach(([x, y, z], i) => {
      obj.position.set(x, y, z);
      obj.rotation.set(0, (hash(i) - 0.5) * 0.12, 0);
      obj.updateMatrix();
      mesh.setMatrixAt(i, obj.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = 0;
  }, [scratch]);

  useFrame(() => {
    const seconds = story.seconds;
    const dsec = Number.isNaN(scratch.last) ? 0 : Math.max(0, Math.min(0.2, seconds - scratch.last));
    scratch.last = seconds;
    const today = world.plan();
    if (!scratch.yesterday || scratch.yesterday.day !== story.day - 1) scratch.yesterday = { day: story.day - 1, plan: dayPlan(sites, heroes, story.day - 1) };
    const yesterday = scratch.yesterday.plan;

    // Ağaçlar.
    sites.trees.forEach((_, i) => {
      const r = treeRefs.current[i];
      if (!r?.outer || !r.tilt || !r.stump) return;
      const st = treeStateAt(today, yesterday, i, seconds);
      const standing = st.kind === "ayakta" || st.kind === "devriliyor" || st.kind === "yatik" || st.kind === "fidan";
      r.tilt.visible = standing;
      r.tilt.rotation.x = st.fall * (Math.PI / 2 - 0.08) + st.shake * 0.07;
      r.tilt.rotation.z = st.shake * 0.04 * Math.sin(seconds * 40);
      r.outer.scale.setScalar(st.kind === "fidan" ? st.grow : 1);
      r.stump.visible = st.kind === "kutuk" || st.kind === "yatik" || st.kind === "devriliyor";
      r.bundles.forEach((b, k) => {
        if (b) b.visible = st.kind === "kutuk" && k < st.bundles;
      });
    });

    // Yongalar: baltanın indiği anda gövdeden (ya da yarılan kütükten) sıçrar.
    for (const chop of today.chops) {
      const tree = sites.trees[chop.tree];
      let from: { x: number; y: number; h: number } | null = null;
      if (seconds >= chop.start && seconds < chop.fall && impactBetween(seconds - chop.start, dsec)) from = { x: tree.trunk.x, y: tree.trunk.y, h: 1.6 };
      else if (seconds >= chop.splitStart && seconds < chop.splitEnd && impactBetween(seconds - chop.splitStart, dsec)) from = { x: tree.logs.x, y: tree.logs.y, h: 0.6 };
      if (!from) continue;
      const toward = tree.spot.yaw + Math.PI;
      for (let k = 0; k < 5; k++) {
        const c = chips[scratch.nextChip++ % CHIP_COUNT];
        const spread = toward + (Math.random() - 0.5) * 1.8;
        const speed = 3 + Math.random() * 3;
        c.born = seconds;
        c.x = from.x;
        c.z = from.y;
        c.y = ground(from) + from.h;
        c.vx = Math.sin(spread) * speed * -0.6;
        c.vz = Math.cos(spread) * speed * -0.6;
        c.vy = 4 + Math.random() * 3;
      }
    }
    const chipMesh = chipRef.current;
    if (chipMesh) {
      const { obj } = scratch;
      chips.forEach((c, i) => {
        const age = seconds - c.born;
        if (c.born < 0 || age < 0 || age > CHIP_LIFE) {
          obj.scale.setScalar(0);
        } else {
          obj.position.set(c.x + c.vx * age, c.y + c.vy * age - 9 * age * age, c.z + c.vz * age);
          obj.rotation.set(age * 12, age * 9, 0);
          obj.scale.setScalar(1 - age / CHIP_LIFE);
        }
        obj.updateMatrix();
        chipMesh.setMatrixAt(i, obj.matrix);
      });
      chipMesh.instanceMatrix.needsUpdate = true;
    }

    // Çalılar ve ot öbekleri.
    sites.bushes.forEach((_, i) => {
      const left = Math.round(pickedFruit(today.bushPicks, yesterday.bushPicks, i, seconds) * BERRIES_PER_BUSH);
      berryRefs.current[i]?.forEach((b, k) => {
        if (b) b.visible = k < left;
      });
    });
    sites.herbs.forEach((_, i) => {
      const left = Math.round(pickedFruit(today.herbPicks, yesterday.herbPicks, i, seconds) * FLOWERS_PER_HERB);
      flowerRefs.current[i]?.forEach((f, k) => {
        if (f) f.visible = k < left;
      });
    });

    // İstif.
    if (stackRef.current) stackRef.current.count = stackCountAt(today, yesterday, seconds);

    // Uyuyanların çadırının üstünde Zzz.
    ARRIVAL_ORDER.forEach((id, h) => {
      const track = placements.get(id)?.track;
      const asleep = !!track?.active && track.hidden;
      zRefs.current[h]?.forEach((z, k) => {
        if (!z) return;
        z.visible = asleep;
        if (!asleep) return;
        const u = (seconds / 2.6 + k / 3) % 1;
        z.position.set(Math.sin(u * 5 + k) * 0.6, u * 3.2, 0);
        z.scale.setScalar(0.9 + u * 0.9);
        (z.material as SpriteMaterial).opacity = Math.min(1, Math.min(u * 4, (1 - u) * 3));
      });
    });
  });

  return (
    <group>
      {sites.trees.map((tree, i) => {
        const y = ground(tree.trunk);
        const leaves = m.leaves[i % m.leaves.length];
        const fallDir = { x: Math.sin(tree.spot.yaw), y: Math.cos(tree.spot.yaw) };
        return (
          <group key={`agac${i}`}>
            <group
              ref={(el) => {
                (treeRefs.current[i] ??= { outer: null, tilt: null, stump: null, bundles: [] }).outer = el;
              }}
              position={[tree.trunk.x, y, tree.trunk.y]}
              rotation-y={tree.spot.yaw}
            >
              <group
                ref={(el) => {
                  (treeRefs.current[i] ??= { outer: null, tilt: null, stump: null, bundles: [] }).tilt = el;
                }}
              >
                <group scale={TREE_SIZE * tree.scale} rotation-y={tree.rotation}>
                  <mesh geometry={TRUNK} material={m.trunk} castShadow />
                  <mesh geometry={LEAVES} material={leaves} castShadow />
                </group>
              </group>
            </group>
            <group
              ref={(el) => {
                (treeRefs.current[i] ??= { outer: null, tilt: null, stump: null, bundles: [] }).stump = el;
              }}
              position={[tree.trunk.x, y, tree.trunk.y]}
              scale={TREE_SIZE * tree.scale}
              visible={false}
            >
              <mesh geometry={STUMP} material={m.trunk} castShadow />
              <mesh geometry={STUMP_TOP} material={m.stumpTop} />
            </group>
            {[0, 1, 2].map((k) => {
              const p = { x: tree.logs.x + fallDir.x * (k - 1) * 1.1, y: tree.logs.y + fallDir.y * (k - 1) * 1.1 };
              return (
                <group
                  key={k}
                  ref={(el) => {
                    (treeRefs.current[i] ??= { outer: null, tilt: null, stump: null, bundles: [] }).bundles[k] = el;
                  }}
                  position={[p.x, ground(p), p.y]}
                  rotation-y={tree.spot.yaw + Math.PI / 2}
                  visible={false}
                >
                  <mesh geometry={LOG} material={m.log} position={[0, 0.24, -0.26]} castShadow />
                  <mesh geometry={LOG} material={m.log} position={[0, 0.24, 0.26]} castShadow />
                  <mesh geometry={LOG} material={m.log} position={[0, 0.64, 0]} castShadow />
                </group>
              );
            })}
          </group>
        );
      })}

      {sites.bushes.map((bush, i) => (
        <group key={`cali${i}`} position={[bush.target.x, ground(bush.target), bush.target.y]} rotation-y={hash(i + 3) * 6.28}>
          <mesh geometry={BUSH} material={m.bush} castShadow />
          {Array.from({ length: BERRIES_PER_BUSH }, (_, k) => {
            const a = k * 2.4 + i;
            const r = 0.9 + hash(k + i * 9) * 0.5;
            return (
              <mesh
                key={k}
                ref={(el) => {
                  (berryRefs.current[i] ??= [])[k] = el;
                }}
                geometry={BERRY}
                material={m.berry}
                position={[Math.cos(a) * r, 0.7 + hash(k * 3 + i) * 1.0, Math.sin(a) * r]}
              />
            );
          })}
        </group>
      ))}

      {sites.herbs.map((herb, i) => (
        <group key={`ot${i}`} position={[herb.target.x, ground(herb.target), herb.target.y]} rotation-y={hash(i + 11) * 6.28}>
          <mesh geometry={TUFT} material={m.tuft} />
          {Array.from({ length: FLOWERS_PER_HERB }, (_, k) => (
            <mesh
              key={k}
              ref={(el) => {
                (flowerRefs.current[i] ??= [])[k] = el;
              }}
              geometry={FLOWER}
              material={m.flower[(i + k) % 2]}
              position={[(k - 1) * 0.36, 1.15 + (k % 2) * 0.12, (k % 2) * 0.2 - 0.1]}
            />
          ))}
        </group>
      ))}

      <instancedMesh
        ref={stackRef}
        args={[LOG, m.log, STACK_SLOTS.length]}
        position={[sites.stack.x, ground(sites.stack), sites.stack.y]}
        rotation-y={yawTo(sites.stack, sites.center) + Math.PI / 2}
        castShadow
        raycast={() => null}
      />

      {sites.seatLogs.map((seat, i) => (
        <mesh key={`oturak${i}`} geometry={SEAT} material={m.seat} position={[seat.at.x, ground(seat.at), seat.at.y]} rotation-y={seat.yaw} castShadow receiveShadow />
      ))}

      <group position={[sites.rack.x, ground(sites.rack), sites.rack.y]} rotation-y={yawTo(sites.rack, sites.center) + Math.PI / 2}>
        <mesh geometry={POST} material={m.rack} position={[-1.8, 0, 0]} castShadow />
        <mesh geometry={POST} material={m.rack} position={[1.8, 0, 0]} castShadow />
        <mesh geometry={BAR} material={m.rack} castShadow />
        {[-1.2, -0.4, 0.4, 1.2].map((x, k) => (
          <mesh key={k} geometry={HANGING} material={m.hanging[k % 2]} position={[x, 0, 0]} castShadow />
        ))}
      </group>

      <instancedMesh ref={chipRef} args={[CHIP, m.chip, CHIP_COUNT]} frustumCulled={false} raycast={() => null} />

      {zMaterials &&
        ARRIVAL_ORDER.map((id, h) => {
          const home = sites.homes[id];
          // Çadırın tepesinin biraz üstü (boyu 1 olan çadır 5,75 birim yüksek).
          const top = ground(home.tent) + 5.75 * YURT_SIZE * home.tentScale;
          return (
            <group key={`zzz-${id}`} position={[home.tent.x, top, home.tent.y]}>
              {[0, 1, 2].map((k) => (
                <sprite
                  key={k}
                  ref={(el) => {
                    (zRefs.current[h] ??= [])[k] = el;
                  }}
                  material={zMaterials[h][k]}
                  visible={false}
                  scale={1.2}
                />
              ))}
            </group>
          );
        })}
    </group>
  );
}

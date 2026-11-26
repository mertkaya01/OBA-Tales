/**
 * HAYVANLAR VE AV SAHNEDE — av çayırının geyikleri, tavşanları, kuşları; mhellingtr'nin okları; kamptaki asacakta
 * günün avı.
 *
 *   · Her hayvan kendi iskeletli kopyası ve mikseriyle çizilir (toplam 16). Yer, yön ve klip animals.ts'ten gelir;
 *     klipler arasında yumuşak geçiş olur.
 *   · Ok yayın bırakıldığı anda çıkar, hafif bir kavisle uçar. Iskalanırsa toprağa saplanıp bir süre kalır;
 *     isabet ederse hayvan yere yığılır (kan yok).
 *   · Asılan av o akşam ve ertesi sabah 07:00'ye kadar asacakta durur.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { AnimationMixer, ConeGeometry, CylinderGeometry, Euler, Group, LoopOnce, MeshLambertMaterial, type AnimationAction, type Object3D } from "three";
import { groundY } from "../worldScale";
import type { HeroWorld } from "./AnimatedHero";
import { dressAnimal, frozenCatch, type AnimalModel } from "./animalModel";
import { ANIMAL_KINDS, ANIMAL_ONE_SHOT, ANIMALS, animalPose, type AnimalEvent, type AnimalKind, type AnimalPose, type EpisodeCache } from "./animals";
import { arrowFlight, type Kill } from "./daySchedule";
import { yawTo } from "./kutadaSites";
import { at } from "./storyClock";

const FADE = 0.2;
const MAX_STEP = 0.1;
const TURN_RATE = 7;
const NO_EVENTS: readonly AnimalEvent[] = [];
const TAU = Math.PI * 2;
const wrapAngle = (a: number) => a - TAU * Math.floor((a + Math.PI) / TAU);

/** Okun hedefteki yüksekliği (gövdenin ortası, dünya birimi). */
const BODY_HEIGHT: Readonly<Record<AnimalKind, number>> = { geyik: 3.4, tavsan: 0.75, kus: 0.7 };
/** Yayın yüksekliği (kahraman göğsü). */
const BOW_HEIGHT = 4.3;
/** Iskalanan ok toprakta bu kadar kalır (saniye). */
const STUCK_SECONDS = 8;

// ── Hayvan ─────────────────────────────────────────────────────────

interface AnimalRig {
  root: Object3D;
  mixer: AnimationMixer;
  actions: ReadonlyMap<string, AnimationAction>;
  dispose: () => void;
}

function buildAnimal(model: AnimalModel, kind: AnimalKind, index: number): AnimalRig {
  const root = model.instantiate();
  const materials = dressAnimal(root, { antlers: kind !== "geyik" || index === 0, shadow: kind !== "kus" });
  const mixer = new AnimationMixer(root);
  const actions = new Map<string, AnimationAction>();
  for (const [name, clip] of model.clips) {
    const action = mixer.clipAction(clip);
    action.timeScale = 0;
    if (name === ANIMAL_ONE_SHOT) {
      action.setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    actions.set(name, action);
  }
  return {
    root,
    mixer,
    actions,
    dispose: () => {
      mixer.stopAllAction();
      materials.forEach((m) => m.dispose());
    },
  };
}

function Animal({ kind, index, model, world, cache }: { kind: AnimalKind; index: number; model: AnimalModel; world: HeroWorld; cache: EpisodeCache }) {
  const group = useRef<Group>(null);
  const rig = useMemo(() => buildAnimal(model, kind, index), [model, kind, index]);
  useEffect(() => rig.dispose, [rig]);
  const spec = ANIMALS[kind];
  const state = useRef({ clip: null as string | null, clipTime: 0, lastPoseTime: 0, last: Number.NaN, yaw: 0, placed: false });
  const pose = useRef<AnimalPose | undefined>(undefined);

  useEffect(() => {
    state.current.clip = null;
    state.current.placed = false;
  }, [rig]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const s = state.current;
    const { story, sites, terrain, uniforms } = world;
    const t = uniforms.uTime.value;
    const dt = Number.isNaN(s.last) ? 0 : Math.min(MAX_STEP, Math.max(0, t - s.last));
    s.last = t;
    const plan = world.plan();
    const hunted = plan.hunt.kind === kind && plan.hunt.index === index;
    const p = (pose.current = animalPose(sites, story.day, kind, index, story.seconds, hunted ? plan.huntEvents : NO_EVENTS, cache, pose.current));
    g.visible = !p.hidden;
    if (p.hidden) return;

    const oneShot = p.clip === ANIMAL_ONE_SHOT;
    if (p.clip !== s.clip) {
      const next = rig.actions.get(p.clip) ?? rig.actions.get(spec.idle);
      const prev = s.clip ? rig.actions.get(s.clip) : undefined;
      if (next) {
        next.reset().play();
        if (prev && prev !== next) next.crossFadeFrom(prev, s.clip === null ? 0 : FADE, false);
      }
      s.clip = p.clip;
      s.clipTime = p.clipTime;
    } else if (oneShot) s.clipTime = p.clipTime;
    else s.clipTime += p.clipTime >= s.lastPoseTime ? Math.min(p.clipTime - s.lastPoseTime, 1) : dt;
    s.lastPoseTime = p.clipTime;
    const action = rig.actions.get(p.clip);
    const length = spec.lengths[p.clip] ?? 1;
    if (action) action.time = oneShot ? Math.min(s.clipTime, length - 1e-3) : s.clipTime % length;
    rig.mixer.update(dt);

    if (!s.placed) {
      s.yaw = p.yaw;
      s.placed = true;
    } else s.yaw += wrapAngle(p.yaw - s.yaw) * Math.min(1, dt * TURN_RATE);
    g.position.set(p.x, groundY(terrain, { x: p.x, y: p.z }) + p.h, p.z);
    g.rotation.y = s.yaw;
  });

  return (
    <group ref={group} scale={spec.scale}>
      <primitive object={rig.root} />
    </group>
  );
}

// ── Oklar ──────────────────────────────────────────────────────────

const ARROW_SHAFT = new CylinderGeometry(0.05, 0.05, 2.2, 5).rotateX(Math.PI / 2);
const ARROW_HEAD = new ConeGeometry(0.12, 0.34, 5).rotateX(Math.PI / 2).translate(0, 0, 1.25);
const ARROW_FLETCH = new CylinderGeometry(0.0, 0.16, 0.42, 3).rotateX(Math.PI / 2).translate(0, 0, -0.95);
const ARROW_POOL = 3;

function Arrows({ world }: { world: HeroWorld }) {
  const refs = useRef<(Group | null)[]>([]);
  const m = useMemo(
    () => ({ shaft: new MeshLambertMaterial({ color: "#c9a46a", flatShading: true }), head: new MeshLambertMaterial({ color: "#a7b0ba", flatShading: true }), fletch: new MeshLambertMaterial({ color: "#e8ecf2", flatShading: true }) }),
    [],
  );
  useEffect(() => () => Object.values(m).forEach((x) => x.dispose()), [m]);

  useFrame(() => {
    const { story, terrain } = world;
    const seconds = story.seconds;
    const plan = world.plan();
    let used = 0;
    for (const shot of plan.shots) {
      if (used >= ARROW_POOL) break;
      const flight = arrowFlight(shot.from, shot.to);
      const end = shot.at + flight + (shot.hit ? 0 : STUCK_SECONDS);
      if (seconds < shot.at || seconds > end) continue;
      const g = refs.current[used++];
      if (!g) continue;
      g.visible = true;
      const u = Math.min(1, (seconds - shot.at) / flight);
      const fromY = groundY(terrain, shot.from) + BOW_HEIGHT;
      const toY = groundY(terrain, shot.to) + (shot.hit ? BODY_HEIGHT[plan.hunt.kind] : 0.25);
      const arc = Math.min(1.2, flight * 1.6);
      const y = fromY + (toY - fromY) * u + arc * 4 * u * (1 - u);
      g.position.set(shot.from.x + (shot.to.x - shot.from.x) * u, y, shot.from.y + (shot.to.y - shot.from.y) * u);
      // Uçuş yönü: yatayda hedefe, dikeyde kavisin eğimi; toprağa saplanınca son eğimde kalır.
      const uu = Math.min(u, 0.999);
      const slope = (toY - fromY + arc * 4 * (1 - 2 * uu)) / Math.max(0.1, Math.hypot(shot.to.x - shot.from.x, shot.to.y - shot.from.y));
      g.rotation.set(-Math.atan(slope), yawTo(shot.from, shot.to), 0, "YXZ");
    }
    for (let k = used; k < ARROW_POOL; k++) {
      const g = refs.current[k];
      if (g) g.visible = false;
    }
  });

  return (
    <>
      {Array.from({ length: ARROW_POOL }, (_, k) => (
        <group
          key={k}
          ref={(el) => {
            refs.current[k] = el;
          }}
          visible={false}
        >
          <mesh geometry={ARROW_SHAFT} material={m.shaft} />
          <mesh geometry={ARROW_HEAD} material={m.head} />
          <mesh geometry={ARROW_FLETCH} material={m.fletch} />
        </group>
      ))}
    </>
  );
}

// ── Asacak ─────────────────────────────────────────────────────────

const POST = new CylinderGeometry(0.16, 0.2, 6.4, 6).translate(0, 3.2, 0);
const BAR = new CylinderGeometry(0.12, 0.12, 8.2, 6).rotateZ(Math.PI / 2).translate(0, 5.9, 0);
const BAR_HEIGHT = 5.9;

function HangingCatch({ world, models }: { world: HeroWorld; models: ReadonlyMap<AnimalKind, AnimalModel> }) {
  const { sites, terrain } = world;
  const wood = useMemo(() => new MeshLambertMaterial({ color: "#7a5232", flatShading: true }), []);
  useEffect(() => () => wood.dispose(), [wood]);
  // Tür başına bir donmuş kopya: bacakları yukarıda, sırtı aşağıda, gövdesi direğe paralel.
  const catches = useMemo(() => {
    const out = new Map<AnimalKind, { object: Object3D; dispose: () => void }>();
    for (const kind of ANIMAL_KINDS) {
      const model = models.get(kind);
      if (!model) continue;
      const { object, materials, size } = frozenCatch(model);
      const scale = ANIMALS[kind].scale;
      object.scale.setScalar(scale);
      object.rotation.copy(new Euler(0, Math.PI / 2, -Math.PI / 2, "YZX"));
      object.position.set(0, BAR_HEIGHT - 0.15 - (size.x * scale) / 2, 0);
      object.visible = false;
      out.set(kind, { object, dispose: () => materials.forEach((m) => m.dispose()) });
    }
    return out;
  }, [models]);
  useEffect(() => () => catches.forEach((c) => c.dispose()), [catches]);

  useFrame(() => {
    const seconds = world.story.seconds;
    const today = world.plan();
    const yesterday = world.yesterday();
    const shown: Kill | null = today.kill && seconds >= today.kill.hang ? today.kill : yesterday.kill && seconds < at(7) ? yesterday.kill : null;
    for (const [kind, c] of catches) c.object.visible = shown?.kind === kind;
  });

  const yaw = yawTo(sites.huntRack, sites.center) + Math.PI / 2;
  return (
    <group position={[sites.huntRack.x, groundY(terrain, sites.huntRack), sites.huntRack.y]} rotation-y={yaw}>
      <mesh geometry={POST} material={wood} position={[-3.8, 0, 0]} castShadow />
      <mesh geometry={POST} material={wood} position={[3.8, 0, 0]} castShadow />
      <mesh geometry={BAR} material={wood} castShadow />
      {[...catches.values()].map((c, i) => (
        <primitive key={i} object={c.object} />
      ))}
    </group>
  );
}

// ── Hepsi ──────────────────────────────────────────────────────────

export function MeadowLife({ world, models }: { world: HeroWorld; models: ReadonlyMap<AnimalKind, AnimalModel> }) {
  const cache = useMemo<EpisodeCache>(() => new Map(), []);
  return (
    <>
      {ANIMAL_KINDS.flatMap((kind) => {
        const model = models.get(kind);
        if (!model) return [];
        return Array.from({ length: ANIMALS[kind].count }, (_, index) => <Animal key={`${kind}-${index}`} kind={kind} index={index} model={model} world={world} cache={cache} />);
      })}
      <Arrows world={world} />
      <HangingCatch world={world} models={models} />
    </>
  );
}


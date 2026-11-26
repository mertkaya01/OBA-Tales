/**
 * İSKELETLİ KAHRAMANLAR SAHNEDE — Blender'da iskelet ve kliplerle hazırlanan kahramanlar (heroModel.ts).
 *
 *   · Yer, yön, klip ve elindeki eşya gün düzeninden gelir (daySchedule.ts): odun keser, taşır, toplar, avlanır,
 *     ateş başında oturur, gece çadırında uyur.
 *   · Seslenilince (arama, tıklama, geliş) gün düzeninin üstüne tepki biner (reactions.ts): kameraya döner,
 *     el sallar, balonda bir söz söyler; uyuyorsa çadırından çıkıp geri girer.
 *   · Klipler arasında 0,25 sn yumuşak geçiş olur. Aynı klip sürerken zamanı kesintisiz akar.
 *   · Canlı yer placement.track'e yazılır: ad plakası, seçim halkası, kamera ve konuşma balonu onu izler.
 *   · Görünmez bir silindir tıklamayı yakalar (uyurken çadırın kapısında durur).
 */
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  AnimationMixer,
  Color,
  Euler,
  LoopOnce,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  type AnimationAction,
  type Group,
  type Object3D,
} from "three";
import { pickLine } from "../../content/heroLines";
import type { ArrivalHeroId } from "../../content/story";
import type { Terrain } from "../../game/terrain";
import type { Character } from "../../types";
import { auraColor, hasAura } from "../characters/aura";
import { HIT_GEOMETRY } from "../characters/characterKit";
import type { CharacterUniforms } from "../characters/characterMaterials";
import type { CharacterPlacement } from "../living/placement";
import { groundY } from "../worldScale";
import { ANIMALS, type AnimalKind } from "./animals";
import { frozenCatch, type AnimalModel } from "./animalModel";
import { CLIP_LENGTH, poseAt, type DayPlan, type SchedulePose } from "./daySchedule";
import { dressHero, ONE_SHOT_CLIPS, type HeroClip, type HeroModel } from "./heroModel";
import { attachHeroProps, type HeroPropSet } from "./heroProps";
import type { KutadaSites } from "./kutadaSites";
import { reactionFrame, type Reaction, type ReactionFrame } from "./reactions";
import type { StoryRuntime } from "./storyRuntime";

/** Klipler arası geçiş (saniye). */
const FADE = 0.25;
/** Kare atlanınca (sekme döndü) klip bundan fazla ilerlemez. */
const MAX_STEP = 0.1;
/** Dönüş hızı (radyan/sn çarpanı). */
const TURN_RATE = 9;
/** Ateş başında oturan kahraman kameraya en fazla bu kadar döner (radyan). */
const SEATED_TURN = 1.1;

const HIT_MATERIAL = new MeshBasicMaterial({ visible: false });
const AURA_RING = new RingGeometry(1.15, 1.75, 14).rotateX(-Math.PI / 2).translate(0, 0.12, 0);

const TAU = Math.PI * 2;
const wrapAngle = (a: number) => a - TAU * Math.floor((a + Math.PI) / TAU);

interface HeroRig {
  root: Object3D;
  mixer: AnimationMixer;
  actions: ReadonlyMap<HeroClip, AnimationAction>;
  props: HeroPropSet;
  /** Sırttaki avın türü ve malzemelerini bırakma işlevi (av yuvasına konduğunda). */
  carried: { kind: AnimalKind | null; dispose: () => void };
  dispose: () => void;
}

function buildRig(model: HeroModel, character: Character, hero: ArrivalHeroId): HeroRig {
  const root = model.instantiate();
  const materials = dressHero(root, character);
  const props = attachHeroProps(root, hero);
  const mixer = new AnimationMixer(root);
  const actions = new Map<HeroClip, AnimationAction>();
  for (const [name, clip] of model.clips) {
    const action = mixer.clipAction(clip);
    // Zamanı biz veririz (gün düzeni ve tepki): mikser kendiliğinden ilerletmez.
    action.timeScale = 0;
    if (ONE_SHOT_CLIPS.has(name)) {
      action.setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    actions.set(name, action);
  }
  const carried = { kind: null as AnimalKind | null, dispose: () => {} };
  return {
    root,
    mixer,
    actions,
    props,
    carried,
    // Kopya ve mikser bileşenle birlikte çöpe gider. uncacheRoot bilerek yok: React geliştirmede (StrictMode) temizliği
    // bir kez erken çalıştırır, bağlar silinirse sonraki play() düşer. Durdurmak ve ekran kartı kaynağını bırakmak yeter.
    dispose: () => {
      mixer.stopAllAction();
      materials.forEach((m) => m.dispose());
      props.dispose();
      carried.dispose();
    },
  };
}

export interface HeroWorld {
  terrain: Terrain;
  sites: KutadaSites;
  story: StoryRuntime;
  uniforms: CharacterUniforms;
  /** O günün ve bir önceki günün planı (gün değişince yenisi). */
  plan: () => DayPlan;
  yesterday: () => DayPlan;
  /** Yüklenmiş hayvan modelleri (sırtlanan ve asılan av için). */
  animalModels: () => ReadonlyMap<AnimalKind, AnimalModel>;
}

interface AnimatedHeroProps {
  hero: ArrivalHeroId;
  character: Character;
  model: HeroModel;
  placement: CharacterPlacement;
  world: HeroWorld;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

interface HeroState {
  clip: HeroClip | null;
  clipTime: number;
  last: number;
  x: number;
  z: number;
  yaw: number;
  placed: boolean;
  reaction: Reaction | null;
  reactions: number;
}

function AnimatedHero({ hero, character, model, placement, world, onSelect, onHover }: AnimatedHeroProps) {
  const { gl } = useThree();
  const outer = useRef<Group>(null);
  const body = useRef<Group>(null);
  const aura = useRef<Mesh>(null);
  const rig = useMemo(() => buildRig(model, character, hero), [model, character, hero]);
  useEffect(() => rig.dispose, [rig]);

  const auraMaterial = useMemo(
    () =>
      hasAura(character)
        ? new MeshBasicMaterial({ color: new Color(auraColor(character)), transparent: true, opacity: 0.6, blending: AdditiveBlending, depthWrite: false })
        : null,
    [character],
  );
  useEffect(() => () => auraMaterial?.dispose(), [auraMaterial]);

  const state = useRef<HeroState>({ clip: null, clipTime: 0, last: Number.NaN, x: 0, z: 0, yaw: 0, placed: false, reaction: null, reactions: 0 });
  const live = useRef<SchedulePose | null>(null);
  const reactionScratch = useRef<ReactionFrame | null>(null);

  // Yeni kopya gelince klip baştan seçilsin; kahraman kalkınca canlı yer bırakılır.
  useEffect(() => {
    state.current.clip = null;
    state.current.placed = false;
    const track = placement.track;
    return () => {
      if (track) {
        track.active = false;
        track.speech = null;
      }
    };
  }, [rig, placement]);

  useFrame(({ camera }) => {
    const group = outer.current;
    const model = body.current;
    if (!group || !model) return;
    const s = state.current;
    const { story, uniforms, terrain, sites } = world;
    const t = uniforms.uTime.value;
    const dt = Number.isNaN(s.last) ? 0 : Math.min(MAX_STEP, Math.max(0, t - s.last));
    s.last = t;

    const timeline = world.plan().timelines.get(hero);
    if (!timeline) return;
    const pose = (live.current = poseAt(timeline, story.seconds, live.current ?? undefined));

    // Seslenildiyse tepki başlar (uyuyorsa çadırdan çıkar).
    const callAt = story.calls.get(hero);
    if (callAt !== undefined && t >= callAt) {
      story.calls.delete(hero);
      const home = sites.homes[hero];
      const asleep = pose.hidden;
      s.reaction = {
        start: t,
        asleep,
        sitting: !asleep && (pose.clip === "otur" || pose.clip === "sohbet"),
        anchor: s.placed ? { x: s.x, z: s.z, yaw: s.yaw } : { x: pose.x, z: pose.z, yaw: pose.yaw },
        door: home.door,
        front: home.front,
        inYaw: home.inYaw,
        line: pickLine(hero, pose.activity, asleep, s.reactions++),
      };
    }
    const frame = s.reaction ? reactionFrame(s.reaction, t, reactionScratch.current ?? undefined) : null;
    if (s.reaction && !frame) s.reaction = null;
    if (frame) reactionScratch.current = frame;

    // Bu karenin duruşu: tepki (varsa) gün düzeninin üstüne biner.
    let x = pose.x;
    let z = pose.z;
    let clip = pose.clip;
    let clipTime = pose.clipTime;
    let hidden = pose.hidden;
    let targetYaw: number = pose.yaw;
    let speech: string | null = null;
    const toCamera = (px: number, pz: number) => Math.atan2(camera.position.x - px, camera.position.z - pz);
    if (frame && s.reaction) {
      speech = frame.speech;
      if (frame.catchUp === 0) {
        x = frame.x;
        z = frame.z;
        clip = frame.clip;
        clipTime = frame.clipTime;
        hidden = frame.hidden;
        if (frame.yaw !== null) targetYaw = frame.yaw;
        else if (s.reaction.sitting) {
          const want = toCamera(x, z);
          const seat = s.reaction.anchor.yaw;
          targetYaw = seat + Math.max(-SEATED_TURN, Math.min(SEATED_TURN, wrapAngle(want - seat)));
        } else targetYaw = toCamera(x, z);
      } else {
        // Tepki bitti: gün düzenindeki yerine yetişir (uzaksa koşarak).
        const k = frame.catchUp;
        x = frame.x + (pose.x - frame.x) * k;
        z = frame.z + (pose.z - frame.z) * k;
        const far = Math.hypot(pose.x - frame.x, pose.z - frame.z) > 2.5;
        if (far && k < 0.95) {
          clip = "kos";
          targetYaw = Math.atan2(pose.x - s.x, pose.z - s.z);
        }
        hidden = pose.hidden && k > 0.95;
      }
    }

    // Klip: değişince yumuşak geçiş ve belirlenen yerden başlar; sürüyorsa zamanı akar.
    const oneShot = ONE_SHOT_CLIPS.has(clip);
    if (clip !== s.clip) {
      const next = rig.actions.get(clip) ?? rig.actions.get("bosta");
      const prev = s.clip ? rig.actions.get(s.clip) : undefined;
      if (next) {
        next.reset().play();
        if (prev && prev !== next) next.crossFadeFrom(prev, s.clip === null ? 0 : FADE, false);
      }
      s.clip = clip;
      s.clipTime = clipTime;
    } else if (oneShot) s.clipTime = clipTime;
    else s.clipTime += dt * (pose.moving && !frame ? 0.95 : 1);
    const action = rig.actions.get(clip);
    if (action) {
      const length = CLIP_LENGTH[clip];
      action.time = oneShot ? Math.min(s.clipTime, length - 1e-3) : s.clipTime % length;
    }
    // Klip zamanları elle verildi (eylemlerin hızı 0); mikser yine de ilerler ki geçişlerin ağırlığı akabilsin.
    rig.mixer.update(dt);

    // Yer ve yön.
    if (!s.placed) {
      s.yaw = targetYaw;
      s.placed = true;
    } else s.yaw += wrapAngle(targetYaw - s.yaw) * Math.min(1, dt * TURN_RATE);
    s.x = x;
    s.z = z;
    const y = groundY(terrain, { x, y: z });
    group.position.set(x, y, z);
    model.rotation.y = s.yaw;
    model.visible = !hidden;

    // Eşyalar.
    const props = pose.props;
    const { axe, carry, weapon, hideWhileCarrying } = rig.props;
    if (axe) axe.visible = props.axe;
    for (const key of ["odun", "testi", "sepet", "av"] as const) {
      const prop = carry[key];
      if (prop) prop.visible = props.carry === key;
    }
    const hideWeapon = props.axe || ((props.carry === "odun" || props.carry === "av") && hideWhileCarrying.length > 0);
    for (const w of weapon) w.visible = !hideWeapon;
    // Sırtlanan av: günün avının donmuş bir kopyası omuzlarda (bacakları iki yana sarkar).
    const slot = carry.av;
    const kill = props.carry === "av" ? world.plan().kill : null;
    if (slot && kill && rig.carried.kind !== kill.kind) {
      const model = world.animalModels().get(kill.kind);
      if (model) {
        rig.carried.dispose();
        slot.clear();
        const { object, materials, size } = frozenCatch(model);
        const scale = (ANIMALS[kill.kind].scale / placement.scale) * 0.85;
        object.scale.setScalar(scale);
        object.rotation.copy(new Euler(0, Math.PI / 2, Math.PI / 2, "YZX"));
        // Bacaklar aşağı sarkınca kutunun üst yarısı gövdedir: gövde omuzlara otursun, başın biraz arkasında kalsın.
        object.position.set(0, -size.x * scale * 0.3, -0.28);
        slot.add(object);
        rig.carried.kind = kill.kind;
        rig.carried.dispose = () => materials.forEach((m) => m.dispose());
      }
    }

    // Aura: ayak altında nabız gibi atar; çadırdayken söner.
    if (aura.current) {
      aura.current.visible = !hidden;
      aura.current.scale.setScalar(1 + 0.14 * Math.sin(t * 2.4 + hero.length * 3.1));
    }

    const track = placement.track;
    if (track) {
      track.active = true;
      track.x = x;
      track.y = y;
      track.z = z;
      track.hidden = hidden;
      track.speech = speech;
    }
  });

  const id = character.id;
  return (
    <group ref={outer}>
      <group scale={placement.scale}>
        <group ref={body}>
          <primitive object={rig.root} />
        </group>
        {auraMaterial && <mesh ref={aura} geometry={AURA_RING} material={auraMaterial} raycast={() => null} />}
        <mesh
          geometry={HIT_GEOMETRY}
          material={HIT_MATERIAL}
          onClick={(event: ThreeEvent<MouseEvent>) => {
            if (event.delta > 6) return;
            event.stopPropagation();
            onSelect(id);
          }}
          onPointerMove={(event: ThreeEvent<PointerEvent>) => {
            event.stopPropagation();
            onHover(id);
            gl.domElement.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            onHover(null);
            gl.domElement.style.cursor = "";
          }}
        />
      </group>
    </group>
  );
}

interface AnimatedHeroesProps {
  /** Modeli yüklenmiş, haritada görünen kahramanlar. */
  characters: readonly Character[];
  models: ReadonlyMap<string, HeroModel>;
  placements: ReadonlyMap<string, CharacterPlacement>;
  world: HeroWorld;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

export function AnimatedHeroes({ characters, models, placements, world, onSelect, onHover }: AnimatedHeroesProps) {
  return (
    <>
      {characters.map((c) => {
        const model = models.get(c.id);
        const placement = placements.get(c.id);
        const hero = c.id as ArrivalHeroId;
        if (!model || !placement || !world.plan().timelines.has(hero)) return null;
        return <AnimatedHero key={c.id} hero={hero} character={c} model={model} placement={placement} world={world} onSelect={onSelect} onHover={onHover} />;
      })}
    </>
  );
}


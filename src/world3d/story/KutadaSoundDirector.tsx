/**
 * ADA SESLERİNİN YÖNETMENİ — sahnede olanı duyurur (ses açıksa).
 *
 *   · Balta gövdeye her indiğinde "tok" (koruya yakından bakarken), yay bırakılınca tıngırtı, ok saplanınca vuruş.
 *   · Kuş sürüsü gündüz cıvıldar; ocak uğuldar, çıtırdar (gece daha çok); gece cırcır böcekleri; hep biraz rüzgâr.
 *   · Seviye kameranın baktığı yere uzaklıktan, sağ-sol dengesi ekrandaki yerden (audio/soundMix.ts).
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import { Vector3 } from "three";
import { closeness, hearing, panFor } from "../../audio/soundMix";
import { useKutadaSound } from "../../state/useKutadaSound";
import type { SkyRuntime } from "../living/sky";
import { groundY, worldZoomOf } from "../worldScale";
import type { HeroWorld } from "./AnimatedHero";
import { animalPose, BIRDS_LEAVE, BIRDS_RETURN, type EpisodeCache } from "./animals";
import { arrowFlight } from "./daySchedule";
import { impactBetween } from "./worldMarks";

/** Kuş sürüsünün saniyedeki cıvıltı sayısı (duyulacak kadar yakınken). */
const CHIRPS_PER_SECOND = 1.3;

export function KutadaSoundDirector({ world, sky }: { world: HeroWorld; sky: SkyRuntime }) {
  const { camera, size } = useThree();
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3 } | null;
  const scratch = useMemo(() => ({ v: new Vector3(), last: Number.NaN, beds: 0, cache: new Map() as EpisodeCache }), []);

  useFrame((_, delta) => {
    const engine = useKutadaSound.getState().engine;
    const seconds = world.story.seconds;
    const dsec = Number.isNaN(scratch.last) ? 0 : Math.max(0, Math.min(0.25, seconds - scratch.last));
    scratch.last = seconds;
    if (!engine) return;
    const { terrain, sites } = world;
    const target = controls?.target;
    const lx = target?.x ?? sites.center.x;
    const lz = target?.z ?? sites.center.y;
    const zoom = worldZoomOf((camera as { zoom: number }).zoom, size);
    const level = (x: number, z: number) => hearing(Math.hypot(x - lx, z - lz), zoom);
    const pan = (x: number, z: number) => panFor(scratch.v.set(x, groundY(terrain, { x, y: z }), z).project(camera).x);
    const plan = world.plan();

    // Balta.
    for (const chop of plan.chops) {
      const tree = sites.trees[chop.tree];
      if (seconds >= chop.start && seconds < chop.fall && impactBetween(seconds - chop.start, dsec)) engine.axe(level(tree.trunk.x, tree.trunk.y), pan(tree.trunk.x, tree.trunk.y));
      else if (seconds >= chop.splitStart && seconds < chop.splitEnd && impactBetween(seconds - chop.splitStart, dsec)) engine.axe(level(tree.logs.x, tree.logs.y) * 0.8, pan(tree.logs.x, tree.logs.y));
    }

    // Ok: bırakılış ve saplanış.
    for (const shot of plan.shots) {
      if (seconds >= shot.at && seconds - dsec < shot.at) engine.bow(level(shot.from.x, shot.from.y), pan(shot.from.x, shot.from.y));
      const land = shot.at + arrowFlight(shot.from, shot.to);
      if (seconds >= land && seconds - dsec < land) engine.thud(level(shot.to.x, shot.to.y) * (shot.hit ? 0.6 : 0.9), pan(shot.to.x, shot.to.y));
    }

    // Kuşlar: sürü konaktayken arada bir cıvıldar.
    if (seconds > BIRDS_RETURN && seconds < BIRDS_LEAVE && Math.random() < dsec * CHIRPS_PER_SECOND) {
      const bird = animalPose(sites, world.story.day, "kus", Math.floor(Math.random() * 7), seconds, [], scratch.cache);
      if (!bird.hidden) engine.chirp(level(bird.x, bird.z), pan(bird.x, bird.z));
    }

    // Sürekli sesler (saniyede on kez yeter).
    scratch.beds += delta;
    if (scratch.beds < 0.1) return;
    scratch.beds = 0;
    const night = sky.lamp;
    const near = closeness(zoom);
    engine.setBeds({
      fire: level(sites.fire.x, sites.fire.y) * (0.45 + 0.55 * night),
      firePan: pan(sites.fire.x, sites.fire.y),
      wind: 0.35 + 0.65 * (1 - near),
      crickets: night > 0.55 ? Math.min(1, level(sites.center.x, sites.center.y) * 2 + 0.25 * near) * night : 0,
    });
  });

  return null;
}

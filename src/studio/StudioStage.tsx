/**
 * STÜDYO SAHNESİ — <Canvas> içinde iki görevli:
 *
 *   StudioDirector  her karede kamerayı senaryoya göre konumlar (yakınlaşma, yörünge, karakter takibi)
 *   ReelPainter     piksel hattı çizdikten hemen sonra kareyi 1080×1920 kompozitör tuvaline aktarır ve
 *                   üstüne altyazı, kural kartı ve imzayı çizer
 *
 * Akın şablonunda yönetmen Akın Günü'nün saatini videoya kilitler (savaş hamleleri kayıtla aynı saniyede), ressam da
 * Öfke çubuğunu, perde başlığını ve anılan adları çizer.
 *
 * Karşılama şablonunda yönetmen geliş sinemasının saatini videoya kilitler (kapı parlar, küreler uçar) ve kahramanları
 * küreleri inene kadar gizler (onHiddenHeroes). Yetenekler şablonunda ressam portre panelini çizer (skillShow).
 *
 * İkisi paylaşılan bir zaman çizelgesi nesnesini (Timeline) okur; arayüz onu değiştirir (oynat, durdur, kaydet).
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import type { OrthographicCamera } from "three";
import { LANDMARKS } from "../content/sites";
import { currentPosition, type WorldPoint } from "../world3d/living/placement";
import { arrivalLength, orbAt } from "../world3d/story/arrival";
import { scheduledSpot } from "../world3d/story/storyRuntime";
import type { WorldScene } from "../world3d/useWorldScene";
import { cameraZoomFor, groundY, tiltForZoom } from "../world3d/worldScale";
import { actAt, fillAct, rageAt, raidCallouts, type Callout } from "../world3d/living/raidDay";
import { drawReelFrame, type RaidOverlay } from "./compositor";
import { cameraAt, cameraDirection, captionAt, cardAt, totalDuration, type RaidDayReel, type Timeline } from "./reel";
import { skillShowFor } from "./skillShow";

const DISTANCE = 1500;

interface DirectorProps {
  timeline: RefObject<Timeline>;
  scene: WorldScene;
  /** Karşılamada henüz doğmamış kahramanlar (haritadan çıkarılır); değişince çağrılır. */
  onHiddenHeroes?: (ids: readonly string[]) => void;
}

/** Karşılama şablonunun geliş sinemasını videonun saatine bağlar; gizlenecek kahramanları döndürür. */
function driveArrival(tl: Timeline, scene: WorldScene): string[] {
  const reel = tl.script.arrival;
  const runtime = scene.arrival;
  if (!reel) {
    if (runtime.active) runtime.active = false;
    return [];
  }
  const n = reel.heroes.length;
  const local = tl.t - reel.at;
  // Küreler kahramanların o anki iş yerine iner (WorldView'daki sinemayla aynı).
  if (local < 0 || runtime.targets.length !== n) {
    const portal = LANDMARKS.kutKapisi;
    runtime.from = { x: portal.x, y: groundY(scene.terrain, portal) + 20, z: portal.y };
    runtime.targets = reel.heroes.map((id) => {
      const spot = scheduledSpot(scene, id) ?? scene.placements.get(id)?.home ?? portal;
      return { x: spot.x, y: groundY(scene.terrain, spot) + 1.5, z: spot.y };
    });
  }
  runtime.active = local >= 0 && local < arrivalLength(n);
  runtime.t = local;
  return reel.heroes.filter((_, i) => local < 0 || !orbAt(local, i).revealed);
}

export function StudioDirector({ timeline, scene, onHiddenHeroes }: DirectorProps) {
  const { size } = useThree();
  const point: WorldPoint = { x: 0, y: 0, z: 0 };
  const hiddenKey = useRef("");

  useFrame(({ camera, clock }) => {
    const tl = timeline.current;
    const total = totalDuration(tl.script.shots);
    if (tl.restart) {
      tl.restart = false;
      tl.playing = true;
      tl.startedAt = clock.elapsedTime;
    }
    if (tl.playing) {
      tl.t = Math.min(total, clock.elapsedTime - tl.startedAt);
      if (tl.t >= total) {
        tl.playing = false;
        const done = tl.onEnd;
        tl.onEnd = null;
        done?.();
      }
    }

    // Akın şablonu oynarken Akın Günü videonun saatiyle akar; durunca meydan kendi temposuna döner.
    const battle = scene.battle;
    const raid = tl.script.raidDay;
    if (raid && tl.playing) {
      battle.intense = true;
      battle.day = { t: raid.start + tl.t, loop: 0 };
    } else if (battle.intense) {
      battle.intense = false;
      battle.day = null;
    }

    // Karşılama: kapı, küreler ve doğan kahramanlar videonun saatiyle.
    const hidden = driveArrival(tl, scene);
    const key = hidden.join(",");
    if (key !== hiddenKey.current) {
      hiddenKey.current = key;
      onHiddenHeroes?.(hidden);
    }

    const { pose } = cameraAt(tl.script.shots, tl.t);
    let { x, z } = pose;
    const followed = pose.follow ? scene.placements.get(pose.follow) : undefined;
    if (followed) {
      currentPosition(followed, scene.terrain, scene.motionUniforms.uTime.value, point);
      x = point.x;
      z = point.z;
    }
    // Tam tepeden bakış (eğim 0) yönü belirsiz kılar: en az biraz eğik kalsın.
    const tilt = Math.max(0.02, pose.tilt ?? tiltForZoom(pose.zoom));
    const [dx, dy, dz] = cameraDirection(pose.yaw, tilt);
    const ground = groundY(scene.terrain, { x, y: z });
    const lookY = ground + (followed ? 4 : 0);
    camera.position.set(x + dx * DISTANCE, lookY + dy * DISTANCE, z + dz * DISTANCE);
    camera.up.set(0, 1, 0);
    camera.lookAt(x, lookY, z);
    const ortho = camera as OrthographicCamera;
    ortho.zoom = cameraZoomFor(pose.zoom, size);
    ortho.updateProjectionMatrix();
  });

  return null;
}

const calloutCache = new WeakMap<RaidDayReel, Callout[]>();

/** Akın Günü'nün videodaki o anı: boss, Öfke, perde ve son 4,5 saniyede anılan en çok üç yoldaş. */
function raidOverlay(raid: RaidDayReel, t: number): RaidOverlay {
  const day = raid.start + t;
  let callouts = calloutCache.get(raid);
  if (!callouts) {
    callouts = raidCallouts(raid.raiders, 0);
    calloutCache.set(raid, callouts);
  }
  const { act } = actAt(day);
  return {
    boss: raid.boss,
    rage: rageAt(day),
    title: fillAct(act.title, raid.boss, raid.raiders.length),
    caption: fillAct(act.caption, raid.boss, raid.raiders.length),
    callouts: callouts
      .filter((c) => c.at <= day && day - c.at < 4.5)
      .slice(-3)
      .map((c) => ({ text: c.text, cls: c.cls, age: day - c.at })),
  };
}

/** Piksel hattından (öncelik 1) sonra çalışır: tuvalde o karenin son hâli vardır. */
export function ReelPainter({ timeline }: { timeline: RefObject<Timeline> }) {
  useFrame(({ gl }) => {
    const tl = timeline.current;
    const canvas = tl.compositor;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const total = totalDuration(tl.script.shots);
    const skills = tl.script.skills;
    drawReelFrame(ctx, gl.domElement, {
      caption: captionAt(tl.script.captions, tl.t, total),
      card: tl.showCards ? cardAt(tl.script.cards, tl.t) : null,
      signature: tl.signature,
      raid: tl.script.raidDay ? raidOverlay(tl.script.raidDay, tl.t) : null,
      extra: skills ? (c) => skillShowFor(skills).draw(c, tl.t) : null,
    });
  }, 2);
  return null;
}

/** Geliştirme sırasında konsoldan incelemek için: window.__kbStudio */
export function StudioDevHandle({ timeline }: { timeline: RefObject<Timeline> }) {
  const state = useThree();
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __kbStudio: { state, timeline } });
  }, [state, timeline]);
  return null;
}

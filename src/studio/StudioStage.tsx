/**
 * STÜDYO SAHNESİ — <Canvas> içinde iki görevli:
 *
 *   StudioDirector  her karede kamerayı senaryoya göre konumlar (yakınlaşma, yörünge, karakter takibi)
 *   ReelPainter     piksel hattı çizdikten hemen sonra kareyi 1080×1920 kompozitör tuvaline aktarır ve
 *                   üstüne altyazı, kural kartı ve imzayı çizer
 *
 * İkisi paylaşılan bir zaman çizelgesi nesnesini (Timeline) okur; arayüz onu değiştirir (oynat, durdur, kaydet).
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, type RefObject } from "react";
import type { OrthographicCamera } from "three";
import { currentPosition, type WorldPoint } from "../world3d/living/placement";
import type { WorldScene } from "../world3d/useWorldScene";
import { cameraZoomFor, groundY, tiltForZoom } from "../world3d/worldScale";
import { drawReelFrame } from "./compositor";
import { cameraAt, cameraDirection, captionAt, cardAt, totalDuration, type Timeline } from "./reel";

const DISTANCE = 1500;

export function StudioDirector({ timeline, scene }: { timeline: RefObject<Timeline>; scene: WorldScene }) {
  const { size } = useThree();
  const point: WorldPoint = { x: 0, y: 0, z: 0 };

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

/** Piksel hattından (öncelik 1) sonra çalışır: tuvalde o karenin son hâli vardır. */
export function ReelPainter({ timeline }: { timeline: RefObject<Timeline> }) {
  useFrame(({ gl }) => {
    const tl = timeline.current;
    const canvas = tl.compositor;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const total = totalDuration(tl.script.shots);
    drawReelFrame(ctx, gl.domElement, {
      caption: captionAt(tl.script.captions, tl.t, total),
      card: tl.showCards ? cardAt(tl.script.cards, tl.t) : null,
      signature: tl.signature,
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

/**
 * Ayaz sisi: açılmamış bölgelerin üstünde yavaşça süzülen yarı saydam bulut kümeleri.
 * (Arazinin kendisi de shaders/fog.ts ile sis rengine boyanır; bu bileşen havadaki bulutlardır.)
 * Bulutlar seyrektir; altındaki karakterler aralarından görünmeye devam eder.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { IcosahedronGeometry, Matrix4, MeshLambertMaterial, Quaternion, Vector3, type InstancedMesh } from "three";
import { REGIONS } from "../content/regions";
import type { Terrain } from "../game/terrain";
import { polygonArea, randomPointInPolygon } from "../lib/geometry";
import { createRng, seedFrom } from "../lib/random";
import { REGION_IDS } from "../types";
import type { RegionId } from "../types";
import { groundY, worldZoomOf } from "./worldScale";

interface Puff {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  phase: number;
}

function buildPuffs(terrain: Terrain, revealed: ReadonlySet<RegionId>, seed: number): Puff[] {
  const rng = createRng(seedFrom("bulutlar", seed));
  const puffs: Puff[] = [];
  for (const id of REGION_IDS) {
    if (revealed.has(id)) continue;
    const region = REGIONS[id];
    const count = Math.round(polygonArea(region.polygon) / 3500);
    for (let i = 0; i < count; i++) {
      const p = randomPointInPolygon(region.polygon, rng, { margin: 10 });
      const base = Math.max(groundY(terrain, p), 8);
      puffs.push({
        x: p.x,
        y: base + rng.float(14, 26),
        z: p.y,
        sx: rng.float(10, 20),
        sy: rng.float(3.5, 6),
        sz: rng.float(8, 16),
        phase: rng.float(0, Math.PI * 2),
      });
    }
  }
  return puffs;
}

interface FogOfWarProps {
  terrain: Terrain;
  revealedRegions: ReadonlySet<RegionId>;
  seed: number;
  animate: boolean;
}

export function FogOfWar({ terrain, revealedRegions, seed, animate }: FogOfWarProps) {
  const ref = useRef<InstancedMesh>(null);
  const puffs = useMemo(() => buildPuffs(terrain, revealedRegions, seed), [terrain, revealedRegions, seed]);
  const geometry = useMemo(() => new IcosahedronGeometry(1, 1), []);
  const material = useMemo(
    () => new MeshLambertMaterial({ color: "#eef4fa", transparent: true, opacity: 0.5, depthWrite: false, flatShading: true }),
    [],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  const scratch = useMemo(() => ({ m: new Matrix4(), q: new Quaternion(), p: new Vector3(), s: new Vector3() }), []);
  const { size } = useThree();

  useFrame(({ clock, camera }) => {
    const mesh = ref.current;
    if (!mesh) return;
    // Yaklaştıkça bulutlar incelir; yakın planı kapatmasınlar.
    const worldZoom = worldZoomOf((camera as { zoom: number }).zoom, size);
    material.opacity = 0.5 - 0.38 * Math.min(1, Math.max(0, (worldZoom - 1.5) / 4));
    const t = animate ? clock.elapsedTime : 0;
    puffs.forEach((puff, i) => {
      scratch.p.set(puff.x + Math.sin(t * 0.08 + puff.phase) * 6, puff.y + Math.sin(t * 0.3 + puff.phase) * 0.6, puff.z);
      scratch.s.set(puff.sx, puff.sy, puff.sz);
      mesh.setMatrixAt(i, scratch.m.compose(scratch.p, scratch.q, scratch.s));
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (puffs.length === 0) return null;
  return <instancedMesh key={puffs.length} ref={ref} args={[geometry, material, puffs.length]} frustumCulled={false} />;
}

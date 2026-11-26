/**
 * AYRINTILAR — dünyayı yakından zenginleştiren küçük şeyler:
 *   · çayır otları ve çiçekler (yalnızca yakınlaşınca çizilir),
 *   · kıyı önündeki sığ sularda yarısı batık kayalar,
 *   · deniz yollarında (content/sites.ts → SEA_ROUTES) dolaşan, hafifçe sallanan yelkenliler.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { DoubleSide, type Group } from "three";
import { SEA_ROUTES } from "../content/sites";
import type { Terrain } from "../game/terrain";
import { box, cone, cylinder, dodeca, merge } from "./geometryKit";
import { InstancedParts, type InstanceTransform } from "./InstancedParts";
import { scatterSeaRocks, scatterTufts } from "./layout";
import { isHiddenAt, type LandVisibility } from "../game/visibility";
import { foggedLambert } from "./materials";
import type { FogUniforms } from "./shaders/fog";
import { WATER_LEVEL, groundY, worldZoomOf } from "./worldScale";

const TUFT = merge(cone(0.42, 2.2, 3, { at: [0, 1.1, 0] }), cone(0.38, 1.7, 3, { at: [0.6, 0.85, 0.15], rz: -0.35 }), cone(0.38, 1.9, 3, { at: [-0.55, 0.95, -0.15], rz: 0.35 }));
const FLOWER = merge(cylinder(0.1, 0.1, 1.6, 3, { at: [0, 0.8, 0] }), box(0.8, 0.5, 0.8, { at: [0, 1.75, 0], ry: 0.6 }), box(0.5, 0.4, 0.5, { at: [0.7, 1.3, 0.3], ry: 0.2 }));
const SEA_ROCK = dodeca(1.6, { scale: [1, 1.4, 1] });
const HULL = merge(box(2.6, 1.1, 6, { at: [0, 0.35, 0] }), box(1.8, 0.8, 1.6, { at: [0, 0.55, 3.4], rx: -0.25 }));
const MAST = cylinder(0.12, 0.14, 6, 4, { at: [0, 3.4, -0.2] });
const SAIL = box(0.08, 3.6, 2.6, { at: [0, 3.8, -1.2] });

/** Otların göründüğü en uzak dünya zoom'u (uzaktan zaten seçilemez, çizim boşa gider). */
const TUFT_ZOOM = 2.6;
const SAIL_COLORS = ["#f1e9d2", "#c4413a", "#e2b23c", "#3f6f8a", "#f1e9d2", "#2a9677"];

interface DetailsProps {
  terrain: Terrain;
  seed: number;
  fogUniforms: FogUniforms;
  /** Karartılı karada çayır otu ve çiçek çizilmez. */
  visibility: LandVisibility;
  animate: boolean;
}

export function Details({ terrain, seed, fogUniforms, visibility, animate }: DetailsProps) {
  const m = useMemo(
    () => ({
      tinted: foggedLambert(fogUniforms, { color: "#ffffff" }),
      rock: foggedLambert(fogUniforms, { color: "#8d929b" }),
      wood: foggedLambert(fogUniforms, { color: "#6e4424" }),
    }),
    [fogUniforms],
  );
  useEffect(() => () => Object.values(m).forEach((material) => material.dispose()), [m]);

  const tufts = useMemo(() => {
    const all = scatterTufts(terrain, seed).filter((t) => !isHiddenAt(terrain, visibility, t));
    const toItem = (t: (typeof all)[number]): InstanceTransform => ({ position: [t.x, groundY(terrain, t) - 0.1, t.y], rotationY: t.rotation, scale: t.scale, color: t.color });
    return { grass: all.filter((t) => !t.flower).map(toItem), flowers: all.filter((t) => t.flower).map(toItem) };
  }, [terrain, seed, visibility]);

  const rocks = useMemo(
    () =>
      scatterSeaRocks(terrain, seed).map<InstanceTransform>((r) => ({
        position: [r.x, WATER_LEVEL - 0.9 + r.scale * 0.3, r.y],
        rotationY: r.rotation,
        scale: r.scale,
      })),
    [terrain, seed],
  );

  const boats = useMemo(
    () =>
      SEA_ROUTES.flatMap((route, r) =>
        Array.from({ length: route.boats }, (_, k) => ({ route, phase: (k / route.boats) * Math.PI * 2 + r, sail: SAIL_COLORS[(r * 2 + k) % SAIL_COLORS.length] })),
      ),
    [],
  );
  const boatRefs = useRef<Group[]>([]);
  const tuftGroup = useRef<Group>(null);
  const { camera, size } = useThree();

  useFrame(({ clock }) => {
    if (tuftGroup.current) tuftGroup.current.visible = worldZoomOf((camera as { zoom: number }).zoom, size) >= TUFT_ZOOM;
    const t = animate ? clock.elapsedTime : 0;
    boats.forEach((boat, i) => {
      const group = boatRefs.current[i];
      if (!group) return;
      const { center, rx, ry, speed } = boat.route;
      const a = boat.phase + t * speed;
      const x = center.x + Math.cos(a) * rx;
      const z = center.y + Math.sin(a) * ry;
      // Gidiş yönü: elipsin teğeti.
      const dx = -Math.sin(a) * rx * Math.sign(speed);
      const dz = Math.cos(a) * ry * Math.sign(speed);
      group.position.set(x, WATER_LEVEL + 0.1 + Math.sin(t * 1.4 + i) * 0.15, z);
      group.rotation.set(Math.sin(t * 1.1 + i) * 0.04, Math.atan2(dx, dz), Math.sin(t * 0.9 + i * 2) * 0.06);
    });
  });

  return (
    <group>
      <group ref={tuftGroup}>
        <InstancedParts geometry={TUFT} material={m.tinted} items={tufts.grass} castShadow={false} />
        <InstancedParts geometry={FLOWER} material={m.tinted} items={tufts.flowers} castShadow={false} />
      </group>
      <InstancedParts geometry={SEA_ROCK} material={m.rock} items={rocks} receiveShadow />
      {boats.map((boat, i) => (
        <group
          key={i}
          ref={(el) => {
            if (el) boatRefs.current[i] = el;
          }}
        >
          <mesh geometry={HULL} material={m.wood} castShadow />
          <mesh geometry={MAST} material={m.wood} castShadow />
          <mesh geometry={SAIL} castShadow>
            <meshLambertMaterial color={boat.sail} side={DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

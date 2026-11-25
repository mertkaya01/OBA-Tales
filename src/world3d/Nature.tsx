/**
 * Doğa: ağaçlar, kayalar ve buz kristalleri. Binlerce parça birkaç "instanced" çizimle gösterilir.
 *
 *   · Çam: üç katlı; karlı yerlerde her katın üstünde kar şapkası.
 *   · Yapraklı: dört yuvarlak öbekten gür bir taç.
 *   · Kavak: ince uzun taç. Huş: beyaz gövde (soğuk yaylalarda).
 *   · Hepsi rüzgârda hafifçe sallanır (tepesi gövdesinden çok); her ağacın kendi ritmi var.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { ConeGeometry, CylinderGeometry, DodecahedronGeometry, IcosahedronGeometry, OctahedronGeometry, type Material } from "three";
import { COLD_KINDS, type Terrain } from "../game/terrain";
import { TERRAIN_KINDS } from "../types";
import { merge } from "./geometryKit";
import { InstancedParts, type InstanceTransform } from "./InstancedParts";
import { scatterIce, scatterRocks, scatterTrees } from "./layout";
import { foggedLambert, pickByPosition } from "./materials";
import type { FogUniforms } from "./shaders/fog";
import { groundY } from "./worldScale";

// Geometriler bir kez oluşturulur; tabanları y=0'a oturur.
const TRUNK = new CylinderGeometry(0.32, 0.5, 2.2, 5).translate(0, 1.1, 0);
const TALL_TRUNK = new CylinderGeometry(0.26, 0.4, 3.6, 5).translate(0, 1.8, 0);
const PINE = merge(
  new ConeGeometry(2.5, 3.2, 7).translate(0, 2.9, 0),
  new ConeGeometry(2.0, 2.9, 7).translate(0, 4.5, 0),
  new ConeGeometry(1.4, 2.5, 7).translate(0, 5.9, 0),
);
const PINE_SNOW = merge(
  new ConeGeometry(1.55, 1.0, 7).translate(0, 3.95, 0),
  new ConeGeometry(1.2, 0.9, 7).translate(0, 5.45, 0),
  new ConeGeometry(0.75, 0.8, 7).translate(0, 6.85, 0),
);
const LEAFY = merge(
  new IcosahedronGeometry(2.2, 0).translate(0, 3.6, 0),
  new IcosahedronGeometry(1.6, 0).translate(1.35, 3.1, 0.4),
  new IcosahedronGeometry(1.5, 0).translate(-1.15, 3.35, -0.6),
  new IcosahedronGeometry(1.3, 0).translate(0.2, 4.95, 0.1),
);
const POPLAR = new IcosahedronGeometry(1.25, 0).scale(1, 2.4, 1).translate(0, 5.6, 0);
const ROCK = new DodecahedronGeometry(1.4, 0).translate(0, 0.5, 0);
const ICE = new OctahedronGeometry(1, 0).scale(0.8, 3, 0.8).translate(0, 2.2, 0);

const TREE_SIZE = 1.35;

const PINE_COLORS = ["#2f5d43", "#3b6e4f", "#294f3d", "#356349", "#2c5a48"];
const FROSTED_PINE = ["#46695a", "#4f7363", "#3f6252"];
const LEAFY_COLORS = ["#5f8f4a", "#6fa055", "#7aa860", "#8ab36a", "#6a9a4e"];
const POPLAR_COLORS = ["#6f9a46", "#82aa52", "#93b85e"];
const BIRCH_LEAVES = ["#c9b45a", "#d8c06a", "#b9a84e"];
const ROCK_COLORS = ["#a3a9b3", "#b1b7c0", "#959ba6"];
const ICE_COLORS = ["#bfe1f0", "#d9f0f8", "#a9d4ea"];
const TRUNK_BROWN = "#6b4a2e";
const TRUNK_BIRCH = "#e8e4da";

/** Rüzgâr: ağacın tepesi gövdesinden çok sallanır; her ağaç (konumuna göre) kendi ritminde. */
const SWAY_VERTEX = /* glsl */ `
#ifdef USE_INSTANCING
{
  vec3 kbRoot = instanceMatrix[3].xyz;
  float kbBend = max( 0.0, position.y - 1.5 ) * 0.045;
  float kbPhase = kbRoot.x * 0.11 + kbRoot.z * 0.07;
  transformed.x += sin( uSwayTime * 1.3 + kbPhase ) * kbBend;
  transformed.z += sin( uSwayTime * 0.9 + kbPhase * 1.7 ) * kbBend * 0.6;
}
#endif`;

function withSway<T extends Material>(material: T, time: { value: number }): T {
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.uSwayTime = time;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uSwayTime;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${SWAY_VERTEX}`);
  };
  const previousKey = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${previousKey()}-ruzgar`;
  return material;
}

interface NatureProps {
  terrain: Terrain;
  seed: number;
  fogUniforms: FogUniforms;
  animate?: boolean;
}

export function Nature({ terrain, seed, fogUniforms, animate = true }: NatureProps) {
  const sway = useMemo(() => ({ value: 0 }), []);
  const materials = useMemo(
    () => ({
      trunk: foggedLambert(fogUniforms, { color: "#ffffff" }),
      foliage: withSway(foggedLambert(fogUniforms, { color: "#ffffff" }), sway),
      snow: withSway(foggedLambert(fogUniforms, { color: "#eef5f7" }), sway),
      rock: foggedLambert(fogUniforms, { color: "#ffffff" }),
      ice: foggedLambert(fogUniforms, { color: "#ffffff", emissive: "#2a5a78", emissiveIntensity: 0.35 }),
    }),
    [fogUniforms, sway],
  );

  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);
  useFrame((_, delta) => {
    if (animate) sway.value += delta;
  });

  const parts = useMemo(() => {
    const trees = scatterTrees(terrain, seed);
    const trunks: InstanceTransform[] = [];
    const tallTrunks: InstanceTransform[] = [];
    const pines: InstanceTransform[] = [];
    const snowCaps: InstanceTransform[] = [];
    const leafy: InstanceTransform[] = [];
    const poplars: InstanceTransform[] = [];
    for (const t of trees) {
      const position = [t.x, groundY(terrain, t) - 0.2, t.y] as const;
      // Uzaktan da seçilsinler diye ağaçlar karakterlerden belirgin şekilde büyük.
      const scale = t.scale * TREE_SIZE;
      const crown = { position, rotationY: t.rotation, scale };
      const pick = Math.abs(Math.floor(t.x * 3.7 + t.y * 5.3)) % 4;
      if (t.conifer) {
        trunks.push({ ...crown, color: TRUNK_BROWN });
        pines.push({ ...crown, color: pickByPosition(t.snowy ? FROSTED_PINE : PINE_COLORS, t.x, t.y) });
        if (t.snowy) snowCaps.push(crown);
      } else if (pick === 0) {
        // Kavak ya da (soğukta) huş: ince uzun.
        const birch = t.snowy || sampleCold(terrain, t);
        tallTrunks.push({ ...crown, color: birch ? TRUNK_BIRCH : TRUNK_BROWN });
        poplars.push({ ...crown, color: pickByPosition(birch ? BIRCH_LEAVES : POPLAR_COLORS, t.x, t.y) });
      } else {
        trunks.push({ ...crown, color: TRUNK_BROWN });
        leafy.push({ ...crown, color: pickByPosition(LEAFY_COLORS, t.x, t.y) });
      }
    }
    const rocks = scatterRocks(terrain, seed).map<InstanceTransform>((r) => ({
      position: [r.x, groundY(terrain, r) - 0.3, r.y],
      rotationY: r.rotation,
      scale: [r.scale, r.scale * 0.7, r.scale],
      color: pickByPosition(ROCK_COLORS, r.x, r.y),
    }));
    const ice = scatterIce(terrain, seed).map<InstanceTransform>((p) => ({
      position: [p.x, groundY(terrain, p) - 0.4, p.y],
      rotationY: p.rotation,
      scale: p.scale,
      color: pickByPosition(ICE_COLORS, p.x, p.y),
    }));
    return { trunks, tallTrunks, pines, snowCaps, leafy, poplars, rocks, ice };
  }, [terrain, seed]);

  return (
    <group>
      <InstancedParts geometry={TRUNK} material={materials.trunk} items={parts.trunks} />
      <InstancedParts geometry={TALL_TRUNK} material={materials.trunk} items={parts.tallTrunks} />
      <InstancedParts geometry={PINE} material={materials.foliage} items={parts.pines} />
      <InstancedParts geometry={PINE_SNOW} material={materials.snow} items={parts.snowCaps} castShadow={false} />
      <InstancedParts geometry={LEAFY} material={materials.foliage} items={parts.leafy} />
      <InstancedParts geometry={POPLAR} material={materials.foliage} items={parts.poplars} />
      <InstancedParts geometry={ROCK} material={materials.rock} items={parts.rocks} receiveShadow />
      <InstancedParts geometry={ICE} material={materials.ice} items={parts.ice} />
    </group>
  );
}

/** Soğuk arazide mi (huş ağacı için)? */
function sampleCold(terrain: Terrain, p: { x: number; y: number }): boolean {
  const col = Math.min(terrain.cols - 1, Math.max(0, Math.floor(p.x / terrain.cellSize)));
  const row = Math.min(terrain.rows - 1, Math.max(0, Math.floor(p.y / terrain.cellSize)));
  const kind = TERRAIN_KINDS[terrain.kinds[row * terrain.cols + col]];
  return kind !== undefined && COLD_KINDS.has(kind);
}

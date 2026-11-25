/**
 * Deniz: adanın dışına uzanan derin okyanus tabanı ve üstünde parıldayan yarı saydam su yüzeyi.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Color, DataTexture, DoubleSide, LinearFilter, MeshLambertMaterial, RedFormat, ShaderMaterial, Vector2 } from "three";
import type { Terrain } from "../game/terrain";
import { TERRAIN_COLORS } from "../game/palette";
import { WORLD_SIZE } from "../types";
import type { SkyRuntime } from "./living/sky";
import { OCEAN_FRAGMENT, OCEAN_VERTEX } from "./shaders/ocean";
import { SEA_FLOOR, WATER_LEVEL } from "./worldScale";

const SIZE = 8000;
const CENTER: [number, number, number] = [WORLD_SIZE.width / 2, 0, WORLD_SIZE.height / 2];

/** Her deniz hücresinin kıyıya uzaklığı (0 = kıyı, 255 = 48 birim ve ötesi): kıyı dalgaları için. */
function shoreTexture(terrain: Terrain): DataTexture {
  const { cols, rows, shore } = terrain;
  const data = new Uint8Array(cols * rows);
  for (let i = 0; i < data.length; i++) data[i] = shore[i] >= 0 ? 0 : Math.min(255, Math.round((-shore[i] / 48) * 255));
  const texture = new DataTexture(data, cols, rows, RedFormat);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function Ocean({ terrain, animate, sky }: { terrain: Terrain; animate: boolean; sky: SkyRuntime }) {
  const shore = useMemo(() => shoreTexture(terrain), [terrain]);
  const floorMaterial = useMemo(() => new MeshLambertMaterial({ color: TERRAIN_COLORS.deepSea }), []);
  const surfaceMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: OCEAN_VERTEX,
        fragmentShader: OCEAN_FRAGMENT,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new Color(TERRAIN_COLORS.shallow) },
          uGlint: { value: new Color(TERRAIN_COLORS.foam) },
          uOpacity: { value: 0.28 },
          uSea: { value: 1 },
          uShore: { value: shore },
          uWorldSize: { value: new Vector2(WORLD_SIZE.width, WORLD_SIZE.height) },
        },
      }),
    [shore],
  );

  useEffect(
    () => () => {
      floorMaterial.dispose();
      surfaceMaterial.dispose();
      shore.dispose();
    },
    [floorMaterial, surfaceMaterial, shore],
  );

  useFrame((_, delta) => {
    if (animate) surfaceMaterial.uniforms.uTime.value += delta;
    surfaceMaterial.uniforms.uSea.value = sky.sea;
  });

  return (
    <group>
      <mesh position={[CENTER[0], SEA_FLOOR + 0.6, CENTER[2]]} rotation-x={-Math.PI / 2} material={floorMaterial} receiveShadow>
        <planeGeometry args={[SIZE, SIZE]} />
      </mesh>
      <mesh position={[CENTER[0], WATER_LEVEL, CENTER[2]]} rotation-x={-Math.PI / 2} material={surfaceMaterial}>
        <planeGeometry args={[SIZE, SIZE]} />
      </mesh>
    </group>
  );
}

/**
 * KARARTI — hikâyede henüz açılmamış karayı (arazi, kıyıdaki sığlık) koyu bir gece silüetine boyar.
 *
 * Standart Three.js malzemelerine (Lambert) küçük bir ek yapılır: dünya konumundan karartı dokusu (paintVeil)
 * okunur ve renk karartı rengine doğru karıştırılır. Karartı tam kapatmaz: kabartmanın gölgesi hafifçe seçilir.
 * Karartılı karadaki ağaç, oba ve köprüler zaten çizilmez (game/visibility.ts).
 */
import { Color, type Material, type Texture } from "three";
import { VEIL_COLOR } from "../../game/terrainPaint";
import { WORLD_SIZE } from "../../types";

export interface FogUniforms {
  uFogMap: { value: Texture | null };
  uMist: { value: Color };
  uFogStrength: { value: number };
  [key: string]: { value: unknown };
}

export function createFogUniforms(): FogUniforms {
  return {
    uFogMap: { value: null },
    uMist: { value: new Color(VEIL_COLOR) },
    uFogStrength: { value: 0.9 },
  };
}

const VERTEX_DECLARATIONS = /* glsl */ `
#include <common>
varying vec2 vKbFogUv;
`;

const VERTEX_WORLD = /* glsl */ `
#include <worldpos_vertex>
{
  vec4 kbWorld = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    kbWorld = instanceMatrix * kbWorld;
  #endif
  kbWorld = modelMatrix * kbWorld;
  vKbFogUv = vec2( kbWorld.x / ${WORLD_SIZE.width.toFixed(1)}, kbWorld.z / ${WORLD_SIZE.height.toFixed(1)} );
}
`;

const FRAGMENT_DECLARATIONS = /* glsl */ `
#include <common>
uniform sampler2D uFogMap;
uniform vec3 uMist;
uniform float uFogStrength;
varying vec2 vKbFogUv;
`;

const FRAGMENT_APPLY = /* glsl */ `
#include <dithering_fragment>
{
  vec2 kbUv = clamp( vKbFogUv, 0.0, 1.0 );
  float kbFog = texture2D( uFogMap, kbUv ).a * uFogStrength;
  gl_FragColor.rgb = mix( gl_FragColor.rgb, uMist, kbFog );
}
`;

/** Malzemeye sis ekini uygular ve aynı malzemeyi döndürür. */
export function applyFogOfWar<T extends Material>(material: T, uniforms: FogUniforms): T {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", VERTEX_DECLARATIONS)
      .replace("#include <worldpos_vertex>", VERTEX_WORLD);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", FRAGMENT_DECLARATIONS)
      .replace("#include <dithering_fragment>", FRAGMENT_APPLY);
  };
  material.customProgramCacheKey = () => "kb-sis";
  return material;
}

/**
 * Karakter malzemeleri.
 *
 * Bütün parçalar tek bir "boyalı" malzemeyi paylaşır; her kopyanın rengi instanceColor'dan gelir.
 * Hareketin tamamı ekran kartında hesaplanır (living/motion.ts):
 *   · gezinme: evden uzaklık, yeni yerdeki zemin yüksekliği (arazi yükseklik dokusundan)
 *   · yön: yürürken gittiği yöne, dururken kameraya döner
 *   · yürüyüş: bacaklar kalçadan, kollar (ve tuttukları) omuzdan sallanır; gövde her adımda hafifçe seker
 *   · Oba Narası: akın meydanındakiler zıplarken kollarını (kalkan, kılıç, yay, fener) havaya kaldırır
 *   · nefes: dururken gövde hafifçe inip kalkar; akın meydanında Oba Narası zıplaması
 * Gölgeler de aynı hareketi yapar (depth malzemesi). Karakterler sis ekini almaz; sisin içinde de net görünürler.
 */
import {
  DataTexture,
  FloatType,
  MeshBasicMaterial,
  MeshDepthMaterial,
  MeshLambertMaterial,
  NearestFilter,
  RedFormat,
  RGBADepthPacking,
  Vector3,
  type Material,
} from "three";
import type { Terrain } from "../../game/terrain";
import { CHEER_PERIOD, MOTION_GLSL, STEP_RATE } from "../living/motion";

export interface CharacterUniforms {
  /** Dünya saati (saniye): hareketin ortak zamanı. İşlemci tarafı da buradan okur. */
  uTime: { value: number };
  uHeightMap: { value: DataTexture };
  uHeightGrid: { value: Vector3 };
}

/** Arazi yüksekliklerini ekran kartının okuyabileceği bir dokuya koyar (satır = y, sütun = x). */
export function createCharacterUniforms(terrain: Terrain): CharacterUniforms {
  const texture = new DataTexture(terrain.heights, terrain.cols, terrain.rows, RedFormat, FloatType);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.needsUpdate = true;
  return {
    uTime: { value: 0 },
    uHeightMap: { value: texture },
    uHeightGrid: { value: new Vector3(terrain.cols, terrain.rows, terrain.cellSize) },
  };
}

export interface MotionOptions {
  /** Program önbelleği için kısa ad. */
  key: string;
  /** Yürürken bacak salınımı. */
  legs?: boolean;
  /** Yürürken kol salınımı ve narada kolları kaldırma. */
  arms?: boolean;
  /** Dururken nefes alma. */
  breathe?: boolean;
  /** Gittiği yöne dönme. */
  turn?: boolean;
  /** Adım ve nara zıplaması. */
  hop?: boolean;
  /** Hareketten önce yerel koordinatta çalışacak ek GLSL (ör. aura nabzı). */
  before?: string;
}

const BOB = 0.12;
/** Omuz eklemi (yerel koordinat): kollar buradan döner. */
const SHOULDER = { x: 0.82, y: 2.62 };

function motionVertex(o: MotionOptions): string {
  return /* glsl */ `
#ifdef USE_INSTANCING
{
  vec3 kbHome = instanceMatrix[3].xyz;
  float kbScale = length( instanceMatrix[0].xyz );
  vec2 kbOffset; float kbYaw; float kbWalk; float kbHop;
  kbMotion( aMotion, uTime, kbOffset, kbYaw, kbWalk, kbHop );
  ${o.before ?? ""}
  ${
    o.legs
      ? /* glsl */ `
  float kbSwing = ( position.x > 0.0 ? 1.0 : -1.0 ) * sin( uTime * ${STEP_RATE.toFixed(1)} + aMotion.y * 20.0 ) * 0.6 * kbWalk;
  vec2 kbHip = vec2( transformed.y - 1.0, transformed.z );
  transformed.y = 1.0 + kbHip.x * cos( kbSwing ) - kbHip.y * sin( kbSwing );
  transformed.z = kbHip.x * sin( kbSwing ) + kbHip.y * cos( kbSwing );`
      : ""
  }
  ${
    o.arms
      ? /* glsl */ `
  // Kollar: önce yana kalkar (narada), sonra ileri-geri sallanır (yürürken, bacakların tersine).
  float kbSide = position.x > 0.0 ? 1.0 : -1.0;
  float kbRaise = 0.0;
  if ( aMotion.w >= 0.0 ) {
    float kbCheer = mod( uTime - aMotion.w + 0.12, ${CHEER_PERIOD.toFixed(1)} );
    kbRaise = kbCheer < 1.3 ? sin( kbCheer / 1.3 * PI ) : 0.0;
  }
  vec2 kbShoulder = vec2( kbSide * ${SHOULDER.x}, ${SHOULDER.y} );
  vec2 kbArm = transformed.xy - kbShoulder;
  float kbA = kbSide * kbRaise * 2.5;
  transformed.xy = kbShoulder + vec2( kbArm.x * cos( kbA ) - kbArm.y * sin( kbA ), kbArm.x * sin( kbA ) + kbArm.y * cos( kbA ) );
  float kbArmSwing = -kbSide * sin( uTime * ${STEP_RATE.toFixed(1)} + aMotion.y * 20.0 ) * 0.5 * kbWalk;
  vec2 kbFore = vec2( transformed.y - ${SHOULDER.y}, transformed.z );
  transformed.y = ${SHOULDER.y} + kbFore.x * cos( kbArmSwing ) - kbFore.y * sin( kbArmSwing );
  transformed.z = kbFore.x * sin( kbArmSwing ) + kbFore.y * cos( kbArmSwing );`
      : ""
  }
  ${
    o.breathe
      ? /* glsl */ `
  float kbBreath = sin( uTime * 2.2 + aMotion.y * 37.0 ) * 0.5 + 0.5;
  transformed.y += kbBreath * ${BOB} * smoothstep( 0.6, 1.4, position.y ) * ( 1.0 - kbWalk );`
      : ""
  }
  ${
    o.turn
      ? /* glsl */ `
  float kbC = cos( kbYaw );
  float kbS = sin( kbYaw );
  transformed.xz = vec2( transformed.x * kbC + transformed.z * kbS, -transformed.x * kbS + transformed.z * kbC );`
      : ""
  }
  float kbLift = kbGroundY( kbHome.xz + kbOffset ) - kbHome.y${o.hop ? " + kbHop" : ""};
  transformed += vec3( kbOffset.x, kbLift, kbOffset.y ) / kbScale;
}
#endif`;
}

/** Malzemeye kalabalık hareketini ekler ve aynı malzemeyi döndürür. */
export function withCharacterMotion<T extends Material>(material: T, uniforms: CharacterUniforms, options: MotionOptions): T {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uHeightMap = uniforms.uHeightMap;
    shader.uniforms.uHeightGrid = uniforms.uHeightGrid;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${MOTION_GLSL}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${motionVertex(options)}`);
  };
  material.customProgramCacheKey = () => `kb-hareket-${options.key}`;
  return material;
}

export function createCharacterMaterials(uniforms: CharacterUniforms) {
  const body = { breathe: true, turn: true, hop: true } as const;
  return {
    /** Kumaş, ten, saç, metal: köşeli ve ışıktan etkilenen. */
    tinted: withCharacterMotion(new MeshLambertMaterial({ color: "#ffffff", flatShading: true }), uniforms, { key: "govde", ...body }),
    /** Bacaklar: aynı boya, üstüne yürüyüş salınımı. */
    legs: withCharacterMotion(new MeshLambertMaterial({ color: "#ffffff", flatShading: true }), uniforms, { key: "bacak", ...body, legs: true }),
    /** Kollar ve tuttukları (kalkan, silah, yay, kopuz): omuzdan sallanır, narada kalkar. */
    arms: withCharacterMotion(new MeshLambertMaterial({ color: "#ffffff", flatShading: true }), uniforms, { key: "kol", ...body, arms: true }),
    /** Fener, madalyon, kadim tüy, akın işareti: kendi ışığıyla parlar. */
    glow: withCharacterMotion(new MeshBasicMaterial({ color: "#ffffff" }), uniforms, { key: "parilti", ...body }),
    /** Elde taşınan ışık (fener, asa taşı). */
    glowArms: withCharacterMotion(new MeshBasicMaterial({ color: "#ffffff" }), uniforms, { key: "parilti-kol", ...body, arms: true }),
    /** Gölge haritası: gölgeler de karakterle birlikte yürür. */
    depth: withCharacterMotion(new MeshDepthMaterial({ depthPacking: RGBADepthPacking }), uniforms, { key: "golge", ...body }),
    depthArms: withCharacterMotion(new MeshDepthMaterial({ depthPacking: RGBADepthPacking }), uniforms, { key: "golge-kol", ...body, arms: true }),
    /** Tıklama alanı: görünmez ama ışın testine girer. */
    hit: new MeshBasicMaterial({ visible: false }),
  };
}

export type CharacterMaterials = ReturnType<typeof createCharacterMaterials>;

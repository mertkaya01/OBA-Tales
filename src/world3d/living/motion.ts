/**
 * HAREKET — kalabalık nasıl yaşar?
 *
 *   · Gezginler evlerinin çevresinde küçük turlar atar: bir noktada durup kameraya döner, etrafına bakınır,
 *     sonra sıradaki noktaya seke seke yürür. Her karakterin ritmi, yönü ve tur genişliği kendine özgüdür.
 *   · Bazıları yerinden hiç kımıldamaz (sohbet eden, dinlenen, nöbet tutan).
 *   · Akın meydanındakiler sıralarında durur; birkaç saniyede bir ön sıradan arkaya doğru dalga gibi
 *     zıplayarak "Oba Narası" atarlar.
 *
 * Hesap ekran kartında yapılır (MOTION_GLSL): binlerce karakter için işlemciye yük binmez. Aynı formülün
 * JavaScript ikizi (motionAt) yalnızca seçili karakterin plakası, seçim halkası ve tıklama alanı içindir.
 * İkisi aynı sıradaki işlemleri yapar; değiştirirken ikisini birlikte değiştir.
 */
import { HEIGHT_SCALE, SEA_FLOOR } from "../worldScale";

export interface MotionParams {
  /** Gezinme yarıçapı (dünya birimi); 0 = yerinde durur. */
  radius: number;
  /** 0–1 arası kişisel tohum: ritim, ilk yön, adım fazı. */
  seed: number;
  /** Dururken baktığı yön (radyan; 0 = güneye, kameraya). */
  yaw: number;
  /** Akın narası gecikmesi (saniye); < 0 ise akında değil. */
  cheer: number;
}

export interface MotionState {
  /** Evden uzaklık (dünya birimi, x ve z). */
  dx: number;
  dz: number;
  /** Baktığı yön (radyan). */
  yaw: number;
  /** Yürüme miktarı: 0 = duruyor, 1 = tam adım. */
  walk: number;
  /** Zıplama yüksekliği (dünya birimi). */
  hop: number;
}

const TAU = Math.PI * 2;
const GOLDEN = 2.3999632;
/** Adım hızı (radyan/saniye): her bacak saniyede ≈1,4 adım. */
export const STEP_RATE = 9;
/** Oba Narası: her bu kadar saniyede bir. */
export const CHEER_PERIOD = 7;
const CHEER_LENGTH = 0.55;
const CHEER_HEIGHT = 1.1;
const WALK_HOP = 0.22;

/** GLSL'in mod'u: sonuç her zaman bölenle aynı işaretli (JavaScript'in %'si negatifte farklıdır). */
const glslMod = (x: number, y: number) => x - y * Math.floor(x / y);
const fract = (x: number) => x - Math.floor(x);
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mixAngle = (a: number, b: number, s: number) => a + (glslMod(b - a + Math.PI, TAU) - Math.PI) * s;

/** Tur periyodu (saniye): 16–26 sn. */
export const cyclePeriod = (seed: number) => 16 + 10 * seed;

function waypoint(k: number, seed: number, radius: number): [number, number] {
  const a = seed * TAU + k * GOLDEN;
  const r = radius * (0.35 + 0.65 * fract(k * 0.618034 + seed * 3.1));
  return [Math.cos(a) * r, Math.sin(a) * r];
}

const angleTo = (dx: number, dz: number) => Math.atan2(dx, dz);

/** t anındaki hareket durumu (MOTION_GLSL'deki kbMotion'ın ikizi). */
export function motionAt(p: MotionParams, t: number, out: MotionState = { dx: 0, dz: 0, yaw: 0, walk: 0, hop: 0 }): MotionState {
  out.dx = 0;
  out.dz = 0;
  out.yaw = p.yaw;
  out.walk = 0;
  out.hop = 0;
  if (p.cheer >= 0) {
    const c = glslMod(t - p.cheer, CHEER_PERIOD);
    out.hop = c < CHEER_LENGTH ? Math.sin((c / CHEER_LENGTH) * Math.PI) * CHEER_HEIGHT : 0;
    return out;
  }
  if (p.radius < 0.01) return out;

  const u = t / cyclePeriod(p.seed) + p.seed * 5;
  const k = Math.floor(u);
  const f = u - k;
  const a = waypoint(k, p.seed, p.radius);
  const b = waypoint(k + 1, p.seed, p.radius);
  const prev = waypoint(k - 1, p.seed, p.radius);
  const s = smoothstep(0.55, 1, f);
  out.dx = a[0] + (b[0] - a[0]) * s;
  out.dz = a[1] + (b[1] - a[1]) * s;

  const yawIn = angleTo(a[0] - prev[0], a[1] - prev[1]);
  const yawOut = angleTo(b[0] - a[0], b[1] - a[1]);
  if (f < 0.1) out.yaw = mixAngle(yawIn, p.yaw, smoothstep(0, 0.1, f));
  else if (f < 0.47) out.yaw = p.yaw;
  else if (f < 0.55) out.yaw = mixAngle(p.yaw, yawOut, smoothstep(0.47, 0.55, f));
  else out.yaw = yawOut;

  out.walk = smoothstep(0.55, 0.6, f) * (1 - smoothstep(0.95, 1, f));
  out.hop = Math.abs(Math.sin(t * STEP_RATE + p.seed * 20)) * WALK_HOP * out.walk;
  return out;
}

/**
 * Ekran kartı tarafı. Gerekenler:
 *   attribute vec4 aMotion        → (radius, seed, yaw, cheer)
 *   uniform float uTime
 *   uniform sampler2D uHeightMap  → arazi yükseklikleri (R, kayan nokta), satır = y, sütun = x
 *   uniform vec3 uHeightGrid      → (sütun, satır, hücre boyu)
 */
export const MOTION_GLSL = /* glsl */ `
attribute vec4 aMotion;
uniform float uTime;
uniform sampler2D uHeightMap;
uniform vec3 uHeightGrid;

float kbHeightAt( ivec2 c ) {
  return texelFetch( uHeightMap, c, 0 ).r;
}

// game/terrain.ts → sampleHeightBilinear ve worldScale.ts → heightToY ile aynı.
float kbGroundY( vec2 p ) {
  vec2 f = clamp( p / uHeightGrid.z - 0.5, vec2( 0.0 ), uHeightGrid.xy - 1.0 );
  vec2 f0 = floor( f );
  vec2 t = f - f0;
  ivec2 c0 = ivec2( f0 );
  ivec2 c1 = min( c0 + 1, ivec2( uHeightGrid.xy ) - 1 );
  float top = mix( kbHeightAt( c0 ), kbHeightAt( ivec2( c1.x, c0.y ) ), t.x );
  float bottom = mix( kbHeightAt( ivec2( c0.x, c1.y ) ), kbHeightAt( c1 ), t.x );
  float h = mix( top, bottom, t.y );
  return h >= 0.0 ? 0.6 + h * ${HEIGHT_SCALE.toFixed(1)} : max( ${SEA_FLOOR.toFixed(1)}, h * 18.0 - 0.5 );
}

const float KB_TAU = 6.2831853;

vec2 kbWaypoint( float k, float seed, float radius ) {
  float a = seed * KB_TAU + k * 2.3999632;
  float r = radius * ( 0.35 + 0.65 * fract( k * 0.618034 + seed * 3.1 ) );
  return vec2( cos( a ), sin( a ) ) * r;
}

float kbMixAngle( float a, float b, float s ) {
  return a + ( mod( b - a + PI, KB_TAU ) - PI ) * s;
}

void kbMotion( vec4 m, float t, out vec2 offset, out float yaw, out float walk, out float hop ) {
  offset = vec2( 0.0 );
  yaw = m.z;
  walk = 0.0;
  hop = 0.0;
  if ( m.w >= 0.0 ) {
    float c = mod( t - m.w, ${CHEER_PERIOD.toFixed(1)} );
    hop = c < ${CHEER_LENGTH} ? sin( c / ${CHEER_LENGTH} * PI ) * ${CHEER_HEIGHT} : 0.0;
    return;
  }
  if ( m.x < 0.01 ) return;
  float u = t / ( 16.0 + 10.0 * m.y ) + m.y * 5.0;
  float k = floor( u );
  float f = u - k;
  vec2 a = kbWaypoint( k, m.y, m.x );
  vec2 b = kbWaypoint( k + 1.0, m.y, m.x );
  vec2 p = kbWaypoint( k - 1.0, m.y, m.x );
  offset = mix( a, b, smoothstep( 0.55, 1.0, f ) );
  float yawIn = atan( a.x - p.x, a.y - p.y );
  float yawOut = atan( b.x - a.x, b.y - a.y );
  if ( f < 0.1 ) yaw = kbMixAngle( yawIn, m.z, smoothstep( 0.0, 0.1, f ) );
  else if ( f < 0.47 ) yaw = m.z;
  else if ( f < 0.55 ) yaw = kbMixAngle( m.z, yawOut, smoothstep( 0.47, 0.55, f ) );
  else yaw = yawOut;
  walk = smoothstep( 0.55, 0.6, f ) * ( 1.0 - smoothstep( 0.95, 1.0, f ) );
  hop = abs( sin( t * ${STEP_RATE.toFixed(1)} + m.y * 20.0 ) ) * ${WALK_HOP} * walk;
}
`;

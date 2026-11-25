/**
 * DENİZ YÜZEYİ — yarı saydam, yavaşça kayan parıltı şeritleri olan buzlu deniz.
 * Altındaki boyalı deniz tabanı (sığlık, köpük) görünmeye devam eder.
 *
 * Kıyı dalgaları: uShore dokusu her deniz noktasının kıyıya uzaklığını taşır. Uzaklığa bağlı, zamanla kıyıya
 * doğru kayan ince köpük çizgileri çizilir; kıyıya yaklaştıkça sıklaşır ve parlar, açıkta kaybolur.
 */

export const OCEAN_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4( position, 1.0 );
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const OCEAN_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uGlint;
uniform float uOpacity;
uniform float uSea;
uniform sampler2D uShore;
uniform vec2 uWorldSize;
varying vec3 vWorld;

void main() {
  // İki yönlü dalga deseni; en tepe noktaları kısa parıltılar olur.
  float a = sin( vWorld.x * 0.09 + uTime * 0.6 ) * sin( vWorld.z * 0.07 - uTime * 0.45 );
  float b = sin( ( vWorld.x + vWorld.z ) * 0.045 - uTime * 0.3 );
  float glint = step( 0.975, a * 0.7 + b * 0.3 );

  // Kıyı dalgaları (0 = kıyı, 1 = 48 birim ve ötesi).
  vec2 uv = vWorld.xz / uWorldSize;
  float shore = 1.0;
  if ( uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0 ) shore = texture2D( uShore, uv ).r;
  float bands = fract( shore * 5.0 + uTime * 0.22 + sin( vWorld.x * 0.05 + vWorld.z * 0.04 ) * 0.08 );
  float foam = step( 0.86, bands ) * ( 1.0 - smoothstep( 0.15, 0.85, shore ) );
  float surf = ( 1.0 - smoothstep( 0.0, 0.12, shore ) ) * ( 0.55 + 0.45 * sin( uTime * 1.6 + vWorld.x * 0.1 ) );

  // Gece su kararır, parıltılar ve köpük ay ışığı gibi kalır.
  vec3 color = mix( uColor * uSea, uGlint * mix( 0.7, 1.0, uSea ), max( glint * 0.6, max( foam * 0.75, surf * 0.5 ) ) );
  gl_FragColor = vec4( color, uOpacity + glint * 0.12 + foam * 0.45 + surf * 0.3 );
}
`;

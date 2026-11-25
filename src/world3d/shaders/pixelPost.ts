/**
 * PİKSEL DİORAMA SON İŞLEMİ
 *
 * Sahne ekranın birkaç kat küçüğü bir dokuya çizilir; bu shader onu ekrana büyütürken:
 *   1. her pikseli keskin tutar (nearest),
 *   2. derinliğin Laplace'ıyla nesne sınırlarını bulup mürekkep kontur çizer
 *      (düz yamaçlar çizgi almaz, yalnızca kırılma ve kenarlar alır),
 *   3. renkleri sınırlı basamağa indirirken 4×4 Bayer düzenli titreme uygular
 *      (gölgelerde ve geçişlerde nokta deseni oluşur),
 *   4. hava karlıysa üç katman piksel kar tanesi yağdırır (her tane tam bir düşük çözünürlük pikseli).
 */

export const PIXEL_POST_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4( position.xy, 0.0, 1.0 );
}
`;

export const PIXEL_POST_FRAGMENT = /* glsl */ `
#include <packing>

uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uLowRes;
uniform float uNear;
uniform float uFar;
uniform float uLevels;
uniform float uInkThreshold;
uniform float uInkStrength;
uniform vec3 uInk;
uniform float uSaturation;
uniform float uTime;
uniform float uSnow;
uniform float uWind;
uniform vec2 uSnowShift;
uniform vec3 uSnowColor;

varying vec2 vUv;

float kbHash( vec2 p ) {
  return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
}

// Bir kar katmanı: ızgaranın her hücresinde en fazla bir tane; tane düşer, rüzgârla kayar, hafifçe salınır.
// uSnowShift dünyanın ekrandaki kayması: kamera kaydırılınca kar da dünyayla birlikte gider (parallax ile).
float kbSnowLayer( vec2 px, float cell, float speed, float size, float parallax, float density, float seed ) {
  vec2 p = px - uSnowShift * parallax;
  p.y += uTime * speed;
  p.x += uTime * speed * uWind;
  vec2 c = floor( p / cell );
  float h = kbHash( c + seed );
  if ( h > density ) return 0.0;
  vec2 local = p - c * cell;
  vec2 flake = vec2( kbHash( c + seed + 17.0 ), kbHash( c + seed + 41.0 ) ) * ( cell - size - 3.0 ) + 1.5;
  flake.x += sin( uTime * 1.6 + h * 40.0 ) * 1.2;
  vec2 d = floor( local ) - floor( flake );
  return ( d.x >= 0.0 && d.x < size && d.y >= 0.0 && d.y < size ) ? 1.0 : 0.0;
}

float viewDepth( vec2 uv ) {
  return -orthographicDepthToViewZ( texture2D( tDepth, uv ).x, uNear, uFar );
}

// 2×2 Bayer: [0 2; 3 1]  →  4×4 = 4·B2(düşük bitler) + B2(yüksek bitler)
float bayer2( vec2 p ) {
  return mod( 2.0 * p.x + 3.0 * p.y, 4.0 );
}

float bayer4( vec2 p ) {
  vec2 q = mod( p, 4.0 );
  return 4.0 * bayer2( mod( q, 2.0 ) ) + bayer2( floor( q / 2.0 ) );
}

void main() {
  vec2 texel = 1.0 / uLowRes;
  vec2 px = floor( vUv * uLowRes );
  vec2 uv = ( px + 0.5 ) * texel;

  vec3 color = texture2D( tColor, uv ).rgb;
  color = pow( max( color, 0.0 ), vec3( 1.0 / 2.2 ) );

  // Biraz daha canlı renk (oyuncak diorama hissi)
  float luma = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
  color = mix( vec3( luma ), color, uSaturation );

  // Mürekkep kontur: derinlik Laplace'ı pozitifse bu piksel komşularından öndedir → kenar.
  float d = viewDepth( uv );
  float laplace =
    viewDepth( uv + vec2( texel.x, 0.0 ) ) +
    viewDepth( uv - vec2( texel.x, 0.0 ) ) +
    viewDepth( uv + vec2( 0.0, texel.y ) ) +
    viewDepth( uv - vec2( 0.0, texel.y ) ) -
    4.0 * d;
  float ink = smoothstep( uInkThreshold, uInkThreshold * 2.5, laplace );

  // Düzenli titremeyle renk basamaklama
  float threshold = ( bayer4( px ) + 0.5 ) / 16.0 - 0.5;
  color = floor( color * uLevels + threshold + 0.5 ) / uLevels;

  color = mix( color, uInk, ink * uInkStrength );

  // Kar: uzak, orta ve yakın katman (yakındakiler daha iri, daha hızlı, daha parlak).
  if ( uSnow > 0.0 ) {
    float snow = kbSnowLayer( px, 7.0, 9.0, 1.0, 0.6, 0.12 * uSnow, 3.0 ) * 0.55;
    snow = max( snow, kbSnowLayer( px, 11.0, 15.0, 1.0, 0.8, 0.2 * uSnow, 11.0 ) * 0.8 );
    snow = max( snow, kbSnowLayer( px, 19.0, 26.0, 2.0, 1.0, 0.26 * uSnow, 29.0 ) * 0.95 );
    color = mix( color, uSnowColor, snow );
  }

  gl_FragColor = vec4( clamp( color, 0.0, 1.0 ), 1.0 );
}
`;

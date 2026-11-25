/**
 * 3D DÜNYA ÖLÇEĞİ
 *
 *   Dünya birimi (x, y)  →  Three.js (x, yükseklik, z = y)
 *   1 dünya birimi = 1 Three.js birimi; dünya 2000 × 1400 birim.
 *   Arazi yüksekliği 0–1 → 0,6–42,6 birim; deniz tabanı en fazla −7 birim.
 *
 * Kamera ortografiktir: camera.zoom = ekran pikseli / dünya birimi.
 * "Dünya zoom'u" bir ayrıntı ölçeğidir: 1 = 1000 × 700 birimlik bir alan ekrana sığar (dünyanın ilk hâlinin
 * genel görünümü). Bütün yakınlık eşikleri (etiketler, kontur, savaş efektleri, uçuşlar) bu ölçeğe bağlıdır;
 * dünya büyüyünce yakın görünüm değişmez, yalnızca daha uzağa çıkılabilir (genel görünüm ≈ 0,5).
 */
import { sampleHeightBilinear, type Terrain } from "../game/terrain";
import { WORLD_SIZE } from "../types";
import type { Coordinates } from "../types";

/** Kara yüksekliğinin Three.js birimindeki karşılığı (en yüksek nokta ≈ 42 birim). */
export const HEIGHT_SCALE = 42;
/** Su yüzeyi. */
export const WATER_LEVEL = 0.35;
/** Deniz tabanının en derin yeri. */
export const SEA_FLOOR = -7;

/** Arazi yüksekliğini (−1…1) Three.js y koordinatına çevirir. */
export function heightToY(height: number): number {
  return height >= 0 ? 0.6 + height * HEIGHT_SCALE : Math.max(SEA_FLOOR, height * 18 - 0.5);
}

/** Dünya noktasındaki zemin yüksekliği (Three.js y). */
export function groundY(terrain: Terrain, point: Coordinates): number {
  return heightToY(sampleHeightBilinear(terrain, point));
}

export interface Viewport {
  width: number;
  height: number;
}

/** Ayrıntı ölçeğinin dayanağı: dünya zoom'u 1'de ekrana sığan alan (kenarlarda arayüz payıyla). */
const DETAIL_FRAME = { width: 1000 + 60, height: 700 + 140 };

/** Bütün adaların, kenarlarda arayüze yer bırakarak ekrana sığdığı kamera zoom'u. */
export function overviewCameraZoom({ width, height }: Viewport): number {
  if (width <= 0 || height <= 0) return 1;
  // Dikeyde daha geniş pay: üstteki bölüm şeridi ve alttaki saat adaların üstüne binmesin.
  return Math.min(width / (WORLD_SIZE.width + 60), height / (WORLD_SIZE.height + 220));
}

/** Dünya zoom'u 1'in kamera zoom'u. */
export function detailCameraZoom({ width, height }: Viewport): number {
  if (width <= 0 || height <= 0) return 1;
  return Math.min(width / DETAIL_FRAME.width, height / DETAIL_FRAME.height);
}

/** Dünya zoom'unu kamera zoom'una çevirir. */
export function cameraZoomFor(worldZoom: number, viewport: Viewport): number {
  return detailCameraZoom(viewport) * worldZoom;
}

/** Kamera zoom'unun dünya zoom'u karşılığı. */
export function worldZoomOf(cameraZoom: number, viewport: Viewport): number {
  return cameraZoom / detailCameraZoom(viewport);
}

/** Bütün adaların sığdığı genel görünümün dünya zoom'u (≈ 0,5). */
export function overviewWorldZoom(viewport: Viewport): number {
  return worldZoomOf(overviewCameraZoom(viewport), viewport);
}

/** Genel görünümden ne kadar uzaklaşılabilir (genel görünümün katı). */
export const MIN_OVERVIEW_FACTOR = 0.8;
/** Eğim eğrisinin başladığı ve en yakın dünya zoom'u. */
export const MIN_WORLD_ZOOM = 0.8;
export const MAX_WORLD_ZOOM = 22;

/**
 * Kameranın dikeyden açısı (radyan): uzaktayken tepeden (≈0), yakındayken eğik.
 * Böylece genel görünüm bir harita gibi, yakın görünüm bir diorama gibi görünür.
 */
export const MAX_TILT = 0.92;

export function tiltForZoom(worldZoom: number): number {
  const t = Math.log(Math.max(worldZoom, MIN_WORLD_ZOOM) / MIN_WORLD_ZOOM) / Math.log(MAX_WORLD_ZOOM / MIN_WORLD_ZOOM);
  const eased = Math.min(1, Math.max(0, (t - 0.12) / 0.7));
  return 0.02 + (MAX_TILT - 0.02) * eased * eased * (3 - 2 * eased);
}

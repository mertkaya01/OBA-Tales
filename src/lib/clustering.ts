/**
 * KÜMELEME VE ODAK — uzak görünümde bölge sayaç balonları, bölge seçilince kamera odağı.
 *
 * "zoom" burada motordan bağımsızdır: 1 = bütün dünya ekrana sığar, 2 = iki kat yakın.
 * Three.js ve Leaflet bu değeri kendi ölçeklerine çevirir.
 */
import { CLASS_IDS, RARITIES, REGION_IDS, WORLD_SIZE } from "../types";
import type { Bounds, Character, ClassId, Coordinates, Rarity, RegionId } from "../types";
import { REGIONS } from "../content/regions";
import { boundsCenter, clamp, mergeBounds, padBounds, polygonBounds } from "./geometry";

/** Bu zoom değerinin altında pinler yerine bölge balonları gösterilir. */
export const CLUSTER_ZOOM_THRESHOLD = 1.8;
/** Bölgeye odaklanırken çıkılabilecek en yakın zoom. */
export const MAX_FOCUS_ZOOM = 4;

export const WORLD_BOUNDS: Bounds = { minX: 0, minY: 0, maxX: WORLD_SIZE.width, maxY: WORLD_SIZE.height };

export interface RegionCluster {
  regionId: RegionId;
  center: Coordinates;
  count: number;
  byClass: Record<ClassId, number>;
  byRarity: Record<Rarity, number>;
  /** Bölgedeki en yüksek nadirlik (balonun halka rengi). */
  topRarity: Rarity;
}

function zeroCounts<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

/** Sınıf başına karakter sayısı (HUD sayaçları için). */
export function countByClass(characters: readonly Character[]): Record<ClassId, number> {
  const counts = zeroCounts(CLASS_IDS);
  for (const c of characters) counts[c.class.id] += 1;
  return counts;
}

export function countByRarity(characters: readonly Character[]): Record<Rarity, number> {
  const counts = zeroCounts(RARITIES);
  for (const c of characters) counts[c.rarity] += 1;
  return counts;
}

/** Karakterleri bölgelere göre gruplar. Boş bölgeler listede yer almaz. */
export function clusterByRegion(characters: readonly Character[]): RegionCluster[] {
  const groups = new Map<RegionId, Character[]>();
  for (const c of characters) {
    const list = groups.get(c.region);
    if (list) list.push(c);
    else groups.set(c.region, [c]);
  }

  const clusters: RegionCluster[] = [];
  for (const regionId of REGION_IDS) {
    const members = groups.get(regionId);
    if (!members) continue;
    const byRarity = countByRarity(members);
    const topRarity = [...RARITIES].reverse().find((r) => byRarity[r] > 0) ?? "siradan";
    clusters.push({
      regionId,
      center: REGIONS[regionId].center,
      count: members.length,
      byClass: countByClass(members),
      byRarity,
      topRarity,
    });
  }
  return clusters;
}

export function shouldCluster(zoom: number, threshold = CLUSTER_ZOOM_THRESHOLD): boolean {
  return zoom < threshold;
}

/** Sınır kutusunu dünya sınırları içine sıkıştırır. */
export function clampToWorld(bounds: Bounds): Bounds {
  return {
    minX: clamp(bounds.minX, 0, WORLD_SIZE.width),
    minY: clamp(bounds.minY, 0, WORLD_SIZE.height),
    maxX: clamp(bounds.maxX, 0, WORLD_SIZE.width),
    maxY: clamp(bounds.maxY, 0, WORLD_SIZE.height),
  };
}

/** Seçili bölgelerin ortak sınır kutusu. Seçim yoksa bütün dünya. */
export function regionsBounds(regionIds: readonly RegionId[], padding = 30): Bounds {
  if (regionIds.length === 0) return WORLD_BOUNDS;
  const merged = regionIds.map((id) => polygonBounds(REGIONS[id].polygon)).reduce(mergeBounds);
  return clampToWorld(padBounds(merged, padding));
}

export interface Viewport {
  width: number;
  height: number;
}

export interface FocusTarget {
  center: Coordinates;
  zoom: number;
}

/** Sınır kutusunu ekrana sığdıracak merkez ve zoom (1 ile maxZoom arası). */
export function focusForBounds(bounds: Bounds, viewport: Viewport, maxZoom = MAX_FOCUS_ZOOM): FocusTarget {
  const center = boundsCenter(bounds);
  if (viewport.width <= 0 || viewport.height <= 0) return { center, zoom: 1 };

  const width = Math.max(bounds.maxX - bounds.minX, 1);
  const height = Math.max(bounds.maxY - bounds.minY, 1);
  const fitWorld = Math.min(viewport.width / WORLD_SIZE.width, viewport.height / WORLD_SIZE.height);
  const fitBounds = Math.min(viewport.width / width, viewport.height / height);
  return { center, zoom: clamp(fitBounds / fitWorld, 1, maxZoom) };
}

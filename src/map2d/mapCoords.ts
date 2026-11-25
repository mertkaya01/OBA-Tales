/**
 * DÜNYA ↔ LEAFLET KOORDİNATLARI
 *
 * Leaflet'in CRS.Simple düzleminde enlem (lat) yukarı doğru artar, bizim y'miz aşağı doğru.
 * Bu yüzden dünya noktası (x, y) → Leaflet [lat, lng] = [-y, x].
 * Fonksiyonlar Leaflet'i içe aktarmaz (testlerde tarayıcı gerekmez); Leaflet bu dizileri doğrudan kabul eder.
 */
import { WORLD_BOUNDS } from "../lib/clustering";
import type { Bounds, Coordinates } from "../types";

export type LatLngTuple = [lat: number, lng: number];
export type LatLngBoundsTuple = [southWest: LatLngTuple, northEast: LatLngTuple];

/** İşaret çevirir ama -0 üretmez (0 → 0). */
const flip = (value: number) => (value === 0 ? 0 : -value);

export function toLatLng(point: Coordinates): LatLngTuple {
  return [flip(point.y), point.x];
}

export function fromLatLng(lat: number, lng: number): Coordinates {
  return { x: lng, y: flip(lat) };
}

export function toLatLngBounds(bounds: Bounds): LatLngBoundsTuple {
  return [
    [flip(bounds.maxY), bounds.minX],
    [flip(bounds.minY), bounds.maxX],
  ];
}

/** Bütün dünya. */
export const WORLD_LAT_LNG_BOUNDS = toLatLngBounds(WORLD_BOUNDS);

/** Kaydırma sınırı: dünyanın biraz dışına taşmaya izin verir. */
export const PAN_LAT_LNG_BOUNDS = toLatLngBounds({
  minX: WORLD_BOUNDS.minX - 150,
  minY: WORLD_BOUNDS.minY - 150,
  maxX: WORLD_BOUNDS.maxX + 150,
  maxY: WORLD_BOUNDS.maxY + 150,
});

/**
 * Harita zemini: world.json tohumundan üretilen piksel ada, üstünde henüz açılmamış karanın karartısı ve iki yakası da
 * açık olan taş köprüler (Batı Kemeri, Kadim Kemer).
 *
 * Arazi bir kez üretilip saklanır; karartı yalnızca açık bölge ve adalar değişince yeniden çizilir.
 */
import { useMemo } from "react";
import { ImageOverlay, Polyline } from "react-leaflet";
import { rgbaToDataUrl } from "../game/sprites/portraitCache";
import { LANDMARKS } from "../content/sites";
import { getPaintedTerrain, getTerrain } from "../game/terrainCache";
import { paintVeil } from "../game/terrainPaint";
import { isHiddenAt, type LandVisibility } from "../game/visibility";
import { WORLD_LAT_LNG_BOUNDS, toLatLng } from "./mapCoords";

const terrainUrlCache = new Map<number, string>();

/** Arazi resmi (tohum başına bir kez üretilir). */
function terrainImageUrl(seed: number): string {
  let url = terrainUrlCache.get(seed);
  if (!url) {
    url = rgbaToDataUrl(getPaintedTerrain(seed, "harita"));
    terrainUrlCache.set(seed, url);
  }
  return url;
}

const veilUrlCache = new Map<string, string>();

/** Karartı resmi: açık bölge ve adalar aynıysa yeniden çizilmez. */
function veilImageUrl(seed: number, visibility: LandVisibility): string {
  const key = `${seed}|${[...visibility.regions].sort().join(",")}|${[...visibility.islands].sort().join(",")}`;
  let url = veilUrlCache.get(key);
  if (!url) {
    url = rgbaToDataUrl(paintVeil(getTerrain(seed), visibility));
    if (veilUrlCache.size > 8) veilUrlCache.clear();
    veilUrlCache.set(key, url);
  }
  return url;
}

/** Taş köprüler: Kutada'yı batıda ana adaya, doğuda Pusluada'ya bağlar. İki ayağı da açık karadaysa çizilir. */
const BRIDGES = [LANDMARKS.batiKemer, LANDMARKS.kadimKemer];

interface BaseMapLayerProps {
  seed: number;
  visibility: LandVisibility;
}

export function BaseMapLayer({ seed, visibility }: BaseMapLayerProps) {
  const terrainUrl = useMemo(() => terrainImageUrl(seed), [seed]);
  const veilUrl = useMemo(() => veilImageUrl(seed, visibility), [seed, visibility]);
  const bridges = useMemo(() => {
    const terrain = getTerrain(seed);
    return BRIDGES.filter((b) => !isHiddenAt(terrain, visibility, b.from) && !isHiddenAt(terrain, visibility, b.to)).map((b) => [toLatLng(b.from), toLatLng(b.to)]);
  }, [seed, visibility]);

  return (
    <>
      <ImageOverlay url={terrainUrl} bounds={WORLD_LAT_LNG_BOUNDS} className="kb-harita-zemini" />
      {bridges.map((positions, i) => (
        <Polyline
          key={i}
          positions={positions}
          pathOptions={{ color: "#d9c79a", weight: 6, opacity: 0.95, dashArray: "4 3", lineCap: "butt", interactive: false }}
        />
      ))}
      <ImageOverlay url={veilUrl} bounds={WORLD_LAT_LNG_BOUNDS} className="kb-kararti" opacity={0.94} />
    </>
  );
}

/**
 * Harita zemini: world.json tohumundan üretilen piksel ada, üstünde açılmamış bölgelerin sisi
 * ve Pusluada'yı ana adaya bağlayan Kadim Kemer.
 *
 * Arazi bir kez üretilip saklanır; sis yalnızca açık bölgeler değişince yeniden çizilir.
 */
import { useMemo } from "react";
import { ImageOverlay, Polyline } from "react-leaflet";
import { rgbaToDataUrl } from "../game/sprites/portraitCache";
import { LANDMARKS } from "../content/sites";
import { getPaintedTerrain } from "../game/terrainCache";
import { paintFog } from "../game/terrainPaint";
import type { RegionId, RevealCircle } from "../types";
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

const fogUrlCache = new Map<string, string>();

/** Sis resmi: içerik aynıysa (açık bölgeler, bakış halkaları, yumuşaklık) yeniden çizilmez. */
function fogImageUrl(revealedRegions: ReadonlySet<RegionId>, glimpses: readonly RevealCircle[], softness: number): string {
  const key = `${[...revealedRegions].sort().join(",")}|${JSON.stringify(glimpses)}|${softness}`;
  let url = fogUrlCache.get(key);
  if (!url) {
    url = rgbaToDataUrl(paintFog({ revealedRegions, glimpses, softness }));
    if (fogUrlCache.size > 8) fogUrlCache.clear();
    fogUrlCache.set(key, url);
  }
  return url;
}

/** Taş köprüler: Kutada'yı batıda ana adaya, doğuda Pusluada'ya bağlar. */
const BRIDGES = [LANDMARKS.batiKemer, LANDMARKS.kadimKemer].map((b) => [toLatLng(b.from), toLatLng(b.to)]);

interface BaseMapLayerProps {
  seed: number;
  revealedRegions: ReadonlySet<RegionId>;
  glimpses: readonly RevealCircle[];
  fogSoftness: number;
}

export function BaseMapLayer({ seed, revealedRegions, glimpses, fogSoftness }: BaseMapLayerProps) {
  const terrainUrl = useMemo(() => terrainImageUrl(seed), [seed]);
  const fogUrl = useMemo(
    () => fogImageUrl(revealedRegions, glimpses, fogSoftness),
    [revealedRegions, glimpses, fogSoftness],
  );

  return (
    <>
      <ImageOverlay url={terrainUrl} bounds={WORLD_LAT_LNG_BOUNDS} className="kb-harita-zemini" />
      {BRIDGES.map((positions, i) => (
        <Polyline
          key={i}
          positions={positions}
          pathOptions={{ color: "#d9c79a", weight: 6, opacity: 0.95, dashArray: "4 3", lineCap: "butt", interactive: false }}
        />
      ))}
      <ImageOverlay url={fogUrl} bounds={WORLD_LAT_LNG_BOUNDS} className="kb-sis" />
    </>
  );
}

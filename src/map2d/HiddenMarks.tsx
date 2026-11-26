/**
 * 2D haritada karartılı kara parçalarının "?" işaretleri (3D'deki ile aynı noktalar: game/visibility.ts →
 * hiddenLandmasses). Üzerine gelince ya da odaklanınca "Sizlerin desteğiyle yakında" ipucu çıkar.
 */
import { divIcon } from "leaflet";
import { useMemo } from "react";
import { Marker } from "react-leaflet";
import { HIDDEN_LAND_HINT } from "../content/story";
import { getTerrain } from "../game/terrainCache";
import { hiddenLandmasses, type LandVisibility } from "../game/visibility";
import { toLatLng } from "./mapCoords";

const ICON = divIcon({
  className: "kb-gizli kb-gizli--buyuk",
  html: `<span aria-hidden="true" class="kb-gizli__isaret">?</span><span role="tooltip" class="kb-gizli__ipucu">${HIDDEN_LAND_HINT}</span>`,
  iconSize: [54, 54],
  iconAnchor: [27, 27],
});

export function HiddenMarks({ seed, visibility }: { seed: number; visibility: LandVisibility }) {
  const points = useMemo(() => hiddenLandmasses(getTerrain(seed), visibility), [seed, visibility]);
  return (
    <>
      {points.map((p, i) => (
        <Marker key={i} position={toLatLng(p)} icon={ICON} keyboard title={`Gizli kara. ${HIDDEN_LAND_HINT}`} alt="" />
      ))}
    </>
  );
}

/**
 * Bölge sınırları ve adları. Bir bölgeye tıklamak o bölgeyi filtreler (tekrar tıklamak kaldırır).
 * Seçili bölge altın, açık bölgeler yün, sisli bölgeler buz rengi kesik çizgiyle çizilir.
 */
import { Pane, Polygon, Tooltip } from "react-leaflet";
import { REGION_LIST } from "../content/regions";
import type { RegionId } from "../types";
import { toLatLng } from "./mapCoords";

const POSITIONS = Object.fromEntries(REGION_LIST.map((r) => [r.id, r.polygon.map(toLatLng)])) as Record<
  RegionId,
  ReturnType<typeof toLatLng>[]
>;

interface RegionPolygonsProps {
  revealedRegions: ReadonlySet<RegionId>;
  selectedRegions: readonly RegionId[];
  onRegionClick: (id: RegionId) => void;
}

export function RegionPolygons({ revealedRegions, selectedRegions, onRegionClick }: RegionPolygonsProps) {
  return (
    <>
      {/* Etiketler pinlerin altında kalsın, tıklamayı engellemesin. */}
      <Pane name="kb-etiketler" style={{ zIndex: 450, pointerEvents: "none" }} />
      {REGION_LIST.map((region) => {
        const selected = selectedRegions.includes(region.id);
        const revealed = revealedRegions.has(region.id);
        return (
          <Polygon
            key={region.id}
            positions={POSITIONS[region.id]}
            pathOptions={{
              className: "kb-bolge",
              color: selected ? "#f6d36f" : revealed ? "#f3ead8" : "#c3e0f2",
              weight: selected ? 3 : 1.5,
              opacity: selected ? 0.95 : 0.5,
              dashArray: selected ? undefined : "4 6",
              fillColor: "#f6d36f",
              fillOpacity: selected ? 0.1 : 0,
            }}
            eventHandlers={{ click: () => onRegionClick(region.id) }}
          >
            <Tooltip permanent direction="center" className="kb-bolge-etiketi" pane="kb-etiketler">
              {region.name}
            </Tooltip>
          </Polygon>
        );
      })}
    </>
  );
}

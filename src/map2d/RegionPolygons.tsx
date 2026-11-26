/**
 * Açık bölgelerin sınırları ve adları. Seçili bölge (Filtreler panelinden) altın, ötekiler yün rengi kesik çizgiyle
 * çizilir. Karartılı bölgeler hiç çizilmez; onların yerinde "?" işareti durur (HiddenMarks). Bölgeye tıklamak haritayı
 * oynatmaz.
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
}

export function RegionPolygons({ revealedRegions, selectedRegions }: RegionPolygonsProps) {
  return (
    <>
      {/* Etiketler pinlerin altında kalsın, tıklamayı engellemesin. */}
      <Pane name="kb-etiketler" style={{ zIndex: 450, pointerEvents: "none" }} />
      {REGION_LIST.filter((region) => revealedRegions.has(region.id)).map((region) => {
        const selected = selectedRegions.includes(region.id);
        return (
          <Polygon
            key={region.id}
            positions={POSITIONS[region.id]}
            interactive={false}
            pathOptions={{
              className: "kb-bolge",
              color: selected ? "#f6d36f" : "#f3ead8",
              weight: selected ? 3 : 1.5,
              opacity: selected ? 0.95 : 0.5,
              dashArray: selected ? undefined : "4 6",
              fillColor: "#f6d36f",
              fillOpacity: selected ? 0.1 : 0,
            }}
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

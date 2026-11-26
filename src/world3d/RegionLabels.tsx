/**
 * Bölge adları — dünyaya iliştirilmiş etiketler. Karartılı (henüz açılmamış) bölgenin adı gösterilmez.
 *
 * Etiketler normal React DOM'unda (tuvalin üstünde) durur; sahnenin içindeki LabelProjector her karede
 * 3D konumlarını ekrana izdüşürüp etiketleri oraya taşır. Ek React kökü açılmaz.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, type RefObject } from "react";
import { Vector3 } from "three";
import { REGION_LIST } from "../content/regions";
import type { Terrain } from "../game/terrain";
import { formatNumber } from "../lib/text";
import type { RegionId } from "../types";
import { groundY } from "./worldScale";

type LabelRefs = RefObject<(HTMLDivElement | null)[]>;

/** Tuvalin üstündeki etiket katmanı (Canvas dışında render edilir). */
export function RegionLabelLayer({
  refs,
  revealedRegions,
  counts,
}: {
  refs: LabelRefs;
  revealedRegions: ReadonlySet<RegionId>;
  /** Bölgedeki (filtreden geçen) kahraman sayısı. */
  counts: Readonly<Record<RegionId, number>>;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {REGION_LIST.map((region, i) => (
        <div
          key={region.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="kb-bolge-etiketi-3d absolute left-0 top-0"
          style={{ transform: "translate(-9999px, -9999px)" }}
        >
          {/* Karartılı bölgenin adı yok; "?" işaretini kara parçası başına yer etiketleri koyar. */}
          {revealedRegions.has(region.id) && (
            <>
              {region.name}
              <span className="kb-bolge-etiketi-3d__sis">{formatNumber(counts[region.id])} kahraman</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/** Sahnenin içinde: etiketleri her karede bölge merkezlerinin ekran konumuna taşır. */
export function LabelProjector({ refs, terrain }: { refs: LabelRefs; terrain: Terrain }) {
  const { camera, size } = useThree();
  const anchors = useMemo(
    () => REGION_LIST.map((r) => new Vector3(r.center.x, groundY(terrain, r.center) + 16, r.center.y)),
    [terrain],
  );
  const scratch = useMemo(() => new Vector3(), []);

  useFrame(() => {
    anchors.forEach((anchor, i) => {
      const el = refs.current[i];
      if (!el) return;
      scratch.copy(anchor).project(camera);
      const visible = Math.abs(scratch.x) <= 1.1 && Math.abs(scratch.y) <= 1.1;
      const x = (scratch.x * 0.5 + 0.5) * size.width;
      const y = (-scratch.y * 0.5 + 0.5) * size.height;
      el.style.transform = visible ? `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)` : "translate(-9999px, -9999px)";
    });
  });

  return null;
}

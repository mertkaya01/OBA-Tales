/**
 * YER ETİKETLERİ — topluluğun ad koyduğu yerler ve akın meydanı.
 *
 *   Yıldızgözü Feneri
 *   adını koyan @kopuz_okcu55      ← tıklanınca o takipçiye uçar ve kartını açar
 *
 * Boss'lu bölümde boss'un başının üstünde adı, lakabı ve akıncı sayısı; boss'suz bölümde meydanın adı.
 * Etiketler yaklaşınca belirir (uzaktan bölge adları yeter). Bölge etiketleriyle aynı yöntem: DOM katmanı +
 * sahnedeki izdüşürücü.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, type RefObject } from "react";
import { Vector3 } from "three";
import type { Terrain } from "../../game/terrain";
import { cn } from "../../lib/cn";
import type { Coordinates } from "../../types";
import { groundY, worldZoomOf } from "../worldScale";

export interface PlaceLabel {
  key: string;
  kind: "yer" | "boss" | "meydan";
  point: Coordinates;
  /** Zeminden yükseklik (Three.js birimi). */
  lift: number;
  title: string;
  subtitle?: string;
  /** Adı koyan takipçi. */
  namedBy?: { id: string; handle: string; known: boolean };
  /** Bu dünya zoom'undan itibaren görünür. */
  minZoom: number;
}

type LabelRefs = RefObject<(HTMLDivElement | null)[]>;
const HIDDEN = "translate(-9999px, -9999px)";

export function PlaceLabelLayer({
  labels,
  refs,
  onNamerClick,
  onBossClick,
}: {
  labels: readonly PlaceLabel[];
  refs: LabelRefs;
  onNamerClick: (id: string) => void;
  /** Boss plakasına tıklanınca (akın panelini açar). */
  onBossClick?: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {labels.map((label, i) => (
        <div
          key={label.key}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={cn("kb-yer absolute left-0 top-0", `kb-yer--${label.kind}`)}
          style={{ transform: HIDDEN }}
        >
          {label.kind === "boss" && onBossClick ? (
            <button type="button" className="kb-yer__ad pointer-events-auto cursor-pointer" onClick={onBossClick} title="Akını izle ve provasını yap">
              {label.title}
            </button>
          ) : (
            <span className="kb-yer__ad">{label.title}</span>
          )}
          {label.subtitle && <span className="kb-yer__alt">{label.subtitle}</span>}
          {label.namedBy &&
            (label.namedBy.known ? (
              <button type="button" className="kb-yer__koyan pointer-events-auto" onClick={() => onNamerClick(label.namedBy!.id)}>
                adını koyan <b>@{label.namedBy.handle}</b>
              </button>
            ) : (
              <span className="kb-yer__koyan">
                adını koyan <b>@{label.namedBy.handle}</b>
              </span>
            ))}
        </div>
      ))}
    </div>
  );
}

export function PlaceLabelProjector({ labels, refs, terrain }: { labels: readonly PlaceLabel[]; refs: LabelRefs; terrain: Terrain }) {
  const { camera, size } = useThree();
  const anchors = useMemo(() => labels.map((l) => new Vector3(l.point.x, groundY(terrain, l.point) + l.lift, l.point.y)), [labels, terrain]);
  const scratch = useMemo(() => new Vector3(), []);

  useFrame(() => {
    const worldZoom = worldZoomOf((camera as { zoom: number }).zoom, size);
    anchors.forEach((anchor, i) => {
      const el = refs.current[i];
      if (!el) return;
      if (worldZoom < labels[i].minZoom) {
        el.style.transform = HIDDEN;
        return;
      }
      scratch.copy(anchor).project(camera);
      const visible = Math.abs(scratch.x) <= 1.05 && Math.abs(scratch.y) <= 1.05;
      // Ekran kenarındaki etiket dışarı taşmasın: yatayda ekranın içine kaydırılır.
      const half = el.offsetWidth / 2;
      const raw = (scratch.x * 0.5 + 0.5) * size.width;
      const x = half * 2 + 16 < size.width ? Math.min(Math.max(raw, half + 8), size.width - half - 8) : raw;
      const y = (-scratch.y * 0.5 + 0.5) * size.height;
      el.style.transform = visible ? `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)` : HIDDEN;
    });
  });

  return null;
}

/**
 * Karakter etiketleri: seçili karakterin başının üstünde isim plakası (ad + nadirlik + sınıf),
 * üzerine gelinen karakterde küçük isim etiketi.
 *
 * Etiketler tuvalin üstündeki React DOM'unda durur; sahnedeki CharacterLabelProjector her karede
 * onları karakterin ekran konumuna taşır (bölge etiketleriyle aynı yöntem).
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, type RefObject } from "react";
import { Vector3 } from "three";
import { CLASSES } from "../../content/classes";
import { RARITY_INFO } from "../../content/rarities";
import type { Terrain } from "../../game/terrain";
import { cn } from "../../lib/cn";
import { useAppStore } from "../../state/useAppStore";
import type { Character } from "../../types";
import { currentPosition, type CharacterPlacement, type WorldPoint } from "../living/placement";
import type { CharacterUniforms } from "./characterMaterials";

export interface CharacterLabelRefs {
  selected: HTMLDivElement | null;
  hovered: HTMLDivElement | null;
}

const RARITY_PLATE: Record<Character["rarity"], string> = {
  siradan: "kb-plaka--siradan",
  nadir: "kb-plaka--nadir",
  destansi: "kb-plaka--destansi",
  efsanevi: "kb-plaka--efsanevi",
};

const HIDDEN = "translate(-9999px, -9999px)";

/** Tuvalin üstündeki etiket katmanı (Canvas dışında render edilir). */
export function CharacterLabelLayer({
  refs,
  characterById,
  visibleIds,
}: {
  refs: RefObject<CharacterLabelRefs>;
  characterById: ReadonlyMap<string, Character>;
  visibleIds: ReadonlySet<string>;
}) {
  const selectedId = useAppStore((s) => s.selectedId);
  const hoveredId = useAppStore((s) => s.hoveredId);
  const selected = selectedId && visibleIds.has(selectedId) ? characterById.get(selectedId) : undefined;
  const hovered = hoveredId && hoveredId !== selectedId && visibleIds.has(hoveredId) ? characterById.get(hoveredId) : undefined;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        ref={(el) => {
          refs.current.selected = el;
        }}
        className={cn("kb-plaka absolute left-0 top-0", selected && RARITY_PLATE[selected.rarity])}
        style={{ transform: HIDDEN }}
      >
        {selected && (
          <>
            <span className="kb-plaka__ad">{selected.displayName}</span>
            <span className="kb-plaka__alt">
              {RARITY_INFO[selected.rarity].label} {CLASSES[selected.class.id].name}
            </span>
          </>
        )}
      </div>
      <div
        ref={(el) => {
          refs.current.hovered = el;
        }}
        className="kb-isim absolute left-0 top-0"
        style={{ transform: HIDDEN }}
      >
        {hovered?.displayName}
      </div>
    </div>
  );
}

/** Sahnenin içinde: etiketleri seçili ve üzerine gelinen karakterin başının üstüne taşır (yürürken de). */
export function CharacterLabelProjector({
  refs,
  terrain,
  placements,
  uniforms,
  visibleIds,
}: {
  refs: RefObject<CharacterLabelRefs>;
  terrain: Terrain;
  placements: ReadonlyMap<string, CharacterPlacement>;
  uniforms: CharacterUniforms;
  visibleIds: ReadonlySet<string>;
}) {
  const { camera, size } = useThree();
  const scratch = useMemo(() => new Vector3(), []);
  const point = useMemo<WorldPoint>(() => ({ x: 0, y: 0, z: 0 }), []);

  const place = (el: HTMLDivElement | null, id: string | null, lift: number) => {
    if (!el) return;
    const placement = id && visibleIds.has(id) ? placements.get(id) : undefined;
    if (!placement) {
      el.style.transform = HIDDEN;
      return;
    }
    currentPosition(placement, terrain, uniforms.uTime.value, point);
    scratch.set(point.x, point.y + lift * placement.scale, point.z).project(camera);
    const x = (scratch.x * 0.5 + 0.5) * size.width;
    const y = (-scratch.y * 0.5 + 0.5) * size.height;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
  };

  useFrame(() => {
    const { selectedId, hoveredId } = useAppStore.getState();
    place(refs.current.selected, selectedId, 6.2);
    place(refs.current.hovered, hoveredId === selectedId ? null : hoveredId, 5.6);
  });

  return null;
}

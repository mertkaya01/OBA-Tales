/**
 * Karakter etiketleri: seçili karakterin başının üstünde isim plakası (ad + nadirlik + sınıf),
 * üzerine gelinen karakterde küçük isim etiketi, seslenilen kahramanın söylediği sözün balonu.
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
import { ARRIVAL_ORDER } from "../../content/story";
import type { Character } from "../../types";
import { currentPosition, type CharacterPlacement, type WorldPoint } from "../living/placement";
import type { CharacterUniforms } from "./characterMaterials";

export interface CharacterLabelRefs {
  selected: HTMLDivElement | null;
  hovered: HTMLDivElement | null;
  /** Konuşma balonu (kahraman el sallarken). */
  speech?: HTMLDivElement | null;
}

const RARITY_PLATE: Record<Character["rarity"], string> = {
  siradan: "kb-plaka--siradan",
  nadir: "kb-plaka--nadir",
  destansi: "kb-plaka--destansi",
  efsanevi: "kb-plaka--efsanevi",
  ulu: "kb-plaka--ulu",
  goksel: "kb-plaka--goksel",
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
      <div
        ref={(el) => {
          refs.current.speech = el;
        }}
        className="kb-balon absolute left-0 top-0"
        style={{ transform: HIDDEN }}
        role="status"
      />
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

  /** Sözü olan kahramanın başının üstüne balonu koyar (seçiliyse plakanın da üstüne). */
  const speak = (el: HTMLDivElement | null | undefined, selectedId: string | null) => {
    if (!el) return;
    let text: string | null = null;
    let speaker: CharacterPlacement | undefined;
    let speakerId: string | null = null;
    for (const id of ARRIVAL_ORDER) {
      const placement = visibleIds.has(id) ? placements.get(id) : undefined;
      const speech = placement?.track?.active ? placement.track.speech : null;
      if (speech) {
        text = speech;
        speaker = placement;
        speakerId = id;
        break;
      }
    }
    if (!text || !speaker) {
      if (el.dataset.text) {
        el.dataset.text = "";
        el.textContent = "";
      }
      el.style.transform = HIDDEN;
      return;
    }
    if (el.dataset.text !== text) {
      el.dataset.text = text;
      el.textContent = text;
    }
    currentPosition(speaker, terrain, uniforms.uTime.value, point);
    scratch.set(point.x, point.y + 6.2 * speaker.scale, point.z).project(camera);
    const x = (scratch.x * 0.5 + 0.5) * size.width;
    const y = (-scratch.y * 0.5 + 0.5) * size.height - (speakerId === selectedId ? 52 : 10);
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
  };

  useFrame(() => {
    const { selectedId, hoveredId } = useAppStore.getState();
    place(refs.current.selected, selectedId, 6.2);
    place(refs.current.hovered, hoveredId === selectedId ? null : hoveredId, 5.6);
    speak(refs.current.speech, selectedId);
  });

  return null;
}

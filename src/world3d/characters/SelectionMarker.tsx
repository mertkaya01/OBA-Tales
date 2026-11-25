/**
 * Seçim işaretleri: seçili karakterin ayak altında nadirlik renginde halka ve etrafında dönen yay;
 * üzerine gelinen karakterde ince beyaz halka. İşaretler karakter yürüdükçe onunla birlikte gider.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { DoubleSide, type Group } from "three";
import { RARITY_COLORS } from "../../game/palette";
import type { Terrain } from "../../game/terrain";
import { useAppStore } from "../../state/useAppStore";
import type { Character } from "../../types";
import { currentPosition, type CharacterPlacement, type WorldPoint } from "../living/placement";
import { groundY } from "../worldScale";
import type { CharacterUniforms } from "./characterMaterials";

interface SelectionMarkerProps {
  terrain: Terrain;
  characterById: ReadonlyMap<string, Character>;
  placements: ReadonlyMap<string, CharacterPlacement>;
  uniforms: CharacterUniforms;
  /** Yalnızca görünen (filtreden geçen) karakterler işaretlenir. */
  visibleIds: ReadonlySet<string>;
}

export function SelectionMarker({ terrain, characterById, placements, uniforms, visibleIds }: SelectionMarkerProps) {
  const selectedId = useAppStore((s) => s.selectedId);
  const hoveredId = useAppStore((s) => s.hoveredId);
  const selectedRef = useRef<Group>(null);
  const hoveredRef = useRef<Group>(null);
  const arcRef = useRef<Group>(null);
  const point = useMemo<WorldPoint>(() => ({ x: 0, y: 0, z: 0 }), []);

  const selected = selectedId && visibleIds.has(selectedId) ? characterById.get(selectedId) : undefined;
  const hovered = hoveredId && hoveredId !== selectedId && visibleIds.has(hoveredId) ? characterById.get(hoveredId) : undefined;

  useFrame((_, delta) => {
    if (arcRef.current) arcRef.current.rotation.y += delta * 1.6;
    const follow = (group: Group | null, c: Character | undefined) => {
      const placement = c && placements.get(c.id);
      if (!group || !placement) return;
      currentPosition(placement, terrain, uniforms.uTime.value, point);
      // Halka zıplamaz, zeminde kalır.
      group.position.set(point.x, groundY(terrain, { x: point.x, y: point.z }) + 0.18, point.z);
      group.scale.setScalar(placement.scale);
    };
    follow(selectedRef.current, selected);
    follow(hoveredRef.current, hovered);
  });

  return (
    <>
      {selected && (
        <group ref={selectedRef}>
          <mesh rotation-x={-Math.PI / 2} raycast={() => null}>
            <ringGeometry args={[1.6, 1.85, 24]} />
            <meshBasicMaterial color={RARITY_COLORS[selected.rarity]} />
          </mesh>
          <group ref={arcRef}>
            <mesh rotation-x={-Math.PI / 2} raycast={() => null}>
              <ringGeometry args={[2.05, 2.45, 24, 1, 0, Math.PI * 0.6]} />
              <meshBasicMaterial color={RARITY_COLORS[selected.rarity]} side={DoubleSide} />
            </mesh>
          </group>
        </group>
      )}
      {hovered && (
        <group ref={hoveredRef}>
          <mesh rotation-x={-Math.PI / 2} raycast={() => null}>
            <ringGeometry args={[1.55, 1.75, 20]} />
            <meshBasicMaterial color="#fbf7ef" transparent opacity={0.85} />
          </mesh>
        </group>
      )}
    </>
  );
}

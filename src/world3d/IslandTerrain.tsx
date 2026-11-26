/**
 * 3D ada arazisi: yükseklik haritasından üretilen köşeli (low-poly) ağ, üstünde boyalı harita dokusu.
 * Araziye tıklamak (sürükleme değilse) o bölgeyi filtreler; harita görünümüyle aynı davranış.
 */
import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { MeshLambertMaterial, type Texture } from "three";
import type { Terrain } from "../game/terrain";
import type { Coordinates } from "../types";
import { applyFogOfWar, type FogUniforms } from "./shaders/fog";
import { buildTerrainGeometry } from "./terrainGeometry";

interface IslandTerrainProps {
  terrain: Terrain;
  texture: Texture;
  fogUniforms: FogUniforms;
  /** Zemine tek tıklama (kamera oynamaz; açık çekmece kapanır). */
  onGroundClick: (point: Coordinates) => void;
  /** Zemine çift tıklama: oraya yakınlaşır. */
  onGroundDoubleClick: (point: Coordinates) => void;
}

export function IslandTerrain({ terrain, texture, fogUniforms, onGroundClick, onGroundDoubleClick }: IslandTerrainProps) {
  const geometry = useMemo(() => buildTerrainGeometry(terrain), [terrain]);
  const material = useMemo(
    () => applyFogOfWar(new MeshLambertMaterial({ map: texture, flatShading: true }), fogUniforms),
    [texture, fogUniforms],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    // Sürükleyerek kaydırma tıklama sayılmasın.
    if (event.delta > 6) return;
    event.stopPropagation();
    onGroundClick({ x: event.point.x, y: event.point.z });
  };
  const onDoubleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onGroundDoubleClick({ x: event.point.x, y: event.point.z });
  };

  return <mesh geometry={geometry} material={material} receiveShadow onClick={onClick} onDoubleClick={onDoubleClick} />;
}

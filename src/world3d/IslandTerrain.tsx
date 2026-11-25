/**
 * 3D ada arazisi: yükseklik haritasından üretilen köşeli (low-poly) ağ, üstünde boyalı harita dokusu.
 * Araziye tıklamak (sürükleme değilse) o bölgeyi filtreler; harita görünümüyle aynı davranış.
 */
import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { MeshLambertMaterial, type Texture } from "three";
import { REGION_LIST } from "../content/regions";
import type { Terrain } from "../game/terrain";
import { findContaining } from "../lib/geometry";
import type { RegionId } from "../types";
import { applyFogOfWar, type FogUniforms } from "./shaders/fog";
import { buildTerrainGeometry } from "./terrainGeometry";

interface IslandTerrainProps {
  terrain: Terrain;
  texture: Texture;
  fogUniforms: FogUniforms;
  onRegionClick: (id: RegionId) => void;
}

export function IslandTerrain({ terrain, texture, fogUniforms, onRegionClick }: IslandTerrainProps) {
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
    const region = findContaining({ x: event.point.x, y: event.point.z }, REGION_LIST);
    if (region) onRegionClick(region.id);
  };

  return <mesh geometry={geometry} material={material} receiveShadow onClick={onClick} />;
}

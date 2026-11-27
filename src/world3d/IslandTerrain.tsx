/**
 * 3D ada arazisi: yükseklik haritasından üretilen köşeli (low-poly) ağ, üstünde boyalı harita dokusu.
 * Ağ parçalıdır (terrainGeometry.buildTerrainChunks): ekranda olmayan parçalar çizilmez. Hepsi tek malzemeyi paylaşır.
 * Araziye tek tıklama açık çekmeceyi kapatır, çift tıklama oraya yakınlaşır.
 */
import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { MeshLambertMaterial, type Texture } from "three";
import type { Terrain } from "../game/terrain";
import type { Coordinates } from "../types";
import { applyFogOfWar, type FogUniforms } from "./shaders/fog";
import { buildTerrainChunks } from "./terrainGeometry";

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
  const chunks = useMemo(() => buildTerrainChunks(terrain), [terrain]);
  const material = useMemo(
    () => applyFogOfWar(new MeshLambertMaterial({ map: texture, flatShading: true }), fogUniforms),
    [texture, fogUniforms],
  );

  useEffect(() => () => chunks.forEach((g) => g.dispose()), [chunks]);
  useEffect(() => () => material.dispose(), [material]);

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

  return (
    <group>
      {chunks.map((geometry, i) => (
        <mesh key={i} geometry={geometry} material={material} receiveShadow onClick={onClick} onDoubleClick={onDoubleClick} />
      ))}
    </group>
  );
}

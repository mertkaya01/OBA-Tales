/**
 * DÜNYA SAHNESİ — <Canvas> içindeki her şey: gün-gece ışıkları, ada, deniz, doğa, yapılar, sis,
 * akın meydanı, boss ve canlı akın (oklar, ocak ışıkları, ayaz dalgası), takipçiler, auralar ve piksel
 * diorama çizim hattı (kar dahil).
 *
 * Akın haritası (WorldView) üstüne kamera kontrolü, seçim ve etiketler ekler; Reel Stüdyosu senaryolu
 * kamera ve video kaydı ekler. İkisi de bu sahneyi paylaşır.
 */
import { useFrame } from "@react-three/fiber";
import type { Character, RegionId, Weather } from "../types";
import { AuraRings } from "./characters/AuraRings";
import type { CharacterUniforms } from "./characters/characterMaterials";
import { FollowerInstances } from "./FollowerInstances";
import { FogOfWar } from "./FogOfWar";
import { IslandTerrain } from "./IslandTerrain";
import { Landmarks } from "./Landmarks";
import { Details } from "./Details";
import { DayNight } from "./living/DayNight";
import { RaidBattle } from "./living/RaidBattle";
import { RaidGround } from "./living/RaidGround";
import { Nature } from "./Nature";
import { Ocean } from "./Ocean";
import { PixelPipeline, type SnowSettings } from "./PixelPipeline";
import { Portal } from "./Portal";
import { Settlements } from "./Settlements";
import { Waters } from "./Waters";
import type { WorldScene } from "./useWorldScene";

const SNOW: Readonly<Record<Weather, SnowSettings>> = {
  acik: { amount: 0, wind: 0 },
  kar: { amount: 0.55, wind: 0.25 },
  tipi: { amount: 1, wind: 1.1 },
};

/** Dünyanın ortak saati: karakter hareketi ve kar bu zamanla akar. Sekme arka plandayken sıçramaz. */
function WorldClockTicker({ uniforms, animate }: { uniforms: CharacterUniforms; animate: boolean }) {
  useFrame((_, delta) => {
    if (animate) uniforms.uTime.value += Math.min(delta, 0.1);
  }, -1);
  return null;
}

const noop = () => {};

interface WorldContentProps {
  scene: WorldScene;
  /** Dünyada görünen karakterler (haritada filtreden geçenler). */
  characters: readonly Character[];
  animate: boolean;
  /** Bir piksel kaç ekran pikseline büyütülsün? */
  pixelSize: number;
  /** Havayı değiştirmek için (verilmezse world.json'daki hava). */
  weather?: Weather;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
  onRegionClick?: (id: RegionId) => void;
}

export function WorldContent({ scene, characters, animate, pixelSize, weather, onSelect = noop, onHover = noop, onRegionClick = noop }: WorldContentProps) {
  const { data, seed, terrain, terrainTexture, fogUniforms, motionUniforms, sky, boss, formation, placements, battle } = scene;
  const snow = animate ? SNOW[weather ?? data.world.weather] : SNOW.acik;

  return (
    <>
      <WorldClockTicker uniforms={motionUniforms} animate={animate} />
      <DayNight terrain={terrain} sky={sky} fogUniforms={fogUniforms} />
      <IslandTerrain terrain={terrain} texture={terrainTexture} fogUniforms={fogUniforms} onRegionClick={onRegionClick} />
      <Waters terrain={terrain} fogUniforms={fogUniforms} />
      <Ocean terrain={terrain} animate={animate} sky={sky} />
      <Nature terrain={terrain} seed={seed} fogUniforms={fogUniforms} animate={animate} />
      <Details terrain={terrain} seed={seed} fogUniforms={fogUniforms} animate={animate} />
      <Landmarks terrain={terrain} seed={seed} fogUniforms={fogUniforms} animate={animate} sky={sky} />
      <Settlements terrain={terrain} fogUniforms={fogUniforms} animate={animate} sky={sky} />
      <Portal terrain={terrain} fogUniforms={fogUniforms} animate={animate} sky={sky} />
      <FogOfWar terrain={terrain} revealedRegions={data.revealedRegions} seed={seed} animate={animate} />
      {formation && <RaidGround formation={formation} bossId={boss?.id ?? null} terrain={terrain} animate={animate} battle={battle} />}
      {formation && boss && (
        <RaidBattle formation={formation} bossId={boss.id} characterById={data.characterById} terrain={terrain} battle={battle} animate={animate} />
      )}
      <FollowerInstances
        characters={characters}
        placements={placements}
        terrain={terrain}
        uniforms={motionUniforms}
        activeParticipantIds={data.activeParticipantIds}
        onSelect={onSelect}
        onHover={onHover}
      />
      <AuraRings characters={characters} placements={placements} uniforms={motionUniforms} />
      <PixelPipeline pixelSize={pixelSize} sky={sky} snow={snow} clock={motionUniforms.uTime} />
    </>
  );
}

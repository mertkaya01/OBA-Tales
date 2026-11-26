/**
 * DÜNYA SAHNESİNİN VERİSİ — akın haritası ve Reel Stüdyosu aynı dünyayı kurar:
 *   arazi, boyalı doku ve sis dokusu · hareket ve gökyüzü ortak durumu · akın meydanı ve herkesin yeri.
 *
 * Dokular bileşen kalkınca serbest bırakılır. Sahnenin kendisi WorldContent.tsx içinde.
 */
import { useEffect, useMemo } from "react";
import { createArrivalRuntime, type ArrivalRuntime } from "./story/arrival";
import { createStoryRuntime, type StoryRuntime } from "./story/storyRuntime";
import { BOSSES } from "../content/bosses";
import type { GameData } from "../data/loaders";
import { useGameData } from "../data/useGameData";
import { getPaintedTerrain, getTerrain } from "../game/terrainCache";
import { paintVeil } from "../game/terrainPaint";
import type { Terrain } from "../game/terrain";
import type { Boss, Character } from "../types";
import { createCharacterUniforms, type CharacterUniforms } from "./characters/characterMaterials";
import { structureObstacles } from "./layout";
import { placeCharacters, type CharacterPlacement } from "./living/placement";
import { createBattleRuntime, parseBossPreview, planFormation, type BattleRuntime, type RaidFormation } from "./living/raid";
import { createSkyRuntime, type SkyRuntime } from "./living/sky";
import { createFogUniforms, type FogUniforms } from "./shaders/fog";
import { toDataTexture } from "./textures";
import type { DataTexture } from "three";

export interface WorldScene {
  data: GameData;
  seed: number;
  terrain: Terrain;
  terrainTexture: DataTexture;
  fogUniforms: FogUniforms;
  /** Hareketin ortak saati ve arazi yükseklik dokusu (karakterler, aura, kar). */
  motionUniforms: CharacterUniforms;
  sky: SkyRuntime;
  /** Akın meydanındaki boss (geliştirmede ?boss= ile önizlenebilir). */
  boss: Boss | null;
  formation: RaidFormation | null;
  placements: ReadonlyMap<string, CharacterPlacement>;
  /** Canlı akının paylaşılan durumu (boss irkilmesi, izleme modunda hız). */
  battle: BattleRuntime;
  /** Geliş sinemasının paylaşılan durumu (kapının parlaması, ışık küresi). */
  arrival: ArrivalRuntime;
  /** Gün düzeninin saati ve kahramanlara seslenme istekleri. */
  story: StoryRuntime;
}

export function useWorldScene(): WorldScene {
  const data = useGameData();
  const seed = data.world.seed;

  const terrain = useMemo(() => getTerrain(seed), [seed]);
  const terrainTexture = useMemo(() => toDataTexture(getPaintedTerrain(seed, "dunya"), "renk"), [seed]);
  const fogUniforms = useMemo(() => {
    const uniforms = createFogUniforms();
    // Karartı: hikâyede henüz açılmamış kara koyu bir silüete döner (shaders/fog.ts).
    uniforms.uFogMap.value = toDataTexture(paintVeil(terrain, data.visibility), "maske");
    return uniforms;
  }, [terrain, data.visibility]);
  const motionUniforms = useMemo(() => createCharacterUniforms(terrain), [terrain]);
  const sky = useMemo(() => createSkyRuntime(), []);
  const battle = useMemo(() => createBattleRuntime(), []);
  const arrival = useMemo(() => createArrivalRuntime(), []);
  const story = useMemo(() => createStoryRuntime(), []);

  useEffect(() => () => terrainTexture.dispose(), [terrainTexture]);
  useEffect(() => () => fogUniforms.uFogMap.value?.dispose(), [fogUniforms]);
  useEffect(() => () => motionUniforms.uHeightMap.value.dispose(), [motionUniforms]);

  // Akın meydanı: aktif bölümün akıncıları saf tutar. Geliştirmede ?boss=… o boss'un meydanını önizler.
  const episode = data.activeEpisode;
  const previewBoss = import.meta.env.DEV ? parseBossPreview(window.location.search) : null;
  const boss = previewBoss ? BOSSES[previewBoss] : episode.bossId ? BOSSES[episode.bossId] : null;
  const raidRegion = previewBoss ? BOSSES[previewBoss].region : episode.region;
  const formation = useMemo(() => {
    if ((episode.status !== "aktif" && !previewBoss) || data.activeParticipantIds.size === 0) return null;
    const participants = [...data.activeParticipantIds].map((id) => data.characterById.get(id)).filter((c): c is Character => !!c);
    return planFormation(participants, raidRegion);
  }, [episode.status, previewBoss, raidRegion, data.activeParticipantIds, data.characterById]);

  const placements = useMemo(() => {
    const obstacles = structureObstacles(terrain, seed);
    if (formation && boss) obstacles.push({ x: formation.ground.focus.x, y: formation.ground.focus.y, r: 13 });
    return placeCharacters(data.characters, terrain, { obstacles, formation });
  }, [data.characters, terrain, seed, formation, boss]);

  return { data, seed, terrain, terrainTexture, fogUniforms, motionUniforms, sky, boss, formation, placements, battle, arrival, story };
}

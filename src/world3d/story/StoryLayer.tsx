/**
 * HİKÂYE KATMANI — Kutada'da yaşayan kahramanlar ve bıraktıkları izler.
 *
 *   · Her karede hikâye saatini yazar (İstanbul saati; ?saat= ve hızlı zamana uyar).
 *   · İskeletli kahramanları gün düzeniyle yürütür (AnimatedHero.tsx).
 *   · Dünyadaki izleri çizer: kesilen ağaçlar, büyüyen istif, toplanan çalılar, oturaklar, uyku "Zzz"leri
 *     (KutadaWork.tsx).
 *   · Bir kahraman seçilince (aramadan ya da tıklayarak) ona seslenir: kameraya dönüp el sallar.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { useAppStore } from "../../state/useAppStore";
import { useWorldTime } from "../../state/useWorldTime";
import type { Character } from "../../types";
import type { WorldScene } from "../useWorldScene";
import { AnimatedHeroes, type HeroWorld } from "./AnimatedHero";
import { dayPlan, parseHuntPreview, setHuntPreview, type DayPlan } from "./daySchedule";
import type { HeroModel } from "./heroModel";
import { KutadaWork } from "./KutadaWork";
import { MeadowLife } from "./MeadowLife";
import { KutadaSoundDirector } from "./KutadaSoundDirector";
import { useAnimalModels } from "./animalModel";
import { kutadaSites } from "./kutadaSites";
import { storyTime } from "./storyClock";
import { ARRIVAL_ORDER, type ArrivalHeroId } from "../../content/story";
import { callHero } from "./storyRuntime";

// Geliştirmede ?av=geyik ile günün avını seçip denemek için (yayında yok sayılır).
if (import.meta.env.DEV && typeof window !== "undefined") setHuntPreview(parseHuntPreview(window.location.search));

interface StoryLayerProps {
  scene: WorldScene;
  /** Modeli yüklenmiş, haritada görünen kahramanlar. */
  characters: readonly Character[];
  models: ReadonlyMap<string, HeroModel>;
  animate: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

export function StoryLayer({ scene, characters, models, animate, onSelect, onHover }: StoryLayerProps) {
  const { story, motionUniforms, terrain, seed } = scene;
  const characterById = scene.data.characterById;
  const heroes = useMemo(() => ARRIVAL_ORDER.filter((id) => characterById.has(id)), [characterById]);
  const sites = useMemo(() => kutadaSites(terrain, seed), [terrain, seed]);
  const heroKey = heroes.join(",");

  const tick = () => {
    const now = storyTime(useWorldTime.getState().settings, Date.now(), motionUniforms.uTime.value);
    story.day = now.day;
    story.seconds = now.seconds;
    story.ready = true;
  };
  useFrame(() => {
    // Hareket azaltma açıkken kahramanlar o anki hâllerinde kalır.
    if (!animate && story.ready) return;
    tick();
  }, -1);

  const cache = useRef<{ key: string; plan: DayPlan } | null>(null);
  const before = useRef<{ key: string; plan: DayPlan } | null>(null);
  const animalModels = useAnimalModels();
  const animalRef = useRef(animalModels);
  useEffect(() => {
    animalRef.current = animalModels;
  }, [animalModels]);
  const world = useMemo<HeroWorld>(
    () => ({
      terrain,
      sites,
      story,
      uniforms: motionUniforms,
      plan: () => {
        const key = `${story.day}:${heroKey}`;
        if (cache.current?.key !== key) cache.current = { key, plan: dayPlan(sites, heroKey ? (heroKey.split(",") as ArrivalHeroId[]) : [], story.day) };
        return cache.current.plan;
      },
      yesterday: () => {
        const key = `${story.day - 1}:${heroKey}`;
        if (before.current?.key !== key) before.current = { key, plan: dayPlan(sites, heroKey ? (heroKey.split(",") as ArrivalHeroId[]) : [], story.day - 1) };
        return before.current.plan;
      },
      animalModels: () => animalRef.current,
    }),
    // Kahraman listesi metin olarak karşılaştırılır: aynı kalınca dünya da aynı kalır, kahramanlar yeniden kurulmaz.
    [terrain, sites, story, motionUniforms, heroKey],
  );

  // Seçilen (aranan ya da tıklanan) kahraman kameraya dönüp el sallar.
  const sceneRef = useRef(scene);
  useEffect(() => {
    sceneRef.current = scene;
  });
  useEffect(
    () =>
      useAppStore.subscribe((s, prev) => {
        if (s.selectedId && s.selectedId !== prev.selectedId && models.has(s.selectedId)) callHero(sceneRef.current, s.selectedId, 0.6);
        else if (s.focus && s.focus !== prev.focus && models.has(s.focus.id)) callHero(sceneRef.current, s.focus.id, 0.6);
      }),
    [models],
  );

  return (
    <>
      {heroes.length > 0 && <AnimatedHeroes characters={characters} models={models} placements={scene.placements} world={world} onSelect={onSelect} onHover={onHover} />}
      <KutadaWork world={world} heroes={heroes} placements={scene.placements} />
      <MeadowLife world={world} models={animalModels} />
      <KutadaSoundDirector world={world} sky={scene.sky} />
    </>
  );
}

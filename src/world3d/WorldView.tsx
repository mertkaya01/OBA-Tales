/**
 * DÜNYA GÖRÜNÜMÜ (Three.js · React Three Fiber)
 *
 * Ayazlı Adalar'ın piksel diorama hâli: low-poly arazi, deniz, oba çadırları, fener, tapınak,
 * ağaçlar, ayaz sisi ve bölge adları. Kamera uzaktayken harita gibi tepeden, yakında eğik bakar.
 * Filtrelerdeki bölge seçimi ve aramadan seçilen karakter, kamerayı oraya uçurur.
 *
 * Yaşayan dünya (sahne WorldContent.tsx, verisi useWorldScene.ts içinde):
 *   · Takipçiler evlerinin çevresinde gezinir, durup etrafa bakar, seke seke yürür.
 *   · Aktif bölümün akıncıları meydanda saf tutar, boss'a bakar ve dalga dalga Oba Narası atar.
 *   · Gün ve gece İstanbul saatine göre döner; akşam obalarda ışıklar yanar. Hava karlıysa kar yağar.
 *   · Topluluğun ad koyduğu yerlerde "adını koyan @…" etiketi durur.
 */
import { Canvas, useThree } from "@react-three/fiber";
import { BADGES } from "../content/badges";
import { EPISODE_BADGES } from "../lib/rules";
import { RaidDayHud } from "./living/RaidDayHud";
import { RaidSoundToggle } from "./living/RaidSoundToggle";
import { TOUR_SEEN_KEY } from "../content/tour";
import { CAST } from "../content/cast";
import { NARRATOR_ID } from "../content/story";
import { WelcomeTour } from "./WelcomeTour";
import { ArrivalCinematic } from "./story/ArrivalCinematic";
import { WelcomeCinematic } from "./story/WelcomeCinematic";
import { welcomeSpots } from "./story/welcome";
import { ARRIVAL_SEEN_KEY, WELCOME_SEEN_KEY, openingCinematic, type OpeningCinematic } from "./story/arrival";
import { LANDMARKS, VILLAGES } from "../content/sites";
import { cn } from "../lib/cn";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WorldClock } from "../components/hud/WorldClock";
import { ZoomControls } from "../components/hud/ZoomControls";
import { QuickViews } from "../components/hud/QuickViews";
import { soundSupported } from "../audio/kutadaSound";
import { useKutadaSound } from "../state/useKutadaSound";
import { TERRAIN_COLORS } from "../game/palette";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { regionsBounds } from "../lib/clustering";
import { formatNumber } from "../lib/text";
import { useAppStore } from "../state/useAppStore";
import { PLACE_IDS, REGION_IDS, WORLD_SIZE } from "../types";
import type { Character, PlaceId, RegionId } from "../types";
import { CameraRig, type CameraRigHandle } from "./CameraRig";
import { CharacterLabelLayer, CharacterLabelProjector, type CharacterLabelRefs } from "./characters/CharacterLabels";
import { scheduledSpot } from "./story/storyRuntime";
import { SelectionMarker } from "./characters/SelectionMarker";
import { placeAnchors } from "./layout";
import { ISLAND_IDS, ISLAND_LIST } from "../content/islands";
import { PLACE_NAMES } from "../content/places";
import { PlaceLabelLayer, PlaceLabelProjector, type PlaceLabel } from "./living/PlaceLabels";
import { currentPosition, type CharacterPlacement } from "./living/placement";
import { BOSS_HEIGHT } from "./living/raid";
import { LabelProjector, RegionLabelLayer } from "./RegionLabels";
import { useWorldScene } from "./useWorldScene";
import { WorldContent } from "./WorldContent";
import { groundY } from "./worldScale";
import { hiddenLandmasses, isHiddenAt, visibleBounds } from "../game/visibility";

/** Bir karaktere odaklanırken kullanılan yakınlık (1 = bütün adalar). */
const CHARACTER_FOCUS_ZOOM = 11;
/** Hızlı görünümler: Konuk obası ve bütün dünya. */
const KONUK = VILLAGES.find((v) => v.id === "konuk_obasi") ?? VILLAGES[0];
const WHOLE_WORLD = { minX: 0, minY: 0, maxX: WORLD_SIZE.width, maxY: WORLD_SIZE.height };
/** Yer etiketleri bu yakınlıktan itibaren görünür. */
const PLACE_LABEL_ZOOM = 2.2;
/** Adı konmamış yapıların etiketi daha yakında belirir (uzaktan kalabalık olmasın). */
const UNNAMED_LABEL_ZOOM = 4;
/**
 * Bir piksel kaç ekran pikseline büyütülür (netlik). 2: net piksel görünüm (her ekranda). 3 daha "retro",
 * 1 piksel efektini kaldırır. Ayrıntılar: docs/gorsel-rehber.md
 */
const PIXEL_SIZE = 2;

/** Geliştirme sırasında tarayıcı konsolundan incelemek için: window.__kbWorld ve window.__kbLiving */
function DevHandle({ living }: { living: unknown }) {
  const state = useThree();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    Object.assign(window, { __kbWorld: state, __kbLiving: living });
  }, [state, living]);
  return null;
}

interface WorldViewProps {
  /** Filtreden geçen karakterler. */
  characters: readonly Character[];
}

/** Bu tarayıcının gördüğü gelişler. */
function readSeenArrivals(): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(ARRIVAL_SEEN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/** Siteyi bu tarayıcıda ilk kez mi açıyor? (karşılama da tur da görülmemiş; depolama kapalıysa ilk kez sayılmaz) */
function isFirstVisit(): boolean {
  try {
    return window.localStorage.getItem(WELCOME_SEEN_KEY) === null && window.localStorage.getItem(TOUR_SEEN_KEY) === null;
  } catch {
    return false;
  }
}

/**
 * Açılış sineması. Geliştirmede ?gelis=<kimlik> tek bir gelişi, ?karsilama ilk ziyaret karşılamasını zorlar.
 * Paylaşılan bir karakter bağlantısıyla (?k=) gelinmişse sinema oynamaz: kamera doğrudan o karaktere gider.
 */
function initialCinematic(data: { world: { story: Parameters<typeof openingCinematic>[0] }; characterById: ReadonlyMap<string, Character> }): OpeningCinematic | null {
  const params = new URLSearchParams(window.location.search);
  if (import.meta.env.DEV) {
    const forced = params.get("gelis");
    if (forced && data.characterById.has(forced)) return { kind: "gelis", heroes: [forced] };
    if (params.has("karsilama")) return openingCinematic(data.world.story, new Set(), new Date(), true);
  }
  if (useAppStore.getState().selectedId) return null;
  return openingCinematic(data.world.story, readSeenArrivals(), new Date(), isFirstVisit());
}

export default function WorldView({ characters: filtered }: WorldViewProps) {
  const scene = useWorldScene();
  // Ada sesleri: düğmeyle açılır, haritadan çıkınca susar.
  const soundOn = useKutadaSound((s) => s.engine !== null);
  const toggleSound = useKutadaSound((s) => s.toggle);
  useEffect(() => () => useKutadaSound.getState().stop(), []);
  const { data, terrain, motionUniforms, boss, formation, placements, story, seed } = scene;

  // Açılış sineması: ilk ziyarette karşılama (kahramanlar Kut Kapısı'ndan doğar), sonra yalnızca yeni gelişler.
  const [cinematic, setCinematic] = useState<OpeningCinematic | null>(() => initialCinematic(data));
  // Kahramanlar ışık sütunu inene kadar haritada görünmez.
  const [hiddenHeroes, setHiddenHeroes] = useState<ReadonlySet<string>>(() => new Set(cinematic?.heroes ?? []));
  // Sinema sürerken harita arayüzü (arama, filtreler, lejant) çekilir.
  const cinematicOn = cinematic !== null;
  useEffect(() => {
    useAppStore.getState().setCinematic(cinematicOn);
    return () => useAppStore.getState().setCinematic(false);
  }, [cinematicOn]);
  const characters = useMemo(() => (hiddenHeroes.size ? filtered.filter((c) => !hiddenHeroes.has(c.id)) : filtered), [filtered, hiddenHeroes]);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const regions = useAppStore((s) => s.filters.regions);
  const focus = useAppStore((s) => s.focus);
  const rigRef = useRef<CameraRigHandle>(null);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const placeLabelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const characterLabelRefs = useRef<CharacterLabelRefs>({ selected: null, hovered: null });
  const compassRef = useRef<HTMLSpanElement>(null);
  const watching = useAppStore((s) => s.watchingRaid);
  const selectedId = useAppStore((s) => s.selectedId);
  const animate = !reducedMotion;

  const visibleIds = useMemo(() => new Set(characters.map((c) => c.id)), [characters]);
  const regionCounts = useMemo(() => {
    const counts = Object.fromEntries(REGION_IDS.map((id) => [id, 0])) as Record<RegionId, number>;
    for (const c of characters) counts[c.region] += 1;
    return counts;
  }, [characters]);
  const onSelect = useCallback((id: string) => useAppStore.getState().select(id), []);
  const onHover = useCallback((id: string | null) => useAppStore.getState().setHovered(id), []);

  // ── Yer etiketleri ───────────────────────────────────────────────
  const episodeNumber = data.activeEpisode.number;
  const placeLabels = useMemo<PlaceLabel[]>(() => {
    const anchors = placeAnchors(terrain);
    const islandIds = new Set<string>(ISLAND_IDS);
    const labels: PlaceLabel[] = data.world.namedPlaces.filter((p) => !isHiddenAt(terrain, data.visibility, anchors[p.place].point)).map((named) => {
      const namer = data.characterById.get(named.namedBy);
      return {
        key: `yer:${named.place}`,
        kind: "yer",
        point: anchors[named.place].point,
        lift: anchors[named.place].lift,
        title: named.name,
        namedBy: { id: named.namedBy, handle: namer?.handle ?? named.namedBy, known: !!namer },
        // Adalar uzaktan da okunur; yapılar yaklaşınca belirir.
        minZoom: islandIds.has(named.place) ? 0 : PLACE_LABEL_ZOOM,
      };
    });
    // Adı konmamış yerler topluluğu ad koymaya çağırır: yapılar yaklaşınca, yabani adalar uzaktan da.
    const named = new Set<PlaceId>(data.world.namedPlaces.map((p) => p.place));
    // Kut Kapısı: yeni yoldaşların geldiği yer, uzaktan da görünür ve kaç kişinin yeni geldiğini söyler.
    const newcomers = data.characters.filter((c) => c.region === "kutada").length;
    const portalNamed = data.world.namedPlaces.find((p) => p.place === "kut_kapisi");
    labels.push({
      key: "portal",
      kind: "meydan",
      point: anchors.kut_kapisi.point,
      lift: anchors.kut_kapisi.lift,
      title: portalNamed?.name ?? PLACE_NAMES.kut_kapisi,
      subtitle: data.characters.length === 0 ? "İlk yoldaş yolda…" : `yeni yoldaşlar buradan gelir · ${formatNumber(newcomers)} yeni`,
      minZoom: 1.2,
    });
    for (const place of PLACE_IDS) {
      if (named.has(place) || islandIds.has(place) || place === "kut_kapisi") continue;
      // Karartılı karadaki yerlerin etiketi yok.
      if (isHiddenAt(terrain, data.visibility, anchors[place].point)) continue;
      labels.push({
        key: `yer:${place}`,
        kind: "yer",
        point: anchors[place].point,
        lift: anchors[place].lift,
        title: PLACE_NAMES[place],
        subtitle: "adını sen koy",
        minZoom: UNNAMED_LABEL_ZOOM,
      });
    }
    // Karartılı her kara parçasına tek "?" (ana ada beş bölge olsa da tek işaret).
    hiddenLandmasses(terrain, data.visibility).forEach((point, i) => labels.push({ key: `gizli:${i}`, kind: "gizli", point, lift: 10, title: "?", minZoom: 0 }));
    for (const island of ISLAND_LIST) {
      if (!data.visibility.islands.has(island.id) || named.has(island.id)) continue;
      labels.push({
        key: `ada:${island.id}`,
        kind: "yer",
        point: anchors[island.id].point,
        lift: anchors[island.id].lift,
        title: "Adsız ada",
        subtitle: `“${island.nickname}” · adını sen koy`,
        minZoom: 0,
      });
    }
    if (formation) {
      const count = `${formatNumber(formation.slots.size)} akıncı`;
      labels.push(
        boss
          ? { key: "boss", kind: "boss", point: formation.ground.focus, lift: BOSS_HEIGHT[boss.id] + 4, title: boss.name, subtitle: `${boss.epithet} · ${count}`, minZoom: 1.6 }
          : { key: "meydan", kind: "meydan", point: formation.ground.square, lift: 12, title: "Akın Meydanı", subtitle: `Bölüm ${episodeNumber} · ${count}`, minZoom: 1.6 },
      );
    }
    return labels;
  }, [terrain, data.world.namedPlaces, data.characterById, data.characters, data.visibility, formation, boss, episodeNumber]);

  const groundAt = useCallback((p: { x: number; y: number }) => groundY(terrain, p), [terrain]);
  const onNamerClick = useCallback((id: string) => useAppStore.getState().focusCharacter(id), []);

  /** Karakterin şu anki yeri (yürüyor olabilir). */
  const positionOf = useCallback(
    (placement: CharacterPlacement) => {
      const p = currentPosition(placement, terrain, motionUniforms.uTime.value);
      return { x: p.x, y: p.z };
    },
    [terrain, motionUniforms],
  );

  // Bölge filtresi değişince o bölgelere uç; seçim kaldırılınca bütün adalara dön.
  const regionKey = regions.join(",");
  const firstRegionFocus = useRef(true);
  useEffect(() => {
    const ids = regionKey ? (regionKey.split(",") as RegionId[]) : [];
    if (firstRegionFocus.current) {
      firstRegionFocus.current = false;
      if (ids.length === 0) return;
    }
    // Kamera ilk karede hazır olsun diye bir sonraki turda.
    const timer = window.setTimeout(() => {
      if (ids.length === 0) rigRef.current?.reset();
      else rigRef.current?.flyToBounds(regionsBounds(ids));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [regionKey]);

  // Aramadan ya da "adını koyan" etiketinden seçilen karaktere uç.
  useEffect(() => {
    if (!focus) return;
    const placement = placements.get(focus.id);
    if (placement) rigRef.current?.flyTo(positionOf(placement), CHARACTER_FOCUS_ZOOM);
  }, [focus, placements, positionOf]);

  // Paylaşılan link (?k=…) ile açıldıysa seçili karaktere yakınlaş.
  const initialSelection = useRef(useAppStore.getState().selectedId);
  useEffect(() => {
    const id = initialSelection.current;
    const placement = id ? placements.get(id) : undefined;
    if (!placement) return;
    const timer = window.setTimeout(() => rigRef.current?.flyTo(positionOf(placement), CHARACTER_FOCUS_ZOOM), 50);
    return () => window.clearTimeout(timer);
  }, [placements, positionOf]);

  // Canlı akın: kamera meydana uçup etrafında döner, savaş temposu artar. Kamerayı tutunca biter.
  useEffect(() => {
    scene.battle.intense = watching;
    // Akın Günü her izlemede baştan başlar.
    scene.battle.day = null;
    if (!watching) {
      rigRef.current?.stopWatch();
      return;
    }
    if (!formation) {
      useAppStore.getState().stopWatchingRaid();
      return;
    }
    const { square, focus } = formation.ground;
    const center = { x: square.x * 0.6 + focus.x * 0.4, y: square.y * 0.6 + focus.y * 0.4 };
    // Kamera merkez etrafında döner: boss (yaklaşık 24 birim) ve bütün saf dönerken de görünsün.
    const fit = Math.max(Math.hypot(focus.x - center.x, focus.y - center.y) + 28, Math.hypot(square.x - center.x, square.y - center.y) + formation.radius);
    const timer = window.setTimeout(() => rigRef.current?.watch(center, 8, formation.facing + Math.PI + 0.5, fit), 80);
    return () => window.clearTimeout(timer);
  }, [watching, formation, scene.battle]);
  // Dünya görünümünden çıkınca izleme de biter.
  useEffect(() => () => useAppStore.getState().stopWatchingRaid(), []);
  const onWatchEnd = useCallback(() => useAppStore.getState().stopWatchingRaid(), []);

  // İlk oba turu: ilk ziyarette (bir karaktere bağlantıyla gelinmediyse) kendiliğinden açılır; görüldüğü saklanır.
  const touring = useAppStore((s) => s.tourOpen);
  useEffect(() => {
    let seen = true;
    try {
      seen = window.localStorage.getItem(TOUR_SEEN_KEY) !== null;
    } catch {
      // Depolama kapalıysa tur kendiliğinden açılmaz (Lejant'tan açılabilir).
    }
    const { selectedId, watchingRaid } = useAppStore.getState();
    // Geliş sineması önce oynar; tur onun ardından açılır.
    if (seen || selectedId || watchingRaid || cinematic) return;
    const timer = window.setTimeout(() => useAppStore.getState().startTour(), 1400);
    return () => window.clearTimeout(timer);
  }, [cinematic]);
  useEffect(() => () => useAppStore.getState().endTour(), []);
  const endTour = useCallback(() => {
    try {
      window.localStorage.setItem(TOUR_SEEN_KEY, new Date().toISOString());
    } catch {
      // Depolama kapalıysa bir dahaki ziyarette yine açılır.
    }
    useAppStore.getState().endTour();
  }, []);
  // Karşılamada (birden çok kahraman) hepsi Kut Kapısı'nın önüne yan yana doğar ve tek tek tanıtılır.
  const welcome = cinematic?.kind === "karsilama" && cinematic.heroes.length > 1;
  // Doğacak kahramanlar ve ışığın ineceği yerler: karşılamada kapının önü, yeni gelişte gün düzenindeki o anki yeri
  // (odun keserken koru, gece çadır kapısı).
  const arriving = useMemo(() => {
    if (!cinematic) return [];
    const stage = welcome ? welcomeSpots(LANDMARKS.kutKapisi, cinematic.heroes.length) : null;
    const list = cinematic.heroes.flatMap((id, i) => {
      const hero = data.characterById.get(id);
      const placement = placements.get(id);
      if (!hero || !placement) return [];
      return [{ hero, spot: stage?.[i] ?? scheduledSpot({ data, terrain, seed, story, motionUniforms }, id) ?? placement.home }];
    });
    const portal = LANDMARKS.kutKapisi;
    scene.arrival.from = { x: portal.x, y: groundY(terrain, portal) + 20, z: portal.y };
    scene.arrival.targets = list.map(({ spot }) => ({ x: spot.x, y: groundY(terrain, spot) + 1.5, z: spot.y }));
    return list;
  }, [cinematic, welcome, placements, terrain, scene.arrival, data, seed, story, motionUniforms]);
  // Karşılamada kahramanlar kapının önünde durur (gün düzeni bekler); bitince yerlerine dönerler.
  const onStage = useCallback(
    (id: string, wave: boolean | null) => {
      const spot = arriving.find((a) => a.hero.id === id)?.spot;
      if (wave === null || !spot) story.stage.delete(id);
      else story.stage.set(id, { x: spot.x, z: spot.y, wave });
    },
    [arriving, story],
  );
  // Belirince haritaya eklenir. Yeni gelişte ayrıca kameraya döner, el sallar (uyuyorsa çadırından çıkıp selam
  // verir, geri girer); karşılamada el sallamayı sahne (onStage) yönetir.
  const showHero = useCallback((id: string) => {
    setHiddenHeroes((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);
  const onArrivalReveal = useCallback(
    (id: string) => {
      showHero(id);
      story.calls.set(id, motionUniforms.uTime.value + 0.5);
    },
    [showHero, story, motionUniforms],
  );
  const onArrivalDone = useCallback(() => {
    try {
      window.localStorage.setItem(ARRIVAL_SEEN_KEY, JSON.stringify(data.world.story.arrivals.map((a) => a.id)));
      // Karşılama bitince (ya da atlanınca) bir daha oynamaz; tur ardından açılır.
      if (cinematic?.kind === "karsilama") window.localStorage.setItem(WELCOME_SEEN_KEY, new Date().toISOString());
    } catch {
      // Depolama kapalıysa sinema bir dahaki ziyarette yine oynar.
    }
    setHiddenHeroes(new Set());
    setCinematic(null);
  }, [data.world.story.arrivals, cinematic]);

  // Akın Günü göstergesi için akıncılar ve akının rozeti.
  const raiders = useMemo(() => (formation ? [...formation.slots.keys()].map((id) => data.characterById.get(id)).filter((c): c is Character => !!c) : []), [formation, data.characterById]);
  const raidBadge = EPISODE_BADGES[data.activeEpisode.number];

  // Zemine tek tıklama kamerayı oynatmaz (yalnızca açık çekmeceyi kapatır); çift tıklama oraya yakınlaşır.
  // Bölge filtresi yalnızca Filtreler panelinden değişir.
  const onGroundClick = useCallback(() => {
    if (useAppStore.getState().selectedId) useAppStore.getState().select(null);
  }, []);
  const onGroundDoubleClick = useCallback((point: { x: number; y: number }) => rigRef.current?.zoomAt(point, 1.8), []);
  // Ev görünümü: açık adalar (1. günde Kutada) ve çevresindeki "?" adaların kıyıları.
  const home = useMemo(() => visibleBounds(data.visibility), [data.visibility]);

  return (
    <div className="absolute inset-0">
      <Canvas
        orthographic
        flat
        dpr={1}
        shadows="percentage"
        gl={{ antialias: false, powerPreference: "high-performance" }}
        camera={{ position: [WORLD_SIZE.width / 2, 1500, WORLD_SIZE.height / 2 + 0.01], zoom: 1, near: 10, far: 4000 }}
        onCreated={({ gl }) => {
          gl.setClearColor(TERRAIN_COLORS.deepSea);
          gl.domElement.setAttribute(
            "aria-label",
            "OBA-Tales üç boyutlu dünyası. Sürükleyerek kaydırın, tekerlekle ya da çift tıklayarak yakınlaşın, sağ tıkla sürükleyerek ya da Q ve E tuşlarıyla döndürün; odaklanınca ok tuşları da çalışır.",
          );
        }}
        className="kb-dunya"
      >
        <WorldContent
          scene={scene}
          characters={characters}
          animate={animate}
          pixelSize={PIXEL_SIZE}
          onSelect={onSelect}
          onHover={onHover}
          onGroundClick={onGroundClick}
          onGroundDoubleClick={onGroundDoubleClick}
        />
        <SelectionMarker
          terrain={terrain}
          characterById={data.characterById}
          placements={placements}
          uniforms={motionUniforms}
          visibleIds={visibleIds}
        />
        <CameraRig ref={rigRef} reducedMotion={reducedMotion} compassRef={compassRef} onWatchEnd={onWatchEnd} groundAt={groundAt} home={home} />
        <LabelProjector refs={labelRefs} terrain={terrain} />
        <PlaceLabelProjector labels={placeLabels} refs={placeLabelRefs} terrain={terrain} />
        <CharacterLabelProjector
          refs={characterLabelRefs}
          terrain={terrain}
          placements={placements}
          uniforms={motionUniforms}
          visibleIds={visibleIds}
        />
        <DevHandle living={import.meta.env.DEV ? { placements, uniforms: motionUniforms, formation, select: onSelect } : null} />
      </Canvas>
      <RegionLabelLayer refs={labelRefs} revealedRegions={data.revealedRegions} counts={regionCounts} />
      <PlaceLabelLayer labels={placeLabels} refs={placeLabelRefs} onNamerClick={onNamerClick} />
      <CharacterLabelLayer refs={characterLabelRefs} characterById={data.characterById} visibleIds={visibleIds} />

      {cinematic && welcome && arriving.length > 1 && (
        <WelcomeCinematic
          heroes={arriving}
          runtime={scene.arrival}
          rig={rigRef}
          reducedMotion={reducedMotion}
          onReveal={showHero}
          onStage={onStage}
          onDone={onArrivalDone}
        />
      )}
      {cinematic && !welcome && arriving.length > 0 && (
        <ArrivalCinematic
          heroes={arriving}
          welcome={cinematic.kind === "karsilama"}
          runtime={scene.arrival}
          rig={rigRef}
          reducedMotion={reducedMotion}
          onReveal={onArrivalReveal}
          onDone={onArrivalDone}
        />
      )}
      {touring && !watching && !cinematic && <WelcomeTour rig={rigRef} narrator={CAST.find((c) => c.id === NARRATOR_ID)} onClose={endTour} />}
      {watching && boss && formation && <RaidDayHud battle={scene.battle} bossName={boss.name} raiders={raiders} badge={raidBadge ? BADGES[raidBadge].name : null} />}
      {watching && boss && formation && (
        <div className="absolute bottom-20 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full border border-alev-400/50 bg-gece-900/90 py-1.5 pl-4 pr-1.5 shadow-lg backdrop-blur sm:bottom-4" role="status">
          <span aria-hidden className="size-2.5 animate-pulse rounded-full bg-kilim-400" />
          <span className="font-display text-sm text-buz-50">
            Canlı akın<span className="hidden sm:inline"> · {boss.name}</span>
          </span>
          <span className="hidden text-xs text-buz-300 md:inline">{formatNumber(formation.slots.size)} akıncı · kamerayı tutunca serbest kalır</span>
          <RaidSoundToggle battle={scene.battle} />
          <button
            type="button"
            onClick={onWatchEnd}
            className="rounded-full border border-white/15 px-3 py-1 text-xs text-buz-100 hover:bg-white/10"
          >
            Bitir
          </button>
        </div>
      )}
      {!touring && !cinematic && !watching && (
        <QuickViews
          className={cn("absolute bottom-16 left-1/2 z-10 -translate-x-1/2 sm:bottom-4", selectedId && "max-md:hidden")}
          views={[
            { id: "oba", label: "Oba", title: "Konuk obası: kahramanların ateşi", go: () => rigRef.current?.flyTo(KONUK.center, 9) },
            { id: "kapi", label: "Kapı", title: "Kut Kapısı: yeni yoldaşlar buradan gelir", go: () => rigRef.current?.flyTo(LANDMARKS.kutKapisi, 6) },
            { id: "ada", label: "Kutada", title: "Hikâyede açık adalar", go: () => rigRef.current?.reset() },
            { id: "dunya", label: "Dünya", title: "Bütün dünya (karanlıktaki adalar dahil)", go: () => rigRef.current?.flyToBounds(WHOLE_WORLD) },
          ]}
        />
      )}
      {/* Sinema sürerken saat ve kamera düğmeleri çekilir (görüntü temiz kalsın). */}
      <div className={cn("transition-[opacity,visibility] duration-500", cinematic && "invisible opacity-0")}>
      <WorldClock seasonStart={data.episodes[0]?.progress?.airedAt ?? null} weather={data.world.weather} />
      <ZoomControls
        sound={soundSupported() ? { on: soundOn, onToggle: () => void toggleSound() } : undefined}
        onZoomIn={() => rigRef.current?.zoomBy(1.6)}
        onZoomOut={() => rigRef.current?.zoomBy(1 / 1.6)}
        onReset={() => {
          useAppStore.getState().setRegions([]);
          rigRef.current?.reset();
        }}
        rotation={{
          onRotateLeft: () => rigRef.current?.rotateBy(Math.PI / 4),
          onRotateRight: () => rigRef.current?.rotateBy(-Math.PI / 4),
          onNorth: () => rigRef.current?.faceNorth(),
          compassRef,
        }}
      />
      </div>
    </div>
  );
}

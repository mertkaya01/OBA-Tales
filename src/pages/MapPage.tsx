/**
 * ANA AKIN HARİTASI ( / )
 *
 * Tam ekran harita ve üstündeki arayüz:
 *   sol üst   → Filtreler + görünüm seçici (Dünya / Harita)
 *   orta üst  → sınıf sayaçları (haritadaki Kalkaneri · Okyeli · Ocakcan), altında seçili filtreler
 *   sağ üst   → "Kahramanını bul" araması
 *   sol alt   → lejant          sağ alt → yakınlaştırma
 *   sağ/alt   → karakter detay çekmecesi
 *
 * Varsayılan görünüm Dünya'dır (Three.js); tarayıcı WebGL desteklemiyorsa Harita (Leaflet) açılır.
 */
import { lazy, Suspense } from "react";
import { CharacterDrawer } from "../components/character/CharacterDrawer";
import { ActiveFilterBar } from "../components/filters/ActiveFilterBar";
import { ClassCounts } from "../components/hud/ClassCounts";
import { FilterPanel } from "../components/filters/FilterPanel";
import { HeroSearch } from "../components/hud/HeroSearch";
import { MapLegend } from "../components/hud/MapLegend";
import { ViewSwitcher } from "../components/hud/ViewSwitcher";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { useFilteredCharacters } from "../hooks/useFilteredCharacters";
import { detectWebGL, useWebGLSupport } from "../hooks/useWebGLSupport";
import { cn } from "../lib/cn";
import { useAppStore } from "../state/useAppStore";
import { useUrlSync } from "../state/useUrlSync";

const MapView = lazy(() => import("../map2d/MapView"));
const loadWorldView = () => import("../world3d/WorldView");
const WorldView = lazy(loadWorldView);

// Dünya görünümünün kodu (three.js ve sahne, ~430 KB) veriler ve arazi hazırlanırken paralel insin:
// arazi bitince harita beklemeden açılır. Bu modül, sayfa verisi yüklenirken yönlendirici tarafından erkenden alınır.
if (typeof window !== "undefined" && useAppStore.getState().view === "dunya" && detectWebGL()) void loadWorldView();

export default function MapPage() {
  useUrlSync();
  const { all, filtered, facets } = useFilteredCharacters();
  const view = useAppStore((s) => s.view);
  const drawerOpen = useAppStore((s) => s.selectedId !== null);
  const worldSupported = useWebGLSupport();
  const effectiveView = worldSupported ? view : "harita";

  return (
    <>
      <title>Harita · OBA-Tales</title>
      <h1 className="sr-only">OBA-Tales Haritası</h1>

      <div className="relative flex-1 overflow-hidden bg-gece-950">
        <Suspense
          fallback={<LoadingScreen fullScreen={false} message={effectiveView === "dunya" ? "Adalar yükseliyor…" : "Harita çiziliyor…"} />}
        >
          {effectiveView === "dunya" ? <WorldView characters={filtered} /> : <MapView characters={filtered} />}
        </Suspense>

        {/* Üst arayüz. Kapsayıcı tıklamaları haritaya geçirir, içindeki parçalar yakalar. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 grid gap-2 p-3 md:grid-cols-[1fr_auto_1fr] md:items-start">
          <div className="pointer-events-auto order-2 flex items-start gap-2 md:order-1">
            <div className="relative">
              <FilterPanel facets={facets} resultCount={filtered.length} />
            </div>
            <ViewSwitcher
              value={effectiveView}
              onChange={useAppStore.getState().setView}
              worldAvailable={worldSupported}
              worldUnavailableReason="Tarayıcın üç boyutlu çizimi (WebGL) desteklemiyor"
            />
          </div>

          <div className="order-3 flex flex-col items-center gap-2 md:order-2">
            <ClassCounts characters={all} className="pointer-events-auto" />
            <ActiveFilterBar resultCount={filtered.length} totalCount={all.length} className="pointer-events-auto" />
          </div>

          <div className={cn("order-1 flex md:order-3 md:justify-end", drawerOpen && "md:mr-[400px]")}>
            <HeroSearch matches={filtered} className="pointer-events-auto w-full md:w-80" />
          </div>
        </div>

        <MapLegend className="absolute bottom-4 left-3 z-10" />
        <CharacterDrawer />
      </div>
    </>
  );
}

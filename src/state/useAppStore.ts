/**
 * UYGULAMA DURUMU (zustand) — filtreler, seçili karakter, görünüm ve geçici arayüz durumu.
 *
 * React bileşenleri, Three.js sahnesi ve Leaflet haritası aynı depoyu okur:
 *   const regions = useAppStore((s) => s.filters.regions);
 *   useAppStore.getState().select("baturay");
 *
 * Filtreler, seçili karakter ve görünüm URL ile senkron tutulur (useUrlSync.ts).
 * hoveredId ve filterPanelOpen URL'ye yazılmaz.
 */
import { create } from "zustand";
import { createEmptyFilters } from "../types";
import type { ClassId, FilterState, Rarity, RegionId, SpecialFilterId, ViewMode } from "../types";
import { filtersEqual, filtersFromSearchParams, readSelectedId, readViewMode, toggleInList } from "../lib/filters";

export interface AppState {
  filters: FilterState;
  /** Çekmecede açık olan karakter (?k=). */
  selectedId: string | null;
  view: ViewMode;
  /** Haritada üzerine gelinen karakter. */
  hoveredId: string | null;
  /** Filtre paneli açık mı? */
  filterPanelOpen: boolean;
  /** Haritanın uçması istenen karakter. nonce, aynı karaktere tekrar odaklanmayı da tetikler. */
  focus: { id: string; nonce: number } | null;
  /** Aktif bölümün boss akını paneli açık mı? (URL'ye yazılmaz.) */
  raidOpen: boolean;
  /** 3D dünyada canlı akın izleniyor mu? (kamera meydanın etrafında döner) */
  watchingRaid: boolean;
  /** İlk oba turu açık mı? (Dede Toygar anlatır; URL'ye yazılmaz.) */
  tourOpen: boolean;

  setQuery: (query: string) => void;
  toggleClass: (id: ClassId) => void;
  toggleRarity: (rarity: Rarity) => void;
  toggleRegion: (id: RegionId) => void;
  toggleSpecial: (id: SpecialFilterId) => void;
  /** Bölge filtresini doğrudan ayarlar (ör. haritada bölgeye tıklayınca tek bölge). */
  setRegions: (ids: RegionId[]) => void;
  resetFilters: () => void;
  select: (id: string | null) => void;
  setView: (view: ViewMode) => void;
  setHovered: (id: string | null) => void;
  setFilterPanelOpen: (open: boolean) => void;
  /** Karakteri seçer ve haritayı ona uçurur (ör. aramadan seçilince). */
  focusCharacter: (id: string) => void;
  setRaidOpen: (open: boolean) => void;
  /** Canlı akını izlemeye başlar: panel kapanır, görünüm Dünya'ya geçer. */
  watchRaid: () => void;
  stopWatchingRaid: () => void;
  /** Tanıtım turunu açar (görünüm Dünya'ya geçer, canlı akın izleme biter). */
  startTour: () => void;
  endTour: () => void;
  /** URL değişince (ilk açılış, geri/ileri) durumu URL'den kurar. */
  hydrateFromUrl: (params: URLSearchParams) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  filters: createEmptyFilters(),
  selectedId: null,
  view: "dunya",
  hoveredId: null,
  filterPanelOpen: false,
  focus: null,
  raidOpen: false,
  watchingRaid: false,
  tourOpen: false,

  setQuery: (query) => set((s) => ({ filters: { ...s.filters, query } })),
  toggleClass: (id) => set((s) => ({ filters: { ...s.filters, classes: toggleInList(s.filters.classes, id) } })),
  toggleRarity: (rarity) => set((s) => ({ filters: { ...s.filters, rarities: toggleInList(s.filters.rarities, rarity) } })),
  toggleRegion: (id) => set((s) => ({ filters: { ...s.filters, regions: toggleInList(s.filters.regions, id) } })),
  toggleSpecial: (id) => set((s) => ({ filters: { ...s.filters, special: toggleInList(s.filters.special, id) } })),
  setRegions: (ids) => set((s) => ({ filters: { ...s.filters, regions: [...ids] } })),
  resetFilters: () => set({ filters: createEmptyFilters() }),
  select: (selectedId) => set({ selectedId }),
  setView: (view) => set({ view }),
  setHovered: (hoveredId) => set((s) => (s.hoveredId === hoveredId ? s : { hoveredId })),
  setFilterPanelOpen: (filterPanelOpen) => set({ filterPanelOpen }),
  focusCharacter: (id) => set((s) => ({ selectedId: id, focus: { id, nonce: (s.focus?.nonce ?? 0) + 1 } })),
  setRaidOpen: (raidOpen) => set({ raidOpen }),
  watchRaid: () => set({ raidOpen: false, view: "dunya", watchingRaid: true, tourOpen: false }),
  stopWatchingRaid: () => set((s) => (s.watchingRaid ? { watchingRaid: false } : s)),
  startTour: () => set({ tourOpen: true, view: "dunya", watchingRaid: false, raidOpen: false }),
  endTour: () => set((s) => (s.tourOpen ? { tourOpen: false } : s)),

  hydrateFromUrl: (params) =>
    set((s) => {
      const filters = filtersFromSearchParams(params);
      return {
        // Aynı filtreyse eski nesneyi koru: gereksiz yeniden çizim olmasın, yazılan metin bozulmasın.
        filters: filtersEqual(s.filters, filters) ? s.filters : filters,
        selectedId: readSelectedId(params),
        view: readViewMode(params),
      };
    }),
}));

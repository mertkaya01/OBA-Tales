/**
 * Filtre paneli — sınıf/platform, nadirlik, bölge ve özel durum filtreleri.
 * Masaüstünde haritanın solunda açılan kart, mobilde alttan açılan sayfa.
 * Her seçeneğin yanında, işaretlenirse kaç karakter kalacağı yazar.
 */
import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useId } from "react";
import { CLASS_LIST } from "../../content/classes";
import { RARITY_LIST } from "../../content/rarities";
import { REGION_LIST } from "../../content/regions";
import { useGameData } from "../../data/useGameData";
import { cn } from "../../lib/cn";
import { countActiveFilters, type FilterFacets } from "../../lib/filters";
import { formatNumber } from "../../lib/text";
import { useAppStore } from "../../state/useAppStore";
import type { Rarity, SpecialFilterId } from "../../types";
import { ClassIcon } from "../character/ClassIcon";
import { FilterGroup, type FilterOption } from "./FilterGroup";

const RARITY_DOT: Record<Rarity, string> = {
  siradan: "bg-siradan",
  nadir: "bg-nadir",
  destansi: "bg-destansi",
  efsanevi: "bg-efsanevi",
  ulu: "bg-ulu",
  goksel: "bg-goksel",
};

const RARITY_ACTIVE: Record<Rarity, string> = {
  siradan: "border-siradan bg-siradan/20 text-buz-50",
  nadir: "border-nadir bg-nadir/20 text-buz-50",
  destansi: "border-destansi bg-destansi/25 text-buz-50",
  efsanevi: "border-efsanevi bg-efsanevi/25 text-buz-50",
  ulu: "border-ulu bg-ulu/25 text-buz-50",
  goksel: "border-goksel bg-goksel/25 text-buz-50",
};

interface FilterPanelProps {
  facets: FilterFacets;
  resultCount: number;
}

export function FilterPanel({ facets, resultCount }: FilterPanelProps) {
  const open = useAppStore((s) => s.filterPanelOpen);
  const filters = useAppStore((s) => s.filters);
  const { setFilterPanelOpen, toggleClass, toggleRarity, toggleRegion, toggleSpecial, resetFilters } = useAppStore.getState();
  const { activeEpisode, revealedRegions } = useGameData();
  const panelId = useId();
  const activeCount = countActiveFilters(filters) - (filters.query.trim() ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setFilterPanelOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setFilterPanelOpen]);

  const specialOptions: FilterOption<SpecialFilterId>[] = [
    { value: "kadro", label: "Ana & Yan Kadro", count: facets.special.kadro },
    { value: "coklu", label: "Çoklu Platform Rozetliler", count: facets.special.coklu },
    { value: "akin", label: `Bölüm ${activeEpisode.number} Akınındakiler`, count: facets.special.akin },
  ];

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setFilterPanelOpen(!open)}
        className={cn(
          "flex items-center gap-2 rounded-xl border px-3 py-2 font-display text-sm shadow-lg backdrop-blur transition-colors",
          open ? "border-gunozu-400/60 bg-gunozu-400/20 text-gunozu-100" : "border-white/15 bg-gece-900/90 text-buz-100 hover:bg-gece-800",
        )}
      >
        <SlidersHorizontal aria-hidden className="size-4" />
        Filtreler
        {activeCount > 0 && (
          <span className="grid min-w-5 place-items-center rounded-full bg-gunozu-400 px-1.5 text-xs text-gece-950">{activeCount}</span>
        )}
      </button>

      {open && (
        <section
          id={panelId}
          aria-label="Filtreler"
          className="fixed inset-x-0 bottom-0 z-40 flex max-h-[78dvh] flex-col rounded-t-2xl border-t border-white/10 bg-gece-900/97 shadow-2xl backdrop-blur-md motion-safe:animate-sheet-in md:absolute md:inset-x-auto md:bottom-auto md:left-0 md:top-full md:mt-2 md:max-h-[calc(100dvh-12.5rem)] md:w-80 md:rounded-2xl md:border md:motion-safe:animate-none"
        >
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="font-display text-lg text-gunozu-300">Filtreler</p>
            <button
              type="button"
              onClick={() => setFilterPanelOpen(false)}
              className="rounded-lg p-1.5 text-buz-200 hover:bg-white/10"
              aria-label="Filtreleri kapat"
            >
              <X aria-hidden className="size-5" />
            </button>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-4 py-4">
            <FilterGroup
              title="Sınıf / Platform"
              options={CLASS_LIST.map((c) => ({
                value: c.id,
                label: `${c.name} · ${c.platformLabel}`,
                icon: <ClassIcon classId={c.id} />,
                count: facets.classes[c.id],
              }))}
              selected={filters.classes}
              onToggle={toggleClass}
            />
            <FilterGroup
              title="Nadirlik"
              options={RARITY_LIST.map((r) => ({
                value: r.id,
                label: r.label,
                icon: <span aria-hidden className={cn("size-2.5 rounded-full", RARITY_DOT[r.id])} />,
                count: facets.rarities[r.id],
                activeClassName: RARITY_ACTIVE[r.id],
              }))}
              selected={filters.rarities}
              onToggle={toggleRarity}
            />
            <FilterGroup
              title="Bölge"
              hint="Seçilen bölgeye harita odaklanır"
              options={REGION_LIST.map((r) => ({
                value: r.id,
                label: revealedRegions.has(r.id) ? r.name : `${r.name} (sisli)`,
                count: facets.regions[r.id],
              }))}
              selected={filters.regions}
              onToggle={toggleRegion}
            />
            <FilterGroup title="Özel durum" options={specialOptions} selected={filters.special} onToggle={toggleSpecial} />
          </div>

          <footer className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-3">
            <button
              type="button"
              onClick={resetFilters}
              disabled={countActiveFilters(filters) === 0}
              className="rounded-lg px-3 py-2 text-sm text-buz-200 underline decoration-dotted hover:text-buz-50 disabled:no-underline disabled:opacity-40"
            >
              Hepsini temizle
            </button>
            <button
              type="button"
              onClick={() => setFilterPanelOpen(false)}
              className="rounded-lg bg-gunozu-400 px-4 py-2 font-display text-sm text-gece-950 hover:bg-gunozu-300 md:hidden"
            >
              {formatNumber(resultCount)} kahramanı göster
            </button>
            <span className="hidden text-sm text-buz-300 md:inline" aria-live="polite">
              {formatNumber(resultCount)} kahraman
            </span>
          </footer>
        </section>
      )}
    </>
  );
}

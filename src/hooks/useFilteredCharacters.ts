/**
 * Filtrelenmiş karakter listesi ve filtre seçeneklerinin sayıları.
 *
 * Arama kutusuna yazarken arayüz takılmasın diye filtreler "ertelenmiş" değerle uygulanır
 * (useDeferredValue): yazı hemen görünür, liste ve harita bir an sonra güncellenir.
 */
import { useDeferredValue, useMemo } from "react";
import { useGameData } from "../data/useGameData";
import { applyFilters, facetCounts, type FilterContext } from "../lib/filters";
import { useAppStore } from "../state/useAppStore";

export function useFilteredCharacters() {
  const data = useGameData();
  const filters = useAppStore((s) => s.filters);
  const deferredFilters = useDeferredValue(filters);

  const ctx = useMemo<FilterContext>(() => ({ activeParticipantIds: data.activeParticipantIds }), [data.activeParticipantIds]);
  const filtered = useMemo(() => applyFilters(data.characters, deferredFilters, ctx), [data.characters, deferredFilters, ctx]);
  const facets = useMemo(() => facetCounts(data.characters, deferredFilters, ctx), [data.characters, deferredFilters, ctx]);

  return {
    all: data.characters,
    filtered,
    facets,
    filters,
    /** Liste henüz son yazılan filtreye yetişmediyse true. */
    isStale: deferredFilters !== filters,
  };
}

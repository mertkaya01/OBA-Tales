/**
 * Seçili filtreler tek satırda: her biri tek tıkla kaldırılabilir; sonuç sayısı ve "Temizle".
 * Hiç filtre yoksa görünmez.
 */
import { X } from "lucide-react";
import { CLASSES } from "../../content/classes";
import { RARITY_INFO } from "../../content/rarities";
import { REGIONS } from "../../content/regions";
import { useGameData } from "../../data/useGameData";
import { cn } from "../../lib/cn";
import { countActiveFilters } from "../../lib/filters";
import { formatNumber } from "../../lib/text";
import { useAppStore } from "../../state/useAppStore";
import type { SpecialFilterId } from "../../types";

interface ActiveFilterBarProps {
  resultCount: number;
  totalCount: number;
  className?: string;
}

export function ActiveFilterBar({ resultCount, totalCount, className }: ActiveFilterBarProps) {
  const filters = useAppStore((s) => s.filters);
  const { setQuery, toggleClass, toggleRarity, toggleRegion, toggleSpecial, resetFilters } = useAppStore.getState();
  const { activeEpisode } = useGameData();

  if (countActiveFilters(filters) === 0) return null;

  const specialLabels: Record<SpecialFilterId, string> = {
    kadro: "Ana & Yan Kadro",
    coklu: "Çoklu Platform",
    akin: `Bölüm ${activeEpisode.number} akını`,
  };

  const pills = [
    ...(filters.query.trim() ? [{ key: "q", label: `“${filters.query.trim()}”`, remove: () => setQuery("") }] : []),
    ...filters.classes.map((id) => ({ key: id, label: CLASSES[id].name, remove: () => toggleClass(id) })),
    ...filters.rarities.map((id) => ({ key: id, label: RARITY_INFO[id].label, remove: () => toggleRarity(id) })),
    ...filters.regions.map((id) => ({ key: id, label: REGIONS[id].name, remove: () => toggleRegion(id) })),
    ...filters.special.map((id) => ({ key: id, label: specialLabels[id], remove: () => toggleSpecial(id) })),
  ];

  return (
    <div
      className={cn(
        "flex max-w-full flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-gece-900/85 px-2 py-1.5 text-sm shadow-lg backdrop-blur",
        className,
      )}
    >
      <span className="px-1 text-buz-300" aria-live="polite">
        <span className="font-display text-buz-50">{formatNumber(resultCount)}</span> / {formatNumber(totalCount)}
      </span>
      {pills.map((pill) => (
        <button
          key={pill.key}
          type="button"
          onClick={pill.remove}
          className="inline-flex items-center gap-1 rounded-full border border-gunozu-400/40 bg-gunozu-400/10 py-0.5 pl-2.5 pr-1.5 text-gunozu-100 hover:bg-gunozu-400/20"
          aria-label={`${pill.label} filtresini kaldır`}
        >
          {pill.label}
          <X aria-hidden className="size-3.5" />
        </button>
      ))}
      <button type="button" onClick={resetFilters} className="px-1.5 text-buz-300 underline decoration-dotted hover:text-buz-50">
        Temizle
      </button>
    </div>
  );
}

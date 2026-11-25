/**
 * Karakter kartı.
 *   row  → listelerde tek satır (portre, ad, unvan, bölge, nadirlik)
 *   card → ızgaralarda dikey kart (büyük portre, platformlar, rozet sayısı)
 * Tıklanınca karakter seçilir ve detay çekmecesi açılır.
 */
import { Sparkles } from "lucide-react";
import { RARITY_INFO } from "../../content/rarities";
import { REGIONS } from "../../content/regions";
import { cn } from "../../lib/cn";
import { formatNumber } from "../../lib/text";
import type { Character } from "../../types";
import { CharacterPortrait } from "./CharacterPortrait";
import { ClassIcon } from "./ClassIcon";
import { PlatformIcon } from "./PlatformIcon";
import { RARITY_TEXT } from "./styles";

interface CharacterCardProps {
  character: Character;
  onSelect?: (id: string) => void;
  selected?: boolean;
  /** Aktif bölüm akınında mı? */
  inRaid?: boolean;
  variant?: "row" | "card";
}

export function CharacterCard({ character: c, onSelect, selected = false, inRaid = false, variant = "row" }: CharacterCardProps) {
  const rarity = RARITY_INFO[c.rarity];
  const label = `${c.displayName}, ${c.title}, ${rarity.label}`;

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={() => onSelect?.(c.id)}
        aria-label={label}
        aria-current={selected || undefined}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-white/5",
          selected && "bg-gunozu-400/10 ring-1 ring-gunozu-400/50",
        )}
      >
        <CharacterPortrait character={c} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-semibold text-buz-50">{c.displayName}</span>
            {inRaid && <Sparkles aria-label="Akında" className="size-3.5 shrink-0 text-gunozu-300" />}
          </span>
          <span className="flex items-center gap-1 truncate text-xs text-buz-300">
            <ClassIcon classId={c.class.id} className="size-3.5" />
            {c.title}
          </span>
        </span>
        <span className="shrink-0 text-right text-xs">
          <span className={cn("block font-semibold", RARITY_TEXT[c.rarity])}>{rarity.label}</span>
          <span className="block text-buz-300">{REGIONS[c.region].name}</span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect?.(c.id)}
      aria-label={label}
      aria-current={selected || undefined}
      className={cn(
        "flex h-full w-full flex-col items-center gap-2 rounded-2xl border border-white/10 bg-gece-900/70 p-4 text-center transition hover:-translate-y-0.5 hover:border-white/25",
        selected && "border-gunozu-400/60",
      )}
    >
      <CharacterPortrait character={c} size="lg" />
      <span className="mt-1 font-display text-lg leading-tight text-buz-50">{c.displayName}</span>
      <span className="-mt-1 text-xs text-buz-300">@{c.handle}</span>
      <span className="flex items-center gap-1 text-sm text-buz-200">
        <ClassIcon classId={c.class.id} />
        {c.title}
      </span>
      <span className="mt-auto flex w-full items-center justify-between pt-2 text-xs">
        <span className={cn("font-semibold", RARITY_TEXT[c.rarity])}>{rarity.label}</span>
        <span className="flex items-center gap-1 text-buz-300" aria-label={`${c.linkedPlatforms.length} platform`}>
          {c.linkedPlatforms.map((p) => (
            <PlatformIcon key={p} platform={p} className="size-3.5" />
          ))}
        </span>
        <span className="tabular-nums text-buz-300">{formatNumber(c.points)} puan</span>
      </span>
    </button>
  );
}

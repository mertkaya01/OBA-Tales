/**
 * "Kahramanını bul" — yazdıkça haritadaki pinleri filtreler ve ilk eşleşmeleri öneri olarak gösterir.
 * Bir öneri seçilince (tıklama ya da ↑ ↓ Enter) harita o karaktere uçar ve çekmecesi açılır.
 */
import { Search, X } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";
import { cn } from "../../lib/cn";
import { useAppStore } from "../../state/useAppStore";
import type { Character } from "../../types";
import { CharacterPortrait } from "../character/CharacterPortrait";
import { RARITY_TEXT } from "../character/styles";
import { RARITY_INFO } from "../../content/rarities";

const MAX_SUGGESTIONS = 6;

interface HeroSearchProps {
  /** Filtreden geçen karakterler (öneriler bunlardan seçilir). */
  matches: readonly Character[];
  className?: string;
}

export function HeroSearch({ matches, className }: HeroSearchProps) {
  const query = useAppStore((s) => s.filters.query);
  const { setQuery, focusCharacter } = useAppStore.getState();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputId = useId();
  const listId = useId();

  const suggestions = query.trim() ? matches.slice(0, MAX_SUGGESTIONS) : [];
  const expanded = open && suggestions.length > 0;
  const activeIndex = Math.min(active, suggestions.length - 1);

  const choose = (c: Character) => {
    focusCharacter(c.id);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && suggestions.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && suggestions.length > 0) {
      event.preventDefault();
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" && expanded) {
      event.preventDefault();
      choose(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <label htmlFor={inputId} className="sr-only">
        Kahramanını bul
      </label>
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-buz-300" />
      <input
        id={inputId}
        data-hero-search
        type="text"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded ? `${listId}-${activeIndex}` : undefined}
        value={query}
        placeholder="Kahramanını bul: ad ya da unvan"
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="w-full rounded-xl border border-white/15 bg-gece-900/90 py-2.5 pl-9 pr-9 text-buz-50 shadow-lg backdrop-blur placeholder:text-buz-300/70 focus:border-gunozu-400/70"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-buz-300 hover:bg-white/10 hover:text-buz-50"
          aria-label="Aramayı temizle"
        >
          <X aria-hidden className="size-4" />
        </button>
      )}

      {expanded && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Öneriler"
          className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-white/15 bg-gece-900/95 py-1 shadow-2xl backdrop-blur"
        >
          {suggestions.map((c, i) => (
            <li
              key={c.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              // onMouseDown: input'un blur'u listeyi kapatmadan önce seçimi yakala.
              onMouseDown={(event) => {
                event.preventDefault();
                choose(c);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-center gap-2.5 px-2.5 py-1.5", i === activeIndex && "bg-white/10")}
            >
              <CharacterPortrait character={c} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-buz-50">{c.displayName}</span>
                <span className="block truncate text-xs text-buz-300">
                  @{c.handle} · {c.title}
                </span>
              </span>
              <span className={cn("text-xs font-semibold", RARITY_TEXT[c.rarity])}>{RARITY_INFO[c.rarity].label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

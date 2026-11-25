/**
 * Takipçi ızgarası — obaya katılan bütün yoldaşlar: arama, sınıf / nadirlik / özel durum süzgeçleri,
 * sıralama ve "daha fazla göster". Kart tıklanınca karakter çekmecesi açılır.
 *
 * Süzgeçler haritadakiyle aynı motoru kullanır (lib/filters): gruplar arası VE, grup içi VEYA.
 */
import { useDeferredValue, useMemo, useState } from "react";
import { CLASS_LIST } from "../../content/classes";
import { applyFilters, type FilterContext } from "../../lib/filters";
import { SORT_KEYS, SORT_LABELS, sortCharacters, type SortKey } from "../../lib/roster";
import { formatNumber } from "../../lib/text";
import { useAppStore } from "../../state/useAppStore";
import type { Character, ClassId, FilterState, Rarity, SpecialFilterId } from "../../types";
import { CharacterCard } from "../character/CharacterCard";
import { ClassIcon } from "../character/ClassIcon";
import { Chip } from "../ui/Chip";
import { EmptyState } from "../ui/EmptyState";
import { SearchInput } from "../ui/SearchInput";

const PAGE = 36;

const SPECIALS: readonly { id: Extract<SpecialFilterId, "akin" | "coklu">; label: string }[] = [
  { id: "akin", label: "Aktif akında" },
  { id: "coklu", label: "Çoklu platform" },
];

interface FollowerGridProps {
  followers: readonly Character[];
  activeParticipantIds: ReadonlySet<string>;
  /** Nadirlik süzgeci dışarıda (nadirlik dizini) da değiştirilebilir. */
  rarities: Rarity[];
  onRaritiesChange: (rarities: Rarity[]) => void;
}

const toggle = <T,>(list: readonly T[], value: T): T[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

export function FollowerGrid({ followers, activeParticipantIds, rarities, onRaritiesChange }: FollowerGridProps) {
  const select = useAppStore((s) => s.select);
  const selectedId = useAppStore((s) => s.selectedId);
  const [query, setQuery] = useState("");
  const [classes, setClasses] = useState<ClassId[]>([]);
  const [special, setSpecial] = useState<SpecialFilterId[]>([]);
  const [sort, setSort] = useState<SortKey>("puan");
  const [visible, setVisible] = useState(PAGE);

  const filters = useMemo<FilterState>(() => ({ query, classes, rarities, regions: [], special }), [query, classes, rarities, special]);
  const deferred = useDeferredValue(filters);
  const ctx = useMemo<FilterContext>(() => ({ activeParticipantIds }), [activeParticipantIds]);
  const results = useMemo(() => sortCharacters(applyFilters(followers, deferred, ctx), sort), [followers, deferred, ctx, sort]);
  const shown = results.slice(0, visible);
  const hasFilters = query !== "" || classes.length > 0 || rarities.length > 0 || special.length > 0;

  const reset = () => {
    setQuery("");
    setClasses([]);
    setSpecial([]);
    onRaritiesChange([]);
    setVisible(PAGE);
  };

  return (
    <div>
      <div className="grid gap-3 rounded-2xl border border-white/10 bg-gece-900/70 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <SearchInput
            value={query}
            onChange={(value) => {
              setQuery(value);
              setVisible(PAGE);
            }}
            label="Yoldaş ara"
            showLabel
            placeholder="Ad, kullanıcı adı ya da unvan (ör. kar_tanesi)"
          />
          <label className="grid gap-1 text-sm text-buz-200">
            Sıralama
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="rounded-xl border border-white/15 bg-gece-950/80 px-3 py-2 text-buz-50 focus:border-gunozu-400/70"
            >
              {SORT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Sınıf ve durum süzgeçleri">
          {CLASS_LIST.map((cls) => (
            <Chip key={cls.id} pressed={classes.includes(cls.id)} onToggle={() => setClasses((list) => toggle(list, cls.id))} icon={<ClassIcon classId={cls.id} />}>
              {cls.name}
            </Chip>
          ))}
          {SPECIALS.map((s) => (
            <Chip key={s.id} pressed={special.includes(s.id)} onToggle={() => setSpecial((list) => toggle(list, s.id))}>
              {s.label}
            </Chip>
          ))}
          {hasFilters && (
            <button type="button" onClick={reset} className="text-sm text-buz-300 underline-offset-4 hover:text-buz-50 hover:underline">
              Süzgeçleri temizle
            </button>
          )}
        </div>
      </div>

      <p className="mt-4 text-sm text-buz-300" aria-live="polite">
        {formatNumber(results.length)} yoldaş{hasFilters ? ` (toplam ${formatNumber(followers.length)})` : ""}
      </p>

      {results.length === 0 ? (
        <EmptyState className="mt-4" title="Bu iz kar altında kalmış" message="Süzgeçlere uyan yoldaş yok. Aramayı değiştir ya da süzgeçleri temizle." />
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {shown.map((c) => (
            <li key={c.id}>
              <CharacterCard character={c} variant="card" onSelect={select} selected={selectedId === c.id} inRaid={activeParticipantIds.has(c.id)} />
            </li>
          ))}
        </ul>
      )}

      {visible < results.length && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((n) => n + PAGE)}
            className="rounded-xl border border-white/15 px-4 py-2 font-display text-buz-100 hover:bg-white/10"
          >
            Daha fazla göster ({formatNumber(Math.min(PAGE, results.length - visible))} yoldaş daha)
          </button>
        </div>
      )}
    </div>
  );
}

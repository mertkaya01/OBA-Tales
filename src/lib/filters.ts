/**
 * FİLTRE MOTORU — haritadaki ve kadro listesindeki tüm filtreler.
 *
 *   Gruplar arası AND · grup içi OR · özel durumlar kendi aralarında AND
 *
 * Ayrıca filtre durumunu URL'ye yazan ve URL'den okuyan saf fonksiyonlar burada
 * (React tarafı src/state/useUrlSync.ts içinde bunları kullanır).
 */
import { CLASS_IDS, RARITIES, REGION_IDS, SPECIAL_FILTER_IDS, URL_PARAMS, VIEW_MODES } from "../types";
import type { BadgeId, Character, ClassId, FilterState, Rarity, RegionId, SpecialFilterId, ViewMode } from "../types";
import { normalizeSearch, searchTokens } from "./text";

export interface FilterContext {
  /** Aktif bölüm akınına katılan karakter kimlikleri ("akin" filtresi). */
  activeParticipantIds: ReadonlySet<string>;
}

export const EMPTY_FILTER_CONTEXT: FilterContext = { activeParticipantIds: new Set() };

const MULTI_PLATFORM_BADGES: ReadonlySet<BadgeId> = new Set<BadgeId>(["cift_iz", "oba_onculugu"]);

const SPECIAL_TESTS: Record<SpecialFilterId, (c: Character, ctx: FilterContext) => boolean> = {
  kadro: (c) => c.roleType !== "follower",
  coklu: (c) => c.badges.some((badge) => MULTI_PLATFORM_BADGES.has(badge)),
  akin: (c, ctx) => ctx.activeParticipantIds.has(c.id),
};

// ── Arama metni (karakter başına bir kez hesaplanır) ───────────────

const searchCache = new WeakMap<Character, string>();

/** Görünen ad, kullanıcı adı, unvan ve sınıf adı; Türkçe duyarsız. */
export function searchTextOf(c: Character): string {
  let text = searchCache.get(c);
  if (text === undefined) {
    text = normalizeSearch(`${c.displayName} ${c.handle} ${c.title} ${c.class.name}`);
    searchCache.set(c, text);
  }
  return text;
}

// ── Eşleştirme ─────────────────────────────────────────────────────

/** Filtreleri bir kez hazırlayıp her karakter için hızlıca çalışan bir test döndürür. */
export function createMatcher(
  filters: FilterState,
  ctx: FilterContext = EMPTY_FILTER_CONTEXT,
): (c: Character) => boolean {
  const tokens = searchTokens(filters.query);
  const classes = new Set(filters.classes);
  const rarities = new Set(filters.rarities);
  const regions = new Set(filters.regions);
  const specialTests = filters.special.map((id) => SPECIAL_TESTS[id]);

  return (c) => {
    if (classes.size > 0 && !classes.has(c.class.id)) return false;
    if (rarities.size > 0 && !rarities.has(c.rarity)) return false;
    if (regions.size > 0 && !regions.has(c.region)) return false;
    for (const test of specialTests) {
      if (!test(c, ctx)) return false;
    }
    if (tokens.length > 0) {
      const text = searchTextOf(c);
      for (const token of tokens) {
        if (!text.includes(token)) return false;
      }
    }
    return true;
  };
}

export function applyFilters(
  characters: readonly Character[],
  filters: FilterState,
  ctx: FilterContext = EMPTY_FILTER_CONTEXT,
): Character[] {
  if (isFilterEmpty(filters)) return [...characters];
  return characters.filter(createMatcher(filters, ctx));
}

// ── Seçenek sayıları ───────────────────────────────────────────────

export interface FilterFacets {
  classes: Record<ClassId, number>;
  rarities: Record<Rarity, number>;
  regions: Record<RegionId, number>;
  special: Record<SpecialFilterId, number>;
}

function tally<K extends string>(keys: readonly K[], items: readonly Character[], keyOf: (c: Character) => K): Record<K, number> {
  const counts = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  for (const c of items) counts[keyOf(c)] += 1;
  return counts;
}

/**
 * Her filtre seçeneğinin yanında gösterilecek sayı: o seçenek işaretlenirse kaç karakter kalır?
 * Bir grubun sayıları hesaplanırken o grubun kendi seçimi yok sayılır (grup içi OR olduğu için).
 * Özel durumlar AND olduğundan, onların sayısı mevcut seçime eklenerek hesaplanır.
 */
export function facetCounts(
  characters: readonly Character[],
  filters: FilterState,
  ctx: FilterContext = EMPTY_FILTER_CONTEXT,
): FilterFacets {
  const without = (patch: Partial<FilterState>) => applyFilters(characters, { ...filters, ...patch }, ctx);
  const special = Object.fromEntries(
    SPECIAL_FILTER_IDS.map((id) => [
      id,
      without({ special: filters.special.includes(id) ? filters.special : [...filters.special, id] }).length,
    ]),
  ) as Record<SpecialFilterId, number>;

  return {
    classes: tally(CLASS_IDS, without({ classes: [] }), (c) => c.class.id),
    rarities: tally(RARITIES, without({ rarities: [] }), (c) => c.rarity),
    regions: tally(REGION_IDS, without({ regions: [] }), (c) => c.region),
    special,
  };
}

/** Seçili filtre sayısı (arama kutusu doluysa 1 sayılır). */
export function countActiveFilters(filters: FilterState): number {
  return (
    (filters.query.trim() ? 1 : 0) +
    filters.classes.length +
    filters.rarities.length +
    filters.regions.length +
    filters.special.length
  );
}

export function isFilterEmpty(filters: FilterState): boolean {
  return countActiveFilters(filters) === 0;
}

const sameMembers = <T>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((v) => b.includes(v));

/**
 * İki filtre aynı sonucu mu verir? Arama metni baş/son boşluklar yok sayılarak karşılaştırılır,
 * böylece kullanıcı yazarken URL senkronu imleci bozmaz.
 */
export function filtersEqual(a: FilterState, b: FilterState): boolean {
  return (
    a.query.trim() === b.query.trim() &&
    sameMembers(a.classes, b.classes) &&
    sameMembers(a.rarities, b.rarities) &&
    sameMembers(a.regions, b.regions) &&
    sameMembers(a.special, b.special)
  );
}

/** Çip tıklaması: değer listedeyse çıkarır, değilse ekler. */
export function toggleInList<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

// ── URL ↔ filtre ───────────────────────────────────────────────────

/** "okyeli,buyucu,okyeli" → ["okyeli"]: bilinmeyenleri ve tekrarları atar, sabit sıraya dizer. */
function parseList<T extends string>(raw: string | null, allowed: readonly T[]): T[] {
  if (!raw) return [];
  const requested = new Set(raw.split(",").map((part) => part.trim()));
  return allowed.filter((value) => requested.has(value));
}

function writeList<T extends string>(params: URLSearchParams, key: string, values: readonly T[], order: readonly T[]) {
  const sorted = order.filter((value) => values.includes(value));
  if (sorted.length > 0) params.set(key, sorted.join(","));
  else params.delete(key);
}

export function filtersFromSearchParams(params: URLSearchParams): FilterState {
  return {
    query: (params.get(URL_PARAMS.query) ?? "").trim(),
    classes: parseList(params.get(URL_PARAMS.classes), CLASS_IDS),
    rarities: parseList(params.get(URL_PARAMS.rarities), RARITIES),
    regions: parseList(params.get(URL_PARAMS.regions), REGION_IDS),
    special: parseList(params.get(URL_PARAMS.special), SPECIAL_FILTER_IDS),
  };
}

/**
 * Filtreleri URL parametrelerine yazar. Diğer parametrelere (?k=, ?gorunum=) dokunmaz.
 * Verilen nesneyi değiştirmez; yeni bir URLSearchParams döner.
 */
export function writeFiltersToSearchParams(filters: FilterState, base?: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(base);
  const query = filters.query.trim();
  if (query) params.set(URL_PARAMS.query, query);
  else params.delete(URL_PARAMS.query);
  writeList(params, URL_PARAMS.classes, filters.classes, CLASS_IDS);
  writeList(params, URL_PARAMS.rarities, filters.rarities, RARITIES);
  writeList(params, URL_PARAMS.regions, filters.regions, REGION_IDS);
  writeList(params, URL_PARAMS.special, filters.special, SPECIAL_FILTER_IDS);
  return params;
}

/** ?gorunum= değerini okur; tanınmayan değerde varsayılana döner. */
export function readViewMode(params: URLSearchParams, fallback: ViewMode = "dunya"): ViewMode {
  const raw = params.get(URL_PARAMS.view);
  return VIEW_MODES.find((mode) => mode === raw) ?? fallback;
}

/** ?k= değerini okur; geçerli bir karakter kimliği değilse null. */
export function readSelectedId(params: URLSearchParams): string | null {
  const raw = params.get(URL_PARAMS.selected);
  return raw && /^[a-z0-9][a-z0-9_-]*$/.test(raw) ? raw : null;
}

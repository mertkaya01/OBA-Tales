/**
 * VERİ YÜKLEYİCİ — public/data/*.json dosyalarını çeker, şemayla doğrular ve
 * kanon içerikle (kadro, bölümler) birleştirip uygulamanın kullanacağı tek bir nesneye çevirir.
 *
 * İleride veriler bir API'den (Cloudflare Pages Functions) gelirse yalnızca bu dosya değişir.
 */
import { CAST } from "../content/cast";
import { EPISODES } from "../content/episodes";
import { DATA_SCHEMAS, formatDataError, type DataFileName } from "../schemas/data";
import type {
  Character,
  Episode,
  EpisodeProgress,
  EpisodeStatus,
  RegionId,
  RosterFile,
  SeasonState,
  WorldState,
} from "../types";

export interface DataFileTypes {
  roster: RosterFile;
  season: SeasonState;
  world: WorldState;
}

const dataUrl = (file: string) => `${import.meta.env.BASE_URL}data/${file}`;

export const DATA_URLS: Readonly<Record<DataFileName, string>> = {
  roster: dataUrl("roster.json"),
  season: dataUrl("season.json"),
  world: dataUrl("world.json"),
};

/** npm run data:gen:stress ile üretilen 5000 takipçilik performans verisi. */
export const STRESS_ROSTER_URL = dataUrl("roster.stress.json");

/** Geliştirme sırasında adres çubuğunda ?stres varsa performans verisini kullan. */
export function resolveRosterUrl(search: string, isDev: boolean): string | undefined {
  return isDev && new URLSearchParams(search).has("stres") ? STRESS_ROSTER_URL : undefined;
}

export class DataLoadError extends Error {
  readonly file: DataFileName;

  constructor(file: DataFileName, message: string, options?: ErrorOptions) {
    super(`${file}.json yüklenemedi: ${message}`, options);
    this.name = "DataLoadError";
    this.file = file;
  }
}

/** Tek bir veri dosyasını çeker ve doğrular. */
export async function loadDataFile<N extends DataFileName>(name: N, url: string = DATA_URLS[name]): Promise<DataFileTypes[N]> {
  let response: Response;
  try {
    // no-cache: tarayıcı önbelleği tutar ama her açılışta sunucuya "değişti mi?" diye sorar.
    response = await fetch(url, { cache: "no-cache", headers: { Accept: "application/json" } });
  } catch (cause) {
    throw new DataLoadError(name, "bağlantı kurulamadı", { cause });
  }
  if (!response.ok) throw new DataLoadError(name, `sunucu ${response.status} döndürdü`);

  let json: unknown;
  try {
    json = await response.json();
  } catch (cause) {
    throw new DataLoadError(name, "dosya geçerli JSON değil", { cause });
  }

  const result = DATA_SCHEMAS[name].safeParse(json);
  if (!result.success) throw new DataLoadError(name, `\n${formatDataError(result.error)}`);
  return result.data as DataFileTypes[N];
}

// ── Birleştirilmiş oyun verisi ─────────────────────────────────────

/** Kanon bölüm + o bölümün canlı durumu. */
export interface EpisodeView extends Episode {
  status: EpisodeStatus;
  progress: EpisodeProgress | null;
}

export interface GameData {
  roster: RosterFile;
  season: SeasonState;
  world: WorldState;
  /** Önce kadro, sonra takipçiler. */
  characters: readonly Character[];
  characterById: ReadonlyMap<string, Character>;
  /** 12 bölüm; season.json'da olmayanlar "kilitli". */
  episodes: readonly EpisodeView[];
  activeEpisode: EpisodeView;
  /** Aktif bölüm akınına katılanlar (yalnızca bilinen karakterler). */
  activeParticipantIds: ReadonlySet<string>;
  revealedRegions: ReadonlySet<RegionId>;
  /** Kimliği bir kadro üyesiyle çakıştığı için atlanan roster kayıtları. */
  skippedIds: readonly string[];
}

export function buildGameData(roster: RosterFile, season: SeasonState, world: WorldState): GameData {
  const characterById = new Map<string, Character>();
  for (const member of CAST) characterById.set(member.id, member);

  const skippedIds: string[] = [];
  for (const c of roster.characters) {
    if (characterById.has(c.id)) skippedIds.push(c.id);
    else characterById.set(c.id, c);
  }

  const progressByNumber = new Map(season.episodes.map((p) => [p.episodeNumber, p]));
  const episodes: EpisodeView[] = EPISODES.map((episode) => {
    const progress = progressByNumber.get(episode.number) ?? null;
    return { ...episode, status: progress?.status ?? "kilitli", progress };
  });
  const activeEpisode = episodes[season.activeEpisode - 1];

  return {
    roster,
    season,
    world,
    characters: [...characterById.values()],
    characterById,
    episodes,
    activeEpisode,
    activeParticipantIds: new Set((activeEpisode.progress?.participantIds ?? []).filter((id) => characterById.has(id))),
    revealedRegions: new Set(world.revealedRegions),
    skippedIds,
  };
}

// ── Önbellekli yükleme ─────────────────────────────────────────────

const cache = new Map<string, Promise<GameData>>();

export interface LoadGameDataOptions {
  /** Varsayılan roster yerine başka bir dosya (ör. stres verisi). */
  rosterUrl?: string;
}

/**
 * Üç dosyayı paralel yükler ve birleştirir. Aynı istek tekrar gelirse aynı sonucu paylaşır;
 * hata olursa önbellekten silinir, böylece "Tekrar dene" yeniden yükler.
 */
export function loadGameData({ rosterUrl }: LoadGameDataOptions = {}): Promise<GameData> {
  const key = rosterUrl ?? DATA_URLS.roster;
  const hit = cache.get(key);
  if (hit) return hit;

  const promise = Promise.all([loadDataFile("roster", rosterUrl), loadDataFile("season"), loadDataFile("world")]).then(
    ([roster, season, world]) => buildGameData(roster, season, world),
  );
  cache.set(key, promise);
  promise.catch(() => cache.delete(key));
  return promise;
}

export function clearDataCache(): void {
  cache.clear();
}

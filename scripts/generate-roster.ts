/**
 * MOCK VERİ ÜRETİCİ — örnek takipçiler (roster.json) ve örnek sezon durumu (season.json).
 *
 * ⚠ Yalnızca geliştirme ve demo içindir: season.json dosyasının üzerine yazar.
 *   Gerçek takipçi listesi ileride scripts/import-followers.ts ile içe aktarılacak.
 *
 * Kullanım:
 *   npm run data:gen                          → 300 takipçi + season.json
 *   npm run data:gen -- --count 120 --seed 7  → farklı sayı ve tohum
 *   npm run data:gen:stress                   → 5000 takipçi, public/data/roster.stress.json
 *                                               (season.json'a dokunmaz; tarayıcıda ?stres ile açılır)
 *
 * Aynı tohum her zaman aynı dosyayı üretir.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { EPISODES } from "../src/content/episodes";
import { REGIONS } from "../src/content/regions";
import { LANDMARKS, VILLAGES } from "../src/content/sites";
import { PORTAL_RADIUS } from "../src/world3d/layout";
import { generateTerrain, isWet, sampleTerrain } from "../src/game/terrain";
import { pointInPolygon, randomPointInPolygon } from "../src/lib/geometry";
import { createRng, seedFrom, type Rng, type WeightedItem } from "../src/lib/random";
import { createStarterCharacter, defaultTitle, deriveBadges, raiseRarity, rarityRank } from "../src/lib/rules";
import { slugify } from "../src/lib/text";
import { formatDataError, rosterSchema, seasonStateSchema } from "../src/schemas/data";
import { PLATFORMS } from "../src/types";
import type {
  Character,
  ElementAura,
  EpisodeProgress,
  EpisodeStatus,
  Platform,
  Poll,
  PollResult,
  RegionId,
  RosterFile,
  SeasonState,
} from "../src/types";

// ── Komut satırı ───────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    count: { type: "string", default: "300" },
    seed: { type: "string", default: "2026" },
    out: { type: "string", default: "public/data/roster.json" },
    "season-out": { type: "string", default: "public/data/season.json" },
    "no-season": { type: "boolean", default: false },
  },
});

const COUNT = Number.parseInt(args.count, 10);
const SEED = Number.parseInt(args.seed, 10);
if (!Number.isInteger(COUNT) || COUNT < 1 || COUNT > 20000) throw new Error("--count 1 ile 20000 arasında olmalı");
if (!Number.isInteger(SEED)) throw new Error("--seed bir tam sayı olmalı");

// ── Örnek sezon zaman çizelgesi ────────────────────────────────────

const MOCK_NOW = new Date("2026-11-24T21:00:00+03:00");
const ACTIVE_EPISODE = 3;
/** Akınlara her zaman katılan kadro üyeleri. */
const CAST_RAIDERS = ["baturay", "alptug", "suheyla", "kursat"];

interface MockEpisode {
  number: number;
  status: EpisodeStatus;
  airedAt: string | null;
  /** Bir takipçinin bu akına katılma olasılığı. */
  joinChance: number;
  /** Tamamlanmış oylamaların kazananları (hikâyeyle uyumlu olsun diye sabit). */
  winners: Record<string, string>;
  recap: string | null;
}

const MOCK_EPISODES: MockEpisode[] = [
  {
    number: 1,
    status: "tamamlandi",
    airedAt: "2026-11-10T19:00:00+03:00",
    joinChance: 0.45,
    winners: { "b01-rota": "kuzey-kayaliklari" },
    recap:
      "Oba Kuzey Kayalıkları'nı seçti! Akın teknesi rüzgârı arkasına alıp buz duvarlarına doğru yol aldı; " +
      "Süheyla'nın kartal gözü, kayalıkların ardında yankılanan dev bir ayak sesini fark etti.",
  },
  {
    number: 2,
    status: "tamamlandi",
    airedAt: "2026-11-17T19:00:00+03:00",
    joinChance: 0.4,
    winners: { "b02-onarim": "suheyla", "b02-sembol": "gunes-cemberi" },
    recap:
      "Feneri Süheyla onardı: halat okuyla kulenin tepesine çıktı, kandili yeniden yaktı. Kulenin üstünde artık " +
      "altın bir Güneş Çemberi dalgalanıyor; ışığı Ayazboğazı'na kadar uzanıyor.",
  },
  {
    number: 3,
    status: "aktif",
    airedAt: "2026-11-24T19:00:00+03:00",
    joinChance: 0.3,
    winners: {},
    recap: null,
  },
  { number: 4, status: "yakinda", airedAt: null, joinChance: 0, winners: {}, recap: null },
];

// ── Dağılımlar ─────────────────────────────────────────────────────

const PLATFORM_WEIGHTS: WeightedItem<Platform>[] = [
  { value: "instagram", weight: 40 },
  { value: "tiktok", weight: 35 },
  { value: "youtube", weight: 25 },
];

const PLATFORM_COUNT_WEIGHTS: WeightedItem<number>[] = [
  { value: 1, weight: 65 },
  { value: 2, weight: 25 },
  { value: 3, weight: 10 },
];

/** Obalar bütün adalara yayılmıştır; liman en kalabalık, tepe en sakin yer. */
const REGION_WEIGHTS: WeightedItem<RegionId>[] = [
  { value: "akinburnu", weight: 26 },
  { value: "suzulkoy", weight: 18 },
  { value: "ayazbogazi", weight: 16 },
  { value: "kiragiduzu", weight: 20 },
  { value: "pusluada", weight: 12 },
  { value: "gunozu_tepesi", weight: 8 },
];

/** Katkılarla kazanılmış ek nadirlik kademesi. */
const EXTRA_RARITY_WEIGHTS: WeightedItem<number>[] = [
  { value: 0, weight: 62 },
  { value: 1, weight: 26 },
  { value: 2, weight: 9 },
  { value: 3, weight: 3 },
];

const AURA_WEIGHTS: WeightedItem<ElementAura>[] = [
  { value: "alev", weight: 40 },
  { value: "isik", weight: 40 },
  { value: null, weight: 20 },
];

// ── İsimler (özgün, çocuk dostu) ───────────────────────────────────

const NAME_FIRST = [
  "Ayaz", "Buz", "Kar", "Kırağı", "Poyraz", "Yel", "Kopuz", "Ocak", "Fener", "Tuğ",
  "Boz", "Kızıl", "Gök", "Ak", "Demir", "Alaz", "Tan", "Yıldız", "Ay", "Gün",
  "Deniz", "Dalga", "Pus", "Çakıl", "Bulut", "Şimşek", "Kıvılcım", "Çınar", "Sedir", "Ilgın",
  "Sarp", "Uçar", "Çevik", "Neşeli", "Cesur", "Bilge", "Sessiz", "Minik", "Usta", "Gümüş",
];

const NAME_SECOND = [
  "Kalkan", "Okçu", "Yolcu", "Bekçi", "Ozan", "Yürek", "Göz", "Kanat", "Tay", "Kuzu",
  "Ateş", "Işık", "Tepe", "Rüzgâr", "Pençe", "Yay", "Fener", "Davul", "Kâşif", "Gezgin",
  "Avcı", "Çoban", "Er", "Can", "Atlı", "Martı", "Kartal", "Sincap", "Tilki", "Baykuş",
  "Ceylan", "Kunduz", "Turna", "Doğan", "Kayıkçı", "Balıkçı", "Kızak", "Yaprak", "Kar Tanesi", "Kelebek",
];

const HANDLE_SEPARATORS = ["_", ".", ""];

function makeName(rng: Rng, usedIds: Set<string>): { handle: string; displayName: string; id: string } {
  for (let attempt = 0; attempt < 40; attempt++) {
    const first = rng.pick(NAME_FIRST);
    const second = rng.pick(NAME_SECOND);
    if (first === second) continue;
    const separator = rng.pick(HANDLE_SEPARATORS);
    const number = attempt > 10 || rng.chance(0.45) ? String(rng.int(1, 99)) : "";
    const handle = `${slugify(first, "_")}${separator}${slugify(second, "_")}${number}`.slice(0, 30);
    const id = slugify(handle, "_");
    if (!usedIds.has(id)) {
      usedIds.add(id);
      return { handle, displayName: `${first} ${second}`, id };
    }
  }
  throw new Error("Benzersiz kullanıcı adı üretilemedi; --count değerini düşürün");
}

// ── Oylama sayımı ──────────────────────────────────────────────────

const votedEpisodes = MOCK_EPISODES.filter((ep) => ep.status === "tamamlandi" || ep.status === "aktif");
const polls: { episode: MockEpisode; poll: Poll }[] = votedEpisodes.flatMap((episode) =>
  EPISODES[episode.number - 1].polls.map((poll) => ({ episode, poll })),
);
const tallies = new Map<string, Record<string, number>>(
  polls.map(({ poll }) => [poll.id, Object.fromEntries(poll.options.map((o) => [o.id, 0]))]),
);

/** Takipçinin bu oylamada seçeceği seçenek: tamamlanmış oylamalarda kazanana eğilimli. */
function castVote(rng: Rng, episode: MockEpisode, poll: Poll): string {
  const winner = episode.winners[poll.id];
  return rng.weighted(poll.options.map((o) => ({ value: o.id, weight: o.id === winner ? 3 : 1 })));
}

// ── Takipçi üretimi ────────────────────────────────────────────────

interface GeneratedFollower {
  character: Character;
  joined: number[];
}

function pickLinkedPlatforms(rng: Rng, primary: Platform): Platform[] {
  const count = rng.weighted(PLATFORM_COUNT_WEIGHTS);
  const others = PLATFORMS.filter((p) => p !== primary);
  const linked: Platform[] = [primary];
  while (linked.length < count) {
    const next = rng.pick(others.filter((p) => !linked.includes(p)));
    linked.push(next);
  }
  return linked;
}

/** Örnek veride henüz obasına dağılmamış yeni yoldaşların payı. */
const NEWCOMER_SHARE = 0.08;

// Takipçiler kendi bölgelerinin obalarında yaşar: ocağın çevresinde, çadırların arasında ve dışında.
const WORLD_SEED: number = JSON.parse(readFileSync(resolve("public/data/world.json"), "utf8")).seed;
const terrain = generateTerrain({ seed: WORLD_SEED });

function homePoint(rng: Rng, region: RegionId): { x: number; y: number } {
  // Kutada: yeni gelenlerin çoğu Kut Kapısı'nın meydanında, kalanı Konuk obasında.
  if (region === "kutada" && rng.chance(0.6)) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const angle = rng.float(0, Math.PI * 2);
      const r = rng.float(PORTAL_RADIUS + 4, 108);
      const p = { x: LANDMARKS.kutKapisi.x + Math.cos(angle) * r, y: LANDMARKS.kutKapisi.y + Math.sin(angle) * r };
      if (sampleTerrain(terrain, p).height >= 0.04 && !isWet(terrain, p)) return p;
    }
  }
  const villages = VILLAGES.filter((v) => v.region === region);
  for (let attempt = 0; attempt < 60 && villages.length > 0; attempt++) {
    const village = rng.weighted(villages.map((v) => ({ value: v, weight: v.count })));
    const angle = rng.float(0, Math.PI * 2);
    const r = rng.float(9, village.radius + 26);
    const p = { x: village.center.x + Math.cos(angle) * r, y: village.center.y + Math.sin(angle) * r };
    if (!pointInPolygon(p, REGIONS[region].polygon)) continue;
    const sample = sampleTerrain(terrain, p);
    if (sample.height < 0.04 || sample.region !== region || isWet(terrain, p)) continue;
    return p;
  }
  return randomPointInPolygon(REGIONS[region].polygon, rng, { margin: 62 });
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function makeFollower(rng: Rng, usedIds: Set<string>): GeneratedFollower {
  const platform = rng.weighted(PLATFORM_WEIGHTS);
  const linkedPlatforms = pickLinkedPlatforms(rng, platform);
  // Yeni gelenler (yaklaşık %8) henüz obalarına dağılmadı: Kutada'da, Kut Kapısı'nın çevresindeler.
  const newcomer = rng.chance(NEWCOMER_SHARE);
  const region: RegionId = newcomer ? "kutada" : rng.weighted(REGION_WEIGHTS);
  const point = homePoint(rng, region);
  const { handle, displayName } = makeName(rng, usedIds);

  const base = createStarterCharacter({
    handle,
    displayName,
    platform,
    linkedPlatforms,
    region,
    coordinates: { x: round1(point.x), y: round1(point.y) },
    now: MOCK_NOW,
  });

  // Akınlara katılım
  const joined = newcomer ? [] : MOCK_EPISODES.filter((ep) => ep.joinChance > 0 && rng.chance(ep.joinChance)).map((ep) => ep.number);

  // Oylar: akına katılan herkes oy verir, katılmayanların bir kısmı da yorum bırakır.
  let votesCast = 0;
  for (const { episode, poll } of polls) {
    if (joined.includes(episode.number) || rng.chance(0.25)) {
      const option = castVote(rng, episode, poll);
      tallies.get(poll.id)![option] += 1;
      votesCast += 1;
    }
  }

  const raidsJoined = joined.length;
  const completedJoined = joined.filter((n) => MOCK_EPISODES[n - 1].status === "tamamlandi");
  const extra = rng.weighted(EXTRA_RARITY_WEIGHTS) + (raidsJoined >= 2 && rng.chance(0.3) ? 1 : 0);
  const rarity = raiseRarity(base.rarity, extra);
  const elementAura = rarity === "efsanevi" ? rng.weighted(AURA_WEIGHTS) : null;

  const character: Character = {
    ...base,
    rarity,
    title: defaultTitle(rarity, base.class.id),
    elementAura,
    badges: deriveBadges({ roleType: "follower", linkedPlatforms, joinedEpisodes: completedJoined, votesCast }),
    points:
      raidsJoined * 50 + votesCast * 10 + (linkedPlatforms.length - 1) * 30 + rarityRank(rarity) * 40 + rng.int(0, 40),
    seasonContributions: { votesCast, raidsJoined },
  };
  return { character, joined };
}

// ── Üret ───────────────────────────────────────────────────────────

const rng = createRng(seedFrom("kokobasi-roster", SEED));
const usedIds = new Set<string>(["baturay", "dede_toygar", "alptug", "suheyla", "kursat", "yalvac", "isikay"]);
const followers = Array.from({ length: COUNT }, () => makeFollower(rng, usedIds));

const roster: RosterFile = {
  version: 1,
  season: 1,
  generatedAt: MOCK_NOW.toISOString(),
  characters: followers.map((f) => f.character),
};

function buildResults(episode: MockEpisode): PollResult[] {
  return EPISODES[episode.number - 1].polls.map((poll) => {
    const counts = { ...tallies.get(poll.id)! };
    const winner = episode.status === "tamamlandi" ? episode.winners[poll.id] : null;
    if (winner) {
      // Kazanan seçenek her zaman en çok oyu almış olsun.
      const max = Math.max(...Object.values(counts));
      if (counts[winner] < max || Object.values(counts).filter((v) => v === max).length > 1) {
        counts[winner] = max + rng.int(1, 5);
      }
    }
    return { pollId: poll.id, tallies: counts, winnerOptionId: winner };
  });
}

const season: SeasonState = {
  version: 1,
  season: 1,
  activeEpisode: ACTIVE_EPISODE,
  episodes: MOCK_EPISODES.map(
    (episode): EpisodeProgress => ({
      episodeNumber: episode.number,
      status: episode.status,
      participantIds:
        episode.joinChance > 0
          ? [...CAST_RAIDERS, ...followers.filter((f) => f.joined.includes(episode.number)).map((f) => f.character.id)]
          : [],
      results: episode.status === "tamamlandi" || episode.status === "aktif" ? buildResults(episode) : [],
      airedAt: episode.airedAt,
      recap: episode.recap,
    }),
  ),
  updatedAt: MOCK_NOW.toISOString(),
};

// ── Doğrula ve yaz ─────────────────────────────────────────────────

function writeJson(path: string, data: unknown, pretty: boolean) {
  const full = resolve(path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, `${JSON.stringify(data, null, pretty ? 2 : undefined)}\n`, "utf8");
  return full;
}

const rosterCheck = rosterSchema.safeParse(roster);
if (!rosterCheck.success) throw new Error(`Üretilen roster geçersiz:\n${formatDataError(rosterCheck.error)}`);
const rosterPath = writeJson(args.out, roster, COUNT <= 1000);
console.log(`✔ ${COUNT} takipçi → ${rosterPath}`);

if (!args["no-season"]) {
  const seasonCheck = seasonStateSchema.safeParse(season);
  if (!seasonCheck.success) throw new Error(`Üretilen sezon geçersiz:\n${formatDataError(seasonCheck.error)}`);
  const seasonPath = writeJson(args["season-out"], season, true);
  const active = season.episodes.find((ep) => ep.episodeNumber === ACTIVE_EPISODE)!;
  console.log(`✔ Sezon (aktif bölüm ${ACTIVE_EPISODE}, akında ${active.participantIds.length} kişi) → ${seasonPath}`);
}

const byRarity = Object.groupBy(roster.characters, (c) => c.rarity);
const byRegion = Object.groupBy(roster.characters, (c) => c.region);
console.log(
  `  Nadirlik: ${Object.entries(byRarity).map(([k, v]) => `${k} ${v?.length ?? 0}`).join(" · ")}\n` +
    `  Bölge:    ${Object.entries(byRegion).map(([k, v]) => `${k} ${v?.length ?? 0}`).join(" · ")}`,
);

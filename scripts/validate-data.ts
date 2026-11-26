/**
 * VERİ DENETİMİ — public/data/*.json dosyalarını şemaya ve kanon içeriğe göre kontrol eder.
 *
 * Kullanım:
 *   npm run data:check                                            (npm run build öncesinde otomatik çalışır)
 *   npm run data:check -- --roster public/data/roster.stress.json  (stres verisini denetler)
 *
 * Hatalar derlemeyi durdurur (çıkış kodu 1); uyarılar yalnızca bilgi verir.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { CAST } from "../src/content/cast";
import { EPISODES } from "../src/content/episodes";
import { REGIONS } from "../src/content/regions";
import { pointInPolygon } from "../src/lib/geometry";
import { multiPlatformBadge } from "../src/lib/rules";
import { DATA_SCHEMAS, formatDataError, type DataFileName } from "../src/schemas/data";
import type { RosterFile, SeasonState, WorldState } from "../src/types";

const { values: args } = parseArgs({
  options: {
    roster: { type: "string", default: "public/data/roster.json" },
    season: { type: "string", default: "public/data/season.json" },
    world: { type: "string", default: "public/data/world.json" },
  },
});

const errors: string[] = [];
const warnings: string[] = [];

/** Aynı türden çok sayıda sorun varsa ilk birkaçını gösterip gerisini sayar. */
function report(target: string[], title: string, items: string[], limit = 8) {
  if (items.length === 0) return;
  const shown = items.slice(0, limit).map((item) => `    - ${item}`);
  const more = items.length > limit ? [`    … ve ${items.length - limit} tane daha`] : [];
  target.push([`${title} (${items.length})`, ...shown, ...more].join("\n"));
}

function load<N extends DataFileName>(name: N, path: string) {
  const full = resolve(path);
  if (!existsSync(full)) {
    errors.push(`${name}.json bulunamadı: ${full}\n    → npm run data:gen ile örnek veri üretebilirsiniz.`);
    return undefined;
  }
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(full, "utf8"));
  } catch (error) {
    errors.push(`${name}.json geçerli JSON değil: ${(error as Error).message}`);
    return undefined;
  }
  const result = DATA_SCHEMAS[name].safeParse(json);
  if (!result.success) {
    const details = formatDataError(result.error).split("\n").map((line) => `    ${line}`).join("\n");
    errors.push(`${name}.json şemaya uymuyor:\n${details}`);
    return undefined;
  }
  return result.data;
}

const roster = load("roster", args.roster) as RosterFile | undefined;
const season = load("season", args.season) as SeasonState | undefined;
const world = load("world", args.world) as WorldState | undefined;

const castIds = new Set(CAST.map((c) => c.id));

// ── roster.json ↔ içerik ───────────────────────────────────────────

if (roster) {
  const outside: string[] = [];
  const castClash: string[] = [];
  const platformBadge: string[] = [];
  const castOnlyBadge: string[] = [];

  for (const c of roster.characters) {
    if (!pointInPolygon(c.coordinates, REGIONS[c.region].polygon)) {
      outside.push(`${c.id}: (${c.coordinates.x}, ${c.coordinates.y}) "${c.region}" bölgesinin dışında`);
    }
    if (castIds.has(c.id)) castClash.push(`${c.id}: bu kimlik kadroya ait`);
    const expected = multiPlatformBadge(c.linkedPlatforms.length);
    for (const badge of ["cift_iz", "oba_onculugu"] as const) {
      if (c.badges.includes(badge) !== (expected === badge)) {
        platformBadge.push(`${c.id}: ${c.linkedPlatforms.length} platform, ama "${badge}" rozeti ${c.badges.includes(badge) ? "var" : "yok"}`);
      }
    }
    if (c.badges.includes("kurucu_oba")) castOnlyBadge.push(`${c.id}: "kurucu_oba" yalnızca kadroya verilir`);
  }

  report(errors, "roster.json: koordinatı kendi bölgesinin dışında kalan takipçiler", outside);
  report(errors, "roster.json: kadroyla aynı kimliği kullanan kayıtlar", castClash);
  report(errors, "roster.json: platform sayısıyla uyuşmayan rozetler", platformBadge);
  report(errors, "roster.json: takipçiye verilmiş kadro rozeti", castOnlyBadge);
}

// ── season.json ↔ içerik ve roster ─────────────────────────────────

if (season) {
  const pollProblems: string[] = [];
  const statusProblems: string[] = [];

  for (const progress of season.episodes) {
    const episode = EPISODES[progress.episodeNumber - 1];
    for (const result of progress.results) {
      const poll = episode.polls.find((p) => p.id === result.pollId);
      if (!poll) {
        pollProblems.push(`B${episode.number}: "${result.pollId}" bu bölümün oylaması değil (${episode.polls.map((p) => p.id).join(", ")})`);
        continue;
      }
      const optionIds = new Set(poll.options.map((o) => o.id));
      for (const optionId of Object.keys(result.tallies)) {
        if (!optionIds.has(optionId)) pollProblems.push(`${poll.id}: "${optionId}" seçeneği yok (${[...optionIds].join(", ")})`);
      }
    }
    if (progress.status === "tamamlandi") {
      const missing = episode.polls.filter(
        (poll) => !progress.results.some((r) => r.pollId === poll.id && r.winnerOptionId !== null),
      );
      if (missing.length > 0) {
        statusProblems.push(`B${episode.number} tamamlandı ama kazananı yazılmamış oylama var: ${missing.map((p) => p.id).join(", ")}`);
      }
    }
    if (progress.status === "tamamlandi" && progress.episodeNumber > season.activeEpisode) {
      statusProblems.push(`B${progress.episodeNumber} tamamlandı görünüyor ama aktif bölüm ${season.activeEpisode}`);
    }
  }
  if (!season.episodes.some((p) => p.episodeNumber === season.activeEpisode)) {
    statusProblems.push(`Aktif bölüm ${season.activeEpisode} season.json listesinde yok; sitede "kilitli" görünecek`);
  }

  report(errors, "season.json: içerikle uyuşmayan oylama sonuçları", pollProblems);
  report(warnings, "season.json: bölüm durumları", statusProblems);

  if (roster) {
    const known = new Set([...castIds, ...roster.characters.map((c) => c.id)]);
    const unknown = season.episodes.flatMap((p) =>
      p.participantIds.filter((id) => !known.has(id)).map((id) => `B${p.episodeNumber}: ${id}`),
    );
    report(warnings, "season.json: roster'da bulunmayan katılımcılar (filtrede görünmezler)", unknown, 5);
  }
}

// Bölgeler artık hikâyeyle açılır (yönetim paneli → Hikâye); sezonla karşılaştırılmaz.

// ── world.json ↔ roster: "adını koyan" karakterler ─────────────────

if (world && roster) {
  const known = new Set([...castIds, ...roster.characters.map((c) => c.id)]);
  report(
    errors,
    "world.json: adını koyan karakter roster'da ya da kadroda yok",
    world.namedPlaces.filter((p) => !known.has(p.namedBy)).map((p) => `${p.place}: ${p.namedBy}`),
  );
}

// ── Özet ───────────────────────────────────────────────────────────

console.log("OBA-Tales veri denetimi");
if (roster) console.log(`  roster.json   ${roster.characters.length} takipçi`);
if (season) console.log(`  season.json   aktif bölüm ${season.activeEpisode}, ${season.episodes.length} bölüm kaydı`);
if (world) console.log(`  world.json    ${world.revealedRegions.length} bölge ve ${world.revealedIslands.length} ada açık, ${world.story.day}. gün, ${world.story.arrivals.length} kahraman geldi`);

if (warnings.length > 0) console.log(`\n⚠ Uyarılar\n${warnings.map((w) => `  ${w}`).join("\n")}`);
if (errors.length > 0) {
  console.error(`\n✖ Hatalar\n${errors.map((e) => `  ${e}`).join("\n")}`);
  console.error(`\n${errors.length} hata bulundu. Düzeltmeden yayına çıkılamaz.`);
  process.exitCode = 1;
} else {
  console.log("\n✔ Veri dosyaları geçerli.");
}

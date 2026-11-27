/**
 * TAKİPÇİ LİSTESİ İŞLEMLERİ — public/data/roster.json üzerinde ekleme, çıkarma, sıfırlama.
 * Kullanan: scripts/import-followers.ts (npm run takipci:ekle) ve yönetim paneli (npm run dev → /yonetim).
 *
 *   · Yeni kişi → Kutada'da, Kut Kapısı'nın çevresinde yeni bir karakter (sınıfı platformundan); özel kahramanların
 *     dibine konmaz.
 *   · Zaten haritada olan kişi başka bir platformdan da geldiyse → o platform eklenir; çift iz / oba öncülüğü rozeti ve
 *     nadirlik bonusu kendiliğinden verilir.
 *   · Sıfırlama örnek (sahte) takipçileri siler; sezon akın listelerinden ve yer adlarından onlara ait kayıtlar da temizlenir.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CAST, nearHero } from "../../src/content/cast";
import { REGIONS } from "../../src/content/regions";
import { LANDMARKS } from "../../src/content/sites";
import type { FollowerEntry } from "../../src/admin/followerFiles";
import { generateTerrain, isWet, sampleTerrain, type Terrain } from "../../src/game/terrain";
import { pointInPolygon } from "../../src/lib/geometry";
import { hashString } from "../../src/lib/random";
import { createStarterCharacter, defaultTitle, multiPlatformBadge, multiPlatformBonus, raiseRarity } from "../../src/lib/rules";
import { isValidHandle } from "../../src/lib/roster";
import { formatDataError, rosterSchema } from "../../src/schemas/data";
import { PLATFORMS } from "../../src/types";
import type { Character, Platform, RosterFile } from "../../src/types";
import { PORTAL_RADIUS } from "../../src/world3d/layout";

export const FILES = {
  roster: resolve("public/data/roster.json"),
  season: resolve("public/data/season.json"),
  world: resolve("public/data/world.json"),
};

/** Listeden düşse de sezon ve yer adı kayıtları silinmeyecek kimlikler: kadro (src/content/cast.ts). */
const CAST_IDS: ReadonlySet<string> = new Set(CAST.map((c) => c.id));

export const readRoster = (): RosterFile => JSON.parse(readFileSync(FILES.roster, "utf8"));

let terrain: Terrain | null = null;
function getTerrain(): Terrain {
  terrain ??= generateTerrain({ seed: JSON.parse(readFileSync(FILES.world, "utf8")).seed });
  return terrain;
}

/** Yeni gelenin yeri: Kut Kapısı'nın meydanının çevresinde, kuru, Kutada'nın içinde, kahramanlardan uzak. */
export function arrivalPoint(handle: string): { x: number; y: number } {
  const t = getTerrain();
  for (let attempt = 0; attempt < 80; attempt++) {
    const h = hashString(`varis:${handle}:${attempt}`);
    const angle = ((h % 3600) / 3600) * Math.PI * 2;
    const r = PORTAL_RADIUS + 4 + (((h >>> 12) % 1000) / 1000) * 60;
    const p = { x: Math.round((LANDMARKS.kutKapisi.x + Math.cos(angle) * r) * 10) / 10, y: Math.round((LANDMARKS.kutKapisi.y + Math.sin(angle) * r) * 10) / 10 };
    if (pointInPolygon(p, REGIONS.kutada.polygon) && sampleTerrain(t, p).height >= 0.04 && !isWet(t, p) && !nearHero(p)) return p;
  }
  return { x: LANDMARKS.kutKapisi.x, y: LANDMARKS.kutKapisi.y + PORTAL_RADIUS + 6 };
}

/** Var olan karaktere yeni platform ekler: nadirlik bonusu ve çok platform rozeti güncellenir. */
function addPlatform(c: Character, platform: Platform): Character {
  const linked = [...c.linkedPlatforms, platform];
  const bonus = multiPlatformBonus(linked.length) - multiPlatformBonus(c.linkedPlatforms.length);
  const rarity = raiseRarity(c.rarity, bonus);
  const badges: Character["badges"] = c.badges.filter((b) => b !== "cift_iz" && b !== "oba_onculugu");
  const badge = multiPlatformBadge(linked.length);
  if (badge) badges.push(badge);
  return { ...c, linkedPlatforms: linked, rarity, title: c.title === defaultTitle(c.rarity, c.class.id) ? defaultTitle(rarity, c.class.id) : c.title, badges, updatedAt: new Date().toISOString() };
}

export interface ImportResult {
  roster: RosterFile;
  before: number;
  added: string[];
  linked: string[];
  skipped: string[];
}

/** Girdileri listeye işler (dosyaya yazmaz). `reset`: önce bütün takipçileri siler. */
export function applyEntries(entries: readonly FollowerEntry[], { reset = false }: { reset?: boolean } = {}): ImportResult {
  const roster = readRoster();
  const before = roster.characters.length;
  const byHandle = new Map((reset ? [] : roster.characters).map((c) => [c.handle.toLocaleLowerCase("tr"), c]));
  const added: string[] = [];
  const linked: string[] = [];
  const skipped: string[] = [];
  for (const entry of entries) {
    if (!PLATFORMS.includes(entry.platform) || !isValidHandle(entry.handle)) {
      skipped.push(entry.handle || "(boş)");
      continue;
    }
    const key = entry.handle.toLocaleLowerCase("tr");
    const existing = byHandle.get(key);
    if (existing) {
      if (existing.linkedPlatforms.includes(entry.platform)) continue;
      byHandle.set(key, addPlatform(existing, entry.platform));
      linked.push(entry.handle);
      continue;
    }
    byHandle.set(key, createStarterCharacter({ handle: entry.handle, displayName: entry.displayName || entry.handle, platform: entry.platform, region: "kutada", coordinates: arrivalPoint(entry.handle) }));
    added.push(entry.handle);
  }
  const next: RosterFile = { ...roster, characters: [...byHandle.values()], generatedAt: new Date().toISOString() };
  return { roster: next, before, added, linked, skipped };
}

/** Kullanıcı adlarına göre takipçileri çıkarır (haritadan çıkmak isteyenler için; dosyaya yazmaz). */
export function removeHandles(handles: readonly string[]): { roster: RosterFile; removed: string[]; missing: string[] } {
  const roster = readRoster();
  const wanted = new Set(handles.map((h) => h.trim().replace(/^@+/, "").toLocaleLowerCase("tr")).filter(Boolean));
  const removed = roster.characters.filter((c) => wanted.has(c.handle.toLocaleLowerCase("tr"))).map((c) => c.handle);
  const found = new Set(removed.map((h) => h.toLocaleLowerCase("tr")));
  return {
    roster: { ...roster, characters: roster.characters.filter((c) => !wanted.has(c.handle.toLocaleLowerCase("tr"))), generatedAt: new Date().toISOString() },
    removed,
    missing: [...wanted].filter((h) => !found.has(h)),
  };
}

/**
 * Listeyi doğrulayıp yazar. Listede artık olmayan kişilere ait sezon akın kayıtları ve yer adları da temizlenir
 * (kadroya ait olanlar kalır). Döndürdüğü: temizlenen yer adı sayısı.
 */
export function saveRoster(roster: RosterFile): number {
  const check = rosterSchema.safeParse(roster);
  if (!check.success) throw new Error(`Liste geçersiz kaldı, hiçbir şey yazılmadı:\n${formatDataError(check.error)}`);
  writeFileSync(FILES.roster, `${JSON.stringify(roster)}\n`, "utf8");
  const ids = new Set(roster.characters.map((c) => c.id));
  const season = JSON.parse(readFileSync(FILES.season, "utf8"));
  for (const ep of season.episodes) ep.participantIds = ep.participantIds.filter((id: string) => ids.has(id) || CAST_IDS.has(id));
  writeFileSync(FILES.season, `${JSON.stringify(season, null, 2)}\n`, "utf8");
  const world = JSON.parse(readFileSync(FILES.world, "utf8"));
  const before = world.namedPlaces.length;
  world.namedPlaces = world.namedPlaces.filter((p: { namedBy: string }) => ids.has(p.namedBy) || CAST_IDS.has(p.namedBy) || p.namedBy.startsWith("kadro:"));
  writeFileSync(FILES.world, `${JSON.stringify(world, null, 2)}\n`, "utf8");
  return before - world.namedPlaces.length;
}

/** Panel için özet: platform, sınıf ve nadirlik dağılımı. */
export function rosterSummary(roster: RosterFile = readRoster()) {
  const count = <K extends string>(pick: (c: Character) => K) =>
    roster.characters.reduce<Record<string, number>>((acc, c) => {
      const k = pick(c);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
  return {
    total: roster.characters.length,
    generatedAt: roster.generatedAt,
    byPlatform: count((c) => c.platform),
    byRarity: count((c) => c.rarity),
    multiPlatform: roster.characters.filter((c) => c.linkedPlatforms.length > 1).length,
    newcomers: roster.characters.filter((c) => c.region === "kutada").length,
  };
}

/**
 * TAKİPÇİ LİSTESİ İŞLEMLERİ — public/data/roster.json üzerinde ekleme, çıkarma, sıfırlama.
 * Kullanan: scripts/import-followers.ts (npm run takipci:ekle) ve yönetim paneli (npm run dev → /yonetim).
 *
 *   · Yeni kişi → Kutada'da, Kut Kapısı'nın çevresinde yeni bir karakter (sınıfı platformundan); özel kahramanların
 *     dibine konmaz.
 *   · Zaten haritada olan kişi başka bir platformdan da geldiyse → o platform eklenir; çift iz / oba öncülüğü rozeti ve
 *     nadirlik bonusu kendiliğinden verilir.
 *   · Hikâyenin kahramanları (mhellingtr, egetunce, bintas) listede olsa da eklenmez: Hikâye kartından gelirler.
 *   · Yorumunda "ad: Kara Şahin" yazan kişi o adla doğar; haritada olan biri yeniden yazarsa adı değişir. Panelden
 *     elle verilen ad, ondan daha eski bir yorumla ezilmez (yorumun tarihi karakterin son güncellemesinden yeni olmalı).
 *     Uygunsuz adlar uygulanmaz, raporda gerekçesiyle listelenir (src/lib/heroNames.ts).
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
import { cleanHeroName, isNewerOrSame, type NameCheck } from "../../src/lib/heroNames";
import { hashString } from "../../src/lib/random";
import { createStarterCharacter, defaultTitle, multiPlatformBadge, multiPlatformBonus, raiseRarity } from "../../src/lib/rules";
import { followerId, heroForHandle, isValidHandle } from "../../src/lib/roster";
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
export function getTerrain(): Terrain {
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
  /** Hikâyenin kahramanları (mhellingtr, egetunce, bintas): listede olsalar da takipçi olarak eklenmez. */
  heroes: string[];
  /** Yorumla kahraman adı seçenler (yeni gelen ya da adını değiştiren). */
  named: { handle: string; name: string }[];
  /** Kabul edilmeyen ad komutları ve gerekçesi (kişi yine katılır, adı değişmez). */
  rejectedNames: { handle: string; name: string; reason: string }[];
}

/** Görünen adı hâlâ kullanıcı adı mı? (kendi seçtiği ya da panelden verilmiş bir ad yok) */
const hasDefaultName = (c: Character) => c.displayName.replace(/^@+/, "").toLowerCase() === c.handle.toLowerCase();

/** Görünen ad en çok 40 karakter (emoji bölünmeden); boşsa kullanıcı adı. */
const cleanDisplayName = (name: string | undefined, handle: string) => [...(name?.trim() || handle)].slice(0, 40).join("").trim() || handle;

/**
 * Girdileri listeye işler (dosyaya yazmaz). `reset`: önce bütün takipçileri siler.
 * Geçersiz kullanıcı adları atlanır (skipped); kahramanlar ayrı listelenir (heroes); hikâye kadrosuyla aynı kimliğe
 * düşen gerçek takipçi "_yoldas" ekli kimlikle girer. Böylece tek bir tuhaf kayıt bütün içe aktarmayı bozmaz.
 */
export function applyEntries(entries: readonly FollowerEntry[], { reset = false, roster = readRoster() }: { reset?: boolean; roster?: RosterFile } = {}): ImportResult {
  const before = roster.characters.length;
  const kept = reset ? [] : roster.characters;
  const byHandle = new Map(kept.map((c) => [c.handle.toLowerCase(), c]));
  const taken = new Set(kept.map((c) => c.id));
  const added: string[] = [];
  const linked: string[] = [];
  const skipped: string[] = [];
  const heroes: string[] = [];
  const named: ImportResult["named"] = [];
  const rejectedNames: ImportResult["rejectedNames"] = [];
  const now = new Date().toISOString();

  // Ad komutları: aynı kişinin birden çok yorumu varsa tarihi en yeni olanı geçer (tarihsiz = şimdi yapıştırılan).
  const commands = new Map<string, { raw: string; at?: string; handle: string }>();
  for (const e of entries) {
    if (!e.heroName) continue;
    const key = e.handle.replace(/^@+/, "").toLowerCase();
    const prev = commands.get(key);
    if (!prev || isNewerOrSame(e.at, prev.at)) commands.set(key, { raw: e.heroName, at: e.at, handle: e.handle });
  }
  const checks = new Map<string, NameCheck>();
  const chosenName = (key: string): string | null => {
    const command = commands.get(key);
    if (!command) return null;
    let check = checks.get(key);
    if (!check) {
      check = cleanHeroName(command.raw);
      checks.set(key, check);
      if (!check.ok) rejectedNames.push({ handle: command.handle, name: command.raw, reason: check.reason });
    }
    return check.ok ? check.name : null;
  };
  /** Bu içe aktarmadan önceki son güncelleme: yorum ondan yeniyse ad değişir. */
  const lastUpdate = new Map(kept.map((c) => [c.handle.toLowerCase(), c.updatedAt]));
  const renamed = new Set<string>();
  const rename = (key: string, c: Character): Character => {
    if (renamed.has(key)) return c;
    const name = chosenName(key);
    const command = commands.get(key);
    if (!name || !command || name === c.displayName) return c;
    const last = lastUpdate.get(key);
    const newer = !command.at || !last || Date.parse(command.at) > Date.parse(last);
    if (!newer && !hasDefaultName(c)) return c;
    renamed.add(key);
    named.push({ handle: c.handle, name });
    return { ...c, displayName: name, updatedAt: now };
  };

  for (const entry of entries) {
    if (!PLATFORMS.includes(entry.platform) || !isValidHandle(entry.handle)) {
      skipped.push(entry.handle || "(boş)");
      continue;
    }
    if (heroForHandle(entry.handle)) {
      if (!heroes.some((h) => h.toLowerCase() === entry.handle.toLowerCase())) heroes.push(entry.handle);
      continue;
    }
    const key = entry.handle.replace(/^@+/, "").toLowerCase();
    const existing = byHandle.get(key);
    if (existing) {
      let next = existing;
      if (!existing.linkedPlatforms.includes(entry.platform)) {
        next = addPlatform(existing, entry.platform);
        linked.push(entry.handle);
      }
      byHandle.set(key, rename(key, next));
      continue;
    }
    const id = followerId(entry.handle, taken);
    // Yalnızca noktadan ya da alt çizgiden oluşan adlardan kimlik çıkmaz.
    if (!/^[a-z0-9]/.test(id)) {
      skipped.push(entry.handle);
      continue;
    }
    taken.add(id);
    const chosen = chosenName(key);
    const character = createStarterCharacter({ handle: entry.handle, displayName: chosen ?? cleanDisplayName(entry.displayName, entry.handle), platform: entry.platform, region: "kutada", coordinates: arrivalPoint(entry.handle) });
    byHandle.set(key, { ...character, id });
    added.push(entry.handle);
    if (chosen) {
      renamed.add(key);
      named.push({ handle: character.handle, name: chosen });
    }
  }
  const next: RosterFile = { ...roster, characters: [...byHandle.values()], generatedAt: now };
  return { roster: next, before, added, linked, skipped, heroes, named, rejectedNames };
}

/** Kullanıcı adlarına göre takipçileri çıkarır (haritadan çıkmak isteyenler için; dosyaya yazmaz). */
export function removeHandles(handles: readonly string[]): { roster: RosterFile; removed: string[]; missing: string[] } {
  const roster = readRoster();
  const wanted = new Set(handles.map((h) => h.trim().replace(/^@+/, "").toLowerCase()).filter(Boolean));
  const removed = roster.characters.filter((c) => wanted.has(c.handle.toLowerCase())).map((c) => c.handle);
  const found = new Set(removed.map((h) => h.toLowerCase()));
  return {
    roster: { ...roster, characters: roster.characters.filter((c) => !wanted.has(c.handle.toLowerCase())), generatedAt: new Date().toISOString() },
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

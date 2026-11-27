/**
 * PANELİN TAKİPÇİ VE BAĞLANTI İŞLERİ — dosya okuyup yazan ince katman (kurallar followerEdit.ts içinde).
 * Kullanan: scripts/yonetimPlugin.ts (yalnızca npm run dev sırasında).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createVisibility } from "../../src/game/visibility";
import { generateTerrain, type Terrain } from "../../src/game/terrain";
import { formatDataError, worldStateSchema } from "../../src/schemas/data";
import type { Platform, RosterFile } from "../../src/types";
import { addFollower, deleteFollower, homeOptions, listFollowers, patchFollower, summarize, type EditContext, type FollowerPatch, type HomeChoice } from "./followerEdit";
import { arrivalPoint, FILES, readRoster, saveRoster } from "./followers";

const readWorld = () => JSON.parse(readFileSync(FILES.world, "utf8"));

let cached: { seed: number; terrain: Terrain } | null = null;
function context(): EditContext {
  const world = readWorld();
  if (!cached || cached.seed !== world.seed) cached = { seed: world.seed, terrain: generateTerrain({ seed: world.seed }) };
  return {
    terrain: cached.terrain,
    seed: world.seed,
    visibility: createVisibility(world.revealedRegions, world.revealedIslands ?? []),
    arrivalPoint,
  };
}

export function followerList(query: { ara?: string; platform?: string; nadirlik?: string; sayfa?: number }) {
  return listFollowers(readRoster(), query);
}

/** Paneldeki küçük harita için: bütün takipçilerin yeri (kimlik, ad, nokta). */
export function followerDots(): { id: string; x: number; y: number }[] {
  return readRoster().characters.map((c) => ({ id: c.id, x: c.coordinates.x, y: c.coordinates.y }));
}

export function follower(id: string) {
  const c = readRoster().characters.find((x) => x.id === id);
  if (!c) throw new Error(`"${id}" listede yok.`);
  return c;
}

export function homes() {
  return homeOptions(context().visibility);
}

function save(roster: RosterFile) {
  saveRoster(roster);
}

export function updateFollower(id: string, patch: FollowerPatch) {
  const result = patchFollower(readRoster(), id, patch, context());
  save(result.roster);
  return summarize(result.character);
}

export function createFollower(input: { handle: string; displayName?: string; platform: Platform; linkedPlatforms?: Platform[]; home?: HomeChoice }) {
  const result = addFollower(readRoster(), input, context());
  save(result.roster);
  return summarize(result.character);
}

export function removeFollower(id: string) {
  save(deleteFollower(readRoster(), id));
}

/** Sosyal medya ve destek bağlantıları (world.json). Boş metin → bağlantı yok. */
export function links() {
  const world = readWorld();
  return { socialLinks: world.socialLinks, supportUrl: world.supportUrl ?? null };
}

export function setLinks(input: { socialLinks?: Record<string, string | null>; supportUrl?: string | null }) {
  const world = readWorld();
  const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  if (input.socialLinks) {
    world.socialLinks = {
      instagram: clean(input.socialLinks.instagram),
      tiktok: clean(input.socialLinks.tiktok),
      youtube: clean(input.socialLinks.youtube),
    };
  }
  if (input.supportUrl !== undefined) world.supportUrl = clean(input.supportUrl);
  world.updatedAt = new Date().toISOString();
  const check = worldStateSchema.safeParse(world);
  if (!check.success) throw new Error(`Bağlantılar geçersiz, hiçbir şey yazılmadı:\n${formatDataError(check.error)}`);
  writeFileSync(FILES.world, `${JSON.stringify(world, null, 2)}\n`, "utf8");
  return links();
}

/**
 * Hikâye yönetimi (betikler ve yönetim paneli): world.json → story (gelen kahramanlar) ile açık bölge ve adalar.
 * Her yazım şemadan geçer; bozuk dosya yazılmaz. Kullanan: scripts/yonetimPlugin.ts (/yonetim → Hikâye).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CAST } from "../../src/content/cast";
import { ISLAND_IDS, ISLANDS } from "../../src/content/islands";
import { REGION_LIST } from "../../src/content/regions";
import { ARRIVAL_ORDER, nextArrival, withNextArrival, withoutLastArrival } from "../../src/content/story";
import { formatDataError, worldStateSchema } from "../../src/schemas/data";
import type { WorldState } from "../../src/types";

const WORLD = resolve("public/data/world.json");

function readWorld(): WorldState {
  const parsed = worldStateSchema.safeParse(JSON.parse(readFileSync(WORLD, "utf8")));
  if (!parsed.success) throw new Error(`world.json okunamadı:\n${formatDataError(parsed.error)}`);
  return parsed.data;
}

function writeWorld(world: WorldState, now = new Date()): WorldState {
  const next = worldStateSchema.parse({ ...world, updatedAt: now.toISOString() });
  writeFileSync(WORLD, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

const nameOf = (id: string) => CAST.find((c) => c.id === id)?.displayName ?? id;

export interface StorySummary {
  day: number;
  arrivals: { id: string; name: string; at: string }[];
  next: { id: string; name: string } | null;
  order: { id: string; name: string }[];
  regions: { id: string; name: string; open: boolean }[];
  islands: { id: string; name: string; open: boolean }[];
}

export function storySummary(): StorySummary {
  const world = readWorld();
  const next = nextArrival(world.story);
  const openRegions = new Set<string>(world.revealedRegions);
  const openIslands = new Set<string>(world.revealedIslands);
  return {
    day: world.story.day,
    arrivals: world.story.arrivals.map((a) => ({ id: a.id, name: nameOf(a.id), at: a.at })),
    next: next ? { id: next, name: nameOf(next) } : null,
    order: ARRIVAL_ORDER.map((id) => ({ id, name: nameOf(id) })),
    regions: REGION_LIST.map((r) => ({ id: r.id, name: r.name, open: openRegions.has(r.id) })),
    islands: ISLAND_IDS.map((id) => ({ id, name: ISLANDS[id].nickname, open: openIslands.has(id) })),
  };
}

/** Sıradaki kahramanı getirir; getirilenin adını döndürür (hepsi geldiyse null). */
export function bringNext(now = new Date()): string | null {
  const world = readWorld();
  const next = nextArrival(world.story);
  if (!next) return null;
  writeWorld({ ...world, story: withNextArrival(world.story, now) }, now);
  return nameOf(next);
}

/** Son gelişi geri alır; geri alınanın adını döndürür. */
export function undoLast(now = new Date()): string | null {
  const world = readWorld();
  const last = world.story.arrivals.at(-1);
  if (!last) return null;
  writeWorld({ ...world, story: withoutLastArrival(world.story) }, now);
  return nameOf(last.id);
}

/** Hikâyenin gününü ayarlar. */
export function setDay(day: number, now = new Date()): void {
  const world = readWorld();
  writeWorld({ ...world, story: { ...world.story, day: Math.max(1, Math.round(day)) } }, now);
}

/** Bir bölgeyi ya da yabani adayı açar/kapatır (Kutada hep açık kalır). */
export function setLandOpen(kind: "bolge" | "ada", id: string, open: boolean, now = new Date()): void {
  const world = readWorld();
  if (kind === "bolge") {
    if (!REGION_LIST.some((r) => r.id === id)) throw new Error(`Bilinmeyen bölge: ${id}`);
    if (id === "kutada" && !open) throw new Error("Kutada hep açık kalır");
    const set = new Set<string>(world.revealedRegions);
    if (open) set.add(id);
    else set.delete(id);
    writeWorld({ ...world, revealedRegions: REGION_LIST.map((r) => r.id).filter((r) => set.has(r)) }, now);
  } else {
    if (!(ISLAND_IDS as readonly string[]).includes(id)) throw new Error(`Bilinmeyen ada: ${id}`);
    const set = new Set<string>(world.revealedIslands);
    if (open) set.add(id);
    else set.delete(id);
    writeWorld({ ...world, revealedIslands: ISLAND_IDS.filter((i) => set.has(i)) }, now);
  }
}

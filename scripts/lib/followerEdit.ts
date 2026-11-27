/**
 * TAKİPÇİ DÜZENLEME — yönetim panelindeki "Takipçiler" kartının kuralları (roster.json üzerinde, dosyaya yazmaz).
 *
 *   · Görünen ad, unvan, nadirlik, rozetler, puan, ana platform, bağlı platformlar ve haritadaki yer değişebilir.
 *     Kullanıcı adı ve kimlik değişmez (kişinin izi): yanlışsa silip yeniden eklenir.
 *   · Sınıf ana platformdan gelir (Instagram → Kalkaneri, TikTok → Okyeli, YouTube → Ocakcan).
 *   · Takipçinin nadirliği en çok Efsanevi'dir; Alp ve Gökeri yalnızca özel kahramanlarındır.
 *   · Unvan boş bırakılırsa nadirlik ve sınıftan kendiliğinden kurulur ("Nadir Okyeli"). Otomatik unvan, nadirlik ya
 *     da sınıf değişince güncellenir; elle yazılmış unvan korunur.
 *   · Bağlı platformlar değişince çift iz / oba öncülüğü rozeti kendiliğinden güncellenir (rozetler elle de seçilebilir).
 *   · Yer: Kut Kapısı'nın çevresi, hikâyede açık bir oba ya da haritada seçilen bir nokta (kuru ve açık kara olmalı).
 *
 * Hatalar Türkçe mesajlı Error olarak fırlatılır; panel olduğu gibi gösterir. Testleri followerEdit.test.ts içinde.
 */
import { REGION_LIST } from "../../src/content/regions";
import { VILLAGES } from "../../src/content/sites";
import { isWet, sampleTerrain, type Terrain } from "../../src/game/terrain";
import { isHiddenAt, type LandVisibility } from "../../src/game/visibility";
import { findContaining } from "../../src/lib/geometry";
import { hashString } from "../../src/lib/random";
import { isValidHandle } from "../../src/lib/roster";
import { classForPlatform, createStarterCharacter, defaultTitle, multiPlatformBadge, rarityRank } from "../../src/lib/rules";
import { BADGE_IDS, FOLLOWER_RARITY_CAP, PLATFORMS, RARITIES, type BadgeId, type Character, type Coordinates, type Platform, type Rarity, type RegionId, type RosterFile } from "../../src/types";
import { toClassInfo } from "../../src/content/classes";
import { structureObstacles } from "../../src/world3d/layout";

export type HomeChoice = { kind: "kapi" } | { kind: "oba"; village: string } | { kind: "nokta"; x: number; y: number };

export interface FollowerPatch {
  displayName?: string;
  /** Boş ya da null: nadirlik ve sınıftan otomatik unvan. */
  title?: string | null;
  rarity?: Rarity;
  badges?: BadgeId[];
  points?: number;
  platform?: Platform;
  linkedPlatforms?: Platform[];
  home?: HomeChoice;
}

export interface EditContext {
  terrain: Terrain;
  seed: number;
  visibility: LandVisibility;
  /** Kut Kapısı'nın çevresinde yer bulan işlev (followers.ts → arrivalPoint). */
  arrivalPoint: (handle: string) => Coordinates;
  now?: Date;
}

export interface FollowerSummary {
  id: string;
  handle: string;
  displayName: string;
  platform: Platform;
  linkedPlatforms: Platform[];
  className: string;
  rarity: Rarity;
  title: string;
  points: number;
  badges: BadgeId[];
  region: RegionId;
  coordinates: Coordinates;
  updatedAt: string;
}

export interface HomeOption {
  id: string;
  label: string;
}

const key = (s: string) => s.trim().replace(/^@+/, "").toLocaleLowerCase("tr");
const MULTI_BADGES: readonly BadgeId[] = ["cift_iz", "oba_onculugu"];

export function summarize(c: Character): FollowerSummary {
  return {
    id: c.id,
    handle: c.handle,
    displayName: c.displayName,
    platform: c.platform,
    linkedPlatforms: c.linkedPlatforms,
    className: c.class.name,
    rarity: c.rarity,
    title: c.title,
    points: c.points,
    badges: c.badges,
    region: c.region,
    coordinates: c.coordinates,
    updatedAt: c.updatedAt,
  };
}

/** Panel listesi: arama (ad, kullanıcı adı, unvan), platform ve nadirlik süzgeci, sayfa. */
export function listFollowers(
  roster: RosterFile,
  query: { ara?: string; platform?: string; nadirlik?: string; sayfa?: number; boyut?: number } = {},
): { total: number; page: number; pages: number; items: FollowerSummary[] } {
  const q = key(query.ara ?? "");
  const size = Math.min(100, Math.max(5, query.boyut ?? 30));
  const filtered = roster.characters
    .filter((c) => !q || key(c.handle).includes(q) || key(c.displayName).includes(q) || key(c.title).includes(q))
    .filter((c) => !query.platform || c.linkedPlatforms.includes(query.platform as Platform))
    .filter((c) => !query.nadirlik || c.rarity === query.nadirlik)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "tr"));
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const page = Math.min(pages, Math.max(1, query.sayfa ?? 1));
  return { total: filtered.length, page, pages, items: filtered.slice((page - 1) * size, page * size).map(summarize) };
}

/** Yer seçenekleri: Kut Kapısı ve hikâyede açık bölgelerdeki obalar. */
export function homeOptions(visibility: LandVisibility): HomeOption[] {
  return [
    { id: "kapi", label: "Kut Kapısı'nın çevresi (yeni gelenler)" },
    ...VILLAGES.filter((v) => v.id && visibility.regions.has(v.region)).map((v) => ({ id: v.id as string, label: v.name })),
  ];
}

function regionAt(p: Coordinates): RegionId {
  const inside = findContaining(p, REGION_LIST);
  if (inside) return inside.id;
  // Yabani adalar bölge değil: en yakın bölgenin kimliği yazılır (yalnızca kayıt için).
  return REGION_LIST.reduce((best, r) => (Math.hypot(r.center.x - p.x, r.center.y - p.y) < Math.hypot(best.center.x - p.x, best.center.y - p.y) ? r : best)).id;
}

/** Nokta kahramanın yaşayabileceği bir yer mi? Değilse nedenini söyler. */
export function pointProblem(p: Coordinates, ctx: EditContext): string | null {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return "Geçersiz nokta.";
  if (sampleTerrain(ctx.terrain, p).height < 0.04) return "Bu nokta denizde ya da kıyıda.";
  if (isWet(ctx.terrain, p)) return "Bu nokta derede ya da gölde.";
  if (isHiddenAt(ctx.terrain, ctx.visibility, p)) return "Bu kara hikâyede henüz açılmadı (karanlıkta).";
  const blocked = structureObstacles(ctx.terrain, ctx.seed).find((o) => Math.hypot(o.x - p.x, o.y - p.y) < o.r);
  if (blocked) return "Bu nokta bir çadırın ya da yapının içinde.";
  return null;
}

/** Obanın çevresinde, çadırlara ve ateşe girmeyen bir yer (kişiye göre hep aynı). */
function villagePoint(villageId: string, handle: string, ctx: EditContext): Coordinates {
  const village = VILLAGES.find((v) => v.id === villageId);
  if (!village) throw new Error(`"${villageId}" diye bir oba yok.`);
  if (!ctx.visibility.regions.has(village.region)) throw new Error(`${village.name} hikâyede henüz açılmadı.`);
  for (let attempt = 0; attempt < 120; attempt++) {
    const h = hashString(`oba:${villageId}:${handle}:${attempt}`);
    const angle = ((h % 3600) / 3600) * Math.PI * 2;
    const r = village.radius * (0.35 + (((h >>> 12) % 1000) / 1000) * 0.75);
    const p = { x: Math.round((village.center.x + Math.cos(angle) * r) * 10) / 10, y: Math.round((village.center.y + Math.sin(angle) * r) * 10) / 10 };
    if (!pointProblem(p, ctx)) return p;
  }
  throw new Error(`${village.name} çevresinde boş yer bulunamadı.`);
}

function placeAt(home: HomeChoice, handle: string, ctx: EditContext): Coordinates {
  if (home.kind === "kapi") return ctx.arrivalPoint(handle);
  if (home.kind === "oba") return villagePoint(home.village, handle, ctx);
  const p = { x: Math.round(home.x * 10) / 10, y: Math.round(home.y * 10) / 10 };
  const problem = pointProblem(p, ctx);
  if (problem) throw new Error(problem);
  return p;
}

function checkRarity(rarity: Rarity) {
  if (!RARITIES.includes(rarity)) throw new Error(`"${rarity}" diye bir nadirlik yok.`);
  if (rarityRank(rarity) > rarityRank(FOLLOWER_RARITY_CAP)) throw new Error("Alp ve Gökeri yalnızca özel kahramanlara verilir; takipçide en yüksek nadirlik Efsanevi.");
}

function cleanPlatforms(main: Platform, linked: readonly Platform[]): Platform[] {
  for (const p of [main, ...linked]) if (!PLATFORMS.includes(p)) throw new Error(`"${p}" diye bir platform yok.`);
  return [main, ...linked.filter((p, i) => p !== main && linked.indexOf(p) === i)];
}

/** Bir takipçiyi değiştirir. Yeni liste ve takipçinin son hâli döner. */
export function patchFollower(roster: RosterFile, id: string, patch: FollowerPatch, ctx: EditContext): { roster: RosterFile; character: Character } {
  const index = roster.characters.findIndex((c) => c.id === id);
  if (index < 0) throw new Error(`"${id}" listede yok.`);
  const old = roster.characters[index];
  const next: Character = { ...old };

  if (patch.displayName !== undefined) {
    const name = patch.displayName.trim();
    if (!name) throw new Error("Görünen ad boş olamaz.");
    if (name.length > 40) throw new Error("Görünen ad en çok 40 harf olabilir.");
    next.displayName = name;
  }
  if (patch.platform !== undefined || patch.linkedPlatforms !== undefined) {
    const main = patch.platform ?? old.platform;
    next.platform = main;
    next.linkedPlatforms = cleanPlatforms(main, patch.linkedPlatforms ?? old.linkedPlatforms);
    const classId = classForPlatform(main);
    next.class = toClassInfo(classId);
  }
  if (patch.rarity !== undefined) {
    checkRarity(patch.rarity);
    next.rarity = patch.rarity;
  }
  if (patch.points !== undefined) {
    if (!Number.isInteger(patch.points) || patch.points < 0) throw new Error("Puan sıfır ya da pozitif bir tam sayı olmalı.");
    next.points = patch.points;
  }
  if (patch.badges !== undefined) {
    const unknown = patch.badges.filter((b) => !BADGE_IDS.includes(b));
    if (unknown.length) throw new Error(`Bilinmeyen rozet: ${unknown.join(", ")}`);
    next.badges = [...new Set(patch.badges)];
  } else if (next.linkedPlatforms.length !== old.linkedPlatforms.length) {
    // Platform sayısı değişti: çok platform rozeti güncellenir.
    const badge = multiPlatformBadge(next.linkedPlatforms.length);
    next.badges = [...next.badges.filter((b) => !MULTI_BADGES.includes(b)), ...(badge ? [badge] : [])];
  }
  // Unvan: elle yazılan korunur; boşsa ya da otomatik unvansa nadirlik ve sınıfa göre kurulur.
  const wasAuto = old.title === defaultTitle(old.rarity, old.class.id);
  if (patch.title !== undefined) {
    const title = (patch.title ?? "").trim();
    if (title.length > 60) throw new Error("Unvan en çok 60 harf olabilir.");
    next.title = title || defaultTitle(next.rarity, next.class.id);
  } else if (wasAuto) {
    next.title = defaultTitle(next.rarity, next.class.id);
  }
  if (patch.home) {
    next.coordinates = placeAt(patch.home, next.handle, ctx);
    next.region = regionAt(next.coordinates);
  }
  next.updatedAt = (ctx.now ?? new Date()).toISOString();
  const characters = [...roster.characters];
  characters[index] = next;
  return { roster: { ...roster, characters, generatedAt: next.updatedAt }, character: next };
}

/** Elle tek takipçi ekler (dosyasız). Kullanıcı adı zaten varsa hata. */
export function addFollower(
  roster: RosterFile,
  input: { handle: string; displayName?: string; platform: Platform; linkedPlatforms?: Platform[]; home?: HomeChoice },
  ctx: EditContext,
): { roster: RosterFile; character: Character } {
  const handle = input.handle.trim().replace(/^@+/, "");
  if (!isValidHandle(handle)) throw new Error(`"${input.handle}" geçerli bir kullanıcı adı değil (harf, rakam, nokta ve alt çizgi).`);
  if (roster.characters.some((c) => key(c.handle) === key(handle))) throw new Error(`@${handle} zaten haritada; listeden bulup düzenleyebilirsin.`);
  const linked = cleanPlatforms(input.platform, input.linkedPlatforms ?? []);
  const home = input.home ?? { kind: "kapi" };
  const coordinates = placeAt(home, handle, ctx);
  const character = createStarterCharacter({ handle, displayName: input.displayName, platform: input.platform, linkedPlatforms: linked, region: regionAt(coordinates), coordinates, now: ctx.now });
  if (roster.characters.some((c) => c.id === character.id)) throw new Error(`@${handle} ile aynı kimlikte biri zaten var.`);
  const now = (ctx.now ?? new Date()).toISOString();
  return { roster: { ...roster, characters: [...roster.characters, character], generatedAt: now }, character };
}

/** Bir takipçiyi siler. */
export function deleteFollower(roster: RosterFile, id: string, now = new Date()): RosterFile {
  if (!roster.characters.some((c) => c.id === id)) throw new Error(`"${id}" listede yok.`);
  return { ...roster, characters: roster.characters.filter((c) => c.id !== id), generatedAt: now.toISOString() };
}

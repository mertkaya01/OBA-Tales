/**
 * YER ADLARI — topluluğun koyduğu adlar (world.json → namedPlaces). Yönetim panelinin "Yer adları" kartı kullanır.
 *
 *   · Ad koyan kişi haritada değilse önce eklenir (Kut Kapısı'nın önünde doğar).
 *   · Ad koyan takipçiye "Ad Koyan" rozeti verilir; artık hiçbir yerin adını taşımıyorsa rozet geri alınır.
 *   · Aynı ad iki yere konmaz. Ad, kahraman adlarıyla aynı denetimden geçer (src/lib/heroNames.ts → cleanPlaceName).
 *   · Karanlıktaki (henüz açılmamış) yerlere de ad konabilir; haritada o kara açılınca görünür.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { PLACE_NAMES } from "../../src/content/places";
import { createVisibility, isHiddenAt } from "../../src/game/visibility";
import { cleanPlaceName } from "../../src/lib/heroNames";
import { heroForHandle } from "../../src/lib/roster";
import { formatDataError, worldStateSchema } from "../../src/schemas/data";
import { PLACE_IDS, PLATFORMS, type BadgeId, type PlaceId, type Platform, type RosterFile } from "../../src/types";
import { placeAnchors } from "../../src/world3d/layout";
import { CAST } from "../../src/content/cast";
import { applyEntries, FILES, getTerrain, readRoster, saveRoster } from "./followers";

const BADGE: BadgeId = "ad_koyan";

interface WorldFile {
  revealedRegions: string[];
  revealedIslands?: string[];
  namedPlaces: { place: PlaceId; name: string; namedBy: string }[];
  updatedAt: string;
  [key: string]: unknown;
}

const readWorld = (): WorldFile => JSON.parse(readFileSync(FILES.world, "utf8"));

function writeWorld(world: WorldFile): void {
  world.updatedAt = new Date().toISOString();
  const check = worldStateSchema.safeParse(world);
  if (!check.success) throw new Error(`Yer adı geçersiz, hiçbir şey yazılmadı:\n${formatDataError(check.error)}`);
  writeFileSync(FILES.world, `${JSON.stringify(world, null, 2)}\n`, "utf8");
}

let anchorCache: ReturnType<typeof placeAnchors> | null = null;

/** Paneldeki liste: her yerin haritacı adı, konulmuş adı, koyanı ve karanlıkta olup olmadığı. */
export function placeList() {
  const world = readWorld();
  const roster = readRoster();
  const terrain = getTerrain();
  anchorCache ??= placeAnchors(terrain);
  const visibility = createVisibility(world.revealedRegions, world.revealedIslands ?? []);
  const byId = new Map(roster.characters.map((c) => [c.id, c]));
  const castById = new Map(CAST.map((c) => [c.id, c]));
  return {
    places: PLACE_IDS.map((id) => {
      const named = world.namedPlaces.find((p) => p.place === id) ?? null;
      const namer = named ? (byId.get(named.namedBy) ?? castById.get(named.namedBy)) : undefined;
      return {
        id,
        label: PLACE_NAMES[id],
        name: named?.name ?? null,
        namedBy: named ? { id: named.namedBy, handle: namer?.handle ?? named.namedBy, displayName: namer?.displayName ?? named.namedBy } : null,
        hidden: isHiddenAt(terrain, visibility, anchorCache![id].point),
      };
    }),
  };
}

/** Rozeti, adını taşıdığı bir yer kalmayan takipçilerden alır, ad koyanlara verir. */
function syncBadges(roster: RosterFile, world: WorldFile): RosterFile {
  const namers = new Set(world.namedPlaces.map((p) => p.namedBy));
  let changed = false;
  const characters = roster.characters.map((c) => {
    const has = c.badges.includes(BADGE);
    if (namers.has(c.id) === has) return c;
    changed = true;
    return { ...c, badges: has ? c.badges.filter((b) => b !== BADGE) : [...c.badges, BADGE], updatedAt: new Date().toISOString() };
  });
  return changed ? { ...roster, characters } : roster;
}

/** Yere ad koyar. handle: adı öneren kişi (haritada değilse platformuyla eklenir). */
export function namePlace(input: { place: string; name: string; handle: string; platform: string }) {
  if (!PLACE_IDS.includes(input.place as PlaceId)) throw new Error("Böyle bir yer yok.");
  const place = input.place as PlaceId;
  const check = cleanPlaceName(input.name ?? "");
  if (!check.ok) throw new Error(`Ad kabul edilmedi: ${check.reason}.`);
  const handle = String(input.handle ?? "").trim().replace(/^@+/, "");
  if (!handle) throw new Error("Adı koyanın kullanıcı adını yaz.");
  const platform = input.platform as Platform;
  if (!PLATFORMS.includes(platform)) throw new Error("Platform seç.");

  let roster = readRoster();
  let added = false;
  let namedBy: string;
  const hero = heroForHandle(handle);
  if (hero) namedBy = hero;
  else {
    let namer = roster.characters.find((c) => c.handle.toLowerCase() === handle.toLowerCase());
    if (!namer) {
      const result = applyEntries([{ platform, handle, displayName: handle }], { roster });
      roster = result.roster;
      namer = roster.characters.find((c) => c.handle.toLowerCase() === handle.toLowerCase());
      if (!namer) throw new Error(`"${handle}" geçerli bir kullanıcı adı değil.`);
      added = true;
    }
    namedBy = namer.id;
  }

  const world = readWorld();
  const clash = world.namedPlaces.find((p) => p.place !== place && p.name.toLocaleLowerCase("tr") === check.name.toLocaleLowerCase("tr"));
  if (clash) throw new Error(`"${check.name}" adı zaten ${PLACE_NAMES[clash.place]} için kullanılıyor.`);
  world.namedPlaces = [...world.namedPlaces.filter((p) => p.place !== place), { place, name: check.name, namedBy }];
  // Önce takipçi listesi (yeni gelen ve rozet), sonra yer adı: saveRoster koyanı olmayan adları temizler.
  saveRoster(syncBadges(roster, world));
  const fresh = readWorld();
  fresh.namedPlaces = world.namedPlaces;
  writeWorld(fresh);
  return { message: `${PLACE_NAMES[place]} artık "${check.name}". Adını koyan @${handle}${added ? " (haritaya da eklendi)" : ""}.`, ...placeList() };
}

/** Yerin konulmuş adını kaldırır (haritacı adı geri gelir). */
export function clearPlace(placeId: string) {
  if (!PLACE_IDS.includes(placeId as PlaceId)) throw new Error("Böyle bir yer yok.");
  const world = readWorld();
  world.namedPlaces = world.namedPlaces.filter((p) => p.place !== placeId);
  writeWorld(world);
  saveRoster(syncBadges(readRoster(), world));
  return { message: `${PLACE_NAMES[placeId as PlaceId]} adı kaldırıldı.`, ...placeList() };
}

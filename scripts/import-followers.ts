/**
 * Gerçek takipçileri haritaya ekler: `npm run takipci:ekle`
 *
 * `veri/girdi/` klasöründeki CSV dosyalarını okur (her satır bir kişi) ve `public/data/roster.json`'a işler:
 *   · Yeni kişi → Kutada'da, Kut Kapısı'nın çevresinde yeni bir karakter (sınıfı platformundan).
 *   · Zaten haritada olan kişi başka bir platformdan da geldiyse → o platform eklenir; çift iz / oba öncülüğü
 *     rozeti ve nadirlik bonusu kendiliğinden verilir.
 *
 * CSV sütunları (ilk satır başlık): platform,kullanici[,ad][,yorum][,video]
 *   platform: instagram | tiktok | youtube
 *   kullanici: kullanıcı adı (@ olsa da olmasa da olur)
 *   ad: görünen ad (boşsa kullanıcı adı)
 * `npm run youtube:yorumlar` YouTube yorumlarından bu biçimde dosyayı kendisi üretir.
 *
 * Seçenekler:
 *   --kuru       hiçbir şey yazmadan ne olacağını gösterir
 *   --sifirla    örnek (sahte) takipçileri siler, yalnızca CSV'dekilerle başlar; sezon ve dünya dosyalarındaki
 *                artık olmayan kişilere ait kayıtları da temizler (ilk gerçek yayından önce bir kez)
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { REGIONS } from "../src/content/regions";
import { LANDMARKS } from "../src/content/sites";
import { generateTerrain, isWet, sampleTerrain } from "../src/game/terrain";
import { pointInPolygon } from "../src/lib/geometry";
import { hashString } from "../src/lib/random";
import { createStarterCharacter, defaultTitle, multiPlatformBadge, multiPlatformBonus, raiseRarity } from "../src/lib/rules";
import { isValidHandle } from "../src/lib/roster";
import { formatDataError, rosterSchema } from "../src/schemas/data";
import { PLATFORMS } from "../src/types";
import type { Character, Platform, RosterFile } from "../src/types";
import { PORTAL_RADIUS } from "../src/world3d/layout";

const { values: args } = parseArgs({
  options: {
    kuru: { type: "boolean", default: false },
    sifirla: { type: "boolean", default: false },
    girdi: { type: "string", default: "veri/girdi" },
  },
});

const ROSTER = resolve("public/data/roster.json");
const SEASON = resolve("public/data/season.json");
const WORLD = resolve("public/data/world.json");
const INPUT = resolve(args.girdi);

/** Tırnaklı alanları ve virgüllü yorumları doğru okuyan küçük CSV ayrıştırıcı. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

interface Entry {
  platform: Platform;
  handle: string;
  displayName: string;
  source: string;
}

function readEntries(): Entry[] {
  if (!existsSync(INPUT)) {
    mkdirSync(INPUT, { recursive: true });
    console.log(`Girdi klasörü oluşturuldu: ${INPUT}\nCSV dosyalarını buraya koyup komutu yeniden çalıştır.`);
    return [];
  }
  const entries: Entry[] = [];
  for (const file of readdirSync(INPUT).filter((f) => f.toLowerCase().endsWith(".csv"))) {
    const rows = parseCsv(readFileSync(resolve(INPUT, file), "utf8").replace(/^﻿/, ""));
    const header = rows.shift()?.map((h) => h.trim().toLocaleLowerCase("tr")) ?? [];
    const col = (name: string) => header.indexOf(name);
    const [pi, ki, ai] = [col("platform"), col("kullanici"), col("ad")];
    if (pi < 0 || ki < 0) {
      console.warn(`  ! ${file}: başlıkta "platform" ve "kullanici" sütunları olmalı, atlandı`);
      continue;
    }
    for (const row of rows) {
      const platform = row[pi]?.trim().toLowerCase() as Platform;
      const handle = (row[ki] ?? "").trim().replace(/^@/, "");
      if (!PLATFORMS.includes(platform)) continue;
      entries.push({ platform, handle, displayName: (ai >= 0 ? row[ai] : "")?.trim() || handle, source: file });
    }
  }
  return entries;
}

// Yeni gelenler Kut Kapısı'nın meydanının çevresinde, kuru ve Kutada'nın içinde bir yere konur.
const world = JSON.parse(readFileSync(WORLD, "utf8"));
const terrain = generateTerrain({ seed: world.seed });
function arrivalPoint(handle: string): { x: number; y: number } {
  for (let attempt = 0; attempt < 80; attempt++) {
    const h = hashString(`varis:${handle}:${attempt}`);
    const angle = ((h % 3600) / 3600) * Math.PI * 2;
    const r = PORTAL_RADIUS + 4 + ((h >>> 12) % 1000) / 1000 * 54;
    const p = { x: Math.round((LANDMARKS.kutKapisi.x + Math.cos(angle) * r) * 10) / 10, y: Math.round((LANDMARKS.kutKapisi.y + Math.sin(angle) * r) * 10) / 10 };
    if (pointInPolygon(p, REGIONS.kutada.polygon) && sampleTerrain(terrain, p).height >= 0.04 && !isWet(terrain, p)) return p;
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

const roster: RosterFile = JSON.parse(readFileSync(ROSTER, "utf8"));
const before = roster.characters.length;
if (args.sifirla) roster.characters = [];
const byHandle = new Map(roster.characters.map((c) => [c.handle.toLocaleLowerCase("tr"), c]));
const entries = readEntries();
let added = 0;
let linked = 0;
const skipped: string[] = [];

for (const entry of entries) {
  if (!isValidHandle(entry.handle)) {
    skipped.push(`${entry.handle || "(boş)"} (${entry.source})`);
    continue;
  }
  const key = entry.handle.toLocaleLowerCase("tr");
  const existing = byHandle.get(key);
  if (existing) {
    if (existing.linkedPlatforms.includes(entry.platform)) continue;
    byHandle.set(key, addPlatform(existing, entry.platform));
    linked++;
    continue;
  }
  const character = createStarterCharacter({
    handle: entry.handle,
    displayName: entry.displayName,
    platform: entry.platform,
    region: "kutada",
    coordinates: arrivalPoint(entry.handle),
  });
  byHandle.set(key, character);
  added++;
}

roster.characters = [...byHandle.values()];
roster.generatedAt = new Date().toISOString();
const check = rosterSchema.safeParse(roster);
if (!check.success) throw new Error(`Roster geçersiz kaldı, hiçbir şey yazılmadı:\n${formatDataError(check.error)}`);

console.log("OBA-Tales takipçi içe aktarımı");
console.log(`  girdi:        ${entries.length} satır (${INPUT})`);
console.log(`  yeni yoldaş:  ${added} (Kutada'da, Kut Kapısı'nın önünde)`);
console.log(`  çift iz:      ${linked} (yeni platform eklendi)`);
if (skipped.length) console.log(`  atlanan:      ${skipped.length} geçersiz kullanıcı adı: ${skipped.slice(0, 8).join(", ")}${skipped.length > 8 ? "…" : ""}`);
console.log(`  toplam:       ${before}${args.sifirla ? " (sıfırlandı)" : ""} → ${roster.characters.length}`);

if (args.kuru) {
  console.log("Kuru deneme: hiçbir dosya yazılmadı.");
} else {
  writeFileSync(ROSTER, `${JSON.stringify(roster)}\n`, "utf8");
  if (args.sifirla) {
    // Artık haritada olmayan kişilere ait akın listeleri ve yer adları temizlenir.
    const ids = new Set(roster.characters.map((c) => c.id));
    const season = JSON.parse(readFileSync(SEASON, "utf8"));
    for (const ep of season.episodes) ep.participantIds = ep.participantIds.filter((id: string) => ids.has(id));
    writeFileSync(SEASON, `${JSON.stringify(season, null, 2)}\n`, "utf8");
    const before = world.namedPlaces.length;
    world.namedPlaces = world.namedPlaces.filter((p: { namedBy: string }) => ids.has(p.namedBy) || p.namedBy.startsWith("kadro:"));
    writeFileSync(WORLD, `${JSON.stringify(world, null, 2)}\n`, "utf8");
    console.log(`  temizlendi:   sezon akın listeleri, ${before - world.namedPlaces.length} yer adı (koyanı artık yok)`);
  }
  console.log("✔ Yazıldı. Kontrol: npm run data:check");
}

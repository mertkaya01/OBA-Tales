/**
 * TAKİPÇİ DOSYALARI — platformların "verilerini indir" dosyalarından ve CSV'den kullanıcı adlarını çıkarır.
 *
 * Saf fonksiyonlardır: hem tarayıcıda (yönetim paneli dosyayı orada okur, sunucuya yalnızca adlar gider) hem de
 * komut satırında (npm run takipci:ekle) çalışır.
 *
 *   Instagram  followers_1.json (JSON) ya da followers_1.html (HTML): "Bilgilerini indir → Takipçiler ve takip edilenler"
 *              (çok takipçide followers_2.json … da olur)
 *   TikTok     user_data_tiktok.json / user_data.json (JSON; "Profile And Settings" ya da eski "Activity" → Follower →
 *              FansList) ya da Follower.txt / "Follower List.txt" (TXT): "Verilerini indir"
 *   ZIP        indirilen ZIP olduğu gibi: içindeki takipçi dosyaları bulunur, gerisi açılmaz (parseFollowerZip)
 *   CSV        platform,kullanici[,ad] (ilk satır başlık) ya da her satırda bir kullanıcı adı
 *
 * Yalnızca kullanıcı adları alınır; dosyadaki e-posta, doğum tarihi gibi bilgiler okunmaz, hiçbir yere gitmez.
 * Yanlış dosya (takip ettiklerin, takip istekleri, profil ziyaretçileri) takipçi sanılmaz; ne olduğu söylenir.
 */
import { PLATFORMS, type Platform } from "../types";
import { isZip, listZip } from "./zipReader";

export interface FollowerEntry {
  platform: Platform;
  handle: string;
  displayName: string;
}

export interface ParsedFile {
  /** Dosyanın türü (kullanıcıya gösterilir). */
  kind: string;
  entries: FollowerEntry[];
  /** Tanınmayan ya da atlanan satır sayısı. */
  skipped: number;
  /** Kullanıcıya not: yanlış dosya, takipçi yok ya da ne seçmesi gerektiği. */
  note?: string;
}

const clean = (handle: string) => handle.trim().replace(/^@+/, "").replace(/\/+$/, "");
const fromUrl = (href: string) => clean(decodeURIComponent(href.split(/[?#]/)[0].split("/").filter(Boolean).pop() ?? ""));
/** Instagram ve TikTok kullanıcı adı kuralı: harf, rakam, nokta, alt çizgi (1–30). */
const VALID = /^[A-Za-z0-9._]{1,30}$/;

function unique(platform: Platform, handles: Iterable<string>): FollowerEntry[] {
  const seen = new Set<string>();
  const out: FollowerEntry[] = [];
  for (const raw of handles) {
    const handle = clean(raw);
    // Kullanıcı adları İngilizce harflerdir: Türkçe küçültme ("I" → "ı") aynı kişiyi iki kez saydırırdı.
    const key = handle.toLowerCase();
    if (!VALID.test(handle) || seen.has(key)) continue;
    seen.add(key);
    out.push({ platform, handle, displayName: handle });
  }
  return out;
}

// ── Instagram ──────────────────────────────────────────────────────

/** followers_1.json: [{ string_list_data: [{ href, value }] }] ya da { relationships_followers: [...] }; yeni biçimde "title". */
export function parseInstagramJson(data: unknown): string[] {
  const list = Array.isArray(data) ? data : Object.values((data ?? {}) as Record<string, unknown>).find(Array.isArray);
  const handles: string[] = [];
  for (const item of (list ?? []) as Record<string, unknown>[]) {
    const strings = (item?.string_list_data ?? []) as { href?: string; value?: string }[];
    const first = strings[0];
    const handle = first?.value || (typeof item?.title === "string" && item.title) || (first?.href ? fromUrl(first.href) : "");
    if (handle) handles.push(handle);
  }
  return handles;
}

/** followers_1.html: profil bağlantıları (instagram.com/kullanici). */
export function parseInstagramHtml(html: string): string[] {
  const handles: string[] = [];
  for (const match of html.matchAll(/href="https?:\/\/(?:www\.)?instagram\.com\/(?:_u\/)?([A-Za-z0-9._]+)\/?"/g)) handles.push(match[1]);
  return handles;
}

// ── TikTok ─────────────────────────────────────────────────────────

/**
 * TikTok JSON'unda takipçi listesini bulur: anahtarında "Follower" ya da "Fans" geçen dizilerdeki UserName alanları.
 * ("Following", yani senin takip ettiklerin alınmaz.)
 */
export function parseTikTokJson(data: unknown): string[] {
  const handles: string[] = [];
  const visit = (node: unknown, underFollowers: boolean, depth: number): void => {
    if (depth > 8 || node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) {
        if (underFollowers && item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          const name = record.UserName ?? record.userName ?? record.username ?? record.uniqueId;
          if (typeof name === "string") handles.push(name);
        }
        visit(item, underFollowers, depth + 1);
      }
      return;
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const followers = /follower|fans/i.test(key) && !/following/i.test(key);
      visit(value, underFollowers || followers, depth + 1);
    }
  };
  visit(data, false, 0);
  return handles;
}

/** "Follower List.txt": her kayıtta "Username: kullanici". */
export function parseTikTokText(text: string): string[] {
  return [...text.matchAll(/User\s*name:\s*([A-Za-z0-9._]+)/gi)].map((m) => m[1]);
}

// ── CSV ────────────────────────────────────────────────────────────

/** Tırnaklı alanları ve virgüllü değerleri doğru okuyan küçük CSV ayrıştırıcı. */
export function parseCsv(text: string): string[][] {
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

/** CSV: başlıkta platform ve kullanici sütunları varsa onlardan; yoksa her satırın ilk alanı, verilen platformla. */
export function parseFollowerCsv(text: string, fallback: Platform): FollowerEntry[] {
  const rows = parseCsv(text.replace(/^﻿/, ""));
  const header = rows[0]?.map((h) => h.trim().toLocaleLowerCase("tr")) ?? [];
  const [pi, ki, ai] = ["platform", "kullanici", "ad"].map((name) => header.indexOf(name));
  if (ki < 0) return unique(fallback, rows.map((r) => r[0] ?? ""));
  const out: FollowerEntry[] = [];
  const seen = new Set<string>();
  for (const row of rows.slice(1)) {
    const platform = (pi >= 0 ? row[pi]?.trim().toLowerCase() : fallback) as Platform;
    const handle = clean(row[ki] ?? "");
    if (!PLATFORMS.includes(platform) || !VALID.test(handle)) continue;
    const key = `${platform}:${handle.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ platform, handle, displayName: (ai >= 0 ? row[ai]?.trim() : "") || handle });
  }
  return out;
}

// ── Dosya türünü tanıma ─────────────────────────────────────────────

const NOT_FOLLOWERS = "Bu bir takipçi listesi değil; hiçbir şey eklenmedi.";

/** Dosya adı takipçi dışı bir liste mi söylüyor? (takip ettiklerin, istekler, ziyaretçiler, engellenenler) */
function otherListByName(lower: string): string | null {
  const base = lower.split("/").pop() ?? lower;
  if (/following|takip_edilen|takip edilen/.test(base)) return "Takip ettiğin hesaplar";
  if (/request|istek/.test(base)) return "Takip istekleri";
  if (/view|ziyaret/.test(base)) return "Profil ziyaretçileri";
  if (/block|engel/.test(base)) return "Engellenenler";
  return null;
}

/** TikTok "Verilerini indir" JSON'u mu? (takipçisi olmasa da tanınsın) */
const isTikTokExport = (data: unknown) =>
  !!data && typeof data === "object" && !Array.isArray(data) && ["Profile And Settings", "Profile", "Activity", "Your Activity", "Comment", "Video"].some((k) => k in (data as Record<string, unknown>));

/** Dosyayı adından ve içeriğinden tanıyıp kullanıcı adlarını çıkarır. `platform` CSV ve düz liste için varsayılandır. */
export function parseFollowerFile(name: string, text: string, platform: Platform): ParsedFile {
  const lower = name.toLowerCase();
  const trimmed = text.replace(/^﻿/, "").trimStart();
  const other = otherListByName(lower);
  if (lower.endsWith(".json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      return { kind: "Okunamayan JSON", entries: [], skipped: 0, note: "Dosya yarım inmiş ya da bozuk olabilir; yeniden indirip dene." };
    }
    const record = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
    // Instagram ZIP'inde followers_1.json'un yanında duran öbür listeler takipçi sanılmasın.
    if ("relationships_following" in record) return { kind: "Instagram: takip ettiğin hesaplar (following.json)", entries: [], skipped: 0, note: `${NOT_FOLLOWERS} Takipçiler followers_1.json dosyasında.` };
    if (Object.keys(record).some((k) => /follow_requests|pending/.test(k)) || (Array.isArray(data) && (data as Record<string, unknown>[]).some((i) => i && typeof i === "object" && "label_values" in i)))
      return { kind: "Instagram: takip istekleri", entries: [], skipped: 0, note: `${NOT_FOLLOWERS} Takipçiler followers_1.json dosyasında.` };
    if (other && !/follower/.test(lower.replace(/following/g, ""))) return { kind: `${other} (${name.split("/").pop()})`, entries: [], skipped: 0, note: NOT_FOLLOWERS };
    const tiktok = parseTikTokJson(data);
    if (tiktok.length || isTikTokExport(data) || platform === "tiktok") {
      const entries = unique("tiktok", tiktok);
      return { kind: "TikTok verileri (JSON)", entries, skipped: tiktok.length - entries.length, note: entries.length ? undefined : "Bu dosyada takipçi yok (henüz takipçin yoksa normal)." };
    }
    const instagram = parseInstagramJson(data);
    const entries = unique("instagram", instagram);
    return { kind: "Instagram takipçileri (JSON)", entries, skipped: instagram.length - entries.length, note: entries.length ? undefined : "Bu dosyada takipçi bulunamadı. Instagram'da followers_1.json dosyasını seç." };
  }
  if (other) return { kind: `${other} (${name.split("/").pop()})`, entries: [], skipped: 0, note: NOT_FOLLOWERS };
  if (lower.endsWith(".html") || /<html|<a\s/i.test(trimmed.slice(0, 2000))) {
    const handles = parseInstagramHtml(text);
    const entries = unique("instagram", handles);
    return { kind: "Instagram takipçileri (HTML)", entries, skipped: handles.length - entries.length };
  }
  if (/User\s*name:/i.test(text)) {
    const handles = parseTikTokText(text);
    const entries = unique("tiktok", handles);
    return { kind: "TikTok takipçi listesi (TXT)", entries, skipped: handles.length - entries.length };
  }
  const entries = parseFollowerCsv(text, platform);
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).length;
  return { kind: lower.endsWith(".csv") ? "CSV" : "Liste", entries, skipped: Math.max(0, lines - entries.length - 1) };
}

// ── ZIP (indirilen dosya olduğu gibi) ──────────────────────────────

/** ZIP içinde takipçi listesi olan dosyalar: Instagram followers_N, TikTok user_data / Follower TXT. */
const FOLLOWER_FILE = /(^|\/)(followers(_\d+)?\.(json|html?)|user_data(_tiktok)?\.json|follower( list)?\.txt|fans\.txt)$/i;

export interface ReadFile {
  /** Gösterilecek ad (ZIP içindeyse "arsiv.zip → connections/…/followers_1.json"). */
  name: string;
  parsed: ParsedFile;
}

/**
 * Seçilen dosyayı okur: ZIP ise içindeki takipçi dosyalarını bulup her birini ayrıştırır, değilse dosyanın kendisini.
 * Panel (tarayıcı) ve komut satırı ortak kullanır; dosyanın baytlarını alır.
 */
export async function readFollowerFile(name: string, bytes: Uint8Array, platform: Platform): Promise<ReadFile[]> {
  if (!isZip(bytes)) return [{ name, parsed: parseFollowerFile(name, new TextDecoder().decode(bytes), platform) }];
  let inner;
  try {
    inner = listZip(bytes).filter((e) => FOLLOWER_FILE.test(e.name));
  } catch (error) {
    return [{ name, parsed: { kind: "ZIP", entries: [], skipped: 0, note: (error as Error).message } }];
  }
  if (inner.length === 0) {
    return [
      {
        name,
        parsed: {
          kind: "ZIP: takipçi dosyası yok",
          entries: [],
          skipped: 0,
          note: "İçinde followers_1.json (Instagram) ya da user_data_tiktok.json (TikTok) bulunamadı. Instagram'da \"Takipçiler ve takip edilenler\" bölümünü, TikTok'ta \"Profil\" verilerini seçtiğinden emin ol.",
        },
      },
    ];
  }
  const out: ReadFile[] = [];
  for (const entry of inner) {
    let parsed: ParsedFile;
    try {
      parsed = parseFollowerFile(entry.name, await entry.text(), platform);
    } catch (error) {
      parsed = { kind: "Açılamadı", entries: [], skipped: 0, note: (error as Error).message };
    }
    out.push({ name: `${name} → ${entry.name}`, parsed });
  }
  return out;
}

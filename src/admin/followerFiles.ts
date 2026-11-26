/**
 * TAKİPÇİ DOSYALARI — platformların "verilerini indir" dosyalarından ve CSV'den kullanıcı adlarını çıkarır.
 *
 * Saf fonksiyonlardır: hem tarayıcıda (yönetim paneli dosyayı orada okur, sunucuya yalnızca adlar gider) hem de
 * komut satırında (npm run takipci:ekle) çalışır.
 *
 *   Instagram  followers_1.json (JSON) ya da followers_1.html (HTML): "Bilgilerini indir → Takipçiler ve takip edilenler"
 *   TikTok     user_data_tiktok.json / user_data.json (JSON) ya da "Follower List.txt" (TXT): "Verilerini indir"
 *   CSV        platform,kullanici[,ad] (ilk satır başlık) ya da her satırda bir kullanıcı adı
 */
import { PLATFORMS, type Platform } from "../types";

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
    const key = handle.toLocaleLowerCase("tr");
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
    const key = `${platform}:${handle.toLocaleLowerCase("tr")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ platform, handle, displayName: (ai >= 0 ? row[ai]?.trim() : "") || handle });
  }
  return out;
}

// ── Dosya türünü tanıma ─────────────────────────────────────────────

/** Dosyayı adından ve içeriğinden tanıyıp kullanıcı adlarını çıkarır. `platform` CSV ve düz liste için varsayılandır. */
export function parseFollowerFile(name: string, text: string, platform: Platform): ParsedFile {
  const lower = name.toLowerCase();
  const trimmed = text.trimStart();
  if (lower.endsWith(".json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return { kind: "Okunamayan JSON", entries: [], skipped: 0 };
    }
    const tiktok = parseTikTokJson(data);
    if (tiktok.length || platform === "tiktok") {
      const entries = unique("tiktok", tiktok);
      return { kind: "TikTok verileri (JSON)", entries, skipped: tiktok.length - entries.length };
    }
    const instagram = parseInstagramJson(data);
    const entries = unique("instagram", instagram);
    return { kind: "Instagram takipçileri (JSON)", entries, skipped: instagram.length - entries.length };
  }
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

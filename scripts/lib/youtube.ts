/**
 * YOUTUBE — kanalın videolarını ve yorumlarını YouTube Data API v3 ile okur (yalnızca okuma, API anahtarıyla).
 *
 * Kullanan: scripts/fetch-youtube-comments.ts (npm run youtube:yorumlar) ve yönetim paneli (/__yonetim/youtube*).
 * Anahtar ve kanal `.env.local` dosyasından ya da ortam değişkenlerinden okunur (git'e girmez):
 *   YOUTUBE_API_KEY=...        Google Cloud Console → YouTube Data API v3 → API anahtarı
 *   YOUTUBE_KANAL=OBA-tales    kanalın @ kullanıcı adı (@ olmadan)
 *
 * Kota: her istek 1 birim, günlük sınır 10.000. Son 10 videonun yorumları ≈ 20–40 birim tutar.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { FollowerEntry } from "../../src/admin/followerFiles";
import { cleanPlaceName, isNewerOrSame, parseNameCommand, placeCandidate } from "../../src/lib/heroNames";

/** .env.local içindeki ANAHTAR=değer satırları (ortam değişkenleri önce gelir, dosya onları ezmez). */
export function readEnv(file = resolve(".env.local")): Record<string, string> {
  const env: Record<string, string> = {};
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  return env;
}

export interface YoutubeSettings {
  key: string;
  channel: string;
}

/** Anahtar yoksa null. */
export function youtubeSettings(env: Record<string, string> = readEnv()): YoutubeSettings | null {
  const key = env.YOUTUBE_API_KEY?.trim();
  if (!key) return null;
  return { key, channel: (env.YOUTUBE_KANAL?.trim() || "OBA-tales").replace(/^@/, "") };
}

export interface YoutubeVideo {
  id: string;
  title: string;
  at: string;
}

export interface YoutubeComment {
  id: string;
  videoId: string;
  /** Kullanıcı adı (@ olmadan, harita kuralına uygun: Türkçe harfler düz yazılır). */
  handle: string;
  /** YouTube'da görünen ad (ör. "@kara-şahin"). */
  displayName: string;
  text: string;
  likes: number;
  at: string;
}

type Fetcher = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }>;

const API = "https://www.googleapis.com/youtube/v3";

class YoutubeError extends Error {
  readonly status: number;
  readonly reason: string;
  constructor(status: number, reason: string, message: string) {
    super(message);
    this.status = status;
    this.reason = reason;
  }
}

async function get<T>(settings: YoutubeSettings, path: string, params: Record<string, string>, fetcher: Fetcher): Promise<T> {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries({ ...params, key: settings.key })) url.searchParams.set(k, v);
  const response = await fetcher(url.toString());
  if (!response.ok) {
    const body = await response.text();
    const reason = /"reason"\s*:\s*"([^"]+)"/.exec(body)?.[1] ?? "";
    const hint =
      reason === "quotaExceeded"
        ? "Günlük YouTube kotası doldu; yarın yeniden dene."
        : reason === "keyInvalid" || response.status === 400
          ? "API anahtarı geçersiz görünüyor (.env.local → YOUTUBE_API_KEY)."
          : reason === "accessNotConfigured"
            ? "Google Cloud projesinde YouTube Data API v3 etkin değil."
            : body.slice(0, 200);
    throw new YoutubeError(response.status, reason, `YouTube API ${response.status}: ${hint}`);
  }
  return (await response.json()) as T;
}

/** YouTube kullanıcı adını harita kuralına uydurur: "@Kara-Şahin" → "kara-sahin" (Türkçe harfler düz). */
export function asciiHandle(raw: string): string {
  return raw
    .replace(/^@+/, "")
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 30);
}

interface ChannelList {
  items?: { contentDetails: { relatedPlaylists: { uploads: string } } }[];
}
interface PlaylistItems {
  items?: { snippet?: { title?: string }; contentDetails: { videoId: string; videoPublishedAt?: string } }[];
}
interface CommentThreads {
  nextPageToken?: string;
  items?: {
    id: string;
    snippet: {
      videoId?: string;
      topLevelComment: { snippet: { authorDisplayName: string; authorChannelUrl?: string; textOriginal: string; likeCount?: number; publishedAt: string; updatedAt?: string } };
    };
  }[];
}

/** Kanalın son videoları (Shorts dahil), yeniden eskiye. Hiç herkese açık videosu olmayan kanalda boş liste. */
export async function channelVideos(settings: YoutubeSettings, max = 10, fetcher: Fetcher = fetch): Promise<YoutubeVideo[]> {
  const channels = await get<ChannelList>(settings, "channels", { part: "contentDetails", forHandle: settings.channel }, fetcher);
  const uploads = channels.items?.[0]?.contentDetails.relatedPlaylists.uploads;
  if (!uploads) throw new Error(`Kanal bulunamadı: @${settings.channel} (.env.local → YOUTUBE_KANAL)`);
  let list: PlaylistItems;
  try {
    list = await get<PlaylistItems>(settings, "playlistItems", { part: "snippet,contentDetails", playlistId: uploads, maxResults: String(Math.min(50, Math.max(1, max))) }, fetcher);
  } catch (error) {
    // Videosu olmayan kanalın "yüklenenler" listesi YouTube'da henüz yoktur (404 playlistNotFound).
    if (error instanceof YoutubeError && (error.reason === "playlistNotFound" || error.status === 404)) return [];
    throw error;
  }
  return (list.items ?? []).map((i) => ({ id: i.contentDetails.videoId, title: i.snippet?.title ?? i.contentDetails.videoId, at: i.contentDetails.videoPublishedAt ?? "" }));
}

/**
 * Bir videonun üst düzey yorumları. order "time" yeniden eskiye (katılım için), "relevance" YouTube'un "En iyi
 * yorumlar" sırası (ad koyma oylaması için). Yorumları kapalı videoda boş liste döner.
 */
export async function videoComments(settings: YoutubeSettings, videoId: string, { limit = 1000, order = "time" }: { limit?: number; order?: "time" | "relevance" } = {}, fetcher: Fetcher = fetch): Promise<YoutubeComment[]> {
  const out: YoutubeComment[] = [];
  let pageToken: string | undefined;
  do {
    let page: CommentThreads;
    try {
      page = await get<CommentThreads>(settings, "commentThreads", { part: "snippet", videoId, maxResults: "100", order, textFormat: "plainText", ...(pageToken ? { pageToken } : {}) }, fetcher);
    } catch (error) {
      if (error instanceof YoutubeError && (error.reason === "commentsDisabled" || error.status === 404)) return out;
      throw error;
    }
    for (const item of page.items ?? []) {
      const s = item.snippet.topLevelComment.snippet;
      const fromUrl = s.authorChannelUrl ? /\/@([^/?#]+)/.exec(s.authorChannelUrl)?.[1] : undefined;
      const raw = fromUrl ? decodeURIComponent(fromUrl) : s.authorDisplayName;
      const handle = asciiHandle(raw);
      if (!handle) continue;
      out.push({ id: item.id, videoId: item.snippet.videoId ?? videoId, handle, displayName: s.authorDisplayName, text: s.textOriginal, likes: s.likeCount ?? 0, at: s.updatedAt ?? s.publishedAt });
    }
    pageToken = page.nextPageToken;
  } while (pageToken && out.length < limit);
  return out.slice(0, limit);
}

/** Kanalın son videolarındaki yorumlar (katılım için). */
export async function channelComments(settings: YoutubeSettings, { videos = 10, limit = 2000 }: { videos?: number; limit?: number } = {}, fetcher: Fetcher = fetch): Promise<{ videos: YoutubeVideo[]; comments: YoutubeComment[] }> {
  const list = await channelVideos(settings, videos, fetcher);
  const comments: YoutubeComment[] = [];
  for (const video of list) {
    if (comments.length >= limit) break;
    comments.push(...(await videoComments(settings, video.id, { limit: limit - comments.length }, fetcher)));
  }
  return { videos: list, comments };
}

/** Yorumlardan takipçi girdileri: kişi başına bir kayıt; ad komutlarından en yenisi tutulur. */
export function commentEntries(comments: readonly YoutubeComment[]): FollowerEntry[] {
  const out: FollowerEntry[] = [];
  const index = new Map<string, number>();
  for (const c of comments) {
    const heroName = parseNameCommand(c.text) ?? undefined;
    const known = index.get(c.handle);
    if (known !== undefined) {
      const prev = out[known];
      if (heroName && (!prev.heroName || isNewerOrSame(c.at, prev.at))) out[known] = { ...prev, heroName, at: c.at };
      continue;
    }
    index.set(c.handle, out.length);
    out.push({ platform: "youtube", handle: c.handle, displayName: c.displayName || c.handle, ...(heroName ? { heroName, at: c.at } : {}) });
  }
  return out;
}

export interface VoteCandidate {
  name: string;
  handle: string;
  displayName: string;
  likes: number;
  text: string;
}

/**
 * Ad koyma oylaması: yorumların önerdiği adlar, beğeniye göre (eşitlikte önce yazan). Aynı ad birden çok kez
 * önerildiyse en çok beğenileni kalır. Uygunsuz ya da cümle olan yorumlar aday olmaz.
 */
export function voteCandidates(comments: readonly YoutubeComment[], max = 15): VoteCandidate[] {
  const seen = new Set<string>();
  const out: VoteCandidate[] = [];
  const sorted = [...comments].sort((a, b) => b.likes - a.likes || Date.parse(a.at) - Date.parse(b.at));
  for (const c of sorted) {
    const raw = placeCandidate(c.text);
    const check = raw ? cleanPlaceName(raw) : null;
    if (!check?.ok) continue;
    const key = check.name.toLocaleLowerCase("tr");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: check.name, handle: c.handle, displayName: c.displayName, likes: c.likes, text: c.text });
    if (out.length >= max) break;
  }
  return out;
}

const csvField = (value: string) => `"${value.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;

/** CSV (veri/girdi/youtube-yorumlar.csv): platform,kullanici,ad,yorum,video,tarih,begeni */
export function commentsCsv(comments: readonly YoutubeComment[]): string {
  const rows = ["platform,kullanici,ad,yorum,video,tarih,begeni"];
  for (const c of comments) rows.push(["youtube", c.handle, c.displayName, c.text, c.videoId, c.at, String(c.likes)].map(csvField).join(","));
  return `﻿${rows.join("\n")}\n`;
}

/**
 * YouTube yorumlarını CSV'ye indirir: `npm run youtube:yorumlar`
 *
 * Kanalın son videolarındaki yorumları YouTube Data API v3 ile okur ve `veri/girdi/youtube-yorumlar.csv`
 * dosyasına yazar (platform,kullanici,ad,yorum,video). Sonra `npm run takipci:ekle` yorum yapanları haritaya ekler.
 *
 * Gerekenler (`.env.local` dosyasına, git'e girmez):
 *   YOUTUBE_API_KEY=...        Google Cloud Console → YouTube Data API v3 → API anahtarı (yalnızca okuma)
 *   YOUTUBE_KANAL=OBA-tales    kanalın @ kullanıcı adı (@ olmadan)
 *
 * Seçenekler: --video-sayisi 10 (son kaç video), --yorum-sinir 2000 (en fazla kaç yorum)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    "video-sayisi": { type: "string", default: "10" },
    "yorum-sinir": { type: "string", default: "2000" },
  },
});

/** .env.local içindeki ANAHTAR=değer satırlarını okur (yalnızca bu betik için). */
function readEnv(): Record<string, string> {
  const file = resolve(".env.local");
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  if (!existsSync(file)) return env;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = readEnv();
const KEY = env.YOUTUBE_API_KEY;
const CHANNEL = (env.YOUTUBE_KANAL ?? "OBA-tales").replace(/^@/, "");
if (!KEY) {
  console.error("YOUTUBE_API_KEY bulunamadı. .env.local dosyasına YOUTUBE_API_KEY=... satırını ekle (ayrıntı: docs/hesaplar.md).");
  process.exit(1);
}

const API = "https://www.googleapis.com/youtube/v3";
async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries({ ...params, key: KEY! })) url.searchParams.set(k, v);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`YouTube API ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return (await response.json()) as T;
}

interface ChannelList {
  items?: { contentDetails: { relatedPlaylists: { uploads: string } } }[];
}
interface PlaylistItems {
  items: { contentDetails: { videoId: string } }[];
}
interface CommentThreads {
  nextPageToken?: string;
  items: { snippet: { topLevelComment: { snippet: { authorDisplayName: string; textOriginal: string } } } }[];
}

const csvField = (value: string) => `"${value.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;

const channels = await get<ChannelList>("channels", { part: "contentDetails", forHandle: CHANNEL });
const uploads = channels.items?.[0]?.contentDetails.relatedPlaylists.uploads;
if (!uploads) throw new Error(`Kanal bulunamadı: @${CHANNEL}`);
const videos = await get<PlaylistItems>("playlistItems", { part: "contentDetails", playlistId: uploads, maxResults: String(Math.min(50, Number(args["video-sayisi"]))) });

const limit = Number(args["yorum-sinir"]);
const rows: string[] = ["platform,kullanici,ad,yorum,video"];
const seen = new Set<string>();
for (const { contentDetails } of videos.items) {
  let pageToken: string | undefined;
  do {
    const page = await get<CommentThreads>("commentThreads", { part: "snippet", videoId: contentDetails.videoId, maxResults: "100", textFormat: "plainText", ...(pageToken ? { pageToken } : {}) });
    for (const item of page.items) {
      const { authorDisplayName, textOriginal } = item.snippet.topLevelComment.snippet;
      const handle = authorDisplayName.replace(/^@/, "");
      rows.push(["youtube", handle, authorDisplayName, textOriginal, contentDetails.videoId].map(csvField).join(","));
      seen.add(handle.toLowerCase());
    }
    pageToken = page.nextPageToken;
  } while (pageToken && rows.length <= limit);
  if (rows.length > limit) break;
}

mkdirSync(resolve("veri/girdi"), { recursive: true });
const out = resolve("veri/girdi/youtube-yorumlar.csv");
writeFileSync(out, `﻿${rows.join("\n")}\n`, "utf8");
console.log(`✔ ${rows.length - 1} yorum, ${seen.size} farklı kişi, ${videos.items.length} video → ${out}`);
console.log("Sıradaki adım: npm run takipci:ekle");

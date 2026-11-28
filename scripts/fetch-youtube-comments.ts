/**
 * YouTube yorumlarını CSV'ye indirir: `npm run youtube:yorumlar`
 *
 * Kanalın son videolarındaki yorumları YouTube Data API v3 ile okur ve `veri/girdi/youtube-yorumlar.csv`
 * dosyasına yazar (platform,kullanici,ad,yorum,video,tarih,begeni). Sonra `npm run takipci:ekle` yorum yapanları
 * haritaya ekler; yorumunda "ad: Kara Şahin" yazan kişi o adla doğar (src/lib/heroNames.ts).
 * Aynı işi tıklayarak yapmak için: `npm run dev` → /yonetim → "YouTube yorumlarından çek".
 *
 * Gerekenler (`.env.local` dosyasına, git'e girmez):
 *   YOUTUBE_API_KEY=...        Google Cloud Console → YouTube Data API v3 → API anahtarı (yalnızca okuma)
 *   YOUTUBE_KANAL=OBA-tales    kanalın @ kullanıcı adı (@ olmadan)
 *
 * Seçenekler: --video-sayisi 10 (son kaç video), --yorum-sinir 2000 (en fazla kaç yorum)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { channelComments, commentEntries, commentsCsv, youtubeSettings } from "./lib/youtube";

const { values: args } = parseArgs({
  options: {
    "video-sayisi": { type: "string", default: "10" },
    "yorum-sinir": { type: "string", default: "2000" },
  },
});

const settings = youtubeSettings();
if (!settings) {
  console.error("YOUTUBE_API_KEY bulunamadı. .env.local dosyasına YOUTUBE_API_KEY=... satırını ekle (ayrıntı: docs/hesaplar.md).");
  process.exit(1);
}

const { videos, comments } = await channelComments(settings, { videos: Number(args["video-sayisi"]), limit: Number(args["yorum-sinir"]) });
if (videos.length === 0) {
  console.log(`Anahtar çalışıyor ama @${settings.channel} kanalında henüz herkese açık video yok; okunacak yorum yok. İlk video yüklenince yeniden çalıştır.`);
  process.exit(0);
}
mkdirSync(resolve("veri/girdi"), { recursive: true });
const out = resolve("veri/girdi/youtube-yorumlar.csv");
writeFileSync(out, commentsCsv(comments), "utf8");
const entries = commentEntries(comments);
console.log(`✔ ${comments.length} yorum, ${entries.length} farklı kişi (${entries.filter((e) => e.heroName).length} kişi ad yazmış), ${videos.length} video → ${out}`);
console.log("Sıradaki adım: npm run takipci:ekle");

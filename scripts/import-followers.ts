/**
 * Gerçek takipçileri haritaya ekler: `npm run takipci:ekle`
 * (Aynı işi tıklayarak yapmak için: `npm run dev` → http://localhost:5173/yonetim)
 *
 * `veri/girdi/` klasöründeki dosyaları okur ve `public/data/roster.json`'a işler:
 *   · Instagram  followers_1.json / followers_1.html ("Bilgilerini indir → Takipçiler ve takip edilenler")
 *   · TikTok     user_data_tiktok.json / user_data.json / "Follower List.txt" ("Verilerini indir")
 *   · CSV        platform,kullanici[,ad] (ilk satır başlık). `npm run youtube:yorumlar` YouTube yorumlarından üretir.
 *   · Düz liste  her satırda bir kullanıcı adı; platform dosya adından (ör. youtube-aboneler.txt)
 * Nasıl indirileceği: docs/hesaplar.md
 *
 * Kurallar (scripts/lib/followers.ts): yeni kişi Kut Kapısı'nın önünde doğar; başka platformdan da gelen kişiye o
 * platform eklenir (çift iz rozeti ve nadirlik bonusu).
 *
 * Seçenekler:
 *   --kuru       hiçbir şey yazmadan ne olacağını gösterir
 *   --sifirla    örnek (sahte) takipçileri siler, yalnızca dosyalardakilerle başlar (ilk gerçek yayından önce bir kez)
 *   --cikar ad1,ad2   bu kullanıcı adlarını haritadan çıkarır (çıkmak isteyenler için)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { parseFollowerFile, type FollowerEntry } from "../src/admin/followerFiles";
import type { Platform } from "../src/types";
import { applyEntries, removeHandles, saveRoster } from "./lib/followers";

const { values: args } = parseArgs({
  options: {
    kuru: { type: "boolean", default: false },
    sifirla: { type: "boolean", default: false },
    cikar: { type: "string" },
    girdi: { type: "string", default: "veri/girdi" },
  },
});

const INPUT = resolve(args.girdi);
const guessPlatform = (name: string): Platform => (/tiktok/i.test(name) ? "tiktok" : /youtube|yt/i.test(name) ? "youtube" : "instagram");

if (args.cikar) {
  const { roster, removed, missing } = removeHandles(args.cikar.split(","));
  console.log(`Çıkarılan: ${removed.length ? removed.join(", ") : "yok"}${missing.length ? ` · bulunamayan: ${missing.join(", ")}` : ""}`);
  if (args.kuru) console.log("Kuru deneme: hiçbir dosya yazılmadı.");
  else if (removed.length) {
    const cleaned = saveRoster(roster);
    console.log(`✔ Yazıldı${cleaned ? ` (${cleaned} yer adı temizlendi)` : ""}. Kontrol: npm run data:check`);
  }
  process.exit(0);
}

function readEntries(): FollowerEntry[] {
  if (!existsSync(INPUT)) {
    mkdirSync(INPUT, { recursive: true });
    console.log(`Girdi klasörü oluşturuldu: ${INPUT}\nDosyaları buraya koyup komutu yeniden çalıştır.`);
    return [];
  }
  const entries: FollowerEntry[] = [];
  for (const file of readdirSync(INPUT).filter((f) => /\.(csv|json|html|txt)$/i.test(f))) {
    const parsed = parseFollowerFile(file, readFileSync(resolve(INPUT, file), "utf8"), guessPlatform(file));
    console.log(`  ${file}: ${parsed.kind}, ${parsed.entries.length} kişi${parsed.skipped ? ` (${parsed.skipped} atlandı)` : ""}`);
    entries.push(...parsed.entries);
  }
  return entries;
}

console.log("OBA-Tales takipçi içe aktarımı");
const entries = readEntries();
const result = applyEntries(entries, { reset: args.sifirla });
console.log(`  girdi:        ${entries.length} kişi (${INPUT})`);
console.log(`  yeni yoldaş:  ${result.added.length} (Kutada'da, Kut Kapısı'nın önünde)`);
console.log(`  çift iz:      ${result.linked.length} (yeni platform eklendi)`);
if (result.skipped.length) console.log(`  atlanan:      ${result.skipped.length} geçersiz kullanıcı adı: ${result.skipped.slice(0, 8).join(", ")}${result.skipped.length > 8 ? "…" : ""}`);
console.log(`  toplam:       ${result.before}${args.sifirla ? " (sıfırlandı)" : ""} → ${result.roster.characters.length}`);

if (args.kuru) {
  console.log("Kuru deneme: hiçbir dosya yazılmadı.");
} else {
  const cleaned = saveRoster(result.roster);
  if (cleaned) console.log(`  temizlendi:   ${cleaned} yer adı (koyanı artık yok)`);
  console.log("✔ Yazıldı. Kontrol: npm run data:check");
}

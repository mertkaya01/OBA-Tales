/**
 * YÖNETİM PANELİ — /yonetim (yalnızca `npm run dev` ile, bu bilgisayarda; yayın sürümünde bu sayfa yoktur).
 *
 *   · Durum: haritadaki takipçi sayısı, platform ve nadirlik dağılımı
 *   · Takipçi ekle: Instagram ve TikTok "verilerini indir" dosyaları, YouTube yorumları, CSV ya da elle liste
 *     (dosya tarayıcıda okunur; sunucuya yalnızca kullanıcı adları gider). Önce önizleme, sonra "Haritaya ekle".
 *   · Haritadan çıkar: çıkmak isteyen kişiler için
 *   · Sıfırla: örnek (sahte) takipçileri siler; "SIFIRLA" yazarak onaylanır
 *   · Yayına al: değişiklikler public/data/ içine yazılır; git ile commit + push yapınca site güncellenir
 * Uç noktalar: scripts/yonetimPlugin.ts · kurallar: scripts/lib/followers.ts · dosya okuyucular: src/admin/followerFiles.ts
 */
import { Download, FileUp, RefreshCw, ShieldAlert, Trash2, UserMinus, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { parseFollowerFile, type FollowerEntry, type ParsedFile } from "../admin/followerFiles";
import { SectionTitle } from "../components/ui/SectionTitle";
import { PLATFORM_LABELS } from "../content/classes";
import { RARITY_INFO } from "../content/rarities";
import { formatNumber } from "../lib/text";
import { PLATFORMS, type Platform, type Rarity } from "../types";

interface Summary {
  total: number;
  generatedAt: string;
  byPlatform: Record<string, number>;
  byRarity: Record<string, number>;
  multiPlatform: number;
  newcomers: number;
}
interface Status {
  summary: Summary;
  youtube: { key: boolean; channel: string | null };
}
interface ImportReport {
  written: boolean;
  before: number;
  after: number;
  added: string[];
  linked: string[];
  skipped: string[];
  cleaned: number;
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/__yonetim${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json", "X-Yonetim": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Hata ${response.status}`);
  return data;
}

function Card({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-gece-900/70 p-5">
      <h2 className="mb-3 flex items-center gap-2 font-display text-xl text-buz-50">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

const button = "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const primary = `${button} bg-gunozu-400 text-gece-900 hover:bg-gunozu-300`;
const secondary = `${button} border border-white/15 text-buz-100 hover:bg-white/10`;
const danger = `${button} bg-alev-500 text-white hover:bg-alev-400`;

/** Platformdan takipçi listesinin nasıl alınacağı. Menü adları uygulama sürümüne göre biraz değişebilir. */
const GUIDES: Readonly<Record<Platform, { title: string; steps: string[]; file: string; accept: string }>> = {
  instagram: {
    title: "Instagram: takipçi listesini indir",
    steps: [
      "Instagram uygulamasında profil → sağ üstteki ☰ menü → Hesap Merkezi.",
      "Bilgilerin ve izinler → Bilgilerini indir → Bilgileri indir veya aktar → OBA-Tales hesabını seç.",
      "\"Bilgilerinin bir kısmı\" → yalnızca \"Takipçiler ve takip edilenler\" kutusunu işaretle → Cihaza indir.",
      "Tarih aralığı: Tüm zamanlar · Biçim: JSON → Dosya oluştur. Hazır olunca e-posta gelir (birkaç dakika–birkaç saat).",
      "İndirdiğin ZIP'i aç: connections/followers_and_following/followers_1.json (çok takipçin varsa followers_2.json … da var).",
      "O dosyayı (dosyaları) aşağıdan seç.",
    ],
    file: "followers_1.json ya da followers_1.html",
    accept: ".json,.html,.htm,.csv,.txt",
  },
  tiktok: {
    title: "TikTok: takipçi listesini indir",
    steps: [
      "TikTok uygulamasında profil → ☰ menü → Ayarlar ve gizlilik → Hesap → Verilerini indir.",
      "\"Veri iste\" sekmesinde biçim olarak JSON'u seç (TXT de olur) → Veri iste.",
      "Hazırlanması birkaç saat ile birkaç gün sürebilir; hazır olunca \"Verileri indir\" sekmesinden indir.",
      "ZIP'i aç: user_data_tiktok.json (ya da user_data.json). TXT seçtiysen \"Follower List.txt\".",
      "O dosyayı aşağıdan seç: içinden yalnızca takipçilerin kullanıcı adları alınır, gerisi okunmaz.",
    ],
    file: "user_data_tiktok.json ya da Follower List.txt",
    accept: ".json,.txt,.csv",
  },
  youtube: {
    title: "YouTube: aboneler ve yorum yapanlar",
    steps: [
      "YouTube abone listesinin tamamını vermez. Yalnızca aboneliğini herkese açık yapanlar YouTube Studio → Pano → \"Son aboneler\" → \"Tümünü gör\" içinde görünür.",
      "Yol 1: o listedeki kullanıcı adlarını bir metin dosyasına alt alta yaz (youtube-aboneler.txt) ve aşağıdan seç.",
      "Yol 2: yorum yapanları otomatik çek. Google Cloud Console → yeni proje → YouTube Data API v3'ü etkinleştir → Kimlik bilgileri → API anahtarı oluştur.",
      ".env.local dosyasına iki satır ekle: YOUTUBE_API_KEY=anahtarın ve YOUTUBE_KANAL=kanal-adın (@ olmadan). Sonra \"Yorumlardan çek\".",
    ],
    file: "youtube-aboneler.txt ya da .csv",
    accept: ".txt,.csv",
  },
};

function PlatformImport({ platform, youtube, onPreview }: { platform: Platform; youtube: Status["youtube"] | null; onPreview: (title: string, entries: FollowerEntry[]) => void }) {
  const guide = GUIDES[platform];
  const [files, setFiles] = useState<{ name: string; parsed: ParsedFile }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const read = async (list: FileList | null) => {
    setError(null);
    const parsed = await Promise.all([...(list ?? [])].map(async (file) => ({ name: file.name, parsed: parseFollowerFile(file.name, await file.text(), platform) })));
    setFiles(parsed);
    const entries = parsed.flatMap((p) => p.parsed.entries);
    if (entries.length) onPreview(`${PLATFORM_LABELS[platform]} · ${parsed.map((p) => p.name).join(", ")}`, entries);
    else setError("Dosyada kullanıcı adı bulunamadı. Doğru dosyayı seçtiğinden emin ol.");
  };

  const fromComments = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ entries: FollowerEntry[] }>("/youtube", {});
      onPreview("YouTube yorumları", result.entries);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="group rounded-xl border border-white/10 bg-white/5 p-4 open:bg-white/[0.07]">
      <summary className="cursor-pointer font-semibold text-buz-50">{guide.title}</summary>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-buz-200">
        {guide.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className={secondary}>
          <FileUp aria-hidden className="size-4" />
          Dosya seç ({guide.file})
          <input type="file" multiple accept={guide.accept} className="sr-only" onChange={(e) => void read(e.target.files)} />
        </label>
        {platform === "youtube" && (
          <button type="button" className={secondary} disabled={busy || !youtube?.key} onClick={() => void fromComments()}>
            <Download aria-hidden className="size-4" />
            {busy ? "Çekiliyor…" : "Yorumlardan çek"}
          </button>
        )}
        {platform === "youtube" && !youtube?.key && <span className="text-xs text-buz-300">.env.local içinde YOUTUBE_API_KEY yok</span>}
      </div>
      {files.map((f) => (
        <p key={f.name} className="mt-2 text-xs text-buz-300">
          {f.name}: {f.parsed.kind}, {formatNumber(f.parsed.entries.length)} kişi{f.parsed.skipped ? ` (${f.parsed.skipped} atlandı)` : ""}
        </p>
      ))}
      {error && <p className="mt-2 text-sm text-alev-300">{error}</p>}
    </details>
  );
}

export default function AdminPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState<{ title: string; entries: FollowerEntry[] } | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");
  const [manualPlatform, setManualPlatform] = useState<Platform>("instagram");
  const [remove, setRemove] = useState("");
  const [confirm, setConfirm] = useState("");
  const [check, setCheck] = useState<{ ok: boolean; output: string } | null>(null);

  const refresh = useCallback(() => {
    api<Status>("/durum")
      .then((s) => {
        setStatus(s);
        setOffline(false);
      })
      .catch(() => setOffline(true));
  }, []);
  useEffect(refresh, [refresh]);

  const preview = async (title: string, entries: FollowerEntry[]) => {
    setPending({ title, entries });
    setMessage(null);
    try {
      setReport(await api<ImportReport>("/onizle", { entries }));
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    try {
      setMessage(await action());
      refresh();
    } catch (e) {
      setMessage(`Hata: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  if (offline) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <SectionTitle as="h1" eyebrow="Yönetim" title="Panel kapalı" description="Yönetim paneli yalnızca bilgisayarında, geliştirme sunucusuyla çalışır." />
        <pre className="mt-4 rounded-xl bg-black/40 p-3 text-sm text-buz-100">npm run dev</pre>
        <p className="mt-2 text-sm text-buz-300">Sonra tarayıcıda http://localhost:5173/yonetim adresini aç.</p>
      </div>
    );
  }

  const s = status?.summary;
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-6">
      <title>Yönetim · OBA-Tales</title>
      <SectionTitle
        as="h1"
        eyebrow="Yönetim (yalnızca bu bilgisayarda)"
        title="Oba yönetim paneli"
        description="Takipçileri ekle, çıkar, örnek veriyi sıfırla. Değişiklikler public/data/ içine yazılır; yayına almak için en alttaki komutları çalıştır."
      />

      <Card title="Durum" icon={<RefreshCw aria-hidden className="size-5 text-buz-300" />}>
        {s ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-xs text-buz-300">Haritadaki takipçi</p>
              <p className="font-display text-3xl text-buz-50">{formatNumber(s.total)}</p>
              <p className="text-xs text-buz-300">{formatNumber(s.newcomers)} Kutada'da · {formatNumber(s.multiPlatform)} çok platformlu</p>
            </div>
            <div className="rounded-xl bg-white/5 p-3 text-sm text-buz-200">
              {PLATFORMS.map((p) => (
                <p key={p}>
                  {PLATFORM_LABELS[p]}: <span className="font-semibold text-buz-50">{formatNumber(s.byPlatform[p] ?? 0)}</span>
                </p>
              ))}
            </div>
            <div className="rounded-xl bg-white/5 p-3 text-sm text-buz-200">
              {(Object.entries(s.byRarity) as [Rarity, number][]).map(([r, n]) => (
                <p key={r}>
                  {RARITY_INFO[r]?.label ?? r}: <span className="font-semibold text-buz-50">{formatNumber(n)}</span>
                </p>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-buz-300">Yükleniyor…</p>
        )}
      </Card>

      <Card title="Takipçi ekle" icon={<UserPlus aria-hidden className="size-5 text-zumrut-400" />}>
        <p className="mb-3 text-sm text-buz-300">
          Platformların resmî API'leri takipçi listesi vermez; ama hesap sahibi kendi verisini indirebilir. Dosya bu tarayıcıda okunur, yalnızca kullanıcı adları
          kaydedilir. Yeni gelenler Kut Kapısı'nın önünde doğar; başka platformdan da gelen kişiye o platform eklenir (çift iz rozeti).
        </p>
        <div className="space-y-3">
          {PLATFORMS.map((p) => (
            <PlatformImport key={p} platform={p} youtube={status?.youtube ?? null} onPreview={(t, e) => void preview(t, e)} />
          ))}
          <details className="rounded-xl border border-white/10 bg-white/5 p-4">
            <summary className="cursor-pointer font-semibold text-buz-50">Elle ekle (her satıra bir kullanıcı adı)</summary>
            <div className="mt-3 flex flex-wrap gap-2">
              <select value={manualPlatform} onChange={(e) => setManualPlatform(e.target.value as Platform)} className="rounded-lg bg-gece-900 px-2 py-1.5 text-sm text-buz-50">
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABELS[p]}
                  </option>
                ))}
              </select>
              <button type="button" className={secondary} disabled={!manual.trim()} onClick={() => void preview(`Elle · ${PLATFORM_LABELS[manualPlatform]}`, parseFollowerFile("liste.txt", manual, manualPlatform).entries)}>
                Önizle
              </button>
            </div>
            <textarea value={manual} onChange={(e) => setManual(e.target.value)} rows={4} placeholder={"kopuz_okcu\n@ayaz.kiz"} className="mt-2 w-full rounded-lg bg-gece-900 p-2 text-sm text-buz-50" />
          </details>
        </div>

        {pending && report && (
          <div className="mt-4 rounded-xl border border-gunozu-400/30 bg-gunozu-400/5 p-4">
            <p className="font-semibold text-gunozu-100">{pending.title}</p>
            <p className="mt-1 text-sm text-buz-200">
              {formatNumber(pending.entries.length)} kişi okundu → <span className="font-semibold text-zumrut-400">{formatNumber(report.added.length)} yeni yoldaş</span>,{" "}
              {formatNumber(report.linked.length)} çift iz (yeni platform), {formatNumber(report.skipped.length)} atlandı. Harita: {formatNumber(report.before)} →{" "}
              {formatNumber(report.after)}.
            </p>
            {report.added.length > 0 && <p className="mt-1 truncate text-xs text-buz-300">Yeniler: {report.added.slice(0, 30).join(", ")}{report.added.length > 30 ? "…" : ""}</p>}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className={primary}
                disabled={busy || report.added.length + report.linked.length === 0}
                onClick={() =>
                  void run(async () => {
                    const done = await api<ImportReport>("/ekle", { entries: pending.entries });
                    setPending(null);
                    setReport(null);
                    return `✔ Haritaya eklendi: ${done.added.length} yeni, ${done.linked.length} çift iz. Toplam ${done.after}.`;
                  })
                }
              >
                Haritaya ekle
              </button>
              <button type="button" className={secondary} onClick={() => (setPending(null), setReport(null))}>
                Vazgeç
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card title="Haritadan çıkar" icon={<UserMinus aria-hidden className="size-5 text-buz-300" />}>
        <p className="mb-2 text-sm text-buz-300">Haritadan çıkmak isteyen olursa kullanıcı adını yaz (birden çoksa virgülle ayır). Kadro ve özel kahramanlar çıkarılamaz.</p>
        <div className="flex flex-wrap gap-2">
          <input value={remove} onChange={(e) => setRemove(e.target.value)} placeholder="kullanici_adi" className="min-w-60 flex-1 rounded-lg bg-gece-900 px-3 py-2 text-sm text-buz-50" />
          <button
            type="button"
            className={secondary}
            disabled={busy || !remove.trim()}
            onClick={() =>
              void run(async () => {
                const r = await api<{ removed: string[]; missing: string[] }>("/cikar", { handles: remove.split(",") });
                setRemove("");
                return `Çıkarılan: ${r.removed.join(", ") || "yok"}${r.missing.length ? ` · bulunamayan: ${r.missing.join(", ")}` : ""}`;
              })
            }
          >
            <Trash2 aria-hidden className="size-4" />
            Çıkar
          </button>
        </div>
      </Card>

      <Card title="Sıfırla" icon={<ShieldAlert aria-hidden className="size-5 text-alev-400" />}>
        <p className="mb-2 text-sm text-buz-300">
          Bütün takipçileri (örnek veri dahil) siler; kadro ve özel kahramanlar kalır. Gerçek takipçilerle başlamadan önce bir kez yap. Onaylamak için kutuya
          <span className="font-semibold text-buz-50"> SIFIRLA</span> yaz.
        </p>
        <div className="flex flex-wrap gap-2">
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="SIFIRLA" className="w-40 rounded-lg bg-gece-900 px-3 py-2 text-sm text-buz-50" />
          <button
            type="button"
            className={danger}
            disabled={busy || confirm !== "SIFIRLA"}
            onClick={() =>
              void run(async () => {
                const r = await api<{ before: number }>("/sifirla", { onay: "SIFIRLA" });
                setConfirm("");
                return `Sıfırlandı: ${r.before} takipçi silindi.`;
              })
            }
          >
            Takipçileri sıfırla
          </button>
        </div>
      </Card>

      <Card title="Kontrol et ve yayına al" icon={<Download aria-hidden className="size-5 rotate-180 text-gunozu-300" />}>
        <button type="button" className={secondary} disabled={busy} onClick={() => void api<{ ok: boolean; output: string }>("/kontrol", {}).then(setCheck)}>
          Veri denetimini çalıştır
        </button>
        {check && <pre className={`mt-3 max-h-48 overflow-auto rounded-xl bg-black/40 p-3 text-xs ${check.ok ? "text-zumrut-300" : "text-alev-300"}`}>{check.output}</pre>}
        <p className="mt-3 text-sm text-buz-300">Her şey yolundaysa değişiklikleri sitene göndermek için terminalde:</p>
        <pre className="mt-2 overflow-auto rounded-xl bg-black/40 p-3 text-sm text-buz-100">{'git add public/data\ngit commit -m "Takipçiler güncellendi"\ngit push'}</pre>
        <p className="mt-2 text-xs text-buz-300">Cloudflare birkaç dakika içinde siteyi kendisi günceller. Haritayı yerelde görmek için sayfayı yenile.</p>
      </Card>

      {message && <p className="sticky bottom-4 rounded-xl border border-white/15 bg-gece-900/95 p-3 text-sm text-buz-50 shadow-lg">{message}</p>}
    </div>
  );
}

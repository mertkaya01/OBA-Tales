/**
 * YÖNETİM PANELİ — /yonetim (yalnızca `npm run dev` ile, bu bilgisayarda; yayın sürümünde bu sayfa yoktur).
 *
 *   · Durum: haritadaki takipçi sayısı, platform ve nadirlik dağılımı
 *   · Takipçi ekle: Instagram ve TikTok "verilerini indir" dosyaları, YouTube yorumları, CSV ya da elle liste
 *     (dosya tarayıcıda okunur; sunucuya yalnızca kullanıcı adları gider). Önce önizleme, sonra "Haritaya ekle".
 *   · Takipçiler: listede ara, tek tek düzenle (ad, unvan, nadirlik, rozet, puan, platform, yer), elle ekle, sil
 *   · Bağlantılar: sosyal medya hesapları ve destek bağlantısı (üst menüde görünür)
 *   · Haritadan çıkar: çıkmak isteyen kişiler için
 *   · Sıfırla: örnek (sahte) takipçileri siler; "SIFIRLA" yazarak onaylanır
 *   · Yayına al: değişiklikler public/data/ içine yazılır; git ile commit + push yapınca site güncellenir
 * Uç noktalar: scripts/yonetimPlugin.ts · kurallar: scripts/lib/followers.ts · dosya okuyucular: src/admin/followerFiles.ts
 */
import { BookOpen, Download, FileUp, Link2, RefreshCw, ShieldAlert, Sparkles, Trash2, Undo2, UserMinus, UserPlus, Users } from "lucide-react";
import { api } from "../admin/adminApi";
import { FollowersCard, LinksCard } from "../admin/FollowerEditor";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { parseFollowerFile, readFollowerFile, type FollowerEntry, type ReadFile } from "../admin/followerFiles";
import { SectionTitle } from "../components/ui/SectionTitle";
import { PLATFORM_LABELS } from "../content/classes";
import { RARITY_INFO } from "../content/rarities";
import { WELCOME_LABELS, WELCOME_MODES, type WelcomeMode } from "../content/story";
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
  story: StorySummary;
  youtube: { key: boolean; channel: string | null };
}
interface ImportReport {
  written: boolean;
  before: number;
  after: number;
  added: string[];
  linked: string[];
  skipped: string[];
  /** Hikâyenin kahramanları: listede olsalar da takipçi olarak eklenmez. */
  heroes: string[];
  cleaned: number;
}

interface StorySummary {
  day: number;
  arrivals: { id: string; name: string; at: string }[];
  next: { id: string; name: string } | null;
  order: { id: string; name: string }[];
  regions: { id: string; name: string; open: boolean }[];
  islands: { id: string; name: string; open: boolean }[];
  welcome: WelcomeMode;
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
      "İndirdiğin ZIP'i açmadan olduğu gibi aşağıdan seç: içindeki followers_1.json (çok takipçide followers_2.json …) kendiliğinden bulunur. following.json (senin takip ettiklerin) alınmaz.",
      "ZIP'i açtıysan connections/followers_and_following/followers_1.json dosyasını seçmen de olur.",
    ],
    file: "ZIP ya da followers_1.json",
    accept: ".zip,.json,.html,.htm,.csv,.txt",
  },
  tiktok: {
    title: "TikTok: takipçi listesini indir",
    steps: [
      "TikTok uygulamasında profil → ☰ menü → Ayarlar ve gizlilik → Hesap → Verilerini indir.",
      "\"Veri iste\" sekmesinde biçim olarak JSON'u seç (TXT de olur) → Veri iste.",
      "Hazırlanması birkaç saat ile birkaç gün sürebilir; hazır olunca \"Verileri indir\" sekmesinden indir.",
      "İndirdiğin ZIP'i açmadan olduğu gibi aşağıdan seç (ya da içindeki user_data_tiktok.json'u; TXT seçtiysen Follower.txt).",
      "İçinden yalnızca takipçilerin kullanıcı adları alınır; e-posta, doğum tarihi gibi bilgiler okunmaz, hiçbir yere gitmez.",
    ],
    file: "ZIP ya da user_data_tiktok.json",
    accept: ".zip,.json,.txt,.csv",
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
  const [files, setFiles] = useState<ReadFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dosya tarayıcıda okunur (ZIP de burada açılır); sunucuya yalnızca kullanıcı adları gider.
  const read = async (list: FileList | null) => {
    setError(null);
    const chosen = [...(list ?? [])];
    const parsed = (await Promise.all(chosen.map(async (file) => readFollowerFile(file.name, new Uint8Array(await file.arrayBuffer()), platform)))).flat();
    setFiles(parsed);
    const entries = parsed.flatMap((p) => p.parsed.entries);
    if (entries.length) onPreview(`${PLATFORM_LABELS[platform]} · ${chosen.map((f) => f.name).join(", ")}`, entries);
    else setError(parsed.find((p) => p.parsed.note)?.parsed.note ?? "Dosyada kullanıcı adı bulunamadı. Doğru dosyayı seçtiğinden emin ol.");
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
        <p key={f.name} className="mt-2 break-all text-xs text-buz-300">
          {f.name}: {f.parsed.kind}, {formatNumber(f.parsed.entries.length)} kişi{f.parsed.skipped ? ` (${f.parsed.skipped} atlandı)` : ""}
          {f.parsed.note && <span className="text-gunozu-200"> · {f.parsed.note}</span>}
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
        description="Hikâyeyi ilerlet (kahramanları getir, adaları aç), takipçileri ekle ya da çıkar. Değişiklikler public/data/ içine yazılır; yayına almak için en alttaki komutları çalıştır."
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

      <Card title="Hikâye" icon={<BookOpen aria-hidden className="size-5 text-gunozu-300" />}>
        {status?.story ? (
          <div className="space-y-4">
            <p className="text-sm text-buz-300">
              Kahramanlar sırayla gelir. "Getir" deyince world.json'a yazılır; commit + push sonrası sitede Kut Kapısı'ndan doğar ve o hafta
              siteye giren herkes gelişi bir kez izler. Siteye ilk kez gelenler ise aşağıdaki karşılamayı görür, ardından Dede'nin turu açılır.
            </p>
            <fieldset className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
              <legend className="px-1 font-display text-buz-100">Yeni ziyaretçi karşılaması</legend>
              <div className="mt-1 grid gap-1.5">
                {WELCOME_MODES.map((mode) => (
                  <label key={mode} className="flex items-center gap-2 text-buz-200">
                    <input
                      type="radio"
                      name="karsilama"
                      checked={status.story.welcome === mode}
                      disabled={busy}
                      onChange={() => void run(async () => (await api<{ message: string }>("/hikaye", { islem: "karsilama", mod: mode })).message)}
                      className="size-4 accent-gunozu-400"
                    />
                    {WELCOME_LABELS[mode]}
                    {mode === "uclu" && <span className="text-xs text-buz-400">(önerilen)</span>}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-buz-300">
                Kendi tarayıcında denemek için: adres çubuğuna http://localhost:5173/?karsilama yaz (yalnızca geliştirmede).
              </p>
            </fieldset>
            <ol className="grid gap-2 sm:grid-cols-3">
              {status.story.order.map((hero, i) => {
                const arrival = status.story.arrivals.find((a) => a.id === hero.id);
                return (
                  <li key={hero.id} className={`rounded-xl border p-3 text-sm ${arrival ? "border-zumrut-400/40 bg-zumrut-400/10" : "border-white/10 bg-white/5"}`}>
                    <p className="text-xs text-buz-300">{i + 1}. kahraman</p>
                    <p className="font-display text-lg text-buz-50">{hero.name}</p>
                    <p className="text-xs text-buz-300">{arrival ? `Geldi: ${new Date(arrival.at).toLocaleString("tr-TR")}` : "Henüz gelmedi"}</p>
                  </li>
                );
              })}
            </ol>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={primary}
                disabled={busy || !status.story.next}
                onClick={() => run(async () => (await api<{ message: string }>("/hikaye", { islem: "getir" })).message)}
              >
                <Sparkles aria-hidden className="size-4" />
                {status.story.next ? `Sıradakini getir: ${status.story.next.name}` : "Hepsi geldi"}
              </button>
              <button
                type="button"
                className={secondary}
                disabled={busy || status.story.arrivals.length === 0}
                onClick={() => run(async () => (await api<{ message: string }>("/hikaye", { islem: "geri-al" })).message)}
              >
                <Undo2 aria-hidden className="size-4" />
                Son gelişi geri al
              </button>
              <label className="ml-auto flex items-center gap-2 text-sm text-buz-200">
                Hikâye günü
                <input
                  type="number"
                  min={1}
                  value={status.story.day}
                  disabled={busy}
                  onChange={(event) => {
                    const gun = Number(event.target.value);
                    if (gun >= 1) void run(async () => (await api<{ message: string }>("/hikaye", { islem: "gun", gun })).message);
                  }}
                  className="w-20 rounded-lg border border-white/15 bg-gece-950/80 px-2 py-1 text-buz-50"
                />
              </label>
            </div>
            <details className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
              <summary className="cursor-pointer font-display text-buz-100">Adaları aç / kapat ({status.story.regions.filter((r) => r.open).length + status.story.islands.filter((i) => i.open).length} açık)</summary>
              <p className="mt-2 text-xs text-buz-300">Kapalı adalar haritada karartılı ve "?" ile görünür; açınca obaları, ağaçları ve köprüleri belirir.</p>
              <div className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                {[...status.story.regions.map((r) => ({ ...r, kind: "bolge" as const })), ...status.story.islands.map((i) => ({ ...i, kind: "ada" as const }))].map((land) => (
                  <label key={land.id} className="flex items-center gap-2 text-buz-200">
                    <input
                      type="checkbox"
                      checked={land.open}
                      disabled={busy || land.id === "kutada"}
                      onChange={(event) => void run(async () => (await api<{ message: string }>("/hikaye", { islem: land.kind, id: land.id, acik: event.target.checked })).message)}
                      className="size-4 accent-gunozu-400"
                    />
                    {land.name}
                    <span className="text-xs text-buz-400">{land.kind === "ada" ? "yabani ada" : "bölge"}</span>
                  </label>
                ))}
              </div>
            </details>
          </div>
        ) : (
          <p className="text-sm text-buz-300">Yükleniyor…</p>
        )}
      </Card>

      <Card title="Takipçiler" icon={<Users aria-hidden className="size-5 text-gunozu-300" />}>
        <FollowersCard onChanged={refresh} />
      </Card>

      <Card title="Bağlantılar" icon={<Link2 aria-hidden className="size-5 text-buz-300" />}>
        <p className="mb-3 text-sm text-buz-300">Sosyal medya hesapların üst menüde ve Obaya Katıl sayfasında görünür; destek bağlantısı yoksa düğme "yakında" der.</p>
        <LinksCard />
      </Card>

      <Card title="Takipçi ekle (toplu)" icon={<UserPlus aria-hidden className="size-5 text-zumrut-400" />}>
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
            {report.heroes.length > 0 && (
              <p className="mt-1 text-xs text-gunozu-200">
                Kahraman: {report.heroes.join(", ")}. Hikâyenin kahramanları takipçi olarak eklenmez; haritaya yukarıdaki Hikâye kartından gelirler.
              </p>
            )}
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

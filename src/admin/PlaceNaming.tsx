/**
 * YÖNETİM · YER ADLARI — ad koyma oylaması (yalnızca `npm run dev` → /yonetim).
 *
 * Videoda "bu adanın adını yorumlara yazın" denir; en çok beğenilen öneri yerin adı olur ve haritada
 * "adını koyan @…" yazar. YouTube'da yorumlar buradan çekilir (beğeniye göre); Instagram ve TikTok'ta kazananı
 * uygulamada görüp elle yazarsın. Ad koyan haritada değilse eklenir ve "Ad Koyan" rozeti alır.
 * Uç noktalar: scripts/yonetimPlugin.ts (/yerler, /yer, /youtube-videolar, /youtube-oylama) · kurallar: scripts/lib/places.ts
 */
import { Download, EyeOff, Trash2, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PLATFORM_LABELS } from "../content/classes";
import { PLATFORMS, type Platform } from "../types";
import { api } from "./adminApi";

interface PlaceRow {
  id: string;
  label: string;
  name: string | null;
  namedBy: { id: string; handle: string; displayName: string } | null;
  hidden: boolean;
}
interface Video {
  id: string;
  title: string;
  at: string;
}
interface Candidate {
  name: string;
  handle: string;
  displayName: string;
  likes: number;
  text: string;
}

const button = "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const primary = `${button} bg-gunozu-400 text-gece-900 hover:bg-gunozu-300`;
const secondary = `${button} border border-white/15 text-buz-100 hover:bg-white/10`;
const field = "rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-buz-50 placeholder:text-buz-400 focus:border-gunozu-400 focus:outline-none";

/** Seçim listesinde gruplar: obalar, yabani adalar, yapılar ve anıtlar. */
function groupOf(id: string): string {
  if (id.endsWith("_obasi")) return "Obalar";
  if (["kartalyuva", "buzultac", "uckardes", "yesilsirt", "marti_adaciklari", "kalekaya", "kuzgunorman", "firtinaburnu"].includes(id)) return "Yabani adalar";
  return "Yapılar ve anıtlar";
}

export function PlaceNamingCard() {
  const [places, setPlaces] = useState<PlaceRow[]>([]);
  const [place, setPlace] = useState("");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [video, setVideo] = useState("");
  const [candidates, setCandidates] = useState<{ total: number; list: Candidate[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ places: PlaceRow[] }>("/yerler")
      .then((r) => setPlaces(r.places))
      .catch((e: Error) => setMessage(`Hata: ${e.message}`));
  }, []);
  useEffect(load, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, PlaceRow[]>();
    for (const p of places) map.set(groupOf(p.id), [...(map.get(groupOf(p.id)) ?? []), p]);
    return [...map];
  }, [places]);
  const selected = places.find((p) => p.id === place) ?? null;
  const named = places.filter((p) => p.name);

  const act = async (action: () => Promise<{ message: string; places: PlaceRow[] }>) => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await action();
      setPlaces(result.places);
      setMessage(`✔ ${result.message}`);
      return true;
    } catch (e) {
      setMessage(`Hata: ${(e as Error).message}`);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const give = (n: string, h: string, p: Platform) =>
    act(() => api("/yer", { islem: "koy", place, name: n, handle: h, platform: p })).then((ok) => {
      if (ok) {
        setName("");
        setHandle("");
      }
    });

  const fetchVideos = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const r = await api<{ videos: Video[] }>("/youtube-videolar", {});
      setVideos(r.videos);
      setVideo(r.videos[0]?.id ?? "");
      if (!r.videos.length) setMessage("Kanalda video bulunamadı.");
    } catch (e) {
      setMessage(`Hata: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const fetchVotes = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const r = await api<{ total: number; candidates: Candidate[] }>("/youtube-oylama", { video });
      setCandidates({ total: r.total, list: r.candidates });
    } catch (e) {
      setMessage(`Hata: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-buz-300">
        Videoda bir yeri göster ve izleyicilere sor: <span className="text-buz-100">"Bu adanın adını yorumlara yaz, en çok beğenilen kazansın."</span> Kazanan ad haritada o yerin üstünde,
        altında "adını koyan @…" ile görünür. Ad koyan haritada değilse eklenir ve <span className="text-gunozu-200">Ad Koyan</span> rozetini alır.
      </p>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-buz-300">1. Yer seç</span>
        <select value={place} onChange={(e) => (setPlace(e.target.value), setCandidates(null))} className={`${field} w-full`}>
          <option value="">Bir yer seç…</option>
          {groups.map(([group, rows]) => (
            <optgroup key={group} label={group}>
              {rows.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name ? `${p.name} (${p.label})` : p.label}
                  {p.hidden ? " · karanlıkta" : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {selected?.hidden && (
        <p className="flex items-center gap-1.5 text-xs text-gunozu-200">
          <EyeOff aria-hidden className="size-3.5" />
          Bu yer henüz karanlıkta: adı kaydedilir, haritada o kara açılınca (Hikâye kartı) görünür.
        </p>
      )}

      {place && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="font-semibold text-buz-50">2a. YouTube oylaması</p>
            <p className="mt-1 text-xs text-buz-300">Videonun yorumları beğeniye göre sıralanır. "yer: Yıldız Koyu" ya da yalnızca "Yıldız Koyu" yazan yorumlar aday olur.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {!videos ? (
                <button type="button" className={secondary} disabled={busy} onClick={() => void fetchVideos()}>
                  <Download aria-hidden className="size-4" />
                  Videoları getir
                </button>
              ) : (
                <>
                  <select value={video} onChange={(e) => (setVideo(e.target.value), setCandidates(null))} className={`${field} min-w-0 flex-1`}>
                    {videos.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title}
                      </option>
                    ))}
                  </select>
                  <button type="button" className={secondary} disabled={busy || !video} onClick={() => void fetchVotes()}>
                    <Trophy aria-hidden className="size-4" />
                    Önerileri say
                  </button>
                </>
              )}
            </div>
            {candidates && (
              <div className="mt-3">
                <p className="text-xs text-buz-300">
                  {candidates.total} yorum okundu, {candidates.list.length} ad önerisi.
                </p>
                <ol className="mt-2 space-y-1.5">
                  {candidates.list.map((c, i) => (
                    <li key={`${c.name}-${c.handle}`} className="flex items-center gap-2 rounded-lg bg-black/20 px-2 py-1.5 text-sm">
                      <span className="w-5 text-right font-display text-gunozu-300">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-buz-50">{c.name}</span>
                        <span className="block truncate text-xs text-buz-300">
                          @{c.handle} · ♥ {c.likes}
                        </span>
                      </span>
                      <button type="button" className={i === 0 ? primary : secondary} disabled={busy} onClick={() => void give(c.name, c.handle, "youtube")}>
                        Adı koy
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="font-semibold text-buz-50">2b. Elle (Instagram, TikTok)</p>
            <p className="mt-1 text-xs text-buz-300">Uygulamada en çok beğenilen yorumu bul; adı ve yazanı buraya gir.</p>
            <div className="mt-3 grid gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Yerin yeni adı (ör. Yıldız Koyu)" maxLength={40} className={field} />
              <div className="flex gap-2">
                <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@kullanici" className={`${field} min-w-0 flex-1`} />
                <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} className={field}>
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {PLATFORM_LABELS[p]}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" className={primary} disabled={busy || !name.trim() || !handle.trim()} onClick={() => void give(name, handle, platform)}>
                Adı koy
              </button>
            </div>
          </div>
        </div>
      )}

      {message && <p className={`text-sm ${message.startsWith("Hata") ? "text-alev-300" : "text-zumrut-400"}`}>{message}</p>}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-buz-300">Konulmuş adlar ({named.length})</p>
        {named.length === 0 ? (
          <p className="text-sm text-buz-300">Henüz hiçbir yere ad konmadı.</p>
        ) : (
          <ul className="space-y-1.5">
            {named.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-buz-50">{p.name}</span>
                  <span className="text-buz-300">
                    {" "}
                    · {p.label} · adını koyan @{p.namedBy?.handle}
                    {p.hidden ? " · karanlıkta" : ""}
                  </span>
                </span>
                <button type="button" className={secondary} disabled={busy} aria-label={`${p.name} adını kaldır`} onClick={() => void act(() => api("/yer", { islem: "kaldir", place: p.id }))}>
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

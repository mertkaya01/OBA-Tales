/**
 * YÖNETİM PANELİ · TAKİPÇİLER — haritadaki takipçileri bul, düzenle, elle ekle, sil; sosyal medya ve destek bağlantıları.
 *
 *   · Liste: ad, kullanıcı adı ya da unvanla arama; platform ve nadirlik süzgeci; sayfa sayfa.
 *   · Düzenleyici: görünen ad, unvan (boşsa otomatik), ana platform (sınıfı belirler), bağlı platformlar, nadirlik
 *     (takipçide en çok Efsanevi), puan, rozetler ve haritadaki yer (Kut Kapısı, bir oba ya da küçük haritada tıklanan
 *     nokta). Kurallar sunucuda: scripts/lib/followerEdit.ts. Hatalar (denizde nokta, geçersiz ad…) burada gösterilir.
 *   · Değişiklikler public/data/roster.json ve world.json'a yazılır; yayına almak için commit + push.
 */
import { Check, ChevronLeft, ChevronRight, Link2, MapPin, Plus, Save, Search, Trash2, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CharacterPortrait } from "../components/character/CharacterPortrait";
import { PlatformIcon } from "../components/character/PlatformIcon";
import { BADGES } from "../content/badges";
import { PLATFORM_LABELS } from "../content/classes";
import { RARITY_INFO } from "../content/rarities";
import { useGameData } from "../data/useGameData";
import { getPaintedTerrain } from "../game/terrainCache";
import { PAINT_TEXEL } from "../game/terrainPaint";
import { visibleBounds } from "../game/visibility";
import { cn } from "../lib/cn";
import { formatNumber } from "../lib/text";
import { BADGE_IDS, FOLLOWER_RARITY_CAP, PLATFORMS, RARITIES, type BadgeId, type Character, type Coordinates, type Platform, type Rarity, type SocialLinks } from "../types";
import { api } from "./adminApi";

interface FollowerSummary {
  id: string;
  handle: string;
  displayName: string;
  platform: Platform;
  linkedPlatforms: Platform[];
  className: string;
  rarity: Rarity;
  title: string;
  points: number;
  badges: BadgeId[];
  coordinates: Coordinates;
}
interface ListResponse {
  total: number;
  page: number;
  pages: number;
  items: FollowerSummary[];
  homes: { id: string; label: string }[];
  dots: { id: string; x: number; y: number }[];
}
type Home = { kind: "kapi" } | { kind: "oba"; village: string } | { kind: "nokta"; x: number; y: number };

const FOLLOWER_RARITIES = RARITIES.slice(0, RARITIES.indexOf(FOLLOWER_RARITY_CAP) + 1);

const button = "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const primary = `${button} bg-gunozu-400 text-gece-900 hover:bg-gunozu-300`;
const secondary = `${button} border border-white/15 text-buz-100 hover:bg-white/10`;
const danger = `${button} bg-alev-500 text-white hover:bg-alev-400`;
const field = "rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-buz-50 placeholder:text-buz-400 focus:border-gunozu-400 focus:outline-none";
const input = `w-full ${field}`;
const label = "mb-1 block text-xs font-semibold uppercase tracking-wide text-buz-300";

function Field({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <span className={label}>{title}</span>
      {children}
      {hint && <p className="mt-1 text-xs text-buz-400">{hint}</p>}
    </div>
  );
}

// ── Küçük harita: hikâyede açık kara, takipçilerin yerleri; tıklayınca yeni yer ──

function MiniMap({ dots, selectedId, pick, onPick }: { dots: ListResponse["dots"]; selectedId: string | null; pick: Coordinates | null; onPick: (p: Coordinates) => void }) {
  const { world, visibility } = useGameData();
  const canvas = useRef<HTMLCanvasElement>(null);
  const bounds = useMemo(() => visibleBounds(visibility, 0.08), [visibility]);
  const image = useMemo(() => {
    const painted = getPaintedTerrain(world.seed, "harita");
    const c = document.createElement("canvas");
    c.width = painted.width;
    c.height = painted.height;
    c.getContext("2d")?.putImageData(new ImageData(painted.data, painted.width, painted.height), 0, 0);
    return c;
  }, [world.seed]);

  useEffect(() => {
    const el = canvas.current;
    const g = el?.getContext("2d");
    if (!el || !g || !bounds) return;
    const sx = bounds.minX / PAINT_TEXEL;
    const sy = bounds.minY / PAINT_TEXEL;
    const sw = (bounds.maxX - bounds.minX) / PAINT_TEXEL;
    const sh = (bounds.maxY - bounds.minY) / PAINT_TEXEL;
    g.imageSmoothingEnabled = false;
    g.drawImage(image, sx, sy, sw, sh, 0, 0, el.width, el.height);
    const toPx = (p: Coordinates) => [((p.x - bounds.minX) / (bounds.maxX - bounds.minX)) * el.width, ((p.y - bounds.minY) / (bounds.maxY - bounds.minY)) * el.height] as const;
    for (const d of dots) {
      if (d.id === selectedId) continue;
      const [x, y] = toPx(d);
      g.fillStyle = "rgba(250, 245, 230, 0.85)";
      g.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    const selected = dots.find((d) => d.id === selectedId);
    const ring = (p: Coordinates, color: string) => {
      const [x, y] = toPx(p);
      g.strokeStyle = "#0b1322";
      g.lineWidth = 4;
      g.beginPath();
      g.arc(x, y, 6, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = color;
      g.lineWidth = 2;
      g.stroke();
    };
    if (selected) ring(selected, "#f6d36f");
    if (pick) ring(pick, "#ff6b4a");
  }, [image, bounds, dots, selectedId, pick]);

  if (!bounds) return null;
  const aspect = (bounds.maxY - bounds.minY) / (bounds.maxX - bounds.minX);
  return (
    <canvas
      ref={canvas}
      width={480}
      height={Math.round(480 * aspect)}
      className="w-full cursor-crosshair rounded-lg border border-white/15 [image-rendering:pixelated]"
      aria-label="Küçük harita: yeni yer seçmek için tıkla"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const u = (e.clientX - r.left) / r.width;
        const v = (e.clientY - r.top) / r.height;
        onPick({ x: Math.round((bounds.minX + u * (bounds.maxX - bounds.minX)) * 10) / 10, y: Math.round((bounds.minY + v * (bounds.maxY - bounds.minY)) * 10) / 10 });
      }}
    />
  );
}

// ── Yer seçimi ──

function HomePicker({ homes, value, onChange, dots, selectedId, keepLabel }: { homes: ListResponse["homes"]; value: Home | null; onChange: (h: Home | null) => void; dots: ListResponse["dots"]; selectedId: string | null; keepLabel: string | null }) {
  const choice = value === null ? "kal" : value.kind === "oba" ? `oba:${value.village}` : value.kind;
  return (
    <div className="space-y-2">
      <select
        className={input}
        value={choice}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "kal") onChange(null);
          else if (v === "kapi") onChange({ kind: "kapi" });
          else if (v === "nokta") onChange({ kind: "nokta", x: NaN, y: NaN });
          else onChange({ kind: "oba", village: v.slice(4) });
        }}
      >
        {keepLabel && <option value="kal">{keepLabel}</option>}
        {homes.map((h) => (
          <option key={h.id} value={h.id === "kapi" ? "kapi" : `oba:${h.id}`}>
            {h.label}
          </option>
        ))}
        <option value="nokta">Haritada seç…</option>
      </select>
      <MiniMap dots={dots} selectedId={selectedId} pick={value?.kind === "nokta" && Number.isFinite(value.x) ? value : null} onPick={(p) => onChange({ kind: "nokta", ...p })} />
      <p className="text-xs text-buz-400">
        {value?.kind === "nokta"
          ? Number.isFinite(value.x)
            ? `Seçilen nokta: ${value.x}, ${value.y} (kaydedince denetlenir: kuru ve açık kara olmalı)`
            : "Küçük haritada bir yere tıkla."
          : "Sarı halka şu anki yeri; haritaya tıklarsan oraya taşınır."}
      </p>
    </div>
  );
}

// ── Düzenleyici ──

function PlatformChecks({ main, value, onChange }: { main: Platform; value: Platform[]; onChange: (v: Platform[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PLATFORMS.map((p) => {
        const on = p === main || value.includes(p);
        return (
          <button
            key={p}
            type="button"
            disabled={p === main}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== p) : [...value, p])}
            className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm", on ? "border-gunozu-400/70 bg-gunozu-400/15 text-gunozu-100" : "border-white/15 text-buz-200 hover:bg-white/10", p === main && "opacity-80")}
          >
            <PlatformIcon platform={p} className="size-4" />
            {PLATFORM_LABELS[p]}
            {p === main && <span className="text-xs">(ana)</span>}
          </button>
        );
      })}
    </div>
  );
}

function FollowerForm({ id, homes, dots, onSaved, onClose }: { id: string; homes: ListResponse["homes"]; dots: ListResponse["dots"]; onSaved: (message: string) => void; onClose: () => void }) {
  const [original, setOriginal] = useState<Character | null>(null);
  const [form, setForm] = useState<{ displayName: string; title: string; platform: Platform; linked: Platform[]; rarity: Rarity; points: string; badges: BadgeId[] } | null>(null);
  const [home, setHome] = useState<Home | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    api<Character>(`/takipci?id=${encodeURIComponent(id)}`)
      .then((c) => {
        setError(null);
        setOriginal(c);
        setForm({ displayName: c.displayName, title: c.title, platform: c.platform, linked: c.linkedPlatforms, rarity: c.rarity, points: String(c.points), badges: c.badges });
        setHome(null);
        setConfirmDelete(false);
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  if (!form || !original) return <p className="text-sm text-buz-300">{error ?? "Yükleniyor…"}</p>;
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm({ ...form, [k]: v });

  const save = async () => {
    const patch: Record<string, unknown> = {};
    if (form.displayName !== original.displayName) patch.displayName = form.displayName;
    if (form.title !== original.title) patch.title = form.title.trim() ? form.title : null;
    if (form.platform !== original.platform || form.linked.join() !== original.linkedPlatforms.join()) {
      patch.platform = form.platform;
      patch.linkedPlatforms = form.linked;
    }
    if (form.rarity !== original.rarity) patch.rarity = form.rarity;
    if (form.points !== String(original.points)) patch.points = Number(form.points);
    if (form.badges.join() !== original.badges.join()) patch.badges = form.badges;
    if (home) {
      if (home.kind === "nokta" && !Number.isFinite(home.x)) return setError("Küçük haritada bir yere tıkla.");
      patch.home = home;
    }
    if (Object.keys(patch).length === 0) return setError("Değişiklik yok.");
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ message: string }>("/takipci", { islem: "guncelle", id, degisiklik: patch });
      onSaved(`@${original.handle}: ${result.message}`);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const result = await api<{ message: string }>("/takipci", { islem: "sil", id });
      onSaved(`@${original.handle}: ${result.message}`);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-gunozu-400/30 bg-white/[0.04] p-4">
      <div className="flex items-start gap-4">
        <CharacterPortrait character={original} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg text-buz-50">{original.displayName}</p>
          <p className="text-sm text-buz-300">
            @{original.handle} · {original.class.name} · {RARITY_INFO[original.rarity].label}
          </p>
          <p className="text-xs text-buz-400">Kullanıcı adı değişmez (kişinin izi); yanlışsa silip yeniden ekle.</p>
        </div>
        <button type="button" className="rounded-lg p-1.5 text-buz-300 hover:bg-white/10" onClick={onClose} aria-label="Düzenleyiciyi kapat">
          <X aria-hidden className="size-5" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field title="Görünen ad">
          <input className={input} value={form.displayName} maxLength={40} onChange={(e) => set("displayName", e.target.value)} />
        </Field>
        <Field title="Unvan" hint="Boş bırakırsan nadirlik ve sınıftan kurulur.">
          <input className={input} value={form.title} maxLength={60} placeholder="Otomatik" onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field title="Ana platform" hint="Sınıfı belirler: Instagram → Kalkaneri, TikTok → Okyeli, YouTube → Ocakcan.">
          <select
            className={input}
            value={form.platform}
            onChange={(e) => {
              // Ana platform değişince eskisi bağlı listeden düşer (kişi iki platformda da takip ediyorsa elle işaretlenir).
              const next = e.target.value as Platform;
              setForm({ ...form, platform: next, linked: form.linked.filter((p) => p !== form.platform) });
            }}
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABELS[p]}
              </option>
            ))}
          </select>
        </Field>
        <Field title="Nadirlik" hint="Takipçide en çok Efsanevi.">
          <select className={input} value={form.rarity} onChange={(e) => set("rarity", e.target.value as Rarity)}>
            {FOLLOWER_RARITIES.map((r) => (
              <option key={r} value={r}>
                {RARITY_INFO[r].label}
              </option>
            ))}
          </select>
        </Field>
        <Field title="Bağlı platformlar">
          <PlatformChecks main={form.platform} value={form.linked} onChange={(v) => set("linked", v)} />
        </Field>
        <Field title="Puan">
          <input className={input} type="number" min={0} step={1} value={form.points} onChange={(e) => set("points", e.target.value)} />
        </Field>
      </div>

      <Field title="Rozetler">
        <div className="flex flex-wrap gap-2">
          {BADGE_IDS.map((b) => {
            const on = form.badges.includes(b);
            return (
              <button
                key={b}
                type="button"
                aria-pressed={on}
                title={BADGES[b].howToEarn}
                onClick={() => set("badges", on ? form.badges.filter((x) => x !== b) : [...form.badges, b])}
                className={cn("rounded-full border px-3 py-1 text-xs", on ? "border-zumrut-400/70 bg-zumrut-400/15 text-zumrut-100" : "border-white/15 text-buz-300 hover:bg-white/10")}
              >
                {on && <Check aria-hidden className="mr-1 inline size-3" />}
                {BADGES[b].name}
              </button>
            );
          })}
        </div>
      </Field>

      <Field title="Haritadaki yeri">
        <HomePicker homes={homes} value={home} onChange={setHome} dots={dots} selectedId={id} keepLabel="Olduğu yerde kalsın" />
      </Field>

      {error && <p className="rounded-lg bg-alev-500/15 px-3 py-2 text-sm text-alev-200">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={primary} disabled={busy} onClick={() => void save()}>
          <Save aria-hidden className="size-4" />
          Kaydet
        </button>
        <button type="button" className={secondary} disabled={busy} onClick={load}>
          Vazgeç
        </button>
        <span className="flex-1" />
        {confirmDelete ? (
          <>
            <span className="text-sm text-alev-200">@{original.handle} haritadan silinsin mi?</span>
            <button type="button" className={danger} disabled={busy} onClick={() => void remove()}>
              Evet, sil
            </button>
            <button type="button" className={secondary} onClick={() => setConfirmDelete(false)}>
              Hayır
            </button>
          </>
        ) : (
          <button type="button" className={secondary} onClick={() => setConfirmDelete(true)}>
            <Trash2 aria-hidden className="size-4" />
            Sil
          </button>
        )}
      </div>
    </div>
  );
}

function NewFollower({ homes, dots, onSaved, onClose }: { homes: ListResponse["homes"]; dots: ListResponse["dots"]; onSaved: (message: string, id: string) => void; onClose: () => void }) {
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [home, setHome] = useState<Home | null>({ kind: "kapi" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    if (home?.kind === "nokta" && !Number.isFinite(home.x)) return setError("Küçük haritada bir yere tıkla.");
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ message: string; follower: { id: string } }>("/takipci", { islem: "ekle", takipci: { handle, displayName, platform, home: home ?? { kind: "kapi" } } });
      onSaved(`@${handle.replace(/^@+/, "")}: ${result.message}`, result.follower.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-zumrut-400/30 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between">
        <p className="font-display text-lg text-buz-50">Yeni takipçi</p>
        <button type="button" className="rounded-lg p-1.5 text-buz-300 hover:bg-white/10" onClick={onClose} aria-label="Kapat">
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field title="Kullanıcı adı">
          <input className={input} value={handle} placeholder="@kullanici.adi" onChange={(e) => setHandle(e.target.value)} />
        </Field>
        <Field title="Görünen ad">
          <input className={input} value={displayName} maxLength={40} placeholder="Boşsa kullanıcı adı" onChange={(e) => setDisplayName(e.target.value)} />
        </Field>
        <Field title="Ana platform">
          <select className={input} value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABELS[p]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field title="Haritadaki yeri">
        <HomePicker homes={homes} value={home} onChange={setHome} dots={dots} selectedId={null} keepLabel={null} />
      </Field>
      {error && <p className="rounded-lg bg-alev-500/15 px-3 py-2 text-sm text-alev-200">{error}</p>}
      <button type="button" className={primary} disabled={busy || !handle.trim()} onClick={() => void add()}>
        <Plus aria-hidden className="size-4" />
        Haritaya ekle
      </button>
    </div>
  );
}

// ── Kart: liste + düzenleyici ──

export function FollowersCard({ onChanged }: { onChanged: () => void }) {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("");
  const [rarity, setRarity] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ ara: query, platform, nadirlik: rarity, sayfa: String(page) });
    api<ListResponse>(`/takipciler?${params}`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [query, platform, rarity, page]);
  // Aramada her tuşta değil, yazmayı bırakınca.
  useEffect(() => {
    const timer = window.setTimeout(load, 220);
    return () => window.clearTimeout(timer);
  }, [load]);

  const changed = (text: string) => {
    setMessage(text);
    load();
    onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">Takipçi ara</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-buz-400" />
          <input
            className={`${input} pl-9`}
            value={query}
            placeholder="Ad, kullanıcı adı ya da unvan"
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          className={field}
          value={platform}
          aria-label="Platform süzgeci"
          onChange={(e) => {
            setPlatform(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Bütün platformlar</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {PLATFORM_LABELS[p]}
            </option>
          ))}
        </select>
        <select
          className={field}
          value={rarity}
          aria-label="Nadirlik süzgeci"
          onChange={(e) => {
            setRarity(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Bütün nadirlikler</option>
          {FOLLOWER_RARITIES.map((r) => (
            <option key={r} value={r}>
              {RARITY_INFO[r].label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={primary}
          onClick={() => {
            setCreating(true);
            setSelected(null);
          }}
        >
          <Plus aria-hidden className="size-4" />
          Yeni takipçi
        </button>
      </div>

      {message && <p className="rounded-lg bg-zumrut-400/10 px-3 py-2 text-sm text-zumrut-200">{message} Yayına almak için en alttaki komutlar.</p>}
      {error && <p className="rounded-lg bg-alev-500/15 px-3 py-2 text-sm text-alev-200">{error}</p>}

      {creating && data && (
        <NewFollower
          homes={data.homes}
          dots={data.dots}
          onClose={() => setCreating(false)}
          onSaved={(text, id) => {
            setCreating(false);
            setSelected(id);
            changed(text);
          }}
        />
      )}
      {selected && data && <FollowerForm key={selected} id={selected} homes={data.homes} dots={data.dots} onSaved={changed} onClose={() => setSelected(null)} />}

      {data && (
        <>
          <p className="text-sm text-buz-300">
            <Users aria-hidden className="mr-1 inline size-4" />
            {formatNumber(data.total)} takipçi{query || platform || rarity ? " (süzgeçten geçen)" : ""}
          </p>
          {data.items.length === 0 ? (
            <p className="rounded-xl bg-white/5 p-4 text-sm text-buz-300">Henüz takipçi yok. "Yeni takipçi" ile elle ekleyebilir ya da aşağıdan dosyayla toplu ekleyebilirsin.</p>
          ) : (
            <ul className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10">
              {data.items.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(c.id);
                      setCreating(false);
                    }}
                    className={cn("flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/5", selected === c.id && "bg-gunozu-400/10")}
                  >
                    <PlatformIcon platform={c.platform} className="size-4 shrink-0 text-buz-200" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-buz-50">{c.displayName}</span>
                      <span className="block truncate text-xs text-buz-400">
                        @{c.handle} · {c.title}
                      </span>
                    </span>
                    <span className="hidden text-xs text-buz-300 sm:inline">{c.className}</span>
                    <span className="w-20 text-right text-xs" style={{ color: `var(--color-${c.rarity})` }}>
                      {RARITY_INFO[c.rarity].label}
                    </span>
                    <span className="w-14 text-right text-xs tabular-nums text-buz-200">{formatNumber(c.points)}</span>
                    <MapPin aria-hidden className="size-4 text-buz-500" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-3 text-sm text-buz-200">
              <button type="button" className={secondary} disabled={data.page <= 1} onClick={() => setPage(data.page - 1)} aria-label="Önceki sayfa">
                <ChevronLeft aria-hidden className="size-4" />
              </button>
              Sayfa {data.page} / {data.pages}
              <button type="button" className={secondary} disabled={data.page >= data.pages} onClick={() => setPage(data.page + 1)} aria-label="Sonraki sayfa">
                <ChevronRight aria-hidden className="size-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Kart: bağlantılar ──

export function LinksCard() {
  const [links, setLinks] = useState<{ socialLinks: SocialLinks; supportUrl: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ socialLinks: SocialLinks; supportUrl: string | null }>("/baglantilar")
      .then((l) => setLinks({ socialLinks: l.socialLinks, supportUrl: l.supportUrl ?? "" }))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (!links) return <p className="text-sm text-buz-300">{error ?? "Yükleniyor…"}</p>;
  const setSocial = (p: Platform, v: string) => setLinks({ ...links, socialLinks: { ...links.socialLinks, [p]: v } });

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ message: string }>("/baglantilar", links);
      setMessage(`${result.message} Yayına almak için en alttaki komutlar.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {PLATFORMS.map((p) => (
          <Field key={p} title={PLATFORM_LABELS[p]}>
            <input className={input} value={links.socialLinks[p] ?? ""} placeholder="https://…" onChange={(e) => setSocial(p, e.target.value)} />
          </Field>
        ))}
      </div>
      <Field title="Destek bağlantısı" hint={'Boş bırakırsan üst menüdeki Destek düğmesi "yakında" der.'}>
        <input className={input} value={links.supportUrl} placeholder="https://… (boş: yakında)" onChange={(e) => setLinks({ ...links, supportUrl: e.target.value })} />
      </Field>
      {error && <p className="rounded-lg bg-alev-500/15 px-3 py-2 text-sm text-alev-200">{error}</p>}
      {message && <p className="rounded-lg bg-zumrut-400/10 px-3 py-2 text-sm text-zumrut-200">{message}</p>}
      <button type="button" className={primary} disabled={busy} onClick={() => void save()}>
        <Link2 aria-hidden className="size-4" />
        Bağlantıları kaydet
      </button>
    </div>
  );
}

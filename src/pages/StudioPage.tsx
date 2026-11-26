/**
 * REEL STÜDYOSU ( /studyo )
 *
 * Dünyayı dikey (9:16) sinematik kamerayla çekip Instagram Reels ve TikTok için video dosyası üretir:
 *   şablon seç (bölüm tanıtımı · Akın Günü · obaya katıl · Kut Kapısı · adsız ada · kahraman) → saati ve havayı ayarla →
 *   altyazıları düzenle → önizle → "Kaydet ve indir"
 *
 * Kayıt tarayıcıda yapılır, hiçbir şey sunucuya gönderilmez. Kapak görseli PNG olarak da indirilebilir.
 */
import { Canvas } from "@react-three/fiber";
import { Clapperboard, Download, Image as ImageIcon, Play, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CLASSES } from "../content/classes";
import { RARITY_INFO } from "../content/rarities";
import { REGIONS } from "../content/regions";
import { SectionTitle } from "../components/ui/SectionTitle";
import { TERRAIN_COLORS } from "../game/palette";
import { cn } from "../lib/cn";
import { lookupHero } from "../lib/roster";
import { useWorldTime } from "../state/useWorldTime";
import { WEATHERS, WORLD_SIZE } from "../types";
import type { Weather } from "../types";
import { ObaSound, scheduleRaidReel, soundSupported } from "../audio/obaSound";
import { REEL, ensureReelFonts } from "../studio/compositor";
import { downloadBlob, pickMimeType, recordingSupported, reelFilename, startRecording, type Recording } from "../studio/recorder";
import {
  TEMPLATE_IDS,
  TEMPLATE_LABELS,
  buildTemplate,
  createTimeline,
  signatureFrom,
  totalDuration,
  type StudioContext,
  type TemplateId,
  type Timeline,
} from "../studio/reel";
import { ReelPainter, StudioDevHandle, StudioDirector } from "../studio/StudioStage";
import { ISLAND_LIST } from "../content/islands";
import { LANDMARKS, VILLAGES } from "../world3d/layout";
import { useWorldScene } from "../world3d/useWorldScene";
import { WorldContent } from "../world3d/WorldContent";

/** Önizleme tuvali: 360 × 640, kayıtta 3 kat büyütülür (1080 × 1920). */
const STAGE = { width: REEL.width / 3, height: REEL.height / 3 };

const HOURS: readonly { id: string; label: string; hour: number | null | "sablon" }[] = [
  { id: "sablon", label: "Şablonun önerisi", hour: "sablon" },
  { id: "simdi", label: "Şimdiki adalar saati", hour: null },
  { id: "safak", label: "Şafak (06:30)", hour: 6.5 },
  { id: "ogle", label: "Öğle (12:00)", hour: 12 },
  { id: "ikindi", label: "İkindi (16:30)", hour: 16.5 },
  { id: "aksam", label: "Akşam ışıkları (19:30)", hour: 19.5 },
  { id: "gece", label: "Gece (22:00)", hour: 22 },
];

const WEATHER_LABELS: Readonly<Record<Weather, string>> = { acik: "Açık", kar: "Kar", tipi: "Tipi" };

type Status = { kind: "bos" } | { kind: "oynuyor" } | { kind: "kaydediyor" } | { kind: "bitti"; text: string } | { kind: "hata"; text: string };

export default function StudioPage() {
  const scene = useWorldScene();
  const { data, formation, boss, placements } = scene;
  const [template, setTemplate] = useState<TemplateId>(formation ? "bolum" : "katil");
  const [heroQuery, setHeroQuery] = useState("baturay");
  const [hourId, setHourId] = useState("sablon");
  const [weather, setWeather] = useState<Weather>(data.world.weather);
  const [showCards, setShowCards] = useState(true);
  const [signature, setSignature] = useState(() => signatureFrom(data.world.socialLinks.instagram));
  const [status, setStatus] = useState<Status>({ kind: "bos" });
  const compositorRef = useRef<HTMLCanvasElement>(null);
  const recordingRef = useRef<Recording | null>(null);
  const supported = useMemo(() => recordingSupported() && pickMimeType() !== null, []);
  // Müzik ve akın efektleri (kodla üretilir); videoya da girer.
  const [withSound, setWithSound] = useState(() => soundSupported());
  const soundRef = useRef<ObaSound | null>(null);

  // ── Şablonun dünyadaki yerleri ───────────────────────────────────
  const hero = useMemo(() => lookupHero(data.characters, heroQuery).hero, [data.characters, heroQuery]);
  const context = useMemo<StudioContext>(() => {
    const episode = data.activeEpisode;
    const poll = episode.polls[0];
    const heroPlacement = hero ? placements.get(hero.id) : undefined;
    return {
      // Açılış çekimi takımadanın ortasını (Kutada ve iki yanındaki adalar) kadraja alır.
      island: { x: WORLD_SIZE.width / 2, y: WORLD_SIZE.height / 2 },
      portal: LANDMARKS.kutKapisi,
      unnamedIsland: (() => {
        const named = new Set<string>(data.world.namedPlaces.map((p) => p.place));
        const island = ISLAND_LIST.find((i) => !named.has(i.id));
        return island ? { position: island.label, nickname: island.nickname } : null;
      })(),
      newcomers: data.characters.filter((c) => c.region === "kutada").length,
      village: VILLAGES[0].center,
      episode: { number: episode.number, title: episode.title, question: poll?.question ?? null, options: poll?.options.map((o) => o.label) ?? [] },
      raid: formation
        ? {
            square: formation.ground.square,
            focus: formation.ground.focus,
            facing: formation.facing,
            count: formation.slots.size,
            raiders: [...formation.slots.keys()].map((id) => data.characterById.get(id)).filter((c) => c !== undefined),
          }
        : null,
      boss: boss ? { name: boss.name } : null,
      hero:
        hero && heroPlacement
          ? {
              id: hero.id,
              position: heroPlacement.home,
              displayName: hero.displayName,
              handle: hero.handle,
              title: hero.title,
              rarity: RARITY_INFO[hero.rarity].label,
              className: CLASSES[hero.class.id].name,
              region: REGIONS[hero.region].name,
            }
          : null,
    };
  }, [data.activeEpisode, data.world.namedPlaces, data.characters, data.characterById, formation, boss, hero, placements]);

  const baseScript = useMemo(() => buildTemplate(template, context), [template, context]);
  // Altyazılar düzenlenebilir: şablon değişince şablonun önerisine döner.
  const [captionEdits, setCaptionEdits] = useState<{ template: TemplateId; text: string } | null>(null);
  const captionsText = captionEdits?.template === template ? captionEdits.text : baseScript.captions.join("\n");
  const script = useMemo(() => ({ ...baseScript, captions: captionsText.split("\n") }), [baseScript, captionsText]);
  const total = totalDuration(script.shots);

  // ── Paylaşılan zaman çizelgesi (sahnedeki yönetmen ve kompozitör okur) ─
  const timelineRef = useRef<Timeline>(createTimeline(script));
  useEffect(() => {
    const timeline = timelineRef.current;
    timeline.script = script;
    timeline.signature = signature.trim();
    timeline.showCards = showCards;
  }, [script, signature, showCards]);
  useEffect(() => {
    timelineRef.current.compositor = compositorRef.current;
    void ensureReelFonts();
  }, []);

  // ── Gün saati: stüdyodayken seçilen saat, çıkınca eski ayar ─────────
  const hourChoice = HOURS.find((h) => h.id === hourId)!.hour;
  const hour = hourChoice === "sablon" ? script.hour : hourChoice;
  useEffect(() => {
    const previous = useWorldTime.getState().settings;
    return () => useWorldTime.getState().setSettings(previous);
  }, []);
  useEffect(() => {
    const { settings, setSettings } = useWorldTime.getState();
    setSettings({ ...settings, override: hour, lapse: null });
  }, [hour]);

  // Kayıt sürerken sayfadan çıkılırsa kaydı ve sesi bırak.
  useEffect(
    () => () => {
      void recordingRef.current?.stop();
      void soundRef.current?.close();
    },
    [],
  );

  /** Her oynatmada temiz bir ses oturumu: eski zamanlanmış sesler iptal olur. Müzik ve (akında) efektler zamanlanır. */
  const startSound = async (): Promise<ObaSound | null> => {
    void soundRef.current?.close();
    soundRef.current = null;
    if (!withSound || !soundSupported()) return null;
    const sound = new ObaSound();
    await sound.resume();
    soundRef.current = sound;
    const t0 = sound.now + 0.05;
    sound.startMusic(0.8);
    if (script.raidDay) scheduleRaidReel(sound, t0, script.raidDay.start, total);
    return sound;
  };
  const stopSound = () => soundRef.current?.stopMusic(0.6);

  const play = async () => {
    await startSound();
    const timeline = timelineRef.current;
    timeline.onEnd = () => {
      stopSound();
      setStatus({ kind: "bos" });
    };
    timeline.restart = true;
    setStatus({ kind: "oynuyor" });
  };

  const stop = () => {
    const timeline = timelineRef.current;
    timeline.playing = false;
    timeline.onEnd = null;
    void soundRef.current?.close();
    soundRef.current = null;
    if (recordingRef.current) {
      void recordingRef.current.stop();
      recordingRef.current = null;
    }
    setStatus({ kind: "bos" });
  };

  const record = async () => {
    const canvas = compositorRef.current;
    if (!canvas) return;
    try {
      await ensureReelFonts();
      const timeline = timelineRef.current;
      const sound = await startSound();
      const recording = startRecording(canvas, 30, sound?.stream);
      recordingRef.current = recording;
      timeline.onEnd = () => {
        stopSound();
        recordingRef.current = null;
        void recording.stop().then(({ blob, extension }) => {
          downloadBlob(blob, reelFilename(template, extension));
          setStatus({ kind: "bitti", text: `Video indirildi (${extension.toUpperCase()}, ${(blob.size / 1_048_576).toFixed(1)} MB).` });
        });
      };
      timeline.restart = true;
      setStatus({ kind: "kaydediyor" });
    } catch (error) {
      setStatus({ kind: "hata", text: error instanceof Error ? error.message : "Kayıt başlatılamadı." });
    }
  };

  const downloadCover = () => {
    compositorRef.current?.toBlob((blob) => {
      if (blob) downloadBlob(blob, reelFilename(`${template}-kapak`, "png"));
    }, "image/png");
  };

  const busy = status.kind === "oynuyor" || status.kind === "kaydediyor";

  return (
    <>
      <title>Reel Stüdyosu · OBA-Tales</title>
      <meta name="description" content="OBA-Tales dünyasından dikey reel videoları: sinematik kamera, piksel altyazı ve kural kartları." />

      <SectionTitle
        as="h1"
        eyebrow="Reel Stüdyosu"
        title="Dünyadan dikey video"
        description="Şablon seç, saati ve havayı ayarla, altyazıları düzenle. Önizle ve Instagram Reels ya da TikTok için 9:16 videoyu indir."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[auto_1fr]">
        {/* Önizleme: görünen kompozitör tuvali; arkasında 3D dünya çizilir */}
        <div className="mx-auto w-full max-w-[360px]">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gece-950 shadow-2xl" style={{ aspectRatio: "9 / 16" }}>
            <div className="pointer-events-none absolute left-0 top-0 opacity-0" style={{ width: STAGE.width, height: STAGE.height }} aria-hidden>
              <Canvas
                orthographic
                flat
                dpr={1}
                shadows="percentage"
                gl={{ antialias: false, powerPreference: "high-performance" }}
                camera={{ position: [WORLD_SIZE.width / 2, 1500, WORLD_SIZE.height / 2 + 0.01], zoom: 1, near: 10, far: 4000 }}
                onCreated={({ gl }) => gl.setClearColor(TERRAIN_COLORS.deepSea)}
              >
                <WorldContent scene={scene} characters={data.characters} animate pixelSize={2} weather={weather} />
                <StudioDirector timeline={timelineRef} scene={scene} />
                <ReelPainter timeline={timelineRef} />
                <StudioDevHandle timeline={timelineRef} />
              </Canvas>
            </div>
            <canvas
              ref={compositorRef}
              width={REEL.width}
              height={REEL.height}
              className="pixelated absolute inset-0 h-full w-full"
              role="img"
              aria-label={`${TEMPLATE_LABELS[template]} önizlemesi`}
            />
            {status.kind === "kaydediyor" && (
              <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-kilim-500/90 px-2.5 py-1 text-xs font-semibold text-white">
                <span className="size-2 animate-pulse rounded-full bg-white" /> Kayıt
              </span>
            )}
          </div>
          <p className="mt-2 text-center text-xs text-buz-300">
            {total.toFixed(0)} saniye · 1080 × 1920 · 30 kare/sn
          </p>
        </div>

        {/* Denetimler */}
        <div className="grid content-start gap-5">
          <fieldset className="grid gap-2">
            <legend className="mb-1 font-display text-lg text-buz-50">Şablon</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {TEMPLATE_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={template === id}
                  disabled={busy}
                  onClick={() => setTemplate(id)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:opacity-50",
                    template === id ? "border-gunozu-400 bg-gunozu-400/15 text-gunozu-100" : "border-white/15 text-buz-200 hover:bg-white/5",
                  )}
                >
                  <span className="font-display">{TEMPLATE_LABELS[id]}</span>
                  {id === "bolum" && <span className="block text-xs text-buz-300">{formation ? `Bölüm ${data.activeEpisode.number} akın meydanı` : "Oba çekimleri"}</span>}
                  {id === "akin" && (
                    <span className="block text-xs text-buz-300">{formation ? "36 sn savaş: Öfke çubuğu ve takipçi adları" : "Aktif akın yok; bölüm tanıtımı çekilir"}</span>
                  )}
                  {id === "katil" && <span className="block text-xs text-buz-300">Sınıf ve çift iz kartları</span>}
                  {id === "kapi" && <span className="block text-xs text-buz-300">Gece portal, yeni gelenler, "nasıl gelirim?" kartı</span>}
                  {id === "ada" && <span className="block text-xs text-buz-300">Adsız bir adaya yorumla ad koyma çağrısı</span>}
                  {id === "kahraman" && <span className="block text-xs text-buz-300">Bir yoldaşı takip eden kamera</span>}
                </button>
              ))}
            </div>
          </fieldset>

          {template === "kahraman" && (
            <label className="grid gap-1 text-sm text-buz-200">
              Kahramanın kullanıcı adı
              <input
                value={heroQuery}
                onChange={(event) => setHeroQuery(event.target.value)}
                className="rounded-xl border border-white/15 bg-gece-950/80 px-3 py-2 text-buz-50 focus:border-gunozu-400/70"
                placeholder="@kullanici_adi"
              />
              <span className={cn("text-xs", hero ? "text-zumrut-300" : "text-kilim-400")}>
                {hero ? `${hero.displayName} · ${hero.title}` : "Bu adla bir yoldaş bulunamadı; katıl şablonu kullanılır."}
              </span>
            </label>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-buz-200">
              Gün saati
              <select
                value={hourId}
                onChange={(event) => setHourId(event.target.value)}
                className="rounded-xl border border-white/15 bg-gece-950/80 px-3 py-2 text-buz-50"
              >
                {HOURS.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm text-buz-200">
              Hava
              <select
                value={weather}
                onChange={(event) => setWeather(event.target.value as Weather)}
                className="rounded-xl border border-white/15 bg-gece-950/80 px-3 py-2 text-buz-50"
              >
                {WEATHERS.map((w) => (
                  <option key={w} value={w}>
                    {WEATHER_LABELS[w]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-1 text-sm text-buz-200">
            Altyazılar (her satır videonun bir bölümünde kelime kelime belirir)
            <textarea
              value={captionsText}
              onChange={(event) => setCaptionEdits({ template, text: event.target.value })}
              rows={5}
              className="rounded-xl border border-white/15 bg-gece-950/80 px-3 py-2 font-display text-buz-50 focus:border-gunozu-400/70"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-buz-200">
              İmza
              <input
                value={signature}
                onChange={(event) => setSignature(event.target.value)}
                maxLength={32}
                className="rounded-xl border border-white/15 bg-gece-950/80 px-3 py-2 text-buz-50 focus:border-gunozu-400/70"
              />
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-buz-200">
              <input type="checkbox" checked={showCards} onChange={(event) => setShowCards(event.target.checked)} className="size-4 accent-gunozu-400" />
              Kural kartlarını göster ({script.cards.length})
            </label>
            <label className="flex items-center gap-2 text-sm text-buz-200">
              <input type="checkbox" checked={withSound} disabled={busy || !soundSupported()} onChange={(event) => setWithSound(event.target.checked)} className="size-4 accent-gunozu-400" />
              Müzik ve efektler (davul, kopuz; akında nara, kalkan, ok sesleri): videoya da girer
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {busy ? (
              <button type="button" onClick={stop} className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2 font-display text-buz-50 hover:bg-white/10">
                <Square aria-hidden className="size-4" />
                Durdur
              </button>
            ) : (
              <>
                <button type="button" onClick={() => void play()} className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2 font-display text-buz-50 hover:bg-white/10">
                  <Play aria-hidden className="size-4" />
                  Önizle
                </button>
                <button
                  type="button"
                  onClick={() => void record()}
                  disabled={!supported}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gunozu-400/60 bg-gunozu-400/15 px-4 py-2 font-display text-gunozu-100 hover:bg-gunozu-400/25 disabled:opacity-50"
                >
                  <Clapperboard aria-hidden className="size-4" />
                  Kaydet ve indir
                </button>
              </>
            )}
            <button type="button" onClick={downloadCover} className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2 text-buz-100 hover:bg-white/10">
              <ImageIcon aria-hidden className="size-4" />
              Kapak indir (PNG)
            </button>
          </div>

          <div aria-live="polite" className="text-sm">
            {status.kind === "kaydediyor" && <p className="text-buz-100">Kaydediliyor… Video bitince kendiliğinden iner. Bu sekmeyi açık tut.</p>}
            {status.kind === "oynuyor" && <p className="text-buz-200">Önizleme oynuyor.</p>}
            {status.kind === "bitti" && (
              <p className="inline-flex items-center gap-1.5 text-zumrut-300">
                <Download aria-hidden className="size-4" />
                {status.text}
              </p>
            )}
            {status.kind === "hata" && <p className="text-kilim-400">{status.text}</p>}
            {!supported && (
              <p className="text-buz-300">
                Bu tarayıcı video kaydını desteklemiyor. Chrome, Edge ya da Safari'nin güncel sürümünü dene; kapak görselini her tarayıcıda indirebilirsin.
              </p>
            )}
          </div>

          <p className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-buz-300">
            İpucu: Yazılar Reels ve TikTok arayüzüyle çakışmasın diye ekranın ortasında durur. Kayıt tarayıcında yapılır; hiçbir
            şey bir sunucuya gönderilmez. Kayıt sırasında sekmeyi değiştirme: arka plandaki sekmelerde tarayıcı kareleri yavaşlatır.
          </p>
        </div>
      </div>
    </>
  );
}

/**
 * REEL SENARYOSU — dikey (9:16) kısa videonun çekimleri, altyazıları ve kural kartları (saf fonksiyonlar, testli).
 *
 *   çekim (Shot)     kamera bir pozdan ötekine akar: yer, yakınlık, yörünge açısı; istersen bir karakteri takip eder
 *   altyazı          her satır kendi zaman diliminde kelime kelime belirir (son kelime altın renkte)
 *   kural kartı      belli bir anda açılıp kapanan bilgi kartı ("Instagram → Kalkaneri" gibi)
 *
 * Şablonlar dünyadaki gerçek yerlerden kurulur: aktif bölümün akın meydanı ve boss'u, Akınburnu obası, seçilen kahraman.
 */
import type { Coordinates } from "../types";

export interface CamPose {
  /** Bakılan nokta (dünya birimi). */
  x: number;
  z: number;
  /** Dünya yakınlığı (1 = bütün adalar). */
  zoom: number;
  /** Yörünge açısı (radyan): 0 = kamera güneyde, kuzeye bakar. */
  yaw: number;
  /** Dikeyden eğim (radyan); verilmezse yakınlığa göre otomatik. */
  tilt?: number;
  /** Bu karakteri takip et (yürürken de kadrajda kalsın). */
  follow?: string;
}

export type Ease = "inOut" | "out" | "linear";

export interface Shot {
  duration: number;
  from: CamPose;
  to: CamPose;
  ease?: Ease;
}

export interface RuleCard {
  /** Başlama anı (saniye). */
  at: number;
  duration: number;
  title: string;
  lines: string[];
}

export const TEMPLATE_IDS = ["bolum", "katil", "kapi", "ada", "kahraman"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const TEMPLATE_LABELS: Readonly<Record<TemplateId, string>> = {
  bolum: "Bölüm tanıtımı",
  katil: "Obaya katıl çağrısı",
  kapi: "Kut Kapısı: yeni gelenler",
  ada: "Adsız adaya ad koy",
  kahraman: "Kahraman yakın çekimi",
};

export interface ReelScript {
  template: TemplateId;
  shots: Shot[];
  captions: string[];
  cards: RuleCard[];
  /** Önerilen gün saati (null = şimdiki adalar saati). */
  hour: number | null;
}

// ── Zaman çizelgesi ────────────────────────────────────────────────

/** Stüdyonun paylaşılan oynatma durumu: arayüz değiştirir, sahnedeki yönetmen ve kompozitör her karede okur. */
export interface Timeline {
  script: ReelScript;
  /** Videonun şu anki saniyesi. */
  t: number;
  playing: boolean;
  /** Bir sonraki karede başa sar ve oynat. */
  restart: boolean;
  startedAt: number;
  /** Sona gelince çağrılır (kayıt burada biter). */
  onEnd: (() => void) | null;
  signature: string;
  showCards: boolean;
  compositor: HTMLCanvasElement | null;
}

export function createTimeline(script: ReelScript): Timeline {
  return { script, t: 0, playing: false, restart: false, startedAt: 0, onEnd: null, signature: "", showCards: true, compositor: null };
}

export function totalDuration(shots: readonly Shot[]): number {
  return shots.reduce((sum, s) => sum + s.duration, 0);
}

const EASES: Readonly<Record<Ease, (t: number) => number>> = {
  linear: (t) => t,
  out: (t) => 1 - (1 - t) ** 3,
  inOut: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** t anındaki kamera pozu. Yakınlık logaritmik akar (yakınlaşma hızı her ölçekte aynı hissettirir). */
export function cameraAt(shots: readonly Shot[], t: number): { pose: CamPose; shot: number } {
  if (shots.length === 0) return { pose: { x: 500, z: 350, zoom: 1, yaw: 0 }, shot: 0 };
  let start = 0;
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const last = i === shots.length - 1;
    if (t < start + shot.duration || last) {
      const local = Math.min(1, Math.max(0, (t - start) / shot.duration));
      const k = EASES[shot.ease ?? "inOut"](local);
      const { from, to } = shot;
      const tilt = from.tilt !== undefined && to.tilt !== undefined ? lerp(from.tilt, to.tilt, k) : undefined;
      return {
        shot: i,
        pose: {
          x: lerp(from.x, to.x, k),
          z: lerp(from.z, to.z, k),
          zoom: Math.exp(lerp(Math.log(from.zoom), Math.log(to.zoom), k)),
          yaw: lerp(from.yaw, to.yaw, k),
          tilt,
          follow: to.follow ?? from.follow,
        },
      };
    }
    start += shot.duration;
  }
  return { pose: shots[shots.length - 1].to, shot: shots.length - 1 };
}

/** Kamera konumunun bakılan noktaya göre yönü (birim vektör, Three.js x/y/z). */
export function cameraDirection(yaw: number, tilt: number): [number, number, number] {
  return [Math.sin(tilt) * Math.sin(yaw), Math.cos(tilt), Math.sin(tilt) * Math.cos(yaw)];
}

// ── Altyazı ────────────────────────────────────────────────────────

/** Kelimelerin belirme aralığı (saniye). */
export const WORD_INTERVAL = 0.3;

export interface CaptionState {
  /** Satırın bütün kelimeleri. */
  words: string[];
  /** Şu an görünen kelime sayısı. */
  shown: number;
  /** Son beliren kelimenin yaşı (saniye; belirme animasyonu için). */
  age: number;
}

/**
 * t anındaki altyazı: satırlar videoya eşit dilimlerle yayılır; her satır diliminin başında kelime kelime belirir,
 * dilimin sonuna kadar ekranda kalır (dilimler arasında kısa bir boşluk).
 */
export function captionAt(captions: readonly string[], t: number, total: number): CaptionState | null {
  const lines = captions.map((c) => c.trim()).filter(Boolean);
  if (lines.length === 0 || total <= 0 || t < 0 || t >= total) return null;
  const slot = total / lines.length;
  const index = Math.min(lines.length - 1, Math.floor(t / slot));
  const local = t - index * slot - 0.15;
  if (local < 0 || local > slot - 0.3) return null;
  const words = lines[index].split(/\s+/);
  const shown = Math.min(words.length, Math.floor(local / WORD_INTERVAL) + 1);
  const age = local - (shown - 1) * WORD_INTERVAL;
  return { words, shown, age };
}

// ── Kural kartı ────────────────────────────────────────────────────

export interface CardState {
  card: RuleCard;
  /** Açılma/kapanma animasyonu: 0 → 1 (tam açık) → 0. */
  presence: number;
}

const CARD_FADE = 0.25;

export function cardAt(cards: readonly RuleCard[], t: number): CardState | null {
  for (const card of cards) {
    const local = t - card.at;
    if (local < 0 || local > card.duration) continue;
    const presence = Math.min(1, local / CARD_FADE, (card.duration - local) / CARD_FADE);
    return { card, presence: Math.max(0, presence) };
  }
  return null;
}

// ── Şablonlar ──────────────────────────────────────────────────────

export interface StudioContext {
  island: Coordinates;
  village: Coordinates;
  /** Kut Kapısı: yeni yoldaşların geldiği portal. */
  portal: Coordinates;
  /** Henüz adı konmamış bir yabani ada (yoksa null). */
  unnamedIsland: { position: Coordinates; nickname: string } | null;
  /** Kutada'daki yeni yoldaş sayısı. */
  newcomers: number;
  episode: { number: number; title: string; question: string | null; options: string[] };
  raid: { square: Coordinates; focus: Coordinates; facing: number; count: number } | null;
  boss: { name: string } | null;
  hero: { id: string; position: Coordinates; displayName: string; handle: string; title: string; rarity: string; className: string; region: string } | null;
}

const upper = (text: string) => text.toLocaleUpperCase("tr");

function episodeTemplate(ctx: StudioContext): ReelScript {
  const { island, episode, raid, boss } = ctx;
  const captionsTail = ["Kararı yorumlarda sen ver!"];
  const cards: RuleCard[] = [];
  let shots: Shot[];
  let captions: string[];

  if (raid) {
    // Kamera akıncıların arkasından boss'a doğru bakar.
    const behind = raid.facing + Math.PI;
    const mid = { x: (raid.square.x + raid.focus.x) / 2, z: (raid.square.y + raid.focus.y) / 2 };
    const square = { x: raid.square.x, z: raid.square.y };
    const focus = { x: raid.focus.x, z: raid.focus.y };
    shots = [
      { duration: 3.5, from: { x: island.x, z: island.y, zoom: 1, yaw: 0 }, to: { ...square, zoom: 2.4, yaw: behind * 0.5 } },
      { duration: 3.5, from: { ...square, zoom: 2.6, yaw: behind * 0.5 }, to: { ...square, zoom: 9, yaw: behind + 0.25 } },
      { duration: 4, from: { ...square, zoom: 9, yaw: behind + 0.25 }, to: { ...square, zoom: 10, yaw: behind - 0.45 }, ease: "linear" },
      { duration: 3.5, from: { ...mid, zoom: 10, yaw: behind - 0.45 }, to: { ...focus, zoom: 15, yaw: behind } },
      { duration: 3.5, from: { ...focus, zoom: 15, yaw: behind }, to: { ...mid, zoom: 5.5, yaw: behind + 0.2 } },
    ];
    captions = [
      `Bölüm ${episode.number}: ${episode.title}`,
      boss ? `${boss.name} yolu kapattı!` : "Oba akına hazırlanıyor!",
      `${raid.count} akıncı meydanda saf tuttu`,
      episode.question ?? "Oba ne yapmalı?",
      ...captionsTail,
    ];
  } else {
    const village = { x: ctx.village.x, z: ctx.village.y };
    shots = [
      { duration: 4, from: { x: island.x, z: island.y, zoom: 1, yaw: 0 }, to: { ...village, zoom: 4, yaw: 0.2 } },
      { duration: 5, from: { ...village, zoom: 7, yaw: 0.3 }, to: { ...village, zoom: 9, yaw: -0.4 }, ease: "linear" },
      { duration: 5, from: { ...village, zoom: 9, yaw: -0.4 }, to: { ...village, zoom: 4, yaw: 0 } },
    ];
    captions = [`Bölüm ${episode.number}: ${episode.title}`, "Oba yola çıkıyor!", episode.question ?? "Oba ne yapmalı?", ...captionsTail];
  }

  const total = totalDuration(shots);
  if (episode.options.length > 0) cards.push({ at: total - 4.6, duration: 4.3, title: "YORUMLARA YAZ", lines: episode.options.map(upper) });
  return { template: "bolum", shots, captions, cards, hour: null };
}

function joinTemplate(ctx: StudioContext): ReelScript {
  const village = { x: ctx.village.x, z: ctx.village.y };
  const portal = { x: ctx.portal.x, z: ctx.portal.y };
  // Yeni yoldaşın yolculuğu: takımadanın ortası → Kut Kapısı (ilk adım) → kendi obası.
  const shots: Shot[] = [
    { duration: 3.5, from: { x: ctx.island.x, z: ctx.island.y, zoom: 1, yaw: 0 }, to: { ...portal, zoom: 7, yaw: 0.3 } },
    { duration: 5, from: { ...portal, zoom: 9, yaw: 0.3 }, to: { ...portal, zoom: 12, yaw: -0.5 }, ease: "linear" },
    { duration: 3.5, from: { ...village, zoom: 9, yaw: -0.4 }, to: { ...village, zoom: 15, yaw: -0.1 } },
    { duration: 4, from: { ...village, zoom: 15, yaw: -0.1 }, to: { ...village, zoom: 4, yaw: 0.25 } },
  ];
  return {
    template: "katil",
    shots,
    captions: ["OBA-Tales dünyasına hoş geldin!", "Kut Kapısı'ndan ilk adımını at", "Takip ettiğin platform sınıfını seçer", "Obada yerin hazır: katıl!"],
    cards: [
      // Platform adları marka yazımıyla, sınıf adları Türkçe büyük harfle (Kalkaneri → KALKANERİ).
      { at: 4, duration: 4.6, title: "SINIFINI SEÇ", lines: [`INSTAGRAM → ${upper("Kalkaneri")}`, `TIKTOK → ${upper("Okyeli")}`, `YOUTUBE → ${upper("Ocakcan")}`] },
      { at: 9.4, duration: 4.2, title: "ÇİFT İZ", lines: ["2 PLATFORM: BİR KADEME NADİR", "3 PLATFORM: OBA ÖNCÜLÜĞÜ"] },
    ],
    // Akşam: obada ışıklar yanar, en sıcak görüntü.
    hour: 19.4,
  };
}

/** Kut Kapısı: gece parlayan portal, çevresinde yeni gelenler. "Takip et, karakterin buradan doğsun." */
function portalTemplate(ctx: StudioContext): ReelScript {
  const portal = { x: ctx.portal.x, z: ctx.portal.y };
  const near = { x: ctx.portal.x, z: ctx.portal.y + 30 };
  const shots: Shot[] = [
    { duration: 3.2, from: { x: ctx.island.x, z: ctx.island.y, zoom: 1, yaw: 0 }, to: { ...portal, zoom: 5, yaw: 0.2 } },
    { duration: 5, from: { ...portal, zoom: 6.5, yaw: 0.2 }, to: { ...portal, zoom: 8, yaw: -1.4 }, ease: "linear" },
    { duration: 4, from: { ...near, zoom: 12, yaw: -1.4 }, to: { ...near, zoom: 16, yaw: -0.6 } },
    { duration: 3.5, from: { ...near, zoom: 16, yaw: -0.6 }, to: { ...portal, zoom: 4, yaw: 0 } },
  ];
  const count = ctx.newcomers > 0 ? `Bu hafta ${ctx.newcomers} yeni yoldaş geldi` : "Her yeni takipçi buradan gelir";
  return {
    template: "kapi",
    shots,
    captions: ["Kut Kapısı açıldı!", count, "Takip et, karakterin buradan doğsun", "Sıradaki sensin!"],
    cards: [{ at: 8.6, duration: 4.6, title: "NASIL GELİRİM?", lines: ["1. TAKİP ET", "2. YORUMA ADINI YAZ", "3. KUT KAPISI'NDAN DOĞ"] }],
    // Gece: girdap ve huzme en parlak hâlinde.
    hour: 20.5,
  };
}

/** Adsız ada: topluluğa ad koyma çağrısı. */
function islandTemplate(ctx: StudioContext): ReelScript {
  const island = ctx.unnamedIsland;
  if (!island) return joinTemplate(ctx);
  const at = { x: island.position.x, z: island.position.y };
  const shots: Shot[] = [
    { duration: 3.4, from: { x: ctx.island.x, z: ctx.island.y, zoom: 1, yaw: 0 }, to: { ...at, zoom: 2.6, yaw: 0.3 } },
    { duration: 5.5, from: { ...at, zoom: 3, yaw: 0.3 }, to: { ...at, zoom: 4.2, yaw: -1.2 }, ease: "linear" },
    { duration: 4, from: { ...at, zoom: 5, yaw: -1.2 }, to: { ...at, zoom: 2, yaw: -0.4 } },
  ];
  return {
    template: "ada",
    shots,
    captions: ["Bu adanın adı yok", `Haritacılar ${island.nickname} diyor`, "Adını sen koy!", "En beğenilen yorum kazanır"],
    cards: [{ at: 7.2, duration: 4.8, title: "ADINI SEN KOY", lines: ["YORUMA ADA İÇİN BİR AD YAZ", "EN ÇOK BEĞENİLEN KAZANIR", "HARİTADA: ADINI KOYAN @SEN"] }],
    // Akşamüstü: adalar altın ışıkta.
    hour: 17.4,
  };
}

function heroTemplate(ctx: StudioContext): ReelScript {
  const hero = ctx.hero;
  if (!hero) return joinTemplate(ctx);
  const at = { x: hero.position.x, z: hero.position.y, follow: hero.id };
  const shots: Shot[] = [
    { duration: 4, from: { ...at, zoom: 4, yaw: 0 }, to: { ...at, zoom: 12, yaw: 0.3 } },
    { duration: 4.5, from: { ...at, zoom: 18, yaw: 0.3 }, to: { ...at, zoom: 20, yaw: -0.5 }, ease: "linear" },
    { duration: 2.5, from: { ...at, zoom: 20, yaw: -0.5 }, to: { ...at, zoom: 9, yaw: -0.2 } },
  ];
  return {
    template: "kahraman",
    shots,
    captions: [hero.displayName, `${hero.title} · ${hero.rarity}`, `@${hero.handle} obada!`],
    cards: [{ at: 4.6, duration: 4.4, title: upper(hero.displayName), lines: [`SINIF: ${upper(hero.className)}`, `NADİRLİK: ${upper(hero.rarity)}`, `BÖLGE: ${upper(hero.region)}`] }],
    hour: null,
  };
}

export function buildTemplate(id: TemplateId, ctx: StudioContext): ReelScript {
  switch (id) {
    case "bolum":
      return episodeTemplate(ctx);
    case "katil":
      return joinTemplate(ctx);
    case "kapi":
      return portalTemplate(ctx);
    case "ada":
      return islandTemplate(ctx);
    case "kahraman":
      return heroTemplate(ctx);
  }
}

/** Instagram adresinden imza: "https://www.instagram.com/oba.tales/" → "@oba.tales". */
export function signatureFrom(url: string | null): string {
  if (!url) return "";
  const handle = url.replace(/\/+$/, "").split("/").pop() ?? "";
  return handle ? `@${handle.replace(/^@/, "")}` : "";
}

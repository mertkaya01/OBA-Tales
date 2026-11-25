/**
 * GÖKYÜZÜ — OBA-Tales dünyasında gün ve gece.
 *
 * Adaların saati İstanbul saatidir: herkes aynı anda aynı akşamı görür. Saat (0–24) bir anahtar kare
 * tablosundan ışıkların rengine ve gücüne çevrilir:
 *   şafak → pembe, alçak güneş · öğle → beyaz, güçlü güneş · akşam → turuncu, uzun gölgeler
 *   gece  → mavi ay ışığı; çadır kapıları, fenerler ve şenlik ocağı yanar.
 *
 * Bu modül Three.js bilmez: saf fonksiyonlardır ve testlerde doğrulanır.
 */

/** Adaların saat dilimi. */
export const WORLD_TIME_ZONE = "Europe/Istanbul";

export type Rgb = readonly [number, number, number];

export interface SkyState {
  /** Işığın geldiği yön (birim vektör, Three.js x/y/z). */
  lightDirection: [number, number, number];
  /** Işık kaynağı güneş mi, ay mı? */
  source: "gunes" | "ay";
  lightColor: Rgb;
  lightIntensity: number;
  skyColor: Rgb;
  groundColor: Rgb;
  hemiIntensity: number;
  /** Açılmamış bölgeleri boyayan sis rengi. */
  mist: Rgb;
  /** Fenerler ve çadır ışıkları: 0 = sönük (gündüz), 1 = tam (gece). */
  lamp: number;
  /** Son işlemdeki renk doygunluğu. */
  saturation: number;
  /** Deniz yüzeyinin parlaklık çarpanı. */
  sea: number;
}

type Key = Omit<SkyState, "lightDirection" | "source"> & { hour: number };

const hex = (value: string): Rgb => {
  const n = Number.parseInt(value.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

// Gece karanlık ama okunaklı: mavi ay ışığı, karakterler ve renkleri seçilebilir kalır.
const NIGHT: Omit<Key, "hour"> = {
  lightColor: hex("#a9bfff"),
  lightIntensity: 0.95,
  skyColor: hex("#4a5f9c"),
  groundColor: hex("#1f2840"),
  hemiIntensity: 1.35,
  mist: hex("#4a5874"),
  lamp: 1,
  saturation: 0.96,
  sea: 0.5,
};

/** Gün doğumu ve batımı: ışık kaynağı bu saatlerde güneşle ay arasında el değiştirir. */
export const SUNRISE = 5.5;
export const SUNSET = 18.75;

const KEYS: readonly Key[] = [
  { hour: 0, ...NIGHT },
  { hour: 4.6, ...NIGHT },
  {
    hour: SUNRISE,
    lightColor: hex("#b9a6ff"),
    lightIntensity: 0.05,
    skyColor: hex("#6a6a9c"),
    groundColor: hex("#262438"),
    hemiIntensity: 1.1,
    mist: hex("#6c6c8a"),
    lamp: 0.8,
    saturation: 0.98,
    sea: 0.6,
  },
  {
    hour: 6.6,
    lightColor: hex("#ffb38a"),
    lightIntensity: 1.3,
    skyColor: hex("#d2b8d4"),
    groundColor: hex("#3f3a52"),
    hemiIntensity: 1.25,
    mist: hex("#a9a4bf"),
    lamp: 0.2,
    saturation: 1.06,
    sea: 0.85,
  },
  {
    hour: 8,
    lightColor: hex("#fff0d8"),
    lightIntensity: 2.3,
    skyColor: hex("#dbeeff"),
    groundColor: hex("#4a5a6a"),
    hemiIntensity: 1.45,
    mist: hex("#b9cadb"),
    lamp: 0,
    saturation: 1.12,
    sea: 1,
  },
  {
    hour: 12,
    lightColor: hex("#fff6e8"),
    lightIntensity: 2.7,
    skyColor: hex("#e2f1ff"),
    groundColor: hex("#4f5f6f"),
    hemiIntensity: 1.55,
    mist: hex("#bccdde"),
    lamp: 0,
    saturation: 1.12,
    sea: 1,
  },
  {
    hour: 16,
    lightColor: hex("#ffe4bc"),
    lightIntensity: 2.5,
    skyColor: hex("#dbe8f6"),
    groundColor: hex("#4f5868"),
    hemiIntensity: 1.45,
    mist: hex("#b9c6d6"),
    lamp: 0,
    saturation: 1.12,
    sea: 1,
  },
  {
    hour: 17.6,
    lightColor: hex("#ff9a5c"),
    lightIntensity: 1.7,
    skyColor: hex("#f0b9a2"),
    groundColor: hex("#4a3a50"),
    hemiIntensity: 1.25,
    mist: hex("#b8a3b0"),
    lamp: 0.35,
    saturation: 1.1,
    sea: 0.8,
  },
  {
    hour: SUNSET,
    lightColor: hex("#ff7a50"),
    lightIntensity: 0.05,
    skyColor: hex("#7a6a9a"),
    groundColor: hex("#2a2238"),
    hemiIntensity: 1.1,
    mist: hex("#6f6680"),
    lamp: 0.85,
    saturation: 1,
    sea: 0.6,
  },
  { hour: 20, ...NIGHT },
  { hour: 24, ...NIGHT },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpRgb = (a: Rgb, b: Rgb, t: number): Rgb => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Saati 0–24 aralığına sarar. */
export function wrapHour(hour: number): number {
  return ((hour % 24) + 24) % 24;
}

/**
 * Işığın yönü. Güneş doğudan doğar, öğlen güneyden (kameranın arkasından) en yükseğe çıkar, batıda batar.
 * Ay da gece aynı yayı izler. Yükseklik hiçbir zaman çok düşmez; gölgeler sonsuza uzamasın.
 */
export function lightDirectionAt(hour: number): { direction: [number, number, number]; source: SkyState["source"] } {
  const h = wrapHour(hour);
  const isDay = h >= SUNRISE && h <= SUNSET;
  const progress = isDay ? (h - SUNRISE) / (SUNSET - SUNRISE) : wrapHour(h - SUNSET) / (24 - (SUNSET - SUNRISE));
  const elevation = isDay ? (12 + 40 * Math.sin(Math.PI * progress)) * (Math.PI / 180) : (28 + 22 * Math.sin(Math.PI * progress)) * (Math.PI / 180);
  // İlerleme 0 → doğu (+x), 0,5 → güney (+z), 1 → batı (−x).
  const hx = Math.cos(Math.PI * progress);
  const hz = Math.sin(Math.PI * progress);
  const c = Math.cos(elevation);
  return { direction: [hx * c, Math.sin(elevation), hz * c], source: isDay ? "gunes" : "ay" };
}

export function skyAt(hour: number): SkyState {
  const h = wrapHour(hour);
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].hour <= h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = b.hour === a.hour ? 0 : (h - a.hour) / (b.hour - a.hour);
  const { direction, source } = lightDirectionAt(h);
  return {
    lightDirection: direction,
    source,
    lightColor: lerpRgb(a.lightColor, b.lightColor, t),
    lightIntensity: lerp(a.lightIntensity, b.lightIntensity, t),
    skyColor: lerpRgb(a.skyColor, b.skyColor, t),
    groundColor: lerpRgb(a.groundColor, b.groundColor, t),
    hemiIntensity: lerp(a.hemiIntensity, b.hemiIntensity, t),
    mist: lerpRgb(a.mist, b.mist, t),
    lamp: lerp(a.lamp, b.lamp, t),
    saturation: lerp(a.saturation, b.saturation, t),
    sea: lerp(a.sea, b.sea, t),
  };
}

/** Fenerlerin, denizin ve son işlemin her karede okuduğu gökyüzü durumu (DayNight günceller). */
export interface SkyRuntime {
  hour: number;
  lamp: number;
  saturation: number;
  sea: number;
}

export function createSkyRuntime(): SkyRuntime {
  return { hour: 12, lamp: 0, saturation: 1.12, sea: 1 };
}

// ── Gün evreleri ve saat ───────────────────────────────────────────

export type DayPhaseId = "safak" | "sabah" | "ogle" | "ikindi" | "aksam" | "gece";

export const DAY_PHASES: Readonly<Record<DayPhaseId, string>> = {
  safak: "Şafak",
  sabah: "Sabah",
  ogle: "Öğle",
  ikindi: "İkindi",
  aksam: "Akşam",
  gece: "Gece",
};

export function dayPhase(hour: number): DayPhaseId {
  const h = wrapHour(hour);
  if (h >= 5 && h < 7) return "safak";
  if (h >= 7 && h < 11) return "sabah";
  if (h >= 11 && h < 15) return "ogle";
  if (h >= 15 && h < 18) return "ikindi";
  if (h >= 18 && h < 20) return "aksam";
  return "gece";
}

/** Verilen andaki adalar saati (İstanbul), kesirli: 19.5 = 19:30. */
export function worldHour(date: Date, timeZone: string = WORLD_TIME_ZONE): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") + get("minute") / 60 + get("second") / 3600;
}

/** "19:30" biçiminde saat. */
export function formatHour(hour: number): string {
  const totalMinutes = Math.floor(wrapHour(hour) * 60);
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

/**
 * Adresteki ?saat=21 ya da ?saat=21:30 değerini okur (gün ve geceyi denemek için).
 * Geçersizse null.
 */
export function parseHourOverride(search: string): number | null {
  const raw = new URLSearchParams(search).get("saat");
  if (!raw) return null;
  const match = /^(\d{1,2})(?::(\d{2}))?$/.exec(raw.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (hour > 23 || minute > 59) return null;
  return hour + minute / 60;
}

/** Hızlı zaman: bir tam gün bu kadar milisaniyede geçer. */
export const TIME_LAPSE_DAY_MS = 120_000;

export interface WorldTimeSettings {
  /** ?saat= ile sabitlenmiş saat. */
  override: number | null;
  /** Hızlı zaman açıldıysa başladığı an ve o anki saat. */
  lapse: { startedAt: number; startHour: number } | null;
}

/** Ayarlara göre şu anki adalar saati. */
export function currentWorldHour(nowMs: number, settings: WorldTimeSettings): number {
  if (settings.lapse) return wrapHour(settings.lapse.startHour + ((nowMs - settings.lapse.startedAt) / TIME_LAPSE_DAY_MS) * 24);
  if (settings.override !== null) return settings.override;
  return worldHour(new Date(nowMs));
}

/** Sezonun kaçıncı günü (ilk bölümün yayın günü = 1. gün); başlangıç yoksa null. */
export function seasonDay(startIso: string | null, nowMs: number): number | null {
  if (!startIso) return null;
  const start = Date.parse(startIso);
  if (Number.isNaN(start) || nowMs < start) return null;
  return Math.floor((nowMs - start) / 86_400_000) + 1;
}

/**
 * METİN YARDIMCILARI — Türkçe duyarsız arama, kimlik (slug) üretimi ve sayı/tarih biçimleme.
 */

/**
 * Aramada karşılaştırma için metni sadeleştirir:
 *   "KÜRŞAT" → "kursat", "Işıkay" → "isikay", "  Şimşek   Kız " → "simsek kiz"
 * Türkçe büyük/küçük harf kurallarıyla küçültür (I → ı, İ → i), aksanları atar, ı'yı i yapar.
 */
export function normalizeSearch(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/g, "i")
    .replace(/\s+/g, " ")
    .trim();
}

/** Arama sorgusunu kelimelere böler; her kelime ayrı ayrı aranır (AND). */
export function searchTokens(query: string): string[] {
  const normalized = normalizeSearch(query);
  return normalized ? normalized.split(" ") : [];
}

/**
 * Metinden URL ve JSON dostu kimlik üretir.
 *   slugify("Buz.Kalkan_42")      → "buz-kalkan-42"
 *   slugify("Şimşek Kız", "_")    → "simsek_kiz"
 */
export function slugify(text: string, separator: "-" | "_" = "-"): string {
  return normalizeSearch(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join(separator);
}

const numberFormat = new Intl.NumberFormat("tr-TR");
const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
});

/** 1203 → "1.203" */
export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** "2026-11-24T18:00:00+03:00" → "24 Kasım 2026" (Türkiye saatine göre). Geçersizse boş metin. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : dateFormat.format(date);
}

const airFormat = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});

/** "2026-12-01T19:00:00+03:00" → "1 Aralık Salı 19:00" (Türkiye saatine göre). Geçersizse boş metin. */
export function formatAirTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(airFormat.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.day} ${parts.month} ${parts.weekday} ${parts.hour}:${parts.minute}`;
}

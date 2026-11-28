/**
 * YORUMLA KATILMA — yorumlardan kahraman adı ve yer adı önerisi okur.
 *
 * Kahraman adı (kişi bu adla haritada doğar; yeniden yazarsa en son yazdığı geçer):
 *   "ad: Kara Şahin"   "isim: …"   "kahraman: …"   "katıl: …"   "#katıl Kara Şahin"   "!ad Kara Şahin"
 *   "adım Kara Şahin"  "ismim …"   "kahramanım …"  "obaya katıl Kara Şahin"  (iyelikli biçimlerde ":" gerekmez)
 * Yer adı önerisi (ad koyma oylaması; en çok beğenilen yorum kazanır):
 *   "yer: Yıldız Koyu"   "ada: …"   "öneri: …"   "ad önerim: …"   "#yer …"
 *
 * Komut satırın başında olmalı (önünde emoji ya da @etiket olabilir). Böylece "ad koymak çok güzel" ya da
 * "adımı yazdım" gibi sıradan cümleler komut sayılmaz. Bulunan ad temizlenir ve denetlenir: küfürlü, bağlantılı,
 * kadroyu ya da siteyi taklit eden, çok kısa veya çok uzun adlar kabul edilmez (kişi yine katılır, adı kullanıcı adı olur).
 *
 * Saf ve testli (heroNames.test.ts); hem tarayıcıdaki panelde hem Node betiklerinde çalışır.
 */

/** Kahraman adı en çok bu kadar harf olabilir (kartlara ve plakalara sığsın). */
export const HERO_NAME_MAX = 24;
/** Yer adı en çok bu kadar harf olabilir (world.json şeması 40'a izin verir; haritada okunaklı kalsın). */
export const PLACE_NAME_MAX = 32;
const NAME_MIN = 2;
const MAX_WORDS = 4;

const SEP = String.raw`\s*[:=\-–—]\s*`;
/** "adım X": ayraç gerekmez, boşluk yeter ("adım adım", "adım attık" gibi deyimler hariç). */
const POSSESSIVE = String.raw`(?:ad[ıi]m(?!\s+(?:ad[ıi]m(?:\s|$)|at(?:t|[ıi]yor|maya|mak|ar(?:\s|$|[ıi]z|s))))|[ıi]smim|kahraman[ıi]m(?:[ıi]n\s+ad[ıi])?|kahraman\s+ad[ıi]m|obaya\s+kat[ıi]l(?:[ıi]yorum)?)`;
/** "ad: X": ayraç (ya da başta # / !) şart; yoksa sıradan cümlelerle karışır. */
const PLAIN = String.raw`(?:ad(?!\s+[öo]neri)|[ıi]sim|kahraman(?:\s+ad[ıi])?|kat[ıi]l)`;
const PLACE = String.raw`(?:yer(?:\s+ad[ıi])?|ada(?:\s+ad[ıi])?|ad\s+[öo]neri(?:m)?|[öo]neri(?:m)?)`;

const NAME_PATTERNS = [
  new RegExp(String.raw`^[#!]\s*(?:${POSSESSIVE}|${PLAIN})(?:${SEP}|\s+)(.+)$`, "iu"),
  new RegExp(String.raw`^${POSSESSIVE}(?:${SEP}|\s+)(.+)$`, "iu"),
  new RegExp(String.raw`^${PLAIN}${SEP}(.+)$`, "iu"),
];
const PLACE_PATTERNS = [new RegExp(String.raw`^[#!]\s*${PLACE}(?:${SEP}|\s+)(.+)$`, "iu"), new RegExp(String.raw`^${PLACE}${SEP}(.+)$`, "iu")];

/** Bağlantı izi: adlarda kabul edilmez. */
const LINK = /https?:|www\.|\.(?:com|net|org|tr|io|gg|ly|me)\b/i;
/** Satır başındaki emoji, boşluk, tırnak ve @etiketler (komutun önünde olabilirler). "#" ve "!" komutun parçasıdır, kalır. */
const LEADING_NOISE = /^(?:[\s"'“”«»‘’*_~>•·]|\p{Extended_Pictographic}|‍|️|@[\w.-]+[,:]?)+/u;
/** Adın sonuna eklenen dolgu sözcükler: "Kara Şahin olsun lütfen" → "Kara Şahin". */
const TRAILING_FILLER = /\s+(?:olsun|olsa|lütfen|lutfen|pls|plz|please|abi|abla|kanka|ya|be|ok|tamam)$/iu;

function firstMatch(text: string, patterns: readonly RegExp[]): string | null {
  for (const rawLine of text.normalize("NFC").split(/\r?\n/)) {
    const line = rawLine.replace(LEADING_NOISE, "").trim();
    // Komut Türkçe küçük harfle aranır ("İSİM:" de tanınsın); ad, yazıldığı gibi özgün satırdan alınır.
    const lower = line.toLocaleLowerCase("tr");
    for (const pattern of patterns) {
      const m = pattern.exec(lower);
      if (m?.[1]) {
        const found = lower.length === line.length ? line.slice(lower.length - m[1].length) : m[1];
        // Bağlantı noktada bölünüp "www" ada dönüşmesin: olduğu gibi döner, denetim geri çevirir.
        if (LINK.test(found)) return found.trim();
        // Ad cümle bitince biter: "ad: Kara Şahin. Harika video" → "Kara Şahin".
        let name = found.split(/[.!?,;|/\\()[\]{}]|\s[-–—]\s|\p{Extended_Pictographic}/u)[0].trim();
        for (let i = 0; i < 3 && TRAILING_FILLER.test(name); i++) name = name.replace(TRAILING_FILLER, "").trim();
        name = name.replace(/^["'“”«»‘’]+|["'“”«»‘’]+$/g, "").trim();
        if (name) return name;
      }
    }
  }
  return null;
}

/** Yorumdaki kahraman adı komutu (ham ad; cleanHeroName ile denetlenmeli). Komut yoksa null. */
export function parseNameCommand(comment: string): string | null {
  return firstMatch(comment, NAME_PATTERNS);
}

/** Yorumdaki yer adı önerisi komutu ("yer: …"). Komut yoksa null. */
export function parsePlaceCommand(comment: string): string | null {
  return firstMatch(comment, PLACE_PATTERNS);
}

/**
 * Ad koyma oylamasında bir yorumun önerdiği ad: önce "yer: …" komutu; yoksa yorumun kendisi kısa bir adsa
 * (tek satır, en çok 4 sözcük) o. "Bence Yıldız Koyu olmalı çünkü…" gibi uzun yorumlar aday olmaz.
 */
export function placeCandidate(comment: string): string | null {
  const command = parsePlaceCommand(comment);
  if (command) return command;
  // "ad: Kara Şahin" kahraman adıdır, yer önerisi değil.
  if (parseNameCommand(comment)) return null;
  const text = comment.normalize("NFC").replace(LEADING_NOISE, "").trim();
  if (!text || /\n/.test(text)) return null;
  const words = text.split(/\s+/);
  return words.length <= MAX_WORDS && text.length <= PLACE_NAME_MAX + 4 ? text : null;
}

// ── Ad denetimi ─────────────────────────────────────────────────────

export type NameCheck = { ok: true; name: string } | { ok: false; reason: string };

/** Karşılaştırma biçimi: küçük harf, Türkçe harfler düz, rakam yerine harf (0→o, 1→i…), tekrarlar tek, yalnızca harf. */
export function compactName(text: string): string {
  return text
    .toLocaleLowerCase("tr")
    .replace(/[ıîì]/g, "i")
    .replace(/[şș]/g, "s")
    .replace(/ğ/g, "g")
    .replace(/[üûù]/g, "u")
    .replace(/[öô]/g, "o")
    .replace(/ç/g, "c")
    .replace(/[âà]/g, "a")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/8/g, "b")
    .replace(/@/g, "a")
    .replace(/\$/g, "s")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/(.)\1+/g, "$1");
}

/**
 * Uygunsuz sözler. Çoğu adın içinde geçmesi yeter; kısa olanlar yalnızca tek başına sözcükse sayılır
 * (yoksa "Nazif", "Kamil", "Epik" gibi masum adlar takılır). Liste kusursuz olamaz: panelden bakılıp ad düzeltilebilir.
 */
const BLOCKED_PARTS = [
  "orospu", "orosbu", "yarak", "siktir", "sikis", "sikerim", "sikeyim", "sikiyim", "amcik", "aminako", "aminakoy",
  "ananisik", "anaskm", "pezevenk", "kahpe", "gavat", "ibne", "gotveren", "gotlek", "yavsak", "serefsiz", "kaltak",
  "fahise", "pust", "dalyarak", "fuck", "shit", "bitch", "niger", "cunt", "whore", "slut", "pusy", "hitler",
  "porn",
].map(compactName);
const BLOCKED_WORDS = new Set(
  ["am", "amk", "amq", "aq", "mk", "oc", "pic", "sik", "sikik", "sikim", "got", "nazi", "rape", "sex", "seks", "dick", "fag", "anan", "nigga"].map(compactName),
);
/** Kadronun ve sitenin adları: takipçiler bunları taşıyamaz (karışıklık ve taklit olmasın). */
const RESERVED = new Set(
  [
    "Baturay", "Dede Toygar", "Toygar", "Alptuğ", "Süheyla", "Kürşat", "Yalvaç", "Işıkay", "egetunce", "mhellingtr", "BinTaş",
    "OBA-Tales", "Oba Tales", "Kökobası", "Yönetici", "Yönetim", "Admin", "Moderatör", "Kut Kapısı",
  ].map((n) => compactName(n).replace(/\s/g, "")),
);

/** Ad uygunsuz söz içeriyor mu? */
export function isBlockedName(name: string): boolean {
  const compact = compactName(name);
  const joined = compact.replace(/\s/g, "");
  if (BLOCKED_PARTS.some((part) => joined.includes(part))) return true;
  return compact.split(/\s+/).some((word) => BLOCKED_WORDS.has(word));
}

/** Sözcük sözcük Türkçe baş harf büyütme: "kara şahin" → "Kara Şahin", "KARA ŞAHİN" → "Kara Şahin". */
function titleCase(text: string): string {
  return text
    .split(" ")
    .map((w) => (w ? w[0].toLocaleUpperCase("tr") + w.slice(1).toLocaleLowerCase("tr") : w))
    .join(" ");
}

function checkName(raw: string, max: number): NameCheck {
  const text = raw.normalize("NFC").trim();
  if (LINK.test(text)) return { ok: false, reason: "bağlantı içeriyor" };
  if (/^@/.test(text)) return { ok: false, reason: "başka birinin etiketi" };
  // Harf, rakam, boşluk ve ad içinde geçebilen ' ’ - dışındaki her şey (emoji, simge) atılır.
  let name = text
    .replace(/[^\p{L}\p{M}\p{N}\s'’-]/gu, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s'’-]+|[\s'’-]+$/g, "")
    .replace(/([-'’])[-'’]+/g, "$1");
  const letters = (name.match(/\p{L}/gu) ?? []).length;
  if (letters < NAME_MIN) return { ok: false, reason: "çok kısa" };
  if ([...name].length > max) return { ok: false, reason: `çok uzun (en çok ${max} harf)` };
  if (name.split(" ").length > MAX_WORDS) return { ok: false, reason: `en çok ${MAX_WORDS} sözcük` };
  if (isBlockedName(name)) return { ok: false, reason: "uygunsuz söz" };
  if (RESERVED.has(compactName(name).replace(/\s/g, ""))) return { ok: false, reason: "kadronun ya da sitenin adı" };
  // Hepsi küçük ya da hepsi büyük yazılmışsa baş harfler büyütülür; kişinin kendi büyük-küçük seçimi korunur.
  if (name === name.toLocaleLowerCase("tr") || (name === name.toLocaleUpperCase("tr") && letters > 3)) name = titleCase(name);
  return { ok: true, name };
}

/** Kahraman adını temizler ve denetler. */
export function cleanHeroName(raw: string): NameCheck {
  return checkName(raw, HERO_NAME_MAX);
}

/** Yer adını temizler ve denetler. */
export function cleanPlaceName(raw: string): NameCheck {
  return checkName(raw, PLACE_NAME_MAX);
}

/** Tarihsiz kayıt "şimdi" sayılır (panelde yapıştırılan yorumlar). a, b'den yeniyse ya da aynıysa true. */
export function isNewerOrSame(a: string | undefined, b: string | undefined): boolean {
  const ta = a ? Date.parse(a) : Number.POSITIVE_INFINITY;
  const tb = b ? Date.parse(b) : Number.POSITIVE_INFINITY;
  return (Number.isNaN(ta) ? Number.POSITIVE_INFINITY : ta) >= (Number.isNaN(tb) ? Number.POSITIVE_INFINITY : tb);
}

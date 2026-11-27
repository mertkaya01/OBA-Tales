/**
 * ZIP OKUYUCU — platformların "verilerini indir" ZIP'ini açmadan içindeki dosyaları okur.
 *
 * Ek kütüphane yok: ZIP'in içindekiler listesi (central directory) elle okunur, sıkıştırılmış dosyalar tarayıcının
 * (ve Node'un) yerleşik DecompressionStream("deflate-raw") akışıyla açılır. Yalnızca istenen dosyalar açılır.
 * Şifreli ZIP ve 4 GB üstü ZIP64 desteklenmez (takipçi dosyaları birkaç MB'tır).
 */

export interface ZipEntry {
  /** ZIP içindeki yol (ör. connections/followers_and_following/followers_1.json). */
  name: string;
  /** Açılmış boyut (bayt). */
  size: number;
  /** Dosyayı açıp UTF-8 metin olarak döndürür. */
  text(): Promise<string>;
}

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;

/** Dosya ZIP mi? (ilk dört bayt "PK\x03\x04", boş ZIP'te "PK\x05\x06") */
export function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 3 || bytes[2] === 5) && (bytes[3] === 4 || bytes[3] === 6);
}

/** ZIP'teki dosyaları listeler (klasörler hariç). Bozuk ZIP'te anlaşılır bir hata verir. */
export function listZip(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // Sondaki kayıt (en fazla 64 KB yorumla birlikte) içindekiler listesinin yerini söyler.
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === END) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("ZIP okunamadı: dosya bozuk ya da yarım inmiş olabilir. Yeniden indirip dene.");
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  if (count === 0xffff || at === 0xffffffff) throw new Error("Bu ZIP çok büyük (ZIP64). İçinden takipçi dosyasını çıkarıp onu seç.");
  const names = new TextDecoder();
  const entries: ZipEntry[] = [];
  for (let k = 0; k < count; k++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== CENTRAL) throw new Error("ZIP okunamadı: içindekiler listesi bozuk.");
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const compressed = view.getUint32(at + 20, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = names.decode(bytes.subarray(at + 46, at + 46 + nameLength)).replace(/\\/g, "/");
    at += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith("/")) continue;
    entries.push({ name, size, text: () => readEntry(bytes, view, { name, flags, method, compressed, local }) });
  }
  return entries;
}

async function readEntry(bytes: Uint8Array, view: DataView, e: { name: string; flags: number; method: number; compressed: number; local: number }): Promise<string> {
  if (e.flags & 1) throw new Error(`${e.name}: şifreli ZIP açılamıyor.`);
  if (e.compressed === 0xffffffff || e.local === 0xffffffff) throw new Error(`${e.name}: çok büyük (ZIP64); dosyayı ZIP'ten çıkarıp seç.`);
  if (view.getUint32(e.local, true) !== LOCAL) throw new Error(`${e.name}: ZIP içinde bulunamadı (bozuk ZIP).`);
  const start = e.local + 30 + view.getUint16(e.local + 26, true) + view.getUint16(e.local + 28, true);
  const data = bytes.slice(start, start + e.compressed);
  if (e.method === 0) return new TextDecoder().decode(data);
  if (e.method !== 8) throw new Error(`${e.name}: desteklenmeyen sıkıştırma (${e.method}); dosyayı ZIP'ten çıkarıp seç.`);
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

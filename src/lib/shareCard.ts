/**
 * PAYLAŞIM KARTI — karakterin hikâye boyunda (1080 × 1920) paylaşılacak görseli ve paylaşım metni.
 *
 *   gece göğü, nadirlik renginde parıltı ve yıldızlar · OBA-Tales başlığı · büyük 3D portre (WebGL yoksa piksel) ·
 *   ad, @kullanıcı adı, unvan, sınıf ve nadirlik · "Haritada beni bul" ve sitenin adresi · "Takip et, bozkırda doğ"
 *
 * Tarayıcıda çalışır (canvas). Yıldızlar karakterin kimliğinden tohumlanır: aynı karakter hep aynı kartı alır.
 */
import { CLASSES } from "../content/classes";
import { RARITY_INFO } from "../content/rarities";
import { RARITY_COLORS } from "../game/palette";
import type { Character } from "../types";
import { createRng, hashString } from "./random";

export const SHARE_CARD = { width: 1080, height: 1920 } as const;

/** Paylaşılacak bağlantı: harita bu karakter seçili açılır. */
export function shareUrl(c: Character, origin: string): string {
  return `${origin.replace(/\/+$/, "")}/?k=${encodeURIComponent(c.id)}`;
}

/** Paylaşım metni: takipçi kendi ağzından, kahramanlar tanıtım olarak. */
export function shareText(c: Character): string {
  const cls = CLASSES[c.class.id].name;
  if (c.roleType === "follower") return `OBA-Tales haritasında doğdum: ${c.title} (${cls}). Takip et, sen de bozkırda doğ!`;
  return `OBA-Tales'in kahramanı ${c.displayName}: ${c.title}. Takip et, sen de haritada doğ!`;
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("portre yüklenemedi"));
    img.src = src;
  });

/** Metni verilen genişliğe sığana kadar küçültür. */
function fitText(ctx: CanvasRenderingContext2D, text: string, font: (size: number) => string, size: number, maxWidth: number): void {
  let s = size;
  ctx.font = font(s);
  while (s > 20 && ctx.measureText(text).width > maxWidth) ctx.font = font((s -= 2));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Kartı çizer ve PNG olarak verir. `portrait`: 3D portrenin adresi (yoksa piksel portre: `pixelPortrait`),
 * `host`: kartın altında yazan adres (ör. oba-tales.etmk.workers.dev).
 */
export async function drawShareCard(c: Character, { portrait, pixelPortrait, host }: { portrait: string | null; pixelPortrait: string; host: string }): Promise<Blob> {
  const { width: W, height: H } = SHARE_CARD;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tarayıcı kart çizemiyor.");
  await Promise.all([document.fonts.load('700 96px "Pixelify Sans"'), document.fonts.load('600 44px "Nunito Variable"')]).catch(() => undefined);
  const display = (s: number) => `700 ${s}px "Pixelify Sans", ui-monospace, monospace`;
  const sans = (s: number, w = 600) => `${w} ${s}px "Nunito Variable", "Nunito", system-ui, sans-serif`;
  const accent = RARITY_COLORS[c.rarity];
  const rarity = RARITY_INFO[c.rarity];
  const cls = CLASSES[c.class.id];

  // Gece göğü, nadirlik renginde parıltı, yıldızlar.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#070b1a");
  sky.addColorStop(0.55, "#121a38");
  sky.addColorStop(1, "#1d1233");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 760, 40, W / 2, 760, 620);
  glow.addColorStop(0, `${accent}66`);
  glow.addColorStop(1, `${accent}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  const rng = createRng(hashString(`kart:${c.id}`));
  for (let i = 0; i < 140; i++) {
    ctx.globalAlpha = rng.float(0.25, 0.9);
    ctx.fillStyle = rng.chance(0.15) ? accent : "#e8f1ff";
    const s = rng.chance(0.1) ? 6 : rng.chance(0.4) ? 4 : 3;
    ctx.fillRect(Math.round(rng.float(0, W)), Math.round(rng.float(0, H)), s, s);
  }
  ctx.globalAlpha = 1;

  // Başlık
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f6d36f";
  ctx.font = display(112);
  ctx.fillText("OBA-TALES", W / 2, 190);
  ctx.fillStyle = "#b8c7e0";
  ctx.font = sans(40);
  ctx.fillText("Topluluk Haritası · Kutada", W / 2, 256);

  // Portre çerçevesi ve portre
  const fx = 190, fy = 330, fw = W - 2 * fx, fh = 860;
  roundRect(ctx, fx, fy, fw, fh, 48);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = accent;
  ctx.stroke();
  try {
    const img = await loadImage(portrait ?? pixelPortrait);
    const scale = Math.min((fw - 80) / img.width, (fh - 60) / img.height);
    const w = img.width * scale, h = img.height * scale;
    ctx.imageSmoothingEnabled = !!portrait; // piksel portre keskin büyüsün
    ctx.drawImage(img, W / 2 - w / 2, fy + fh - 30 - h, w, h);
    ctx.imageSmoothingEnabled = true;
  } catch {
    // Portre yoksa çerçeve boş kalır; kart yine paylaşılabilir.
  }

  // Ad, kullanıcı adı, unvan, sınıf · nadirlik
  ctx.fillStyle = "#ffffff";
  fitText(ctx, c.displayName, display, 96, W - 140);
  ctx.fillText(c.displayName, W / 2, 1320);
  ctx.fillStyle = "#9fb3d1";
  ctx.font = sans(44);
  ctx.fillText(`@${c.handle}`, W / 2, 1385);
  ctx.fillStyle = accent;
  fitText(ctx, c.title, display, 72, W - 140);
  ctx.fillText(c.title, W / 2, 1490);
  const pill = `${cls.name} · ${rarity.label}`;
  ctx.font = sans(42, 700);
  const pw = ctx.measureText(pill).width + 72;
  roundRect(ctx, W / 2 - pw / 2, 1530, pw, 76, 38);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = `${accent}aa`;
  ctx.stroke();
  ctx.fillStyle = "#e8f1ff";
  ctx.fillText(pill, W / 2, 1582);

  // Alt bilgi
  ctx.fillStyle = "#b8c7e0";
  ctx.font = sans(44);
  ctx.fillText("Haritada beni bul", W / 2, 1720);
  ctx.fillStyle = "#f6d36f";
  fitText(ctx, host, display, 54, W - 120);
  ctx.fillText(host, W / 2, 1790);
  ctx.fillStyle = "#8ea3c4";
  ctx.font = sans(36);
  ctx.fillText("Takip et, bozkırda doğ ⚔️", W / 2, 1858);

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Kart oluşturulamadı."))), "image/png"));
}

/**
 * REEL KOMPOZİTÖRÜ — 1080 × 1920 tuvale bir kare çizer:
 *   3D dünya (piksel piksel 3 kat büyütülmüş) · üstte OBA-TALES damgası · ortada kelime kelime piksel altyazı ·
 *   gerektiğinde kural kartı · altta imza (@hesap) · akın reelinde boss'un Öfke çubuğu, perde başlığı ve anılan adlar
 *
 * Yazılar platformların arayüzüyle çakışmasın diye "güvenli alanda" durur (üstte ve altta pay bırakılır).
 * Kayıt bu tuvalden alınır: ekranda görülen, videoda çıkanla aynıdır.
 */
import type { ClassId } from "../types";
import type { CaptionState, CardState } from "./reel";

export const REEL = { width: 1080, height: 1920 } as const;

const FONT = '"Pixelify Sans", ui-monospace, monospace';
const INK = "#1b1424";
const GOLD = "#f6d36f";
const WHITE = "#fbf7ef";

/** Akın reelinin göstergesi (Akın Günü'nün o anı). */
export interface RaidOverlay {
  boss: string;
  /** 0–100. */
  rage: number;
  title: string;
  caption: string;
  /** Ekrandaki haberler; age = beliren haberin yaşı (saniye). */
  callouts: { text: string; cls: ClassId | null; age: number }[];
}

export interface ReelOverlay {
  caption: CaptionState | null;
  card: CardState | null;
  /** Alttaki imza, ör. "@oba.tales". */
  signature: string;
  raid?: RaidOverlay | null;
  /** Damganın üstüne, kart ve altyazının altına çizilen ek katman (ör. yetenek paneli). */
  extra?: ((ctx: CanvasRenderingContext2D) => void) | null;
}

/** Sınıf renkleri (index.css'tekilerin videoda okunan açık tonları). */
const CLASS_COLORS: Readonly<Record<ClassId, string>> = { kalkaneri: "#ff7a66", okyeli: "#7fd0f2", ocakcan: "#ffc45e" };

/** Kelimeleri genişliğe göre satırlara böler. */
function wrapWords(ctx: CanvasRenderingContext2D, words: readonly string[], maxWidth: number): string[][] {
  const lines: string[][] = [];
  let line: string[] = [];
  for (const word of words) {
    const next = [...line, word];
    if (line.length > 0 && ctx.measureText(next.join(" ")).width > maxWidth) {
      lines.push(line);
      line = [word];
    } else line = next;
  }
  if (line.length > 0) lines.push(line);
  return lines;
}

/** Kalın mürekkep konturlu yazı (piksel oyun altyazısı gibi). */
function outlinedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string, outline = 12) {
  ctx.lineJoin = "round";
  ctx.lineWidth = outline;
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function drawCaption(ctx: CanvasRenderingContext2D, caption: CaptionState) {
  ctx.font = `700 70px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const lines = wrapWords(ctx, caption.words, 900);
  const lineHeight = 92;
  const top = 1240 - ((lines.length - 1) * lineHeight) / 2;
  const space = ctx.measureText(" ").width;
  let index = 0;
  lines.forEach((line, row) => {
    const width = ctx.measureText(line.join(" ")).width;
    let x = (REEL.width - width) / 2;
    const y = top + row * lineHeight;
    for (const word of line) {
      const wordWidth = ctx.measureText(word).width;
      if (index < caption.shown) {
        const newest = index === caption.shown - 1;
        // Yeni kelime hafifçe büyüyerek "pat" diye belirir.
        const pop = newest ? 1 + Math.max(0, 0.18 - caption.age) : 1;
        ctx.save();
        ctx.translate(x + wordWidth / 2, y);
        ctx.scale(pop, pop);
        outlinedText(ctx, word, -wordWidth / 2, 0, newest ? GOLD : WHITE);
        ctx.restore();
      }
      x += wordWidth + space;
      index++;
    }
  });
}

function drawCard(ctx: CanvasRenderingContext2D, { card, presence }: CardState) {
  const width = 860;
  const height = 130 + card.lines.length * 74;
  const x = (REEL.width - width) / 2;
  const y = 330;
  ctx.save();
  ctx.globalAlpha = presence;
  // Açılırken hafifçe büyür.
  const scale = 0.9 + 0.1 * presence;
  ctx.translate(REEL.width / 2, y + height / 2);
  ctx.scale(scale, scale);
  ctx.translate(-REEL.width / 2, -(y + height / 2));

  ctx.fillStyle = "rgba(13, 27, 46, 0.92)";
  ctx.fillRect(x, y, width, height);
  // Piksel çerçeve: dış altın, iç koyu çizgi
  ctx.fillStyle = "#edbd45";
  for (const [rx, ry, rw, rh] of [
    [x, y, width, 8],
    [x, y + height - 8, width, 8],
    [x, y, 8, height],
    [x + width - 8, y, 8, height],
  ]) {
    ctx.fillRect(rx, ry, rw, rh);
  }
  ctx.fillStyle = INK;
  ctx.fillRect(x + 8, y + 8, width - 16, 4);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 58px ${FONT}`;
  outlinedText(ctx, card.title, REEL.width / 2, y + 72, GOLD, 10);
  ctx.font = `600 44px ${FONT}`;
  card.lines.forEach((line, i) => outlinedText(ctx, line, REEL.width / 2, y + 150 + i * 74, WHITE, 8));
  ctx.restore();
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alpha = 0.86) {
  ctx.fillStyle = `rgba(13, 27, 46, ${alpha})`;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(237, 189, 69, 0.85)";
  ctx.fillRect(x, y, w, 5);
  ctx.fillRect(x, y + h - 5, w, 5);
}

function drawRaid(ctx: CanvasRenderingContext2D, raid: RaidOverlay) {
  // Üstte boss ve Öfke çubuğu (damganın altında).
  const x = 110;
  const w = REEL.width - 220;
  panel(ctx, x, 248, w, 112);
  ctx.textBaseline = "middle";
  ctx.font = `700 42px ${FONT}`;
  ctx.textAlign = "left";
  outlinedText(ctx, raid.boss, x + 28, 290, WHITE, 8);
  ctx.textAlign = "right";
  outlinedText(ctx, raid.rage > 0 ? `ÖFKE ${raid.rage}` : "SAKİN", x + w - 28, 290, raid.rage > 0 ? "#ff8a5c" : GOLD, 8);
  ctx.fillStyle = INK;
  ctx.fillRect(x + 28, 322, w - 56, 22);
  const fill = (w - 56 - 6) * (raid.rage / 100);
  if (fill > 0) {
    const gradient = ctx.createLinearGradient(x + 31, 0, x + 31 + fill, 0);
    gradient.addColorStop(0, "#e5562b");
    gradient.addColorStop(1, "#f6d36f");
    ctx.fillStyle = gradient;
    ctx.fillRect(x + 31, 325, fill, 16);
  }

  // Anılan yoldaşlar: sağda, kayarak gelir ve 4,5 saniye sonra söner.
  ctx.font = `700 40px ${FONT}`;
  ctx.textAlign = "right";
  raid.callouts.forEach((callout, i) => {
    const slide = Math.min(1, callout.age / 0.25);
    const fade = Math.min(1, Math.max(0, (4.5 - callout.age) / 0.5));
    const y = 760 + i * 92;
    const width = Math.min(900, ctx.measureText(callout.text).width + 56);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate((1 - slide) * 260, 0);
    panel(ctx, REEL.width - 60 - width, y - 38, width, 76, 0.82);
    outlinedText(ctx, callout.text, REEL.width - 88, y, callout.cls ? CLASS_COLORS[callout.cls] : GOLD, 8);
    ctx.restore();
  });

  // Perde başlığı ve açıklaması: altyazının yerinde.
  ctx.textAlign = "center";
  ctx.font = `700 80px ${FONT}`;
  outlinedText(ctx, raid.title, REEL.width / 2, 1190, GOLD, 14);
  ctx.font = `600 40px ${FONT}`;
  wrapWords(ctx, raid.caption.split(/\s+/), 900).forEach((line, row) => outlinedText(ctx, line.join(" "), REEL.width / 2, 1280 + row * 52, WHITE, 8));
}

/** Bir reel karesi: kaynak (WebGL tuvali) keskin büyütülür, üstüne yazılar çizilir. */
export function drawReelFrame(ctx: CanvasRenderingContext2D, source: CanvasImageSource, overlay: ReelOverlay) {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, REEL.width, REEL.height);

  // Üst damga
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 54px ${FONT}`;
  outlinedText(ctx, "OBA-TALES", REEL.width / 2, 190, GOLD, 10);

  if (overlay.raid) drawRaid(ctx, overlay.raid);
  overlay.extra?.(ctx);
  if (overlay.card) drawCard(ctx, overlay.card);
  if (overlay.caption) drawCaption(ctx, overlay.caption);

  if (overlay.signature) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 40px ${FONT}`;
    outlinedText(ctx, overlay.signature, REEL.width / 2, 1560, WHITE, 8);
  }
}

/** Yazı tipinin tuvalde kullanılabilir olmasını bekler (ilk karede yedek yazı tipi görünmesin). */
export async function ensureReelFonts(): Promise<void> {
  try {
    await Promise.all([document.fonts.load(`700 70px ${FONT}`), document.fonts.load(`600 44px ${FONT}`)]);
  } catch {
    // Yazı tipi yüklenemezse yedek yazı tipiyle devam edilir.
  }
}

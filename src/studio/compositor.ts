/**
 * REEL KOMPOZİTÖRÜ — 1080 × 1920 tuvale bir kare çizer:
 *   3D dünya (piksel piksel 3 kat büyütülmüş) · üstte OBA-TALES damgası · ortada kelime kelime piksel altyazı ·
 *   gerektiğinde kural kartı · altta imza (@hesap)
 *
 * Yazılar platformların arayüzüyle çakışmasın diye "güvenli alanda" durur (üstte ve altta pay bırakılır).
 * Kayıt bu tuvalden alınır: ekranda görülen, videoda çıkanla aynıdır.
 */
import type { CaptionState, CardState } from "./reel";

export const REEL = { width: 1080, height: 1920 } as const;

const FONT = '"Pixelify Sans", ui-monospace, monospace';
const INK = "#1b1424";
const GOLD = "#f6d36f";
const WHITE = "#fbf7ef";

export interface ReelOverlay {
  caption: CaptionState | null;
  card: CardState | null;
  /** Alttaki imza, ör. "@oba.tales". */
  signature: string;
}

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

/** Bir reel karesi: kaynak (WebGL tuvali) keskin büyütülür, üstüne yazılar çizilir. */
export function drawReelFrame(ctx: CanvasRenderingContext2D, source: CanvasImageSource, overlay: ReelOverlay) {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, REEL.width, REEL.height);

  // Üst damga
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 54px ${FONT}`;
  outlinedText(ctx, "OBA-TALES", REEL.width / 2, 190, GOLD, 10);

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

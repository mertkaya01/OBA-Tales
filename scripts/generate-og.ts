/**
 * PAYLAŞIM GÖRSELİ — public/og-image.png (1200 × 630), sosyal medyada bağlantı paylaşılınca görünen kart.
 *
 * Oyunun kendi piksel parçalarından üretilir (görsel dosyası kullanılmaz):
 *   kutup gecesi arka planı + kuzey ışıkları + kar · Buzkıran Tekgöz · ocak başında kadro · "OBA-TALES" yazısı
 * 400 × 210 piksel çizilir, 3 kat keskin büyütülür.
 *
 *   npm run og
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { CAST } from "../src/content/cast";
import { bossSprite } from "../src/game/fx/bossSprites";
import { PixelFxPlayer } from "../src/game/fx/PixelFxPlayer";
import { raidBackdrop } from "../src/game/fx/raidBackdrop";
import { composeSprite, type Sprite } from "../src/game/sprites/composeSprite";
import { rasterText } from "../src/vendor/pixelfx/core/font.js";

const W = 400;
const H = 210;
const GROUND = 176;
const SCALE = 3;

const canvas = raidBackdrop("kutup", "kar", W, H, GROUND).data;

/** Kaynak piksellerini (alfa ile) tuvale karıştırır. */
function blend(x: number, y: number, r: number, g: number, b: number, a: number) {
  if (x < 0 || y < 0 || x >= W || y >= H || a === 0) return;
  const i = (y * W + x) * 4;
  const k = a / 255;
  canvas[i] = r * k + canvas[i] * (1 - k);
  canvas[i + 1] = g * k + canvas[i + 1] * (1 - k);
  canvas[i + 2] = b * k + canvas[i + 2] * (1 - k);
}

/**
 * Bir efekt katmanını çizer. pixelfx'in hava efektleri 320 piksel geniş: tuvalimiz 400 olduğu için
 * kenarlarını yumuşakça söndürürüz (kesik görünmesin); kar birikintisini de zeminde maskeleriz.
 */
function drawLayer(pixels: Uint8ClampedArray, { fadeFrom = 40, fadeTo = 360, maxY = H } = {}) {
  const edge = 50;
  for (let y = 0; y < Math.min(H, maxY); y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const fade = Math.max(0, Math.min(1, (x - fadeFrom) / edge, (fadeTo - x) / edge));
      blend(x, y, pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3] * fade);
    }
}

function drawSprite(sprite: Sprite, left: number, top: number, scale = 1) {
  for (let y = 0; y < sprite.height * scale; y++)
    for (let x = 0; x < sprite.width * scale; x++) {
      const i = (Math.floor(y / scale) * sprite.width + Math.floor(x / scale)) * 4;
      blend(left + x, top + y, sprite.data[i], sprite.data[i + 1], sprite.data[i + 2], sprite.data[i + 3]);
    }
}

// Efektler: kuzey ışıkları ve ocak (arkada), kar (önde). Döngülerin güzel bir anına kadar ilerletilir.
const CAMPFIRE_X = 120;
const sky = new PixelFxPlayer(W, H);
sky.play("weather/aurora", { x: W / 2, y: 160, light: 0.85 });
const fire = new PixelFxPlayer(W, H);
fire.play("fire/campfire", { x: CAMPFIRE_X, y: GROUND + 2, height: 18 });
const snow = new PixelFxPlayer(W, H);
snow.play("weather/snow", { x: W / 2, y: GROUND + 24 });
for (const player of [sky, fire, snow]) {
  for (let i = 0; i < 150; i++) player.update(1 / 30);
  player.render();
}
drawLayer(sky.front.pixels);
drawLayer(sky.back.pixels);

// Boss sağda, kadro ocağın iki yanında (2 kat büyük)
const boss = bossSprite("buzkiran_tekgoz").sprite;
drawSprite(boss, W - boss.width * 2 - 8, GROUND - boss.height * 2 + 6, 2);
drawLayer(fire.back.pixels, { fadeFrom: -100, fadeTo: 500 });
const order = ["suheyla", "alptug", "baturay", "dede_toygar", "kursat", "yalvac", "isikay"];
const xs = [22, 46, 70, 142, 166, 190, 214];
order.forEach((id, i) => {
  const member = CAST.find((c) => c.id === id)!;
  const sprite = composeSprite(member);
  drawSprite(sprite, xs[i], GROUND - sprite.height * 2 + 4 - (i % 2) * 3, 2);
});
drawLayer(fire.front.pixels, { fadeFrom: -100, fadeTo: 500 });
drawLayer(snow.front.pixels, { maxY: GROUND - 3 });
drawLayer(snow.back.pixels, { maxY: GROUND - 3 });

// Başlık: "OBA-TALES" (büyük font ×4) ve alt satır.
function text(str: string, font: "mini" | "big", left: number, top: number, scale: number, color: [number, number, number], shadow = true) {
  const plot = (dx: number, dy: number, c: [number, number, number]) => {
    for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) blend(left + dx * scale + x + (c === color ? 0 : 1), top + dy * scale + y + (c === color ? 0 : 1), c[0], c[1], c[2], 255);
  };
  if (shadow) rasterText(str, font, (x, y) => plot(x, y, [27, 20, 36]));
  rasterText(str, font, (x, y) => plot(x, y, color));
}

const TITLE = "OBA-TALES";
const titleScale = 4;
const titleLeft = 18;
const titleTop = 26;
text(TITLE, "big", titleLeft, titleTop, titleScale, [246, 211, 111]);
const SUB = "AYAZLI ADALARDA TOPLULUK AKINI";
text(SUB, "mini", titleLeft + 1, titleTop + 7 * titleScale + 8, 2, [195, 224, 242]);

// 3 kat büyüt ve PNG olarak yaz.
const outW = W * SCALE;
const outH = H * SCALE;
const raw = Buffer.alloc((outW * 3 + 1) * outH);
for (let y = 0; y < outH; y++) {
  raw[y * (outW * 3 + 1)] = 0; // filtre yok
  for (let x = 0; x < outW; x++) {
    const src = (Math.floor(y / SCALE) * W + Math.floor(x / SCALE)) * 4;
    const dst = y * (outW * 3 + 1) + 1 + x * 3;
    raw[dst] = canvas[src];
    raw[dst + 1] = canvas[src + 1];
    raw[dst + 2] = canvas[src + 2];
  }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

const header = Buffer.alloc(13);
header.writeUInt32BE(outW, 0);
header.writeUInt32BE(outH, 4);
header[8] = 8; // bit derinliği
header[9] = 2; // RGB
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", header),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = resolve(import.meta.dirname, "../public/og-image.png");
writeFileSync(out, png);
console.log(`Paylaşım görseli yazıldı: public/og-image.png (${outW}×${outH}, ${Math.round(png.length / 1024)} KB)`);

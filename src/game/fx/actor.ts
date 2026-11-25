/**
 * Karakter sprite'ı → pixelfx "aktörü": efektlerin okuduğu siluet maskesi ve renkler.
 * Hale başın üstüne oturur, şifa halkası gövdeyi tarar, kalkan kubbesi önünde açılır.
 */
import type { Actor } from "../../vendor/pixelfx/core/index.js";
import type { Sprite } from "../sprites/composeSprite";

export function actorFromSprite(sprite: Sprite, scale: number): Actor {
  const w = sprite.width * scale;
  const h = sprite.height * scale;
  const mask = new Uint8Array(w * h);
  const pixels = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const src = (Math.floor(y / scale) * sprite.width + Math.floor(x / scale)) * 4;
      const a = sprite.data[src + 3];
      if (a === 0) continue;
      mask[y * w + x] = 1;
      // pixelfx rengi: 0xAABBGGRR
      pixels[y * w + x] = ((a << 24) | (sprite.data[src + 2] << 16) | (sprite.data[src + 1] << 8) | sprite.data[src]) >>> 0;
    }
  }
  const left = -Math.floor(w / 2);
  const top = -h;
  return { mask: { w, h, data: mask }, pixels, x: left, y: top, w, h, k: 2, head: [0, top], chest: [0, top + Math.round(h * 0.45)] };
}

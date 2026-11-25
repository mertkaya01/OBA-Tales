/**
 * PORTRE ÖNBELLEĞİ — karakter kartları ve çekmece için büyütülmüş piksel portreler.
 *
 * Sprite bir kez çizilip PNG adresine (data URL) çevrilir ve saklanır; aynı karakter
 * listede yüzlerce kez görünse de yeniden çizilmez. Yalnızca tarayıcıda çalışır.
 */
import type { Character } from "../../types";
import { composeSprite, type Sprite } from "./composeSprite";

const MAX_ENTRIES = 3000;
const cache = new Map<string, string>();

function portraitKey(c: Character, scale: number): string {
  return `${c.id}|${c.class.id}|${c.rarity}|${scale}`;
}

/** Ham RGBA görüntüyü (atlas, arazi, sis) PNG adresine çevirir. */
export function rgbaToDataUrl(image: { width: number; height: number; data: Uint8ClampedArray<ArrayBuffer> }): string {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext("2d")!.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
  return canvas.toDataURL("image/png");
}

/** Sprite'ı keskin piksellerle (yumuşatmasız) büyütüp canvas'a çizer. */
export function spriteToCanvas(sprite: Sprite, scale: number): HTMLCanvasElement {
  const source = document.createElement("canvas");
  source.width = sprite.width;
  source.height = sprite.height;
  source.getContext("2d")!.putImageData(new ImageData(sprite.data, sprite.width, sprite.height), 0, 0);

  const canvas = document.createElement("canvas");
  canvas.width = sprite.width * scale;
  canvas.height = sprite.height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Karakterin büyütülmüş portresinin PNG adresi. */
export function getPortraitUrl(character: Character, scale = 4): string {
  const key = portraitKey(character, scale);
  const hit = cache.get(key);
  if (hit) return hit;

  const url = spriteToCanvas(composeSprite(character), scale).toDataURL("image/png");
  if (cache.size >= MAX_ENTRIES) {
    // En eski kaydı çıkar (Map ekleme sırasını korur).
    cache.delete(cache.keys().next().value!);
  }
  cache.set(key, url);
  return url;
}

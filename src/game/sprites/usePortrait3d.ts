/**
 * 3D portre kuyruğu ve kancası: kartlardaki portreler karakterin 3D modelinden, ekranın çözünürlüğünde çizilir.
 *
 * Çizici (world3d/characters/portrait3d.ts) yalnızca gerektiğinde tembel yüklenir; portreler sıraya girer ve
 * kareyi kilitlememek için küçük gruplar halinde çizilir. Hazır olana kadar (ya da WebGL yoksa) null döner:
 * çağıran eski piksel portreyi gösterir. Sonuçlar saklanır; aynı karakter yeniden çizilmez.
 */
import { useEffect, useState } from "react";
import type { Character } from "../../types";

type Renderer = typeof import("../../world3d/characters/portrait3d");

/** Portreler artık ekran çözünürlüğünde (daha büyük) olduğu için önbellek daha küçük tutulur. */
const MAX_ENTRIES = 600;
/** Bir seferde en çok bu kadar milisaniye çizilir (en az bir portre); kalanı sonraki tura kalır, sayfa takılmaz. */
const BUDGET_MS = 10;
const cache = new Map<string, string | null>();
const queue: { key: string; character: Character; width: number; height: number; density: number; resolve: (url: string | null) => void }[] = [];
let renderer: Promise<Renderer> | null = null;
let draining = false;

/** Ekran pikseli / CSS pikseli; yarım adımlara yuvarlanır ki yakınlaştırmada her şey yeniden çizilmesin. */
export function portraitDensity(): number {
  const ratio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return Math.min(3, Math.max(1, Math.ceil(ratio * 2) / 2));
}

export const portraitKey = (c: Character, width: number, height: number, density: number) =>
  `${c.id}|${c.class.id}|${c.rarity}|${c.roleType}|${width}x${height}@${density}`;

function drain(module: Renderer): void {
  const start = performance.now();
  // İlk turda süre hep bütçenin altındadır: en az bir portre çizilir.
  while (queue.length && performance.now() - start < BUDGET_MS) {
    const job = queue.shift()!;
    let url = cache.get(job.key);
    if (url === undefined) {
      try {
        url = module.renderPortraitUrl(job.character, job.width, job.height, { density: job.density });
      } catch {
        url = null;
      }
      if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
      cache.set(job.key, url);
    }
    job.resolve(url);
  }
  if (queue.length) setTimeout(() => drain(module), 0);
  else draining = false;
}

/** Portreyi sıraya koyar; çizilince adresini (WebGL yoksa null) verir. Boy CSS pikselidir. */
export function requestPortrait(character: Character, width: number, height: number, density = portraitDensity()): Promise<string | null> {
  const key = portraitKey(character, width, height, density);
  const hit = cache.get(key);
  if (hit !== undefined) return Promise.resolve(hit);
  return new Promise((resolve) => {
    queue.push({ key, character, width, height, density, resolve });
    renderer ??= import("../../world3d/characters/portrait3d");
    if (draining) return;
    draining = true;
    void renderer.then(drain, () => {
      draining = false;
      for (const job of queue.splice(0)) job.resolve(null);
    });
  });
}

/** Karakterin 3D portresinin adresi (width × height CSS pikselinde gösterilecek); hazır değilse null. */
export function usePortrait3d(character: Character, width: number, height: number): string | null {
  const density = portraitDensity();
  const key = portraitKey(character, width, height, density);
  const [state, setState] = useState<{ key: string; url: string | null }>(() => ({ key, url: cache.get(key) ?? null }));
  useEffect(() => {
    let live = true;
    void requestPortrait(character, width, height, density).then((url) => {
      if (live) setState({ key, url });
    });
    return () => {
      live = false;
    };
  }, [key, character, width, height, density]);
  return state.key === key ? state.url : (cache.get(key) ?? null);
}

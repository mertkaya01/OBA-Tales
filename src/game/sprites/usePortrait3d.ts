/**
 * 3D portre kuyruğu ve kancası: kartlardaki portreler karakterin 3D modelinden çizilir.
 *
 * Çizici (world3d/characters/portrait3d.ts) yalnızca gerektiğinde tembel yüklenir; portreler sıraya girer ve
 * kareyi kilitlememek için küçük gruplar halinde çizilir. Hazır olana kadar (ya da WebGL yoksa) null döner:
 * çağıran eski piksel portreyi gösterir. Sonuçlar saklanır; aynı karakter yeniden çizilmez.
 */
import { useEffect, useState } from "react";
import type { Character } from "../../types";

type Renderer = typeof import("../../world3d/characters/portrait3d");

const MAX_ENTRIES = 2000;
const PER_TICK = 6;
const cache = new Map<string, string | null>();
const queue: { key: string; character: Character; width: number; height: number; resolve: (url: string | null) => void }[] = [];
let renderer: Promise<Renderer> | null = null;
let draining = false;

export const portraitKey = (c: Character, width: number, height: number) => `${c.id}|${c.class.id}|${c.rarity}|${c.roleType}|${width}x${height}`;

function drain(module: Renderer): void {
  for (let n = 0; n < PER_TICK && queue.length; n++) {
    const job = queue.shift()!;
    let url = cache.get(job.key);
    if (url === undefined) {
      try {
        url = module.renderPortraitUrl(job.character, job.width, job.height);
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

/** Portreyi sıraya koyar; çizilince adresini (WebGL yoksa null) verir. */
export function requestPortrait(character: Character, width: number, height: number): Promise<string | null> {
  const key = portraitKey(character, width, height);
  const hit = cache.get(key);
  if (hit !== undefined) return Promise.resolve(hit);
  return new Promise((resolve) => {
    queue.push({ key, character, width, height, resolve });
    renderer ??= import("../../world3d/characters/portrait3d");
    if (draining) return;
    draining = true;
    void renderer.then(drain, () => {
      draining = false;
      for (const job of queue.splice(0)) job.resolve(null);
    });
  });
}

/** Karakterin 3D portresinin adresi; hazır değilse (ya da çizilemiyorsa) null. */
export function usePortrait3d(character: Character, width: number, height: number): string | null {
  const key = portraitKey(character, width, height);
  const [state, setState] = useState<{ key: string; url: string | null }>(() => ({ key, url: cache.get(key) ?? null }));
  useEffect(() => {
    let live = true;
    void requestPortrait(character, width, height).then((url) => {
      if (live) setState({ key, url });
    });
    return () => {
      live = false;
    };
  }, [key, character, width, height]);
  return state.key === key ? state.url : (cache.get(key) ?? null);
}

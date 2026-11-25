/**
 * Sezon sayfasının görselleri: boss resimleri (öfkeli, sakin, siluet) PNG adresine çevrilip saklanır.
 */
import { bossSprite, silhouette } from "../../game/fx/bossSprites";
import { rgbaToDataUrl } from "../../game/sprites/portraitCache";
import type { BossReveal } from "../../lib/season";
import type { BossElement, BossId } from "../../types";

const urls = new Map<string, string>();

export function bossImageUrl(id: BossId, reveal: BossReveal): string {
  const key = `${id}:${reveal}`;
  let url = urls.get(key);
  if (!url) {
    const { sprite } = bossSprite(id, reveal === "sakin");
    url = rgbaToDataUrl(reveal === "gizem" || reveal === "siluet" ? silhouette(sprite) : sprite);
    urls.set(key, url);
  }
  return url;
}

export const ELEMENT_LABELS: Readonly<Record<BossElement, string>> = {
  buz: "Buz",
  sis: "Sis",
  ayaz: "Ayaz",
  golge: "Gölge",
};

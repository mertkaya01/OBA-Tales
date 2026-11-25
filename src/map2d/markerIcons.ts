/**
 * HARİTA SİMGELERİ — Leaflet pinleri ve küme balonları için HTML üreticileri.
 *
 * Pinler karakterin piksel çizimini sprite atlasından gösterir: bütün pinler tek bir görüntüyü
 * paylaşır, her biri yalnızca kendi hücresinin konumunu (background-position) taşır.
 * Atlas adresi ve boyutu harita kabındaki CSS değişkenlerinden okunur (--kb-atlas, --kb-atlas-w, --kb-atlas-h).
 */
import type { AtlasRect } from "../game/sprites/atlas";
import { formatNumber } from "../lib/text";
import type { Rarity } from "../types";

/** Pin içindeki sprite büyütmesi: 16×20 → 32×40 piksel. */
export const PIN_SCALE = 2;
export const PIN_SIZE: [number, number] = [36, 44];
/** Pinin haritaya değdiği nokta: alt orta. */
export const PIN_ANCHOR: [number, number] = [18, 43];

const FRAME: Record<Rarity, string> = {
  siradan: "frame-siradan",
  nadir: "frame-nadir",
  destansi: "frame-destansi",
  efsanevi: "frame-efsanevi",
  ulu: "frame-ulu",
  goksel: "frame-goksel",
};

/** Halka dilimlerinin sırası: en nadir en üstte (saat 12 yönünde) başlar. */
const RING_ORDER: readonly Rarity[] = ["goksel", "ulu", "efsanevi", "destansi", "nadir", "siradan"];

/** Kullanıcıdan gelen metni HTML'e güvenle koymak için. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface PinState {
  selected: boolean;
  inRaid: boolean;
}

export function pinHtml(rarity: Rarity, rect: AtlasRect, { selected, inRaid }: PinState): string {
  const classes = ["kb-pin", FRAME[rarity], selected && "kb-pin--secili", inRaid && "kb-pin--akin"].filter(Boolean).join(" ");
  const position = `-${rect.x * PIN_SCALE}px -${rect.y * PIN_SCALE}px`;
  return `<div class="${classes}"><span class="kb-pin__sprite" style="background-position:${position}"></span></div>`;
}

export interface ClusterInfo {
  count: number;
  /** Kümedeki nadirlik dağılımı: halka bu oranlarla dilimlenir. */
  byRarity: Readonly<Record<Rarity, number>>;
  /** Uzak görünümde bölge adını da yaz. */
  regionName?: string;
}

/** Nadirlik dağılımını gösteren halka: conic-gradient dilimleri. */
export function rarityRing(byRarity: Readonly<Record<Rarity, number>>): string {
  const total = RING_ORDER.reduce((sum, r) => sum + byRarity[r], 0) || 1;
  let start = 0;
  const stops = RING_ORDER.filter((r) => byRarity[r] > 0).map((r) => {
    const end = start + (byRarity[r] / total) * 100;
    const stop = `var(--color-${r}) ${start.toFixed(1)}% ${end.toFixed(1)}%`;
    start = end;
    return stop;
  });
  return `conic-gradient(${stops.length > 0 ? stops.join(", ") : "var(--color-siradan) 0 100%"})`;
}

/** Küme balonunun çapı: kalabalık arttıkça yavaşça büyür. */
export function clusterSize(count: number, bubble: boolean): number {
  const base = bubble ? 58 : 40;
  return Math.round(base + Math.min(28, Math.log10(Math.max(1, count)) * 12));
}

export function clusterHtml({ count, byRarity, regionName }: ClusterInfo): string {
  const label = regionName ? `<span class="kb-kume__ad">${escapeHtml(regionName)}</span>` : "";
  return (
    `<div class="kb-kume" style="background:${rarityRing(byRarity)}">` +
    `<div class="kb-kume__ic"><span class="kb-kume__sayi">${formatNumber(count)}</span>${label}</div></div>`
  );
}

/**
 * SES KARIŞIMI — bir ses, kameranın baktığı yerden ne kadar duyulur?
 *
 *   · Uzaktan (bütün adalara bakarken) ada sesleri duyulmaz, yalnızca rüzgâr.
 *   · Yakınlaştıkça duyma yarıçapı daralır ama ses netleşir: koruya yakından bakan baltayı duyar, obadaki ateşi
 *     duymaz.
 *
 * Saf fonksiyonlardır; testleri soundMix.test.ts içinde.
 */

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Ne kadar yakından bakılıyor (0 = uzak, 1 = yakın). worldZoom: dünya yakınlığı (1 ≈ 1000×700 birimlik kare). */
export function closeness(worldZoom: number): number {
  return smooth(1.2, 5, worldZoom);
}

/** Duyma yarıçapı (dünya birimi). */
export function hearingRadius(worldZoom: number): number {
  return 34 + 220 / Math.max(1, worldZoom);
}

/** Kaynağın duyulma seviyesi (0–1). */
export function hearing(distance: number, worldZoom: number): number {
  const r = hearingRadius(worldZoom);
  if (distance >= r) return 0;
  const k = 1 - distance / r;
  return closeness(worldZoom) * k * k;
}

/** Ekrandaki yatay yerden sağ-sol dengesi (ndcX: −1 sol kenar … 1 sağ kenar). */
export function panFor(ndcX: number): number {
  return Math.max(-0.85, Math.min(0.85, ndcX * 0.85));
}

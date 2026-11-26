import { describe, expect, it } from "vitest";
import { alevKadini } from "./alevKadini";
import { buyucuSifaci } from "./buyucuSifaci";
import { TAKIPCI_MODELLERI } from "./takipciler";

interface Mesh {
  readonly p: readonly number[];
  readonly i: readonly number[];
}

/**
 * Oyun arka yüzleri çizmez: içe dönük ya da karışık sarılmış üçgenler delik gibi görünür (Kalkaneri perçemleri öyleydi).
 * Bir kenarı aynı yönde iki kez dolaşan üçgen çifti sarılışın karıştığını, negatif hacim parçanın içe döndüğünü gösterir.
 */
function windingProblems(mesh: Mesh): { mixed: number; volume: number; closed: boolean } {
  const seen = new Set<string>();
  let mixed = 0;
  let volume = 0;
  const { p, i } = mesh;
  for (let t = 0; t < i.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const key = `${i[t + e]}>${i[t + ((e + 1) % 3)]}`;
      if (seen.has(key)) mixed++;
      seen.add(key);
    }
    const [a, b, c] = [i[t], i[t + 1], i[t + 2]].map((v) => [p[v * 3], p[v * 3 + 1], p[v * 3 + 2]]);
    volume += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  // Kapalı parça: her kenarın ters yönlüsü de var. Açık parçada (ağzı açık halka gibi) hacmin işareti anlamsızdır.
  const closed = [...seen].every((key) => seen.has(key.split(">").reverse().join(">")));
  return { mixed, volume, closed };
}

const ALL: [string, Mesh][] = [
  ...Object.entries(TAKIPCI_MODELLERI).flatMap(([body, parts]) => parts.map((part): [string, Mesh] => [`${body}-${part.name}-${part.k.join("/")}`, part])),
  ...Object.entries(buyucuSifaci).map(([id, part]): [string, Mesh] => [`buyucu-${id}`, part]),
  ...Object.entries(alevKadini).map(([id, part]): [string, Mesh] => [`bintas-${id}`, part]),
];

describe("model yüzleri", () => {
  it("her parçanın üçgenleri aynı yöne sarılı ve parça dışa bakıyor (delik görünmez)", () => {
    expect(ALL.length).toBeGreaterThan(200);
    let closedParts = 0;
    for (const [id, mesh] of ALL) {
      const { mixed, volume, closed } = windingProblems(mesh);
      expect(mixed, `${id}: karışık sarılmış kenar`).toBe(0);
      if (!closed) continue;
      closedParts++;
      expect(volume, `${id}: içe dönük`).toBeGreaterThanOrEqual(0);
    }
    expect(closedParts / ALL.length).toBeGreaterThan(0.8);
  });
});

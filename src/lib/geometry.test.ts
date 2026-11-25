import { describe, expect, it } from "vitest";
import { REGION_LIST } from "../content/regions";
import {
  boundsCenter,
  clamp,
  distanceToPolygonEdge,
  distanceToSegment,
  findContaining,
  mergeBounds,
  padBounds,
  pointInPolygon,
  polygonArea,
  polygonBounds,
  polygonCentroid,
  randomPointInPolygon,
} from "./geometry";
import { createRng, hashString, seedFrom } from "./random";

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

// L şeklinde (içbükey) poligon: sağ üst köşesi boş.
const lShape = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 6 },
  { x: 10, y: 6 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe("pointInPolygon", () => {
  it("karenin içini ve dışını ayırır", () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
    expect(pointInPolygon({ x: -1, y: 5 }, square)).toBe(false);
  });

  it("içbükey poligonda boş köşeyi dışarıda sayar", () => {
    expect(pointInPolygon({ x: 2, y: 2 }, lShape)).toBe(true);
    expect(pointInPolygon({ x: 8, y: 8 }, lShape)).toBe(true);
    expect(pointInPolygon({ x: 8, y: 2 }, lShape)).toBe(false);
  });
});

describe("sınır kutusu, alan, merkez", () => {
  it("karenin değerlerini doğru hesaplar", () => {
    expect(polygonBounds(square)).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
    expect(polygonArea(square)).toBe(100);
    expect(polygonCentroid(square)).toEqual({ x: 5, y: 5 });
    expect(polygonArea(lShape)).toBe(4 * 10 + 6 * 4);
  });

  it("kutuları birleştirir, genişletir ve merkezini bulur", () => {
    const merged = mergeBounds({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, { minX: 5, minY: -5, maxX: 20, maxY: 8 });
    expect(merged).toEqual({ minX: 0, minY: -5, maxX: 20, maxY: 10 });
    expect(padBounds(merged, 2)).toEqual({ minX: -2, minY: -7, maxX: 22, maxY: 12 });
    expect(boundsCenter(merged)).toEqual({ x: 10, y: 2.5 });
  });
});

describe("uzaklıklar", () => {
  it("doğru parçasına ve kenara uzaklığı ölçer", () => {
    expect(distanceToSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
    expect(distanceToSegment({ x: 13, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
    expect(distanceToPolygonEdge({ x: 5, y: 5 }, square)).toBe(5);
    expect(distanceToPolygonEdge({ x: 1, y: 5 }, square)).toBe(1);
  });

  it("clamp sınırların dışını sıkıştırır", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-2, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});

describe("tohumlu rastgelelik", () => {
  it("aynı tohum aynı diziyi üretir, farklı tohum farklı", () => {
    const a = createRng(42);
    const b = createRng(42);
    const c = createRng(43);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    const seqC = Array.from({ length: 5 }, () => c.next());
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
  });

  it("değerler aralıkta kalır, int iki ucu da üretir", () => {
    const rng = createRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      seen.add(rng.int(1, 3));
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it("ağırlıklı seçimde sıfır ağırlık hiç gelmez", () => {
    const rng = createRng(9);
    for (let i = 0; i < 500; i++) {
      expect(rng.weighted([{ value: "yok", weight: 0 }, { value: "var", weight: 1 }])).toBe("var");
    }
  });

  it("metin özeti kararlıdır ve parçaları karıştırmaz", () => {
    expect(hashString("Kökobası")).toBe(hashString("Kökobası"));
    expect(hashString("Kökobası")).not.toBe(hashString("kokobasi"));
    expect(seedFrom("a", "b")).not.toBe(seedFrom("ab"));
  });
});

describe("bölgeler üzerinde", () => {
  it("her bölge merkezi kendi bölgesinde bulunur", () => {
    for (const region of REGION_LIST) {
      expect(findContaining(region.center, REGION_LIST)?.id).toBe(region.id);
    }
  });

  it("rastgele noktalar bölgenin içinde ve kenardan uzakta kalır", () => {
    for (const region of REGION_LIST) {
      const rng = createRng(seedFrom("test", region.id));
      for (let i = 0; i < 300; i++) {
        const p = randomPointInPolygon(region.polygon, rng, { margin: 6 });
        expect(pointInPolygon(p, region.polygon)).toBe(true);
        expect(distanceToPolygonEdge(p, region.polygon)).toBeGreaterThanOrEqual(6);
      }
    }
  });

  it("aynı tohumla aynı noktayı verir", () => {
    const poly = REGION_LIST[0].polygon;
    expect(randomPointInPolygon(poly, createRng(1))).toEqual(randomPointInPolygon(poly, createRng(1)));
  });
});

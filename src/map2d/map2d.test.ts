import { describe, expect, it } from "vitest";
import { REGIONS } from "../content/regions";
import { regionsBounds } from "../lib/clustering";
import { WORLD_LAT_LNG_BOUNDS, fromLatLng, toLatLng, toLatLngBounds } from "./mapCoords";
import { clusterHtml, clusterSize, escapeHtml, pinHtml, rarityRing } from "./markerIcons";

describe("koordinat dönüşümü", () => {
  it("dünya noktasını Leaflet'e ve geri çevirir", () => {
    const p = REGIONS.pusluada.center;
    const [lat, lng] = toLatLng(p);
    expect([lat, lng]).toEqual([-p.y, p.x]);
    expect(fromLatLng(lat, lng)).toEqual(p);
  });

  it("sınır kutusunu güneybatı-kuzeydoğu çiftine çevirir", () => {
    expect(WORLD_LAT_LNG_BOUNDS).toEqual([
      [-2240, 0],
      [0, 3200],
    ]);
    const [[south, west], [north, east]] = toLatLngBounds(regionsBounds(["akinburnu"], 0));
    expect(south).toBeLessThan(north);
    expect(west).toBeLessThan(east);
    expect(west).toBe(240);
  });
});

describe("harita simgeleri", () => {
  it("metni HTML'e güvenle koyar", () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)">`)).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("pin, atlastaki hücreyi büyütülmüş konumla gösterir", () => {
    const html = pinHtml("efsanevi", { x: 32, y: 20, width: 16, height: 20 }, { selected: true, inRaid: true });
    expect(html).toContain("background-position:-64px -40px");
    expect(html).toContain("frame-efsanevi");
    expect(html).toContain("kb-pin--secili");
    expect(html).toContain("kb-pin--akin");
    expect(pinHtml("siradan", { x: 0, y: 0, width: 16, height: 20 }, { selected: false, inRaid: false })).not.toContain("secili");
  });

  it("küme balonu sayıyı ve kaçışlı bölge adını yazar, kalabalıkla büyür", () => {
    const html = clusterHtml({ count: 1203, byRarity: { siradan: 1000, nadir: 200, destansi: 3, efsanevi: 0, ulu: 0, goksel: 0 }, regionName: "Kırağı<düzü>" });
    expect(html).toContain("1.203");
    expect(html).toContain("Kırağı&lt;düzü&gt;");
    expect(clusterSize(1000, true)).toBeGreaterThan(clusterSize(5, true));
    expect(clusterSize(5, false)).toBeLessThan(clusterSize(5, true));
  });

  it("halka nadirlik dağılımına göre dilimlenir, boş nadirlik dilim almaz", () => {
    const ring = rarityRing({ siradan: 2, nadir: 1, destansi: 1, efsanevi: 0, ulu: 0, goksel: 0 });
    expect(ring).toBe(
      "conic-gradient(var(--color-destansi) 0.0% 25.0%, var(--color-nadir) 25.0% 50.0%, var(--color-siradan) 50.0% 100.0%)",
    );
    expect(rarityRing({ siradan: 0, nadir: 0, destansi: 0, efsanevi: 0, ulu: 0, goksel: 0 })).toBe("conic-gradient(var(--color-siradan) 0 100%)");
  });
});

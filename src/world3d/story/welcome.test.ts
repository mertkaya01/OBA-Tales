import { describe, expect, it } from "vitest";
import { CAST } from "../../content/cast";
import { LANDMARKS } from "../../content/sites";
import { getTerrain } from "../../game/terrainCache";
import { isWet, sampleTerrain } from "../../game/terrain";
import { PORTAL_RADIUS } from "../layout";
import { orbAt } from "./arrival";
import { WELCOME_PER_HERO, heroIntro, introStart, welcomeAt, welcomeLanded, welcomeLength, welcomeSpots } from "./welcome";

describe("karşılama", () => {
  const n = 3;

  it("sırası: kapı → küreler → yan yana grup → her kahramana yakın tanıtım → son", () => {
    expect(welcomeAt(1, n).caption).toBe("Kut Kapısı titriyor…");
    expect(welcomeAt(3.5, n).caption).toBe("Üç ışık doğuyor…");
    const landed = welcomeLanded(n);
    // Son küre indiğinde hepsi görünür, grup çekimi başlar.
    for (let i = 0; i < n; i++) expect(orbAt(landed, i).revealed).toBe(true);
    expect(welcomeAt(landed + 0.2, n)).toMatchObject({ group: true, focus: null, caption: "Kutada'nın kahramanları" });
    for (let i = 0; i < n; i++) {
      expect(welcomeAt(introStart(n, i) + 0.1, n)).toMatchObject({ focus: i, group: false, caption: null });
      expect(welcomeAt(introStart(n, i) + WELCOME_PER_HERO - 0.1, n).focus).toBe(i);
    }
    expect(welcomeAt(welcomeLength(n) - 0.1, n).focus).toBeNull();
    expect(welcomeAt(welcomeLength(n), n).letterbox).toBe(0);
    // Uzun tutulmaz: 16 saniyenin altında.
    expect(welcomeLength(n)).toBeLessThan(16);
  });

  it("kahramanlar Kut Kapısı'nın taş meydanının hemen önünde, yan yana, kuru düz karada doğar", () => {
    const terrain = getTerrain(20261124);
    const spots = welcomeSpots(LANDMARKS.kutKapisi, n);
    expect(spots).toHaveLength(n);
    for (let i = 1; i < n; i++) {
      expect(spots[i].x - spots[i - 1].x).toBeGreaterThan(10);
      expect(spots[i].y).toBe(spots[0].y);
    }
    for (const p of spots) {
      expect(Math.hypot(p.x - LANDMARKS.kutKapisi.x, p.y - LANDMARKS.kutKapisi.y)).toBeGreaterThan(PORTAL_RADIUS);
      expect(sampleTerrain(terrain, p).height).toBeGreaterThan(0.05);
      expect(isWet(terrain, p)).toBe(false);
    }
  });

  it("tanıtım kartı: unvan, sınıf · nadirlik, üç özel yetenek ve imza yeteneği", () => {
    const ege = heroIntro(CAST.find((c) => c.id === "egetunce")!);
    expect(ege).toMatchObject({ name: "egetunce", title: "Gün Kılıçlı Alp", tags: "Kalkaneri · Ulu", epithet: "Kut Kapısı'nın Bekçisi", skill: "Lavanta Kalkanı · Gün Kılıcı" });
    expect(ege.features).toEqual(["Gün Kılıcı", "Lavanta Kalkanı", "Uyumayan Gözler"]);
    expect(heroIntro(CAST.find((c) => c.id === "mhellingtr")!).skill).toBe("Gök Gürültüsü");
    expect(heroIntro(CAST.find((c) => c.id === "bintas")!).features).toHaveLength(3);
  });
});

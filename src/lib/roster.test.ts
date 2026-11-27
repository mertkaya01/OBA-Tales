import { describe, expect, it } from "vitest";
import { CAST } from "../content/cast";
import type { Character, Rarity } from "../types";
import { createStarterCharacter } from "./rules";
import { followerId, heroForHandle, isValidHandle, lookupHero, previewNewcomer, rarityBreakdown, sortCharacters } from "./roster";

const now = new Date("2026-11-25T12:00:00Z");
const make = (handle: string, rarity: Rarity, points: number, displayName?: string): Character => ({
  ...createStarterCharacter({ handle, displayName, platform: "tiktok", region: "akinburnu", coordinates: { x: 215, y: 560 }, now }),
  rarity,
  points,
});

const people = [
  make("zeren_yay", "nadir", 120, "Zeren Yay"),
  make("cagri_kalkan", "efsanevi", 80, "Çağrı Kalkan"),
  make("ilgin_ok", "siradan", 300, "Ilgın Ok"),
  make("ayaz_can", "nadir", 120, "Ayaz Can"),
];

describe("kadro sıralama", () => {
  it("puana göre (eşitlikte ada göre), nadirliğe göre, Türkçe alfabeyle ada göre", () => {
    expect(sortCharacters(people, "puan").map((c) => c.handle)).toEqual(["ilgin_ok", "ayaz_can", "zeren_yay", "cagri_kalkan"]);
    expect(sortCharacters(people, "nadirlik").map((c) => c.handle)).toEqual(["cagri_kalkan", "ayaz_can", "zeren_yay", "ilgin_ok"]);
    // Türkçe sıra: A, Ç, I, Z
    expect(sortCharacters(people, "ad").map((c) => c.displayName)).toEqual(["Ayaz Can", "Çağrı Kalkan", "Ilgın Ok", "Zeren Yay"]);
    expect(people[0].handle).toBe("zeren_yay"); // asıl dizi değişmez
  });

  it("nadirlik dağılımı sayılar ve toplamı 100 olan yüzdeler", () => {
    const shares = rarityBreakdown(people);
    expect(shares.map((s) => s.count)).toEqual([1, 2, 0, 1, 0, 0]);
    expect(shares.reduce((sum, s) => sum + s.percent, 0)).toBe(100);
    expect(rarityBreakdown([]).every((s) => s.percent === 0)).toBe(true);
  });
});

describe("kahramanını bul", () => {
  const everyone = [...CAST, ...people];

  it("@ işaretini, boşlukları, büyük harfi ve Türkçe harf farkını gözetmez", () => {
    expect(lookupHero(everyone, "  @Zeren_Yay ").hero?.handle).toBe("zeren_yay");
    expect(lookupHero(everyone, "dede_toygar").hero?.id).toBe("dede_toygar");
  });

  it("birebir yoksa benzer adları önerir; çok kısa aramada sonuç yok", () => {
    const r = lookupHero(everyone, "kalkan");
    expect(r.hero).toBeNull();
    expect(r.suggestions.map((c) => c.handle)).toContain("cagri_kalkan");
    expect(r.suggestions.length).toBeLessThanOrEqual(5);
    expect(lookupHero(everyone, "a")).toEqual({ hero: null, suggestions: [], handle: "a" });
  });
});

describe("kahramanlar ve takipçi kimlikleri", () => {
  it("kahramanın kullanıcı adını büyük harf, nokta, alt çizgi ve @ fark etmeden tanır", () => {
    expect(heroForHandle("mhellingtr")).toBe("mhellingtr");
    expect(heroForHandle("@MhellingTR")).toBe("mhellingtr");
    expect(heroForHandle("MHELLINGTR")).toBe("mhellingtr");
    expect(heroForHandle("ege.tunce")).toBe("egetunce");
    expect(heroForHandle("Bin_Tas")).toBe("bintas");
    expect(heroForHandle("mhellingtr2")).toBeNull();
    expect(heroForHandle("kursat")).toBeNull();
  });

  it("takipçi kimliği kadroyla ve alınmış kimliklerle çakışmaz", () => {
    expect(followerId("Kopuz.Okcu")).toBe("kopuz_okcu");
    for (const member of CAST) expect(followerId(member.handle)).not.toBe(member.id);
    expect(followerId("kursat")).toBe("kursat_yoldas");
    expect(followerId("kopuz_okcu", new Set(["kopuz_okcu"]))).toBe("kopuz_okcu_2");
  });
});

describe("yeni gelenin önizlemesi", () => {
  it("ana platform sınıfı belirler, ek platformlar nadirliği ve rozeti", () => {
    const one = previewNewcomer("@yeni_okcu", ["tiktok"])!;
    expect(one.class.id).toBe("okyeli");
    expect(one.rarity).toBe("siradan");
    expect(one.title).toBe("Çırak Okyeli");
    expect(one.badges).toEqual([]);

    const two = previewNewcomer("yeni_okcu", ["instagram", "youtube"])!;
    expect(two.class.id).toBe("kalkaneri");
    expect(two.rarity).toBe("nadir");
    expect(two.badges).toContain("cift_iz");

    const three = previewNewcomer("yeni_okcu", ["youtube", "tiktok", "instagram"])!;
    expect(three.class.id).toBe("ocakcan");
    expect(three.rarity).toBe("nadir");
    expect(three.badges).toContain("oba_onculugu");
    expect(three.region).toBe("kutada");
  });

  it("geçersiz kullanıcı adı ya da platform seçilmemişse önizleme yok", () => {
    expect(isValidHandle("@ok")).toBe(true);
    expect(isValidHandle("a")).toBe(false);
    expect(isValidHandle("boşluklu ad")).toBe(false);
    expect(previewNewcomer("x", ["tiktok"])).toBeNull();
    expect(previewNewcomer("gecerli_ad", [])).toBeNull();
  });
});

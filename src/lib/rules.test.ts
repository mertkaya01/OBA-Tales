import { describe, expect, it } from "vitest";
import { CAST } from "../content/cast";
import { characterSchema } from "../schemas/data";
import {
  classForPlatform,
  cleanHandle,
  compareRarityDesc,
  createStarterCharacter,
  defaultTitle,
  deriveBadges,
  multiPlatformBadge,
  raiseRarity,
  rarityAt,
  rarityRank,
  startingRarity,
  uniquePlatforms,
} from "./rules";

describe("platform → sınıf", () => {
  it("bire bir eşleşir", () => {
    expect(classForPlatform("instagram")).toBe("kalkaneri");
    expect(classForPlatform("tiktok")).toBe("okyeli");
    expect(classForPlatform("youtube")).toBe("ocakcan");
  });
});

describe("nadirlik kademeleri", () => {
  it("sırayı korur ve sınırlarda durur", () => {
    expect(rarityRank("siradan")).toBe(0);
    expect(rarityRank("efsanevi")).toBe(3);
    expect(rarityAt(-4)).toBe("siradan");
    expect(rarityAt(9)).toBe("goksel");
    expect(raiseRarity("nadir")).toBe("destansi");
    expect(raiseRarity("destansi", 5)).toBe("efsanevi");
    expect(raiseRarity("nadir", -3)).toBe("siradan");
    // Ulu ve Göksel yükseltmeyle kazanılmaz; özel kahramanınki olduğu gibi kalır.
    expect(raiseRarity("efsanevi", 2)).toBe("efsanevi");
    expect(raiseRarity("ulu")).toBe("ulu");
    expect(raiseRarity("goksel", -1)).toBe("goksel");
  });

  it("yüksek nadirliği öne sıralar", () => {
    const sorted = (["nadir", "efsanevi", "siradan", "destansi"] as const).slice().sort(compareRarityDesc);
    expect(sorted).toEqual(["efsanevi", "destansi", "nadir", "siradan"]);
  });
});

describe("çoklu abonelik", () => {
  it("2 ve 3 platform bir kademe yükseltir", () => {
    expect(startingRarity(1)).toBe("siradan");
    expect(startingRarity(2)).toBe("nadir");
    expect(startingRarity(3)).toBe("nadir");
  });

  it("platform sayısına göre rozet verir", () => {
    expect(multiPlatformBadge(1)).toBeNull();
    expect(multiPlatformBadge(2)).toBe("cift_iz");
    expect(multiPlatformBadge(3)).toBe("oba_onculugu");
  });

  it("ana platformu başa alır, tekrarları atar", () => {
    expect(uniquePlatforms("tiktok", ["youtube", "tiktok", "youtube"])).toEqual(["tiktok", "youtube"]);
    expect(uniquePlatforms("youtube", ["tiktok", "instagram"])).toEqual(["youtube", "instagram", "tiktok"]);
    expect(uniquePlatforms("instagram")).toEqual(["instagram"]);
  });
});

describe("rozetler", () => {
  it("tek platformlu yeni takipçinin rozeti yoktur", () => {
    expect(deriveBadges({ roleType: "follower", linkedPlatforms: ["tiktok"] })).toEqual([]);
  });

  it("platform, akın ve oy rozetlerini sabit sırayla verir", () => {
    expect(
      deriveBadges({
        roleType: "follower",
        linkedPlatforms: ["instagram", "tiktok", "youtube"],
        joinedEpisodes: [4, 3, 1],
        votesCast: 12,
      }),
    ).toEqual(["oba_onculugu", "ilk_adim", "buzkiran_akini", "ozan_dostu"]);
  });

  it("10 oydan azına Ozan Dostu vermez", () => {
    expect(deriveBadges({ roleType: "follower", linkedPlatforms: ["youtube"], votesCast: 9 })).toEqual([]);
  });

  it("kadro üyelerinin rozetleri kurallarla uyuşur", () => {
    for (const member of CAST) {
      const expected = deriveBadges({ roleType: member.roleType, linkedPlatforms: member.linkedPlatforms });
      expect([...member.badges].sort(), member.id).toEqual([...expected].sort());
    }
  });
});

describe("yeni karakter", () => {
  const now = new Date("2026-11-24T15:00:00Z");

  it("kullanıcı adını sadeleştirir", () => {
    expect(cleanHandle("  @@Buz.Kalkan_42 ")).toBe("Buz.Kalkan_42");
  });

  it("varsayılan unvanı sınıf ve nadirlikten kurar", () => {
    expect(defaultTitle("siradan", "kalkaneri")).toBe("Çırak Kalkaneri");
    expect(defaultTitle("nadir", "okyeli")).toBe("Yoldaş Okyeli");
  });

  it("çift platformlu takipçiyi kurallara göre oluşturur ve şemadan geçer", () => {
    const c = createStarterCharacter({
      handle: "@Buz.Kalkan_42",
      platform: "instagram",
      linkedPlatforms: ["youtube"],
      region: "akinburnu",
      coordinates: { x: 215, y: 560 },
      now,
    });
    expect(c).toMatchObject({
      id: "buz_kalkan_42",
      handle: "Buz.Kalkan_42",
      displayName: "Buz.Kalkan_42",
      roleType: "follower",
      linkedPlatforms: ["instagram", "youtube"],
      class: { id: "kalkaneri", name: "Kalkaneri", archetype: "savasci" },
      rarity: "nadir",
      title: "Yoldaş Kalkaneri",
      badges: ["cift_iz"],
      updatedAt: "2026-11-24T15:00:00.000Z",
    });
    const parsed = characterSchema.safeParse(c);
    expect(parsed.success, parsed.success ? "" : parsed.error.message).toBe(true);
  });
});

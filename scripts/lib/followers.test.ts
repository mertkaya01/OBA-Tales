import { describe, expect, it } from "vitest";
import { applyEntries } from "./followers";

// applyEntries gerçek roster.json'u okur ama yazmaz; kullanıcı adları gerçek takipçilerle çakışmayacak kadar tuhaf seçildi.
describe("abone ve takipçi içe aktarımı", () => {
  const result = applyEntries([
    { platform: "youtube", handle: "mhellingtr", displayName: "" },
    { platform: "instagram", handle: "EGETUNCE", displayName: "" },
    { platform: "tiktok", handle: "zq.Deneme.ISIK", displayName: "Çok uzun bir görünen ad 🎮 kırk karakteri rahatça aşan bir ad" },
    { platform: "instagram", handle: "zq.deneme.isik", displayName: "" },
    { platform: "instagram", handle: "kursat", displayName: "" },
    { platform: "tiktok", handle: "__", displayName: "" },
  ]);

  it("kahramanları eklemez, ayrıca listeler", () => {
    expect(result.heroes).toEqual(["mhellingtr", "EGETUNCE"]);
    expect(result.roster.characters.some((c) => c.id === "mhellingtr" || c.id === "egetunce")).toBe(false);
  });

  it("aynı kişiyi büyük-küçük harf farkıyla iki kez eklemez; ikinci platformu bağlar", () => {
    const isik = result.roster.characters.filter((c) => c.handle.toLowerCase() === "zq.deneme.isik");
    expect(isik).toHaveLength(1);
    expect(isik[0].linkedPlatforms).toEqual(["tiktok", "instagram"]);
    expect([...isik[0].displayName].length).toBeLessThanOrEqual(40);
  });

  it("kadroyla aynı adlı gerçek takipçi ayrı kimlikle girer; kimlik çıkmayan ad atlanır", () => {
    const kursat = result.roster.characters.find((c) => c.handle === "kursat");
    if (result.added.includes("kursat")) expect(kursat?.id).toMatch(/^kursat_yoldas/);
    expect(result.skipped).toContain("__");
    expect(new Set(result.roster.characters.map((c) => c.id)).size).toBe(result.roster.characters.length);
  });
});

describe("yorumla kahraman adı", () => {
  const base = applyEntries([{ platform: "youtube", handle: "zq-yorumcu", displayName: "@zq-yorumcu" }], { roster: { version: 1, season: 1, generatedAt: "2026-11-01T00:00:00.000Z", characters: [] } });
  const old = { ...base.roster, characters: base.roster.characters.map((c) => ({ ...c, updatedAt: "2026-11-27T12:00:00.000Z" })) };

  it("yeni gelen yorumdaki adla doğar", () => {
    const r = applyEntries([{ platform: "instagram", handle: "zq.yeni", displayName: "zq.yeni", heroName: "kara şahin" }], { roster: old });
    expect(r.roster.characters.find((c) => c.handle === "zq.yeni")?.displayName).toBe("Kara Şahin");
    expect(r.named).toEqual([{ handle: "zq.yeni", name: "Kara Şahin" }]);
  });

  it("haritadaki kişi yeni yorumla adını değiştirir; eski yorum elle verilmiş adı ezmez", () => {
    const renamed = applyEntries([{ platform: "youtube", handle: "zq-yorumcu", displayName: "", heroName: "Demir Yay", at: "2026-11-28T10:00:00Z" }], { roster: old });
    expect(renamed.roster.characters[0].displayName).toBe("Demir Yay");
    const manual = { ...old, characters: old.characters.map((c) => ({ ...c, displayName: "Panelden Ad" })) };
    const stale = applyEntries([{ platform: "youtube", handle: "zq-yorumcu", displayName: "", heroName: "Demir Yay", at: "2026-11-26T10:00:00Z" }], { roster: manual });
    expect(stale.roster.characters[0].displayName).toBe("Panelden Ad");
    expect(stale.named).toEqual([]);
    // Adı hâlâ kullanıcı adıysa eski yorum da uygulanır.
    const plain = applyEntries([{ platform: "youtube", handle: "zq-yorumcu", displayName: "", heroName: "Demir Yay", at: "2026-11-26T10:00:00Z" }], { roster: old });
    expect(plain.roster.characters[0].displayName).toBe("Demir Yay");
  });

  it("aynı kişinin en yeni komutu geçer; uygunsuz ad uygulanmaz ama kişi katılır", () => {
    const r = applyEntries(
      [
        { platform: "tiktok", handle: "zq.iki", displayName: "", heroName: "Yeni Ad", at: "2026-11-28T10:00:00Z" },
        { platform: "tiktok", handle: "zq.iki", displayName: "", heroName: "Eski Ad", at: "2026-11-20T10:00:00Z" },
        { platform: "tiktok", handle: "zq.kufur", displayName: "", heroName: "siktir" },
      ],
      { roster: old },
    );
    expect(r.roster.characters.find((c) => c.handle === "zq.iki")?.displayName).toBe("Yeni Ad");
    expect(r.roster.characters.find((c) => c.handle === "zq.kufur")?.displayName).toBe("zq.kufur");
    expect(r.rejectedNames).toEqual([{ handle: "zq.kufur", name: "siktir", reason: "uygunsuz söz" }]);
  });
});

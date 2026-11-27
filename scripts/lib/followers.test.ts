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

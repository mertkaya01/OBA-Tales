import { describe, expect, it } from "vitest";
import { VILLAGES } from "../../src/content/sites";
import { getTerrain } from "../../src/game/terrainCache";
import { createVisibility } from "../../src/game/visibility";
import { createStarterCharacter, defaultTitle } from "../../src/lib/rules";
import type { RosterFile } from "../../src/types";
import { addFollower, deleteFollower, homeOptions, listFollowers, patchFollower, pointProblem, type EditContext } from "./followerEdit";

const SEED = 20261124;
const konuk = VILLAGES.find((v) => v.id === "konuk_obasi")!;
const ctx: EditContext = {
  terrain: getTerrain(SEED),
  seed: SEED,
  visibility: createVisibility(["kutada"], []),
  arrivalPoint: () => ({ x: 1600, y: 1160 }),
  now: new Date("2026-11-27T10:00:00Z"),
};

function roster(): RosterFile {
  const at = { x: 1600, y: 1160 };
  return {
    version: 1,
    season: 1,
    generatedAt: "2026-11-27T09:00:00.000Z",
    characters: [
      createStarterCharacter({ handle: "kartal.oglu", displayName: "Kartal", platform: "instagram", region: "kutada", coordinates: at }),
      createStarterCharacter({ handle: "ayaz_okcu", displayName: "Ayaz", platform: "tiktok", linkedPlatforms: ["instagram"], region: "kutada", coordinates: at }),
      createStarterCharacter({ handle: "bilge.ozan", platform: "youtube", region: "kutada", coordinates: at }),
    ],
  };
}

describe("yönetim panelinde takipçi düzenleme", () => {
  it("listeler, arar, süzer ve sayfalar", () => {
    const r = roster();
    expect(listFollowers(r).total).toBe(3);
    expect(listFollowers(r, { ara: "AYAZ" }).items.map((c) => c.handle)).toEqual(["ayaz_okcu"]);
    expect(listFollowers(r, { platform: "instagram" }).total).toBe(2); // bağlı platform da sayılır
    expect(listFollowers(r, { boyut: 5, sayfa: 9 }).page).toBe(1);
  });

  it("ad, unvan, nadirlik, puan ve rozet değişir; otomatik unvan nadirliği izler, elle yazılan korunur", () => {
    const r = roster();
    let { roster: next, character } = patchFollower(r, "kartal_oglu", { displayName: "Kartal Oğlu", rarity: "destansi", points: 120 }, ctx);
    expect(character.displayName).toBe("Kartal Oğlu");
    expect(character.title).toBe(defaultTitle("destansi", "kalkaneri"));
    expect(character.points).toBe(120);
    expect(character.updatedAt).toBe(ctx.now!.toISOString());
    ({ roster: next, character } = patchFollower(next, "kartal_oglu", { title: "Kutada'nın Kalkanı", badges: ["ilk_adim"] }, ctx));
    expect(character.title).toBe("Kutada'nın Kalkanı");
    expect(character.badges).toEqual(["ilk_adim"]);
    ({ character } = patchFollower(next, "kartal_oglu", { rarity: "efsanevi" }, ctx));
    expect(character.title).toBe("Kutada'nın Kalkanı");
    ({ character } = patchFollower(next, "kartal_oglu", { title: "" }, ctx));
    expect(character.title).toBe(defaultTitle("destansi", "kalkaneri"));
  });

  it("ana platform sınıfı belirler; platform sayısı değişince çok platform rozeti güncellenir", () => {
    const { character } = patchFollower(roster(), "kartal_oglu", { platform: "youtube", linkedPlatforms: ["instagram", "tiktok"] }, ctx);
    expect(character.class.id).toBe("ocakcan");
    expect(character.linkedPlatforms).toEqual(["youtube", "instagram", "tiktok"]);
    expect(character.badges).toContain("oba_onculugu");
    expect(character.badges).not.toContain("cift_iz");
  });

  it("geçersiz değişiklikleri reddeder", () => {
    const r = roster();
    expect(() => patchFollower(r, "kartal_oglu", { rarity: "ulu" }, ctx)).toThrow(/Efsanevi/);
    expect(() => patchFollower(r, "kartal_oglu", { displayName: "  " }, ctx)).toThrow(/boş/);
    expect(() => patchFollower(r, "kartal_oglu", { points: -3 }, ctx)).toThrow(/Puan/);
    expect(() => patchFollower(r, "yok_boyle", { points: 3 }, ctx)).toThrow(/listede yok/);
  });

  it("yer: obada boş bir yer, Kut Kapısı ya da haritadan seçilen kuru ve açık bir nokta", () => {
    const r = roster();
    const inVillage = patchFollower(r, "bilge_ozan", { home: { kind: "oba", village: "konuk_obasi" } }, ctx).character;
    expect(Math.hypot(inVillage.coordinates.x - konuk.center.x, inVillage.coordinates.y - konuk.center.y)).toBeLessThan(konuk.radius * 1.15);
    expect(pointProblem(inVillage.coordinates, ctx)).toBeNull();
    expect(inVillage.region).toBe("kutada");
    expect(patchFollower(r, "bilge_ozan", { home: { kind: "kapi" } }, ctx).character.coordinates).toEqual({ x: 1600, y: 1160 });
    expect(() => patchFollower(r, "bilge_ozan", { home: { kind: "nokta", x: 30, y: 30 } }, ctx)).toThrow(/denizde/);
    expect(() => patchFollower(r, "bilge_ozan", { home: { kind: "nokta", x: konuk.center.x, y: konuk.center.y } }, ctx)).toThrow(/çadır|yapı/);
    // Karartılı bir obaya taşınamaz.
    const hidden = VILLAGES.find((v) => v.id && v.region !== "kutada")!;
    expect(() => patchFollower(r, "bilge_ozan", { home: { kind: "oba", village: hidden.id! } }, ctx)).toThrow(/açılmadı/);
    expect(homeOptions(ctx.visibility).map((h) => h.id)).toEqual(["kapi", "konuk_obasi"]);
  });

  it("elle ekler (aynı kullanıcı adını iki kez eklemez) ve siler", () => {
    const { roster: added, character } = addFollower(roster(), { handle: "@yeni.yoldas", displayName: "Yeni", platform: "tiktok" }, ctx);
    expect(character.handle).toBe("yeni.yoldas");
    expect(character.class.id).toBe("okyeli");
    expect(added.characters).toHaveLength(4);
    expect(() => addFollower(added, { handle: "YENI.YOLDAS", platform: "instagram" }, ctx)).toThrow(/zaten/);
    expect(() => addFollower(added, { handle: "boşluk var", platform: "instagram" }, ctx)).toThrow(/geçerli/);
    expect(deleteFollower(added, character.id).characters).toHaveLength(3);
  });

  it("hikâyenin kahramanlarını takipçi olarak eklemez; kadroyla aynı adlı gerçek takipçi ayrı kimlik alır", () => {
    expect(() => addFollower(roster(), { handle: "mhellingtr", platform: "youtube" }, ctx)).toThrow(/kahraman/);
    expect(() => addFollower(roster(), { handle: "@Ege.Tunce", platform: "instagram" }, ctx)).toThrow(/kahraman/);
    const { roster: once, character } = addFollower(roster(), { handle: "kursat", platform: "instagram" }, ctx);
    expect(character.id).toBe("kursat_yoldas");
    expect(character.handle).toBe("kursat");
    // Aynı kimliğe düşen ikinci biri (ör. "Kursat_Yoldas") sayı ekli kimlik alır.
    expect(addFollower(once, { handle: "kursat__yoldas", platform: "tiktok" }, ctx).character.id).toBe("kursat_yoldas_2");
  });
});

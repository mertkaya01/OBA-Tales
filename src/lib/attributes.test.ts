import { describe, expect, it } from "vitest";
import { CAST } from "../content/cast";
import { ATTRIBUTE_IDS } from "../types";
import type { Character, Rarity } from "../types";
import { ATTRIBUTE_CAP, attributesOf } from "./attributes";
import { createStarterCharacter } from "./rules";

const make = (handle: string, platform: Character["platform"], rarity: Rarity = "siradan"): Character => ({
  ...createStarterCharacter({ handle, platform, region: "akinburnu", coordinates: { x: 473, y: 1425 }, now: new Date("2026-11-25T12:00:00Z") }),
  rarity,
});

describe("nitelikler", () => {
  it("takipçide sınıfa göre şekillenir, nadirlikle artar, tavanı aşmaz ve her açılışta aynıdır", () => {
    const shield = attributesOf(make("kalkan_bir", "instagram")).values;
    const archer = attributesOf(make("okcu_bir", "tiktok")).values;
    const healer = attributesOf(make("ocak_bir", "youtube")).values;
    expect(shield.guc).toBeGreaterThan(archer.guc);
    expect(archer.ceviklik).toBeGreaterThan(shield.ceviklik);
    expect(healer.kut).toBeGreaterThan(shield.kut);
    const low = attributesOf(make("ayni_kisi", "tiktok", "siradan")).values;
    const high = attributesOf(make("ayni_kisi", "tiktok", "efsanevi")).values;
    for (const id of ATTRIBUTE_IDS) expect(high[id]).toBeGreaterThan(low[id]);
    expect(attributesOf(make("ayni_kisi", "tiktok")).values).toEqual(low);
    for (let i = 0; i < 200; i++) {
      const sheet = attributesOf(make(`yoldas_${i}`, (["instagram", "tiktok", "youtube"] as const)[i % 3], "efsanevi"));
      expect(sheet.heroic).toBe(false);
      expect(sheet.special).toBeNull();
      for (const id of ATTRIBUTE_IDS) expect(sheet.values[id]).toBeLessThanOrEqual(ATTRIBUTE_CAP);
    }
  });

  it("özel kahramanlar tavanı aşar ve kendilerine ait bir nitelik taşır; en güçlüsü mhellingtr", () => {
    const ege = attributesOf(CAST.find((c) => c.id === "egetunce")!);
    const mhe = attributesOf(CAST.find((c) => c.id === "mhellingtr")!);
    for (const sheet of [ege, mhe]) {
      expect(sheet.heroic).toBe(true);
      expect(sheet.special?.value).toBeGreaterThan(ATTRIBUTE_CAP);
      expect(Math.max(...Object.values(sheet.values))).toBeGreaterThan(ATTRIBUTE_CAP);
    }
    expect(ege.values.guc).toBeGreaterThan(mhe.values.guc); // savaşçı daha güçlü
    expect(mhe.values.ceviklik).toBeGreaterThan(ege.values.ceviklik); // okçu daha çevik
    const total = (s: typeof ege) => Object.values(s.values).reduce((a, b) => a + b, 0) + (s.special?.value ?? 0);
    expect(total(mhe)).toBeGreaterThan(total(ege));
    // Kadronun geri kalanı türetilir, tavanı aşmaz.
    for (const member of CAST.filter((c) => c.roleType !== "hero")) {
      expect(attributesOf(member).heroic, member.id).toBe(false);
    }
  });
});

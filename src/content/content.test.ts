/**
 * KANON İÇERİK TESTLERİ — bölgeler, bölümler, boss'lar, kadro ve rozetler birbiriyle tutarlı mı?
 */
import * as icons from "lucide-react";
import { describe, expect, it } from "vitest";
import { characterSchema } from "../schemas/data";
import { pointInPolygon } from "../lib/geometry";
import { deriveBadges } from "../lib/rules";
import { SEASON_LENGTH, WORLD_SIZE } from "../types";
import type { Coordinates } from "../types";
import { BADGE_LIST } from "./badges";
import { BOSS_LIST, BOSSES } from "./bosses";
import { CAST } from "./cast";
import { EPISODES } from "./episodes";
import { REGION_LIST, REGIONS } from "./regions";

const SLUG = /^[a-z0-9][a-z0-9_-]*$/;

/** İki doğru parçası gerçekten kesişiyor mu? (ortak köşe sayılmaz) */
function segmentsCross(p1: Coordinates, p2: Coordinates, p3: Coordinates, p4: Coordinates): boolean {
  const side = (a: Coordinates, b: Coordinates, c: Coordinates) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return side(p3, p4, p1) * side(p3, p4, p2) < 0 && side(p1, p2, p3) * side(p1, p2, p4) < 0;
}

describe("bölgeler", () => {
  it.each(REGION_LIST.map((r) => [r.id, r] as const))("%s geçerli bir poligon", (_id, region) => {
    expect(region.polygon.length).toBeGreaterThanOrEqual(3);
    for (const p of region.polygon) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(WORLD_SIZE.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(WORLD_SIZE.height);
    }
    expect(pointInPolygon(region.center, region.polygon)).toBe(true);
    expect(region.elevation).toBeGreaterThanOrEqual(0);
    expect(region.elevation).toBeLessThanOrEqual(1);

    const n = region.polygon.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        const crosses = segmentsCross(region.polygon[i], region.polygon[i + 1], region.polygon[j], region.polygon[(j + 1) % n]);
        expect(crosses, `kenar ${i} × ${j}`).toBe(false);
      }
    }
  });

  it("bölgeler birbirine taşmaz", () => {
    let overlapping = 0;
    for (let x = 2; x < WORLD_SIZE.width; x += 4) {
      for (let y = 2; y < WORLD_SIZE.height; y += 4) {
        if (REGION_LIST.filter((r) => pointInPolygon({ x, y }, r.polygon)).length > 1) overlapping++;
      }
    }
    expect(overlapping).toBe(0);
  });

  it("her bölge, kendisinde geçen ilk bölümde açılır; başlangıç adası (Kutada) hep açıktır", () => {
    expect(REGION_LIST.filter((r) => r.hub).map((r) => r.id)).toEqual(["kutada"]);
    expect(REGIONS.kutada.unlockEpisode).toBe(1);
    for (const region of REGION_LIST.filter((r) => !r.hub)) {
      expect(EPISODES.find((ep) => ep.region === region.id)?.number, region.id).toBe(region.unlockEpisode);
    }
  });
});

describe("bölümler ve boss'lar", () => {
  it("12 bölüm sırayla ve benzersiz kimliklerle tanımlı", () => {
    expect(EPISODES).toHaveLength(SEASON_LENGTH);
    EPISODES.forEach((ep, i) => expect(ep.number).toBe(i + 1));
    const ids = EPISODES.map((ep) => ep.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => SLUG.test(id))).toBe(true);
  });

  it("oylamalar 1–2 adet, kimlikleri benzersiz ve bölüm önekli", () => {
    const pollIds = new Set<string>();
    for (const ep of EPISODES) {
      expect(ep.polls.length).toBeGreaterThanOrEqual(1);
      expect(ep.polls.length).toBeLessThanOrEqual(2);
      for (const poll of ep.polls) {
        expect(poll.id.startsWith(`b${String(ep.number).padStart(2, "0")}-`), poll.id).toBe(true);
        expect(pollIds.has(poll.id), poll.id).toBe(false);
        pollIds.add(poll.id);
        const optionIds = poll.options.map((o) => o.id);
        expect(optionIds.length).toBeGreaterThanOrEqual(2);
        expect(new Set(optionIds).size).toBe(optionIds.length);
        expect(optionIds.every((id) => SLUG.test(id)), poll.id).toBe(true);
      }
    }
  });

  it("her bölüm açılmış bir bölgede geçer", () => {
    for (const ep of EPISODES) expect(REGIONS[ep.region].unlockEpisode, ep.id).toBeLessThanOrEqual(ep.number);
  });

  it("boss'lar bölümleriyle karşılıklı uyuşur", () => {
    for (const ep of EPISODES.filter((e) => e.bossId)) {
      const boss = BOSSES[ep.bossId!];
      expect(boss.episode).toBe(ep.number);
      expect(boss.region).toBe(ep.region);
    }
    for (const boss of BOSS_LIST) expect(EPISODES[boss.episode - 1].bossId).toBe(boss.id);
  });
});

describe("kadro", () => {
  it("lider, anlatıcı, 3 ana, 2 yan karakter ve 3 özel kahramandan oluşur", () => {
    expect(CAST.map((c) => c.roleType).sort()).toEqual(["core", "core", "core", "hero", "hero", "hero", "leader", "narrator", "side", "side"]);
  });

  it("Ulu ve Göksel kademeler yalnızca özel kahramanlarda; mhellingtr en güçlüsü", () => {
    const special = CAST.filter((c) => c.rarity === "ulu" || c.rarity === "goksel");
    expect(special.map((c) => [c.id, c.rarity, c.class.id])).toEqual([
      ["egetunce", "ulu", "kalkaneri"],
      ["mhellingtr", "goksel", "okyeli"],
    ]);
    for (const hero of special) {
      expect(hero.roleType).toBe("hero");
      expect(hero.specialAbilities?.length).toBeGreaterThanOrEqual(3);
    }
    const top = Math.max(...CAST.map((c) => c.points));
    expect(CAST.find((c) => c.points === top)?.id).toBe("mhellingtr");
    // Takipçi kaydı Ulu ya da Göksel olamaz.
    const follower = { ...special[0], roleType: "follower" as const, badges: ["oba_onculugu" as const] };
    expect(characterSchema.safeParse(follower).success).toBe(false);
  });

  it.each(CAST.map((c) => [c.id, c] as const))("%s şemadan geçer ve kendi bölgesinde durur", (_id, member) => {
    const result = characterSchema.safeParse(member);
    expect(result.success, result.success ? "" : result.error.message).toBe(true);
    expect(pointInPolygon(member.coordinates, REGIONS[member.region].polygon)).toBe(true);
    const expected = deriveBadges({ roleType: member.roleType, linkedPlatforms: member.linkedPlatforms });
    expect([...member.badges].sort()).toEqual([...expected].sort());
  });
});

describe("rozetler", () => {
  it("her rozet simgesi lucide-react içinde var", () => {
    const pascal = (name: string) => name.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join("");
    for (const badge of BADGE_LIST) {
      expect(icons[pascal(badge.icon) as keyof typeof icons], badge.icon).toBeDefined();
    }
  });
});

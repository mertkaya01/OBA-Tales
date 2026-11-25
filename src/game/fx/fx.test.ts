import { describe, expect, it } from "vitest";
import { BOSS_LIST } from "../../content/bosses";
import { CAST } from "../../content/cast";
import { createStarterCharacter } from "../../lib/rules";
import { BOSS_IDS, CLASS_IDS } from "../../types";
import type { Character, Rarity } from "../../types";
import { EFFECTS } from "../../vendor/pixelfx/effects.js";
import { composeSprite } from "../sprites/composeSprite";
import { actorFromSprite } from "./actor";
import { bossSprite } from "./bossSprites";
import { BOSS_SCENES, PORTRAIT, RAID_STAGE, anchorPoint, classSkill, pickRaiders, portraitAuras, raidSkills } from "./fxCatalog";
import { PixelFxPlayer, paintedPixels } from "./PixelFxPlayer";
import { raidBackdrop } from "./raidBackdrop";

const now = new Date("2026-11-25T12:00:00Z");
const follower = (rarity: Rarity, platform: Character["platform"] = "instagram"): Character => ({
  ...createStarterCharacter({ handle: `portre_${rarity}_${platform}`, platform, region: "akinburnu", coordinates: { x: 215, y: 560 }, now }),
  rarity,
});

describe("pixelfx oynatıcı", () => {
  it("vendor'daki bütün efektler meta bilgisiyle yüklenir", () => {
    for (const [id, mod] of Object.entries(EFFECTS)) {
      expect(mod.meta.name, id).toBeTruthy();
      expect(mod.meta.size, id).toHaveLength(2);
    }
  });

  it("ateş çizer, döngüyü durdurunca söner ve kaldırılır", () => {
    const player = new PixelFxPlayer(128, 128);
    const fire = player.play("fire/campfire", { x: 64, y: 112, tag: "ocak" });
    for (let i = 0; i < 20; i++) player.update(1 / 30);
    player.render();
    expect(paintedPixels(player.front.pixels) + paintedPixels(player.back.pixels)).toBeGreaterThan(150);
    expect(player.has("ocak")).toBe(true);
    player.stop("ocak");
    for (let i = 0; i < 20; i++) player.update(1 / 30);
    expect(fire.finished).toBe(true);
    expect(player.count).toBe(0);
    // Boşalan katman bir kez daha yüklenir, sonra değişmez.
    player.render();
    expect(player.front.changed || player.back.changed).toBe(true);
    expect(paintedPixels(player.front.pixels)).toBe(0);
    player.render();
    expect(player.front.changed).toBe(false);
  });

  it("tek seferlik efekt kendiliğinden biter; hız verilen efekt kayar; gecikmeli efekt bekler", () => {
    const player = new PixelFxPlayer(200, 60);
    const arrow = player.play("projectiles/arrow", { x: 20, y: 30, velocity: { x: 200, y: 0 }, lifetime: 0.5 });
    const late = player.play("ice/ice-shatter", { x: 100, y: 58, delay: 1 });
    player.update(0.25);
    expect(arrow.options.x).toBeCloseTo(70);
    player.render();
    expect(paintedPixels(player.front.pixels)).toBeGreaterThan(0);
    for (let i = 0; i < 10; i++) player.update(0.1);
    // 1,25 sn: ok bitti; buz kütlesi (1 sn gecikme + 2,8 sn) hâlâ parçalanıyor.
    expect(arrow.finished).toBe(true);
    expect(late.finished).toBe(false);
    expect(player.count).toBe(1);
    for (let i = 0; i < 30; i++) player.update(0.1);
    expect(late.finished).toBe(true);
  });

  it("katman seçimi: arkaya zorlanan efekt ön katmana çizilmez", () => {
    const player = new PixelFxPlayer(128, 128);
    player.play("holy/sunburst", { x: 64, y: 64, layer: "back" });
    player.update(0.5);
    player.render();
    expect(paintedPixels(player.back.pixels)).toBeGreaterThan(100);
    expect(paintedPixels(player.front.pixels)).toBe(0);
  });
});

describe("canlı portre", () => {
  it("sprite'tan aktör: ayakları (0,0)'da, siluet dolu, renkler paketli", () => {
    const sprite = composeSprite(follower("nadir"));
    const actor = actorFromSprite(sprite, 2);
    expect(actor.w).toBe(32);
    expect(actor.h).toBe(40);
    expect(actor.y).toBe(-40);
    expect(actor.x).toBe(-16);
    const filled = actor.mask.data.reduce((sum, v) => sum + v, 0);
    expect(filled).toBeGreaterThan(300);
    const i = actor.mask.data.indexOf(1);
    expect(actor.pixels[i] >>> 24).toBe(255);
  });

  it("aura nadirliğe ve elemente göre seçilir", () => {
    const ids = (c: Character) => portraitAuras(c).map((r) => r.id);
    expect(ids(follower("siradan"))).toEqual(["weather/snow"]);
    expect(ids(follower("nadir"))).toEqual(["weather/fireflies"]);
    expect(ids(follower("destansi"))).toEqual(["holy/halo"]);
    expect(ids(follower("efsanevi"))).toContain("holy/sunburst");
    const yalvac = CAST.find((c) => c.id === "yalvac")!;
    const isikay = CAST.find((c) => c.id === "isikay")!;
    expect(ids(yalvac)).toContain("fire/spirit-flame");
    expect(ids(isikay)).toContain("holy/halo");
    for (const c of [...CAST, follower("efsanevi")]) {
      for (const recipe of portraitAuras(c)) {
        expect(recipe.options?.x).toBe(PORTRAIT.feetX);
      }
    }
  });

  it("her sınıfın imza yeteneği oynar ve görünür bir şey çizer", () => {
    for (const classId of CLASS_IDS) {
      const player = new PixelFxPlayer(PORTRAIT.width, PORTRAIT.height);
      const actor = actorFromSprite(composeSprite(follower("siradan")), 2);
      for (const r of classSkill(classId, { x: PORTRAIT.feetX, y: PORTRAIT.feetY })) player.playRecipe(r, { actor });
      let painted = 0;
      for (let i = 0; i < 12; i++) {
        player.update(1 / 30);
        player.render();
        painted = Math.max(painted, paintedPixels(player.front.pixels) + paintedPixels(player.back.pixels));
      }
      expect(painted, classId).toBeGreaterThan(20);
    }
  });
});

describe("boss akını sahnesi", () => {
  it("her boss'un sahnesi, sprite'ı ve iki hâli var", () => {
    for (const id of BOSS_IDS) {
      const scene = BOSS_SCENES[id];
      expect(scene.attacks.length, id).toBeGreaterThan(0);
      expect(scene.weakness.fx.length, id).toBeGreaterThan(0);
      expect(raidSkills(scene).ocakcan).toBe(scene.weakness.label);
      const angry = bossSprite(id);
      const calm = bossSprite(id, true);
      expect(angry.sprite.height, id).toBeGreaterThan(55);
      expect(angry.sprite.height).toBeLessThan(RAID_STAGE.groundY);
      expect(paintedPixels(angry.sprite.data), id).toBeGreaterThan(angry.sprite.width * angry.sprite.height * 0.25);
      // Sakin hâl farklı çizilir.
      expect(calm.sprite.data.some((v, i) => v !== angry.sprite.data[i]), id).toBe(true);
      // Zayıf nokta sprite'ın içinde.
      expect(Math.abs(angry.core.x)).toBeLessThan(angry.sprite.width / 2);
      expect(-angry.core.y).toBeLessThan(angry.sprite.height);
    }
    expect(BOSS_LIST.map((b) => b.id)).toEqual([...BOSS_IDS]);
  });

  it("çapalar doğru noktaya yerleşir", () => {
    const anchors = { boss: { x: 242, y: 150 }, cekirdek: { x: 242, y: 117 }, ocak: { x: 92, y: 150 }, oba: () => ({ x: 40, y: 152 }) };
    expect(anchorPoint({ id: "weather/snow", at: "sahne", dx: 160, dy: 170 }, anchors)).toEqual({ x: 160, y: 170 });
    expect(anchorPoint({ id: "ice/ice-shatter", at: "cekirdek", dx: -2, dy: 14 }, anchors)).toEqual({ x: 240, y: 131 });
    expect(anchorPoint({ id: "shadow/shadow-flames", at: "oba", dy: 2 }, anchors)).toEqual({ x: 40, y: 154 });
  });

  it("sahneye her sınıftan en fazla dört akıncı çıkar, önce kadro", () => {
    const crowd = [...Array.from({ length: 9 }, (_, i) => ({ ...follower("siradan", "tiktok"), id: `okcu_${i}` })), ...CAST];
    const picked = pickRaiders(crowd);
    for (const classId of CLASS_IDS) expect(picked[classId].length).toBeLessThanOrEqual(4);
    expect(picked.okyeli.length).toBe(4);
    expect(picked.kalkaneri[0].roleType).not.toBe("follower");
    expect(pickRaiders([]).ocakcan).toEqual([]);
  });

  it("arka plan: gökyüzü üstte koyu, zemin çizgisi açık, her piksel opak", () => {
    for (const [sky, ground] of [["kutup", "kar"], ["alacakaranlik", "deniz"], ["tutulma", "tas"]] as const) {
      const bg = raidBackdrop(sky, ground);
      expect(paintedPixels(bg.data)).toBe(320 * 180);
      const brightness = (x: number, y: number) => {
        const i = (y * 320 + x) * 4;
        return bg.data[i] + bg.data[i + 1] + bg.data[i + 2];
      };
      expect(brightness(5, 2)).toBeLessThan(brightness(5, RAID_STAGE.groundY));
    }
  });
});

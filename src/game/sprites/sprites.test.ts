import { describe, expect, it } from "vitest";
import { CAST } from "../../content/cast";
import { createStarterCharacter, raiseRarity } from "../../lib/rules";
import { RARITIES } from "../../types";
import type { Character, Rarity } from "../../types";
import { RARITY_COLORS, hexToRgba } from "../palette";
import { atlasRect, buildSpriteAtlas } from "./atlas";
import { composeSprite, resolveLook } from "./composeSprite";
import {
  BODY,
  CLASS_LAYERS,
  HAIR_LAYERS,
  RARITY_LAYERS,
  SPRITE_HEIGHT,
  SPRITE_SLOTS,
  SPRITE_WIDTH,
  type PixelLayer,
} from "./pixelMaps";

const now = new Date("2026-11-24T15:00:00Z");
const make = (handle: string, platform: Character["platform"], rarity: Rarity = "siradan"): Character => {
  const base = createStarterCharacter({ handle, platform, region: "akinburnu", coordinates: { x: 215, y: 560 }, now });
  return { ...base, rarity };
};

const allLayers: [string, PixelLayer][] = [
  ["gövde", BODY],
  ...Object.entries(HAIR_LAYERS).map(([k, v]) => [`saç:${k}`, v] as [string, PixelLayer]),
  ...Object.entries(CLASS_LAYERS).flatMap(([k, v]) => [[`${k}:arka`, v.back], [`${k}:ön`, v.front]] as [string, PixelLayer][]),
  ...Object.entries(RARITY_LAYERS).flatMap(([k, v]) => [[`${k}:arka`, v.back], [`${k}:ön`, v.front]] as [string, PixelLayer][]),
];

/** Sprite içindeki opak piksel sayısı. */
const opaque = (data: Uint8ClampedArray) => data.filter((_, i) => i % 4 === 3 && data[i] > 0).length;
/** Belirli bir rengin kaç pikselde geçtiği. */
const countColor = (data: Uint8ClampedArray, hex: string) => {
  const [r, g, b] = hexToRgba(hex);
  let n = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i] === r && data[i + 1] === g && data[i + 2] === b && data[i + 3] > 0) n++;
  return n;
};

describe("piksel haritaları", () => {
  it.each(allLayers)("%s katmanı 16×20 ve yalnızca tanımlı renk yuvalarını kullanır", (_name, pixelLayer) => {
    expect(pixelLayer).toHaveLength(SPRITE_HEIGHT);
    for (const row of pixelLayer) {
      expect(row).toHaveLength(SPRITE_WIDTH);
      for (const ch of row) expect(ch === "." || (SPRITE_SLOTS as readonly string[]).includes(ch), `"${ch}"`).toBe(true);
    }
  });

  it("gövde dikey eksene göre simetriktir", () => {
    const mirrorable = BODY.map((row) => row.replace(/[^.]/g, "#"));
    for (const row of mirrorable) expect(row).toBe([...row].reverse().join(""));
  });
});

describe("sprite birleştirici", () => {
  it("aynı karakter her zaman aynı görüntüyü verir", () => {
    const a = make("ayaz_okcu", "tiktok");
    expect(composeSprite(a).data).toEqual(composeSprite({ ...a }).data);
  });

  it("farklı takipçiler farklı görünür", () => {
    const looks = new Set(
      ["a1", "b2", "c3", "d4", "e5", "f6"].map((h) => JSON.stringify(resolveLook(make(h, "instagram")))),
    );
    expect(looks.size).toBeGreaterThan(3);
  });

  it("her sınıf kendi ekipmanını taşır", () => {
    const sizes = (["instagram", "tiktok", "youtube"] as const).map((p) => opaque(composeSprite(make("ayni_ad", p)).data));
    expect(new Set(sizes).size).toBe(3);
  });

  it("nadirlik yükseldikçe süs artar ve atkı nadirlik rengini alır", () => {
    const base = make("kar_tanesi", "instagram");
    const pixels = RARITIES.map((r) => opaque(composeSprite({ ...base, rarity: r }).data));
    expect(pixels[2]).toBeGreaterThan(pixels[0]); // destansı: uzun pelerin
    for (const rarity of ["nadir", "destansi", "efsanevi"] as const) {
      expect(countColor(composeSprite({ ...base, rarity }).data, RARITY_COLORS[rarity])).toBeGreaterThanOrEqual(8);
    }
    expect(raiseRarity("siradan")).toBe("nadir");
  });

  it("kadro kendi sabit renklerini kullanır", () => {
    const baturay = CAST.find((c) => c.id === "baturay")!;
    expect(resolveLook(baturay).colors.c).toBe("#2a3f6b");
    expect(resolveLook(baturay).colors.w).toBe("#c4413a");
  });
});

describe("sprite atlası", () => {
  const characters = [...CAST, ...Array.from({ length: 200 }, (_, i) => make(`takipci_${i}`, "youtube"))];
  const atlas = buildSpriteAtlas(characters, 256);

  it("boyutları ikinin kuvvetidir ve herkese yer vardır", () => {
    expect(atlas.columns).toBe(16);
    expect(Math.log2(atlas.width) % 1).toBe(0);
    expect(Math.log2(atlas.height) % 1).toBe(0);
    expect(atlas.width * atlas.height).toBeGreaterThanOrEqual(characters.length * SPRITE_WIDTH * SPRITE_HEIGHT);
    expect(atlas.index.size).toBe(characters.length);
  });

  it("her karakterin hücresi doludur ve birbirine taşmaz", () => {
    const seen = new Set<string>();
    for (const c of characters) {
      const rect = atlasRect(atlas, c.id)!;
      expect(rect.x + rect.width).toBeLessThanOrEqual(atlas.width);
      expect(rect.y + rect.height).toBeLessThanOrEqual(atlas.height);
      const key = `${rect.x},${rect.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      // Hücrenin ortasındaki gövde pikseli opak olmalı.
      const alpha = atlas.data[((rect.y + 10) * atlas.width + rect.x + 7) * 4 + 3];
      expect(alpha, c.id).toBe(255);
    }
    expect(atlasRect(atlas, "olmayan")).toBeNull();
  });
});

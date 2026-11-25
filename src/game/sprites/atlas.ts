/**
 * SPRITE ATLASI — bütün karakterleri tek bir dokuda toplar.
 *
 * Three.js binlerce takipçiyi tek bir InstancedMesh ile çizer; her örnek bu atlastan kendi
 * hücresini okur. 2048 piksel genişlikte 128 sütun × 16×20 hücre → 5000 takipçi ≈ 2048×1024.
 *
 * Koordinatlar piksel cinsindendir ve SOL ÜST köşeden başlar. Motor (Three/Pixi) kendi UV
 * yönüne çevirir.
 */
import type { Character } from "../../types";
import { composeSprite } from "./composeSprite";
import { SPRITE_HEIGHT, SPRITE_WIDTH } from "./pixelMaps";

export interface AtlasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpriteAtlas {
  width: number;
  height: number;
  columns: number;
  cellWidth: number;
  cellHeight: number;
  /** RGBA, satır satır, üst satır önce. */
  data: Uint8ClampedArray<ArrayBuffer>;
  /** Karakter kimliği → atlastaki sıra. */
  index: ReadonlyMap<string, number>;
}

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function buildSpriteAtlas(characters: readonly Character[], maxWidth = 2048): SpriteAtlas {
  const cellWidth = SPRITE_WIDTH;
  const cellHeight = SPRITE_HEIGHT;
  const columns = Math.max(1, Math.floor(maxWidth / cellWidth));
  const unique = [...new Map(characters.map((c) => [c.id, c])).values()];
  const usedColumns = Math.min(columns, Math.max(1, unique.length));
  const rowsNeeded = Math.max(1, Math.ceil(unique.length / columns));
  const width = nextPowerOfTwo(usedColumns * cellWidth);
  const height = nextPowerOfTwo(rowsNeeded * cellHeight);
  const data = new Uint8ClampedArray(width * height * 4);
  const index = new Map<string, number>();

  unique.forEach((character, i) => {
    index.set(character.id, i);
    const sprite = composeSprite(character);
    const originX = (i % columns) * cellWidth;
    const originY = Math.floor(i / columns) * cellHeight;
    for (let y = 0; y < cellHeight; y++) {
      const src = y * cellWidth * 4;
      const dst = ((originY + y) * width + originX) * 4;
      data.set(sprite.data.subarray(src, src + cellWidth * 4), dst);
    }
  });

  return { width, height, columns, cellWidth, cellHeight, data, index };
}

/** Karakterin atlastaki hücresi (piksel, sol üst köşeden). Atlasta yoksa null. */
export function atlasRect(atlas: SpriteAtlas, characterId: string): AtlasRect | null {
  const i = atlas.index.get(characterId);
  if (i === undefined) return null;
  return {
    x: (i % atlas.columns) * atlas.cellWidth,
    y: Math.floor(i / atlas.columns) * atlas.cellHeight,
    width: atlas.cellWidth,
    height: atlas.cellHeight,
  };
}

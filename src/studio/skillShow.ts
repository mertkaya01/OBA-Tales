/**
 * YETENEK GÖSTERİSİ (reel) — "Kahraman yetenekleri" şablonunda videonun üst yarısında açılan portre paneli: kahramanın
 * 3D portresi auralarıyla durur, ardından imza yeteneğini oynar (çekmecedeki canlı portrenin aynısı: fxCatalog).
 *
 * Animasyon videonun saatine kilitlidir: her karede efekt oynatıcısı tam o saniyeye ilerletilir; geri sarınca baştan
 * kurulup o ana hızla getirilir. Böylece önizleme ve kayıt aynı çıkar. Gök Gürültüsü'nde panel kararır, kahraman
 * siluete döner (darkness).
 */
import { actorFromSprite } from "../game/fx/actor";
import { PORTRAIT, darknessAt, portraitAuras, signatureSkill, type SignatureSkill } from "../game/fx/fxCatalog";
import { PixelFxPlayer } from "../game/fx/PixelFxPlayer";
import { composeSprite } from "../game/sprites/composeSprite";
import type { Character } from "../types";
import { renderPortrait } from "../world3d/characters/portrait3d";

export interface SkillSegment {
  hero: Character;
  /** Panelin açıldığı saniye. */
  at: number;
  duration: number;
}

/** Panel açıldıktan bu kadar sonra yetenek oynar (önce kahraman auralarıyla görünür). */
export const SKILL_DELAY = 0.6;
/** Portre tuvali bu kat büyütülür: 88 × 96 → 528 × 576. */
const SCALE = 6;
const FADE = 0.25;
const STEP = 1 / 60;

interface HeroAssets {
  /** Pürüzsüz portre (WebGL yoksa piksel sprite) ve tuvaldeki yeri (portre pikseli). */
  image: HTMLCanvasElement;
  box: { x: number; y: number; w: number; h: number };
  actor: ReturnType<typeof actorFromSprite>;
  skill: SignatureSkill;
}

function canvasOf(width: number, height: number, data: Uint8ClampedArray | Uint8Array): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
  return canvas;
}

function heroAssets(hero: Character): HeroAssets {
  const { feetX, feetY, spriteScale } = PORTRAIT;
  const boxW = 16 * spriteScale;
  const boxH = 20 * spriteScale;
  const model = renderPortrait(hero, boxW, boxH);
  const sharp = model ? renderPortrait(hero, boxW, boxH, { density: SCALE }) : null;
  const sprite = model ?? composeSprite(hero);
  const actor = actorFromSprite(sprite, model ? 1 : spriteScale);
  if (sharp) actor.pixels.fill(0);
  const image = sharp ? canvasOf(sharp.width, sharp.height, sharp.data) : canvasOf(sprite.width, sprite.height, sprite.data);
  return { image, box: { x: feetX - boxW / 2, y: feetY - boxH, w: boxW, h: boxH }, actor, skill: signatureSkill(hero, { x: feetX, y: feetY }) };
}

/** Bir reel boyunca yaşayan gösteri: kahraman varlıkları bir kez hazırlanır, oynatıcı bölüm başına kurulur. */
export class SkillShow {
  private readonly segments: readonly SkillSegment[];
  private assets = new Map<string, HeroAssets>();
  private state: { index: number; player: PixelFxPlayer; local: number; fired: boolean } | null = null;
  private back = document.createElement("canvas");
  private front = document.createElement("canvas");
  private tinted = document.createElement("canvas");

  constructor(segments: readonly SkillSegment[]) {
    this.segments = segments;
    for (const c of [this.back, this.front]) {
      c.width = PORTRAIT.width;
      c.height = PORTRAIT.height;
    }
  }

  private assetsFor(hero: Character): HeroAssets {
    let a = this.assets.get(hero.id);
    if (!a) {
      a = heroAssets(hero);
      this.assets.set(hero.id, a);
    }
    return a;
  }

  /** t anının panelini çizer (panel yoksa hiçbir şey çizmez). */
  draw(ctx: CanvasRenderingContext2D, t: number): void {
    const index = this.segments.findIndex((s) => t >= s.at && t < s.at + s.duration);
    if (index < 0) {
      this.state = null;
      return;
    }
    const segment = this.segments[index];
    const assets = this.assetsFor(segment.hero);
    const local = t - segment.at;
    // Yeni bölüm ya da geri sarma: oynatıcı baştan kurulur, o ana kadar ilerletilir.
    if (!this.state || this.state.index !== index || local < this.state.local - 1e-3) {
      const player = new PixelFxPlayer(PORTRAIT.width, PORTRAIT.height);
      for (const recipe of portraitAuras(segment.hero)) player.playRecipe(recipe, { actor: assets.actor });
      this.state = { index, player, local: 0, fired: false };
    }
    const s = this.state;
    while (s.local < local - 1e-6) {
      if (!s.fired && s.local >= SKILL_DELAY) {
        s.fired = true;
        for (const recipe of assets.skill.recipes) s.player.playRecipe(recipe, { actor: assets.actor });
      }
      const dt = Math.min(STEP, local - s.local);
      s.player.update(dt);
      s.local += dt;
    }
    s.player.render();
    this.back.getContext("2d")!.putImageData(new ImageData(s.player.back.pixels, PORTRAIT.width, PORTRAIT.height), 0, 0);
    this.front.getContext("2d")!.putImageData(new ImageData(s.player.front.pixels, PORTRAIT.width, PORTRAIT.height), 0, 0);

    const presence = Math.max(0, Math.min(1, local / FADE, (segment.duration - local) / FADE));
    const dark = assets.skill.darkness ? darknessAt(local - SKILL_DELAY, assets.skill.darkness) : 0;
    const w = PORTRAIT.width * SCALE;
    const h = PORTRAIT.height * SCALE;
    const x = Math.round((1080 - w) / 2);
    const y = 300;

    ctx.save();
    ctx.globalAlpha = presence;
    // Panel: koyu zemin, altın piksel çerçeve.
    ctx.fillStyle = "rgba(13, 27, 46, 0.9)";
    ctx.fillRect(x - 20, y - 20, w + 40, h + 40);
    ctx.fillStyle = "#edbd45";
    for (const [rx, ry, rw, rh] of [
      [x - 20, y - 20, w + 40, 8],
      [x - 20, y + h + 12, w + 40, 8],
      [x - 20, y - 20, 8, h + 40],
      [x + w + 12, y - 20, 8, h + 40],
    ]) {
      ctx.fillRect(rx, ry, rw, rh);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.back, x, y, w, h);
    if (dark > 0) {
      ctx.fillStyle = `rgba(4, 5, 11, ${0.94 * dark})`;
      ctx.fillRect(x, y, w, h);
    }
    // Kahraman: kararınca siluet (yalnızca kendi piksellerinin üstü boyanır).
    const { image, box } = assets;
    let hero: CanvasImageSource = image;
    if (dark > 0) {
      this.tinted.width = image.width;
      this.tinted.height = image.height;
      const tctx = this.tinted.getContext("2d")!;
      tctx.drawImage(image, 0, 0);
      tctx.globalCompositeOperation = "source-atop";
      tctx.fillStyle = `rgba(0, 0, 0, ${0.96 * dark})`;
      tctx.fillRect(0, 0, image.width, image.height);
      tctx.globalCompositeOperation = "source-over";
      hero = this.tinted;
    }
    ctx.imageSmoothingEnabled = image.width > box.w; // pürüzsüz portre yumuşak, piksel sprite keskin
    ctx.drawImage(hero, x + box.x * SCALE, y + box.y * SCALE, box.w * SCALE, box.h * SCALE);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.front, x, y, w, h);
    ctx.restore();
  }
}

const shows = new WeakMap<readonly SkillSegment[], SkillShow>();

/** Senaryonun gösterisi (aynı bölüm listesi için tek nesne). */
export function skillShowFor(segments: readonly SkillSegment[]): SkillShow {
  let show = shows.get(segments);
  if (!show) {
    show = new SkillShow(segments);
    shows.set(segments, show);
  }
  return show;
}

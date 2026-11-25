/**
 * PİKSEL EFEKT OYNATICI — pixelfx efektlerini canlı oynatır, iki katmana (karakterin arkası ve önü) çizer.
 *
 *   const player = new PixelFxPlayer(320, 180);
 *   player.play("fire/campfire", { x: 90, y: 148 });
 *   // her karede:
 *   player.update(dt);
 *   player.render();        // player.back.pixels ve player.front.pixels RGBA baytlar
 *
 * Motordan bağımsızdır (Pixi bilmez): baytları Pixi dokusuna, canvas'a ya da teste vermek kullanana kalır.
 * Koordinatlar tuval pikselidir: (0, 0) sol üst köşe, x sağa, y aşağı.
 */
import { clearFrame, composite, createFrame, createFx, type Frame, type FxInstance, type FxOptions } from "../../vendor/pixelfx/core/index.js";
import { EFFECTS, type EffectId } from "../../vendor/pixelfx/effects.js";

export interface FxLayerOutput {
  frame: Frame;
  /** w × h × 4, RGBA, saydam zemin üzerine (ışık alfa olarak toplanır). */
  pixels: Uint8ClampedArray<ArrayBuffer>;
  /** Baytlar bu karede değişti mi? (Değişmeyen katmanı dokuya yeniden yüklemeye gerek yok.) */
  changed: boolean;
  /** Katmanda şu an çizili bir şey var mı? */
  hasContent: boolean;
}

export interface PlayOptions extends FxOptions {
  /** Aynı etiketli efektler birlikte durdurulabilir (ör. "ortam", "saldiri"). */
  tag?: string;
  /**
   * auto: efektin arka parçası arka katmana, gerisi öne · back: hepsi arka katmanda · front: hepsi önde
   */
  layer?: "auto" | "back" | "front";
  /** Saniyede piksel: efekt bu hızla kayar (ok, mermi). */
  velocity?: { x: number; y: number };
  /** Bu kadar saniye sonra kendiliğinden durur (döngüler için). */
  lifetime?: number;
  /** Bu kadar saniye sonra başlar. */
  delay?: number;
}

export interface FxHandle {
  readonly id: EffectId;
  readonly tag?: string;
  /** Efektin konumu ve ayarları (değiştirilebilir: x, y, flip…). */
  readonly options: FxOptions;
  stop(): void;
  readonly finished: boolean;
}

interface Live extends FxHandle {
  fx: FxInstance;
  layer: "auto" | "back" | "front";
  age: number;
  delay: number;
  lifetime: number;
  velocity: { x: number; y: number } | null;
}

export class PixelFxPlayer {
  readonly width: number;
  readonly height: number;
  readonly back: FxLayerOutput;
  readonly front: FxLayerOutput;
  private live: Live[] = [];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    const layer = (): FxLayerOutput => ({
      frame: createFrame(width, height, 0, 0),
      pixels: new Uint8ClampedArray(width * height * 4),
      changed: false,
      hasContent: false,
    });
    this.back = layer();
    this.front = layer();
  }

  /** Bir efekti başlatır. Döngüler stop() ya da lifetime ile biter, tek seferlikler kendiliğinden. */
  play(id: EffectId, { tag, layer, velocity, lifetime, delay, ...options }: PlayOptions = {}): FxHandle {
    const fx = createFx(EFFECTS[id], options);
    const entry: Live = {
      id,
      tag,
      fx,
      layer: layer ?? "auto",
      options: fx.options,
      age: 0,
      delay: delay ?? 0,
      lifetime: lifetime ?? Infinity,
      velocity: velocity ?? null,
      stop: () => fx.stop(),
      get finished() {
        return fx.done();
      },
    };
    this.live.push(entry);
    return entry;
  }

  /** Katalogdaki bir tarifi oynatır; overrides konumu ve diğer ayarları değiştirir. */
  playRecipe(recipe: { id: EffectId; options?: PlayOptions; layer?: PlayOptions["layer"] }, overrides: PlayOptions = {}): FxHandle {
    return this.play(recipe.id, { ...recipe.options, layer: recipe.layer, ...overrides });
  }

  /** Etiketli bütün efektleri söndürür (etiketsiz çağrılırsa hepsini). */
  stop(tag?: string): void {
    for (const entry of this.live) if (tag === undefined || entry.tag === tag) entry.fx.stop();
  }

  /** Hepsini hemen kaldırır. */
  clear(): void {
    this.live = [];
  }

  /** Oynayan efekt sayısı. */
  get count(): number {
    return this.live.length;
  }

  has(tag: string): boolean {
    return this.live.some((entry) => entry.tag === tag && !entry.fx.done());
  }

  update(dt: number): void {
    for (const entry of this.live) {
      if (entry.delay > 0) {
        entry.delay -= dt;
        continue;
      }
      entry.fx.update(dt);
      entry.age += dt;
      if (entry.velocity) {
        entry.options.x = (entry.options.x ?? 0) + entry.velocity.x * dt;
        entry.options.y = (entry.options.y ?? 0) + entry.velocity.y * dt;
      }
      if (entry.age >= entry.lifetime) entry.fx.stop();
    }
    this.live = this.live.filter((entry) => !entry.fx.done());
  }

  /** Bütün efektleri iki katmana çizer ve RGBA baytlara çevirir. */
  render(): void {
    const drawLayer = (output: FxLayerOutput, layer: "back" | "front") => {
      clearFrame(output.frame);
      let drew = false;
      for (const entry of this.live) {
        if (entry.delay > 0) continue;
        if (entry.layer === "auto") entry.fx.draw(output.frame, layer);
        else if (entry.layer === layer) entry.fx.draw(output.frame);
        else continue;
        drew = true;
      }
      // Bir önceki karede bir şey vardıysa, boşalan katman da bir kez yüklensin.
      output.changed = drew || output.hasContent;
      if (output.changed) composite(output.frame, output.pixels, null, 1);
      output.hasContent = drew;
    };
    drawLayer(this.back, "back");
    drawLayer(this.front, "front");
  }
}

/** Bir katmanda opak ya da yarı saydam kaç piksel var (testler ve hata ayıklama için). */
export function paintedPixels(pixels: Uint8ClampedArray): number {
  let n = 0;
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) n++;
  return n;
}

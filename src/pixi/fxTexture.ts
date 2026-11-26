/**
 * Piksel baytları → Pixi dokusu.
 *
 *   textureFromRgba   sprite, boss, arka plan: bir kez çizilir
 *   LayerTexture      pixelfx katmanı: her karede, yalnızca değiştiyse yeniden yüklenir
 *
 * Bütün dokular keskin (nearest) büyür: pikseller bulanıklaşmaz. Tek istisna smoothTextureFromRgba (3D portre).
 */
import { Texture, TextureSource } from "pixi.js";
import type { FxLayerOutput } from "../game/fx/PixelFxPlayer";

TextureSource.defaultOptions.scaleMode = "nearest";

interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
}

function canvasOf(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext("2d")!];
}

/** Bir RGBA görüntüyü (isteğe bağlı tam sayı büyütmeyle) dokuya çevirir. */
export function textureFromRgba(image: RgbaImage, scale = 1): Texture {
  const [source, ctx] = canvasOf(image.width, image.height);
  ctx.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
  if (scale === 1) return Texture.from(source);
  const [big, bigCtx] = canvasOf(image.width * scale, image.height * scale);
  bigCtx.imageSmoothingEnabled = false;
  bigCtx.drawImage(source, 0, 0, big.width, big.height);
  return Texture.from(big);
}

/** Pürüzsüz (linear) doku: yüksek çözünürlüklü 3D portre gibi, küçültülünce de yumuşak kalması gerekenler için. */
export function smoothTextureFromRgba(image: RgbaImage): Texture {
  const [source, ctx] = canvasOf(image.width, image.height);
  ctx.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
  const texture = Texture.from(source);
  texture.source.scaleMode = "linear";
  return texture;
}

/** Bir pixelfx katmanını Pixi dokusuna bağlar. */
export class LayerTexture {
  readonly texture: Texture;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly image: ImageData;
  private readonly output: FxLayerOutput;

  constructor(output: FxLayerOutput) {
    this.output = output;
    const [canvas, ctx] = canvasOf(output.frame.w, output.frame.h);
    this.ctx = ctx;
    this.image = new ImageData(output.frame.w, output.frame.h);
    this.texture = Texture.from(canvas);
  }

  /** player.render() sonrası çağrılır. */
  sync(): void {
    if (!this.output.changed) return;
    this.image.data.set(this.output.pixels);
    this.ctx.putImageData(this.image, 0, 0);
    this.texture.source.update();
  }

  destroy(): void {
    this.texture.destroy(true);
  }
}

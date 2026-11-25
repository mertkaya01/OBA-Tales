/**
 * Boyalı görüntülerden (arazi, sis) Three.js dokusu üretir.
 * Arazi keskin piksellerle (nearest), sis yumuşak (linear) büyütülür.
 */
import { DataTexture, LinearFilter, NearestFilter, NoColorSpace, RGBAFormat, SRGBColorSpace } from "three";
import type { PaintedImage } from "../game/terrainPaint";

export function toDataTexture(image: PaintedImage, kind: "renk" | "maske"): DataTexture {
  const bytes = new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength);
  const texture = new DataTexture(bytes, image.width, image.height, RGBAFormat);
  const filter = kind === "renk" ? NearestFilter : LinearFilter;
  texture.magFilter = filter;
  texture.minFilter = filter;
  texture.generateMipmaps = false;
  // Renk dokusu sRGB'dir; sis maskesinde yalnızca saydamlık kullanılır.
  texture.colorSpace = kind === "renk" ? SRGBColorSpace : NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

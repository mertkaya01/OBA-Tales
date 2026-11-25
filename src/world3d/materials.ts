/**
 * Dünya malzemeleri: köşeli (flat shading) Lambert + sis eki.
 * Bütün çevre parçaları aynı görünüm dilini paylaşsın diye tek yerden üretilir.
 */
import { MeshLambertMaterial, type MeshLambertMaterialParameters } from "three";
import { applyFogOfWar, type FogUniforms } from "./shaders/fog";

export function foggedLambert(fogUniforms: FogUniforms, params: MeshLambertMaterialParameters = {}): MeshLambertMaterial {
  return applyFogOfWar(new MeshLambertMaterial({ flatShading: true, ...params }), fogUniforms);
}

/** Listeden konuma göre sabit bir renk seçer (aynı ağaç her açılışta aynı renkte). */
export function pickByPosition<T>(list: readonly T[], x: number, y: number): T {
  const index = Math.abs(Math.floor(x * 7.13 + y * 13.71)) % list.length;
  return list[index];
}

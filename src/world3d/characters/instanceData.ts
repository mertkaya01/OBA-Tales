/**
 * Kopya verisi: filtreden geçen karakterler → her parça için dönüşüm matrisleri, renkler ve hareket bilgisi.
 *
 * Bir karakterin bütün parçaları aynı matrisi paylaşır (yer + ölçek); parçanın karaktere göre yeri
 * geometrinin içine işlenmiştir. Yön, yürüyüş ve zıplama ekran kartında aMotion'dan hesaplanır
 * (living/motion.ts). Böylece binlerce karakter, parça başına tek bir çizimle canlı kalır.
 */
import { Color, Matrix4, Quaternion, Vector3 } from "three";
import { resolveLook } from "../../game/sprites/composeSprite";
import { hashString } from "../../lib/random";
import type { Character } from "../../types";
import type { CharacterPlacement } from "../living/placement";
import { PARTS, type PartSpec } from "./characterKit";

export interface PartInstances {
  spec: PartSpec;
  count: number;
  /** count × 16 */
  matrices: Float32Array;
  /** count × 3, doğrusal renk uzayında */
  colors: Float32Array;
  /** count × 4: (yarıçap, tohum, yön, nara gecikmesi) */
  motion: Float32Array;
}

export interface InstanceData {
  /** Kopya sırası → karakter kimliği (tıklama ve tıklama alanı için). */
  ids: string[];
  /** Karakter başına matris (evdeki yeri), ids.length × 16. */
  matrices: Float32Array;
  /** Karakter başına hareket bilgisi, ids.length × 4. */
  motion: Float32Array;
  parts: PartInstances[];
}

/**
 * Karakterlerin dünyadaki boyu. Gerçek orandan bilerek büyük (çadırların yarısı kadar):
 * oyuncak diorama hissi verir ve uzaktan da okunurlar.
 */
export const CHARACTER_SIZE = 1.8;

/** Kadro biraz daha iri, efsaneviler hafifçe, ulu ve göksel kahramanlar biraz daha iri; herkes kendi küçük farkıyla. */
export function characterScale(c: Character): number {
  const role = c.roleType === "follower" ? 1 : 1.15;
  const rarity = c.rarity === "goksel" ? 1.14 : c.rarity === "ulu" ? 1.1 : c.rarity === "efsanevi" ? 1.06 : 1;
  const jitter = 0.96 + ((hashString(`boy:${c.id}`) % 1000) / 1000) * 0.08;
  return CHARACTER_SIZE * role * rarity * jitter;
}

/** Dururken yüzleri kameraya (güneye) dönük, ±35° kadar farklı yönlere bakarlar. */
export function characterFacing(c: Character): number {
  if (c.roleType === "hero") return 0; // nöbetteki kahramanlar kapıdan gelenlere, kameraya bakar
  return ((hashString(`yon:${c.id}`) % 1000) / 1000 - 0.5) * 1.2;
}

const colorCache = new Map<string, Color>();
function linear(hex: string): Color {
  let color = colorCache.get(hex);
  if (!color) {
    color = new Color(hex);
    colorCache.set(hex, color);
  }
  return color;
}

export function buildInstanceData(
  characters: readonly Character[],
  placements: ReadonlyMap<string, CharacterPlacement>,
  activeParticipantIds: ReadonlySet<string>,
): InstanceData {
  const placed = characters.filter((c) => placements.has(c.id));
  const n = placed.length;
  const matrices = new Float32Array(n * 16);
  const motion = new Float32Array(n * 4);
  const matrix = new Matrix4();
  const position = new Vector3();
  const identity = new Quaternion();
  const scale = new Vector3();

  const looks = placed.map((c, i) => {
    const p = placements.get(c.id)!;
    position.set(p.home.x, p.groundY, p.home.y);
    matrix.compose(position, identity, scale.setScalar(p.scale)).toArray(matrices, i * 16);
    motion.set([p.motion.radius, p.motion.seed, p.motion.yaw, p.motion.cheer], i * 4);
    return resolveLook(c);
  });

  const parts = PARTS.map<PartInstances>((spec) => {
    const members: number[] = [];
    placed.forEach((c, i) => {
      if (spec.applies(c, looks[i], { inRaid: activeParticipantIds.has(c.id) })) members.push(i);
    });
    const partMatrices = new Float32Array(members.length * 16);
    const partColors = new Float32Array(members.length * 3);
    const partMotion = new Float32Array(members.length * 4);
    members.forEach((charIndex, k) => {
      partMatrices.set(matrices.subarray(charIndex * 16, charIndex * 16 + 16), k * 16);
      partMotion.set(motion.subarray(charIndex * 4, charIndex * 4 + 4), k * 4);
      const color = linear(spec.color(looks[charIndex]));
      partColors[k * 3] = color.r;
      partColors[k * 3 + 1] = color.g;
      partColors[k * 3 + 2] = color.b;
    });
    return { spec, count: members.length, matrices: partMatrices, colors: partColors, motion: partMotion };
  });

  return { ids: placed.map((c) => c.id), matrices, motion, parts };
}

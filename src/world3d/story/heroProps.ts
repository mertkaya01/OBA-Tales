/**
 * KAHRAMANIN ELİNDEKİLER — balta, sırtta odun bağı, su testisi, belde toplama sepeti.
 *
 *   · Her eşya iskeletin bir kemiğine bağlanır (balta sağ ele, odun ve testi göğse, sepet kalçaya); kemik
 *     oynadıkça eşya da onunla gider. Yeri model biriminde, duruş pozunda verilir; kemiğe göre yerel konuma
 *     bir kez çevrilir.
 *   · Balta eldeyken kahramanın kendi silahı (egetunce'nin kılıcı, mhellingtr'nin yayı) görünmez.
 */
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  Quaternion,
  Vector2,
  Vector3,
  type Material,
  type Object3D,
} from "three";
import type { ArrivalHeroId } from "../../content/story";
import type { Carry } from "./daySchedule";

export interface HeroPropSet {
  axe: Object3D | null;
  carry: Record<Exclude<Carry, null>, Object3D | null>;
  /** Balta eldeyken gizlenen silah parçaları. */
  weapon: Object3D[];
  /** Odun taşırken gizlenen parçalar (mhellingtr'nin yayı omzuna takılmasın). */
  hideWhileCarrying: Object3D[];
  dispose: () => void;
}

/** İskelet türüne göre eşyaların duruş pozundaki yeri (model birimi; ayak tabanı y = 0, yüz +z). */
const ANCHORS: Readonly<Record<"takipci" | "bintas", { wood: [number, number, number]; jug: [number, number, number]; basketX: number; basketY: number }>> = {
  takipci: { wood: [0, 3.36, -0.28], jug: [0.42, 3.2, -0.2], basketX: 0.66, basketY: 1.92 },
  bintas: { wood: [0, 3.05, -0.42], jug: [0.48, 3.0, -0.3], basketX: 0.95, basketY: 1.72 },
};

/** Sepet, toplama yapmayan elin tarafındaki kalçada: x > 0 sol taraf. */
const BASKET_SIDE: Readonly<Record<ArrivalHeroId, 1 | -1>> = { mhellingtr: 1, egetunce: -1, bintas: 1 };
const BASKET_FILL: Readonly<Record<ArrivalHeroId, string>> = { mhellingtr: "#7b2d5b", egetunce: "#7a64b8", bintas: "#5f8f3a" };


function boneOf(root: Object3D, name: string): Object3D | null {
  // glTF yükleyici adlardaki noktayı atar: "hand.R" → "handR".
  return root.getObjectByName(name.replace(".", "")) ?? root.getObjectByName(name) ?? null;
}

/** Eşyayı model uzayındaki dönüşümüyle kemiğe bağlar (duruş pozunda bir kez hesaplanır). */
function attach(bone: Object3D, object: Object3D, position: Vector3, rotation: Quaternion) {
  const desired = new Matrix4().compose(position, rotation, new Vector3(1, 1, 1));
  const local = bone.matrixWorld.clone().invert().multiply(desired);
  local.decompose(object.position, object.quaternion, object.scale);
  bone.add(object);
}

function build(geometries: BufferGeometry[], materials: Material[], parts: [BufferGeometry, Material, [number, number, number], [number, number, number]?][]): Group {
  const group = new Group();
  for (const [geometry, material, at, rot] of parts) {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(...at);
    if (rot) mesh.rotation.set(...rot);
    mesh.castShadow = true;
    group.add(mesh);
    if (!geometries.includes(geometry)) geometries.push(geometry);
    if (!materials.includes(material)) materials.push(material);
  }
  return group;
}

export function attachHeroProps(root: Object3D, hero: ArrivalHeroId): HeroPropSet {
  root.updateMatrixWorld(true);
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const lambert = (color: string) => new MeshLambertMaterial({ color, flatShading: true });
  const wood = lambert("#7a4e2a");
  const bark = lambert("#5d3b22");
  const iron = lambert("#a7b0ba");
  const rig = hero === "bintas" ? ANCHORS.bintas : ANCHORS.takipci;

  const hand = boneOf(root, "hand.R");
  const chest = boneOf(root, "chest");
  const hips = boneOf(root, "hips");

  // ── Balta: sap kolun uzantısı gibi aşağı-öne; ağız öne bakar ──
  let axe: Object3D | null = null;
  if (hand && hero !== "bintas") {
    const handle = new CylinderGeometry(0.065, 0.075, 1.4, 6).translate(0, -0.52, 0);
    const head = new BoxGeometry(0.09, 0.34, 0.5).translate(0, -1.08, 0.2);
    const edge = new BoxGeometry(0.05, 0.46, 0.12).translate(0, -1.08, 0.47);
    axe = build(geometries, materials, [
      [handle, wood, [0, 0, 0]],
      [head, iron, [0, 0, 0]],
      [edge, iron, [0, 0, 0]],
    ]);
    const wrist = new Vector3().setFromMatrixPosition(hand.matrixWorld);
    const grip = wrist.clone().add(new Vector3(0, -0.24, 0.04));
    const down = new Vector3(0, -1, 0.42).normalize(); // sapın gittiği yön
    const y = down.clone().negate();
    const z = new Vector3(0, 0.42, 1).normalize();
    const x = new Vector3().crossVectors(y, z).normalize();
    const rotation = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
    attach(hand, axe, grip, rotation);
  }

  // ── Sırtta odun bağı: üç kütük, omuzların üstünde ──
  let woodBundle: Object3D | null = null;
  if (chest) {
    const log = new CylinderGeometry(0.17, 0.17, 1.6, 7).rotateZ(Math.PI / 2);
    woodBundle = build(geometries, materials, [
      [log, bark, [0, 0, -0.16]],
      [log, bark, [0.06, 0, 0.16]],
      [log, bark, [-0.04, 0.27, 0]],
    ]);
    attach(chest, woodBundle, new Vector3(...rig.wood), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.12));
  }

  // ── Su testisi (BinTaş): omzunda ──
  let jug: Object3D | null = null;
  if (chest && hero === "bintas") {
    const profile = [
      [0, 0],
      [0.18, 0.02],
      [0.27, 0.18],
      [0.25, 0.42],
      [0.12, 0.6],
      [0.1, 0.72],
      [0.14, 0.76],
      [0, 0.76],
    ].map(([a, b]) => new Vector2(a, b));
    jug = build(geometries, materials, [[new LatheGeometry(profile, 8).translate(0, -0.38, 0), lambert("#b5653a"), [0, 0, 0]]]);
    attach(chest, jug, new Vector3(...rig.jug), new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -0.5));
  }

  // ── Toplama sepeti: toplayan elin karşı kalçasında ──
  let basket: Object3D | null = null;
  if (hips) {
    basket = build(geometries, materials, [
      [new CylinderGeometry(0.3, 0.24, 0.42, 8), lambert("#c19a5b"), [0, 0, 0]],
      [new CylinderGeometry(0.27, 0.27, 0.08, 8), lambert(BASKET_FILL[hero]), [0, 0.2, 0]],
    ]);
    attach(hips, basket, new Vector3(rig.basketX * BASKET_SIDE[hero], rig.basketY, 0.12), new Quaternion());
  }

  // ── Sırtlanan av: göğüste boş bir yuva; avlanan hayvanın kopyası oyunda içine konur (AnimatedHero) ──
  let catchSlot: Object3D | null = null;
  if (chest) {
    catchSlot = new Group();
    catchSlot.name = "av-yuvasi";
    attach(chest, catchSlot, new Vector3(0, rig.wood[1] - 0.05, rig.wood[2] + 0.05), new Quaternion());
  }

  // Silah parçaları birleşince "silah" ve "silah-parilti" ağlarında toplanır (heroModel.ts → dressHero).
  const weapon: Object3D[] = [];
  root.traverse((o) => {
    if ((o as Mesh).isMesh && typeof o.userData.oba === "string" && o.userData.oba.startsWith("silah")) weapon.push(o);
  });

  for (const o of [axe, woodBundle, jug, basket, catchSlot]) if (o) o.visible = false;
  return {
    axe,
    carry: { odun: woodBundle, testi: jug, sepet: basket, av: catchSlot },
    weapon,
    hideWhileCarrying: hero === "mhellingtr" ? weapon : [],
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}

/**
 * OBALAR VE ANITLAR — yaşayan dünyanın yapıları (konumlar: content/sites.ts, yerleşim: layout.ts).
 *
 *   Oba kampı: taş halkalı ateş (titreyen alev, yükselen duman, gece yerde sıcak ışık lekesi), kazan
 *              sehpası, odun yığını, tuğ sancağı (obanın renginde), at ağılı ve atlar ya da koyun sürüsü.
 *   Anıtlar:   Ata Heykeli · Balbal Yolu · Yazıtlı Taşlar (gece runları parlar) · Kartal Anıtı · Dilek Ağacı ·
 *              gözcü kuleleri · Üçkardeş Feneri · batık gemi · donmuş şelale.
 *   Patika köprüleri: yolların nehri geçtiği yerlerde ahşap köprüler.
 *
 * Tekrarlanan parçalar InstancedParts ile tek çizimde; her şey kodla, basit şekillerden kurulur.
 */
import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  CircleGeometry,
  DataTexture,
  DoubleSide,
  Euler,
  type Group,
  IcosahedronGeometry,
  LinearFilter,
  type InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Quaternion,
  RGBAFormat,
  Vector3,
} from "three";
import { MONUMENTS } from "../content/sites";
import { getTrails } from "../game/paths";
import type { Terrain } from "../game/terrain";
import { hashString } from "../lib/random";
import type { Coordinates } from "../types";
import { box, cone, cylinder, dodeca, ico, merge, ring } from "./geometryKit";
import { InstancedParts, type InstanceTransform } from "./InstancedParts";
import { CORRAL_RADIUS, FLOCK_RADIUS, balbalPlacements, campLayouts, shipwreckPlacement } from "./layout";
import { isHiddenAt, type LandVisibility } from "../game/visibility";
import type { SkyRuntime } from "./living/sky";
import { foggedLambert } from "./materials";
import type { FogUniforms } from "./shaders/fog";
import { WATER_LEVEL, groundY } from "./worldScale";

// ── Geometriler (tabanları y = 0, yüzleri +z) ──────────────────────

const FIRE_RING = merge(...ring(8, 2.1).map((p, i) => dodeca(0.55 + (i % 3) * 0.08, { at: [p.x, 0.3, p.z], ry: i })));
const FIRE_LOGS = merge(box(0.55, 0.5, 3.4, { at: [0, 0.3, 0], ry: 0.6 }), box(0.55, 0.5, 3.4, { at: [0, 0.35, 0], ry: -0.6 }), box(0.5, 0.45, 3, { at: [0, 0.6, 0], ry: 1.6 }));
const FLAME = cone(1.15, 3.2, 5, { at: [0, 1.6, 0] });
const FLAME_CORE = cone(0.65, 2.1, 5, { at: [0, 1.05, 0] });
const GLOW_DISC = new CircleGeometry(12, 20).rotateX(-Math.PI / 2).translate(0, 0.25, 0);

/** Yerdeki ışık lekesi için ortası parlak, kenarı sönen dairesel doku. */
function glowTexture(): DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.min(1, Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2));
      const a = Math.round(255 * (1 - d) ** 2);
      data.set([255, 255, 255, a], (y * size + x) * 4);
    }
  }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
const SMOKE = new IcosahedronGeometry(0.9, 0);
/** Oba ateşinin boyu (karakterler 1,8 kat iri olduğu için ateş de büyütüldü). */
const FIRE_SCALE = 2.4;
/** Tuğ sancakları uzaktan seçilsin: obanın simgesi. */
const BANNER_SCALE = 2.6;

const TRIPOD = merge(...ring(3, 1.1).map((p) => cylinder(0.08, 0.1, 3.2, 4, { at: [p.x * 0.5, 1.5, p.z * 0.5], rx: p.z * 0.3, rz: -p.x * 0.3 })));
const POT = merge(cylinder(0.85, 0.65, 1.1, 8, { at: [0, 1.1, 0] }), cylinder(0.9, 0.9, 0.15, 8, { at: [0, 1.65, 0] }));
const WOODPILE = merge(
  ...[0, 1, 2, 3, 4, 5].map((i) => {
    const row = i < 3 ? 0 : i < 5 ? 1 : 2;
    const col = i < 3 ? i - 1 : i < 5 ? i - 3.5 : 0;
    return cylinder(0.3, 0.3, 2.6, 6, { at: [col * 0.62, 0.32 + row * 0.55, 0], rx: Math.PI / 2 });
  }),
);

const BANNER_POLE = merge(cylinder(0.14, 0.18, 9, 5, { at: [0, 4.5, 0] }), cone(0.28, 0.9, 5, { at: [0, 9.4, 0] }), cylinder(0.45, 0.45, 0.2, 8, { at: [0, 8.7, 0] }));
const BANNER_TASSEL = cone(0.55, 2.2, 6, { at: [0, 7.5, 0], rx: Math.PI });
const BANNER_FLAG = box(0.1, 1.9, 2.6, { at: [0, 5.9, 1.35] });

// Ağıl: karakter boyunun yarısından yüksek, kalın direkli, üç sıra kirişli çit; bir yanında giriş aralığı.
const CORRAL = merge(
  ...ring(18, CORRAL_RADIUS).flatMap((p, i, all) => {
    const next = all[(i + 1) % all.length];
    const post = cylinder(0.26, 0.3, 3.2, 5, { at: [p.x, 1.6, p.z] });
    const cap = cone(0.32, 0.4, 5, { at: [p.x, 3.4, p.z] });
    if (i === 0) return [post, cap]; // giriş aralığı
    const mx = (p.x + next.x) / 2;
    const mz = (p.z + next.z) / 2;
    const length = Math.hypot(next.x - p.x, next.z - p.z);
    const angle = Math.atan2(next.z - p.z, next.x - p.x);
    return [
      post,
      cap,
      box(length, 0.24, 0.18, { at: [mx, 2.75, mz], ry: -angle }),
      box(length, 0.24, 0.18, { at: [mx, 1.85, mz], ry: -angle }),
      box(length, 0.24, 0.18, { at: [mx, 0.95, mz], ry: -angle }),
    ];
  }),
);

const HORSE = merge(
  box(1.05, 1.05, 2.5, { at: [0, 1.75, 0] }),
  box(0.5, 1.2, 0.7, { at: [0, 2.45, 1.2], rx: -0.5 }),
  box(0.48, 0.5, 1.05, { at: [0, 2.95, 1.75], rx: 0.25 }),
  box(0.14, 0.75, 0.5, { at: [0, 2.55, 0.9], rx: -0.5 }),
  ...[
    [-0.35, 0.95],
    [0.35, 0.95],
    [-0.35, -0.95],
    [0.35, -0.95],
  ].map(([x, z]) => box(0.26, 1.25, 0.26, { at: [x, 0.62, z] })),
  box(0.2, 1.2, 0.2, { at: [0, 1.55, -1.35], rx: 0.4 }),
);
const SHEEP = merge(box(1.2, 0.95, 1.6, { at: [0, 0.95, 0] }), ...[[-0.35, 0.5], [0.35, 0.5], [-0.35, -0.5], [0.35, -0.5]].map(([x, z]) => box(0.2, 0.55, 0.2, { at: [x, 0.28, z] })));
const SHEEP_HEAD = box(0.5, 0.5, 0.55, { at: [0, 1.15, 0.95] });

const BALBAL = merge(box(1.0, 2.3, 0.7, { at: [0, 1.15, 0] }), box(0.82, 0.85, 0.66, { at: [0, 2.75, 0] }), box(0.8, 0.3, 0.2, { at: [0, 1.6, 0.42] }));
const STELE = merge(box(1.4, 6.4, 0.6, { at: [0, 3.2, 0] }), cone(1.0, 0.9, 4, { at: [0, 6.85, 0], ry: Math.PI / 4, scale: [1, 1, 0.45] }));
const RUNES = merge(...[4.8, 3.6, 2.4].map((y, i) => box(0.7 - i * 0.1, 0.22, 0.08, { at: [0, y, 0.33] })), box(0.18, 1.6, 0.08, { at: [0, 3.6, 0.34] }));

const ATA = merge(
  box(9, 3, 9, { at: [0, 1.5, 0] }),
  box(7, 1, 7, { at: [0, 3.5, 0] }),
  cylinder(2.5, 4.0, 12, 8, { at: [0, 10, 0] }),
  cylinder(2.7, 2.7, 0.8, 8, { at: [0, 12.6, 0] }),
  box(6.4, 1.8, 3.2, { at: [0, 16.4, 0] }),
  box(1.3, 6.5, 1.3, { at: [-3.3, 13, 0.3], rz: -0.12 }),
  box(1.3, 4.5, 1.3, { at: [3.2, 14.2, 1.0], rx: -0.6 }),
  box(2.4, 2.6, 2.4, { at: [0, 18.6, 0] }),
  cone(1.3, 2.6, 6, { at: [0, 16.6, 1.0], rx: Math.PI }),
  cone(1.8, 3.2, 8, { at: [0, 21.4, 0] }),
  cylinder(2.0, 2.0, 0.6, 8, { at: [0, 20.1, 0] }),
);
const ATA_STAFF = merge(cylinder(0.32, 0.38, 24, 6, { at: [3.6, 14, 2.6] }), ico(0.9, { at: [3.6, 26.3, 2.6] }));

const KARTAL_PILLAR = merge(cylinder(1.5, 1.9, 12, 8, { at: [0, 6, 0] }), box(4.4, 1.2, 4.4, { at: [0, 12.6, 0] }), box(5.5, 1.2, 5.5, { at: [0, 0.6, 0] }));
const KARTAL = merge(
  ico(1.4, { at: [0, 14.8, 0], scale: [0.85, 1.25, 0.95] }),
  box(6.5, 0.3, 2.0, { at: [-3.4, 16.4, -0.2], rz: 0.55 }),
  box(6.5, 0.3, 2.0, { at: [3.4, 16.4, -0.2], rz: -0.55 }),
  ico(0.75, { at: [0, 16.6, 0.6] }),
  cone(0.3, 0.8, 4, { at: [0, 16.4, 1.45], rx: Math.PI / 2 }),
  box(1.2, 0.25, 1.6, { at: [0, 13.6, -1.2], rx: 0.4 }),
);

const TREE_TRUNK = merge(cylinder(0.9, 1.5, 6.5, 6, { at: [0, 3.25, 0] }), cylinder(0.35, 0.5, 3, 5, { at: [1.6, 6.2, 0], rz: -0.8 }), cylinder(0.35, 0.5, 3, 5, { at: [-1.4, 6.6, 0.5], rz: 0.8 }));
const TREE_CROWN = merge(ico(3.4, { at: [0, 9.2, 0] }), ico(2.6, { at: [2.8, 8, 0.6] }), ico(2.6, { at: [-2.6, 8.4, -0.4] }), ico(2.2, { at: [0.4, 8.2, 2.6] }));

const TOWER = merge(
  ...[
    [-1.9, -1.9],
    [1.9, -1.9],
    [-1.9, 1.9],
    [1.9, 1.9],
  ].map(([x, z]) => box(0.5, 12.5, 0.5, { at: [x * 0.92, 6.2, z * 0.92], rx: z * 0.025, rz: -x * 0.025 })),
  box(5.2, 0.5, 5.2, { at: [0, 12.2, 0] }),
  ...[0, 1, 2, 3].map((k) => box(5.2, 1, 0.2, { at: [0, 13, 0], ry: (k * Math.PI) / 2 }).translate(...([[0, 0, 2.5], [2.5, 0, 0], [0, 0, -2.5], [-2.5, 0, 0]][k] as [number, number, number]))),
  box(4.2, 0.3, 0.3, { at: [0, 4, 1.8], rz: 0.6 }),
  box(4.2, 0.3, 0.3, { at: [0, 8, -1.8], rz: -0.6 }),
);
const TOWER_ROOF = cone(4.2, 2.6, 4, { at: [0, 15.6, 0], ry: Math.PI / 4 });

const WRECK = merge(
  box(3.2, 1.7, 9.5, { at: [0, 0.5, 0] }),
  box(2.4, 1.2, 2.2, { at: [0, 1.1, 4.6], rx: -0.3 }),
  ...[-3, -1, 1, 3].map((z) => box(3.6, 0.25, 0.3, { at: [0, 1.5, z] })),
  cylinder(0.18, 0.22, 6, 5, { at: [0.6, 3.6, -0.8], rz: -0.7 }),
);

const RIBBON = box(0.18, 1.3, 0.05, { at: [0, -0.65, 0] });

// Yıkık kale: kare sur, iki köşede kırık kuleler, bir yanı çökmüş.
const RUIN_WALLS = merge(
  box(24, 6, 2, { at: [-2, 3, -12] }),
  box(2, 4.5, 18, { at: [-13, 2.25, -2] }),
  box(14, 3, 2, { at: [-6, 1.5, 12] }),
  box(2, 7.5, 9, { at: [13, 3.75, -7.5] }),
  cylinder(3, 3.4, 11, 8, { at: [-13, 5.5, -12] }),
  cylinder(3, 3.4, 6.5, 8, { at: [13, 3.25, 12] }),
  box(1.2, 2, 1.2, { at: [-14.5, 11.8, -12] }),
  box(1.2, 1.4, 1.2, { at: [-11.5, 11.5, -12] }),
  box(5, 9, 5, { at: [0, 4.5, -2] }),
);
const RUIN_RUBBLE = merge(...ring(9, 9, 0.4).map((p, i) => dodeca(0.8 + (i % 3) * 0.5, { at: [p.x + 6, 0.5, p.z + 6], ry: i })));

const ICE_FALL = merge(
  ...[0, 1, 2, 3, 4].map((k) => box(5.5 - k * 0.5, 2.2 + k * 0.3, 1.4, { at: [0, 13 - k * 2.4, -k * 2.2] })),
  ...[-2, -1, 0, 1, 2].map((x) => cone(0.35, 2.4, 4, { at: [x * 1.0, 10.4, 0.8], rx: Math.PI })),
  cylinder(5.5, 6.5, 0.6, 10, { at: [0, 0.3, 3] }),
);

// ── Malzemeler ─────────────────────────────────────────────────────

function createMaterials(fog: FogUniforms) {
  return {
    stone: foggedLambert(fog, { color: "#a8a092" }),
    stoneDark: foggedLambert(fog, { color: "#7b746a" }),
    wood: foggedLambert(fog, { color: "#7a4a26" }),
    woodDark: foggedLambert(fog, { color: "#4f3420" }),
    iron: foggedLambert(fog, { color: "#3a3a42" }),
    tinted: foggedLambert(fog, { color: "#ffffff" }),
    tassel: foggedLambert(fog, { color: "#2b211c" }),
    wool: foggedLambert(fog, { color: "#efeae0" }),
    sheepHead: foggedLambert(fog, { color: "#3b302a" }),
    bronze: foggedLambert(fog, { color: "#9a7440" }),
    leaves: foggedLambert(fog, { color: "#6f9f55" }),
    roof: foggedLambert(fog, { color: "#9c3a2f" }),
    blueBand: foggedLambert(fog, { color: "#3f6f8a" }),
    darkLeaves: foggedLambert(fog, { color: "#3f6e3e" }),
    ice: foggedLambert(fog, { color: "#cdeefa", emissive: "#5aa9d6", emissiveIntensity: 0.25, transparent: true, opacity: 0.9 }),
    rune: new MeshLambertMaterial({ color: "#7fe3ff", emissive: "#3fc6ff", emissiveIntensity: 0.4, flatShading: true }),
    flame: new MeshLambertMaterial({ color: "#ff9a3d", emissive: "#ff6a1a", emissiveIntensity: 1.6, flatShading: true }),
    flameCore: new MeshLambertMaterial({ color: "#ffd76a", emissive: "#ffb53d", emissiveIntensity: 1.8, flatShading: true }),
    glow: new MeshBasicMaterial({ color: "#ff9a4a", map: glowTexture(), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
    beam: new MeshBasicMaterial({ color: "#fff1b8", transparent: true, opacity: 0.18, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
    smoke: new MeshBasicMaterial({ color: "#c9cdd6", transparent: true, opacity: 0.32, depthWrite: false }),
  };
}

interface SettlementsProps {
  terrain: Terrain;
  fogUniforms: FogUniforms;
  animate: boolean;
  sky: SkyRuntime;
  /** Karartılı karadaki obalar, anıtlar ve köprüler çizilmez. */
  visibility: LandVisibility;
}

const HORSE_COLORS = ["#6b4226", "#3b2a20", "#d8d0c2", "#8a5a33", "#2a2522", "#a39a8c"];
const RIBBON_COLORS = ["#c4413a", "#e2b23c", "#3f6f8a", "#2a9677", "#f3efe6", "#6a43b8"];

export function Settlements({ terrain, fogUniforms, animate, sky, visibility }: SettlementsProps) {
  const m = useMemo(() => createMaterials(fogUniforms), [fogUniforms]);
  useEffect(
    () => () =>
      Object.values(m).forEach((material) => {
        if ("map" in material && material.map) material.map.dispose();
        material.dispose();
      }),
    [m],
  );

  const at = useCallback((p: Coordinates, lift = 0): [number, number, number] => [p.x, groundY(terrain, p) + lift, p.y], [terrain]);
  const show = useCallback((p: Coordinates, reach = 0) => !isHiddenAt(terrain, visibility, p, reach), [terrain, visibility]);
  const camps = useMemo(() => campLayouts(terrain).filter((c) => show(c.village.center)), [terrain, show]);

  // ── Kamp parçaları ──
  const parts = useMemo(() => {
    const item = (p: Coordinates, extra: Partial<InstanceTransform> = {}, lift = -0.1): InstanceTransform => ({ position: at(p, lift), ...extra });
    const hashAngle = (key: string) => ((hashString(key) % 628) / 100);
    const horses: InstanceTransform[] = [];
    const sheep: InstanceTransform[] = [];
    for (const camp of camps) {
      if (camp.corral) {
        const count = 3 + (hashString(camp.village.name) % 3);
        for (let k = 0; k < count; k++) {
          const a = hashAngle(`${camp.village.name}:at:${k}`);
          const r = 2.5 + (k % 3) * 3.6;
          const p = { x: camp.corral.x + Math.cos(a) * r, y: camp.corral.y + Math.sin(a) * r };
          horses.push(item(p, { rotationY: a * 2.3, color: HORSE_COLORS[hashString(`${camp.village.name}${k}`) % HORSE_COLORS.length], scale: 1.35 }, 0));
        }
      }
      if (camp.flock) {
        for (let k = 0; k < 10; k++) {
          const a = hashAngle(`${camp.village.name}:koyun:${k}`);
          const r = (k / 10) * FLOCK_RADIUS;
          const p = { x: camp.flock.x + Math.cos(a) * r, y: camp.flock.y + Math.sin(a) * r };
          sheep.push(item(p, { rotationY: a * 3.1, scale: 1.3 + (k % 3) * 0.12 }, 0));
        }
      }
    }
    return {
      rings: camps.map((c) => item(c.fire, { scale: FIRE_SCALE }, -0.15)),
      logs: camps.map((c) => item(c.fire, { rotationY: hashAngle(c.village.name), scale: FIRE_SCALE })),
      glows: camps.map((c) => item(c.fire, {}, 0)),
      tripods: camps.map((c) => item(c.cauldron, { rotationY: hashAngle(`${c.village.name}k`), scale: 1.8 })),
      woodpiles: camps.map((c) => item(c.woodpile, { rotationY: hashAngle(`${c.village.name}o`), scale: 1.8 })),
      poles: camps.map((c) => item(c.banner, { scale: BANNER_SCALE }, -0.2)),
      flags: camps.map((c) => item(c.banner, { rotationY: hashAngle(`${c.village.name}s`), color: c.village.banner, scale: BANNER_SCALE }, -0.2)),
      corrals: camps.filter((c) => c.corral).map((c) => item(c.corral!, { rotationY: hashAngle(`${c.village.name}a`) }, -0.15)),
      horses,
      sheep,
    };
  }, [camps, at]);

  // ── Anıt parçaları ──
  const monuments = useMemo(() => {
    const balbals = balbalPlacements().filter((p) => show(p)).map<InstanceTransform>((p) => ({ position: at(p, -0.3), rotationY: p.rotation, scale: 0.9 + (hashString(`${p.x}`) % 3) * 0.08 }));
    const steles = ring(7, 7, 0.3).map<InstanceTransform>((p) => {
      const q = { x: MONUMENTS.yazitliTaslar.x + p.x, y: MONUMENTS.yazitliTaslar.y + p.z };
      // Yüzü halkanın ortasına dönük.
      return { position: at(q, -0.4), rotationY: Math.atan2(-p.x, -p.z), scale: 0.85 + (hashString(`${p.angle}`) % 4) * 0.08 };
    });
    const ribbons: InstanceTransform[] = Array.from({ length: 26 }, (_, k) => {
      const a = (k / 26) * Math.PI * 2 * 3.1;
      const r = 2.2 + (k % 4) * 0.7;
      const p = MONUMENTS.dilekAgaci;
      return { position: [p.x + Math.cos(a) * r, groundY(terrain, p) + 5.2 + (k % 3) * 0.9, p.y + Math.sin(a) * r], rotationY: a, color: RIBBON_COLORS[k % RIBBON_COLORS.length] };
    });
    const wreck = shipwreckPlacement(terrain);
    // Yazıtlı taşlar, dilek ağacının bezleri ve batık gemi de kendi adalarıyla birlikte görünür.
    return {
      balbals,
      steles: show(MONUMENTS.yazitliTaslar) ? steles : [],
      ribbons: show(MONUMENTS.dilekAgaci) ? ribbons : [],
      wreck: show(wreck, 40) ? wreck : null,
    };
  }, [terrain, at, show]);

  const bridges = useMemo(
    () =>
      getTrails(terrain).bridges.filter((b) => show(b.center, 6)).map((b) => {
        const half = b.length / 2;
        const ends = [-1, 1].map((s) => groundY(terrain, { x: b.center.x + Math.cos(b.angle) * half * s, y: b.center.y + Math.sin(b.angle) * half * s }));
        return { ...b, y: Math.max(ends[0], ends[1], groundY(terrain, b.center)) + 0.9 };
      }),
    [terrain, show],
  );

  // ── Canlılık: alev, duman, gece ışığı, runlar ──
  const flameRef = useRef<InstancedMesh>(null);
  const coreRef = useRef<InstancedMesh>(null);
  const smokeRef = useRef<InstancedMesh>(null);
  const work = useMemo(() => ({ matrix: new Matrix4(), q: new Quaternion(), e: new Euler(), p: new Vector3(), s: new Vector3() }), []);
  const fireBases = useMemo(() => camps.map((c) => at(c.fire, -0.05)), [camps, at]);

  const placeFlames = useCallback((t: number) => {
    const { matrix, q, e, p, s } = work;
    fireBases.forEach((base, i) => {
      const flicker = animate ? 0.85 + Math.sin(t * 9 + i * 1.7) * 0.12 + Math.sin(t * 13 + i) * 0.07 : 1;
      q.setFromEuler(e.set(0, t * 0.6 + i, 0));
      p.set(base[0], base[1] + 0.35, base[2]);
      flameRef.current?.setMatrixAt(i, matrix.compose(p, q, s.set(FIRE_SCALE, flicker * FIRE_SCALE, FIRE_SCALE)));
      p.set(base[0] + 0.35, base[1] + 0.35, base[2] + 0.25);
      coreRef.current?.setMatrixAt(i, matrix.compose(p, q, s.set(FIRE_SCALE, (2 - flicker) * FIRE_SCALE, FIRE_SCALE)));
      for (let k = 0; k < 3; k++) {
        const phase = animate ? (t * 0.28 + k / 3 + i * 0.13) % 1 : k / 3;
        p.set(base[0] + Math.sin(t * 0.7 + k * 2 + i) * phase * 2.5, base[1] + 4 + phase * 11, base[2] + phase * 2);
        const size = 0.55 + phase * 1.5;
        smokeRef.current?.setMatrixAt(i * 3 + k, matrix.compose(p, q.identity(), s.set(size, size, size)));
      }
    });
    for (const mesh of [flameRef.current, coreRef.current, smokeRef.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [fireBases, work, animate]);
  useLayoutEffect(() => placeFlames(0), [placeFlames]);

  const beamsRef = useRef<Group[]>([]);
  useFrame(({ clock }, delta) => {
    m.glow.opacity = sky.lamp * 0.8;
    m.beam.opacity = 0.14 + sky.lamp * 0.3;
    m.rune.emissiveIntensity = 0.4 + sky.lamp * 2.2;
    m.flame.emissiveIntensity = 1.6 + sky.lamp * 0.8;
    if (!animate) return;
    placeFlames(clock.elapsedTime);
    beamsRef.current.forEach((beam, i) => {
      if (beam) beam.rotation.y += delta * (0.6 + i * 0.15);
    });
  });

  return (
    <group>
      {/* Oba kampları */}
      <InstancedParts geometry={FIRE_RING} material={m.stoneDark} items={parts.rings} receiveShadow />
      <InstancedParts geometry={FIRE_LOGS} material={m.woodDark} items={parts.logs} />
      <InstancedParts geometry={GLOW_DISC} material={m.glow} items={parts.glows} castShadow={false} />
      <instancedMesh ref={flameRef} args={[FLAME, m.flame, fireBases.length]} frustumCulled={false} />
      <instancedMesh ref={coreRef} args={[FLAME_CORE, m.flameCore, fireBases.length]} frustumCulled={false} />
      <instancedMesh ref={smokeRef} args={[SMOKE, m.smoke, fireBases.length * 3]} frustumCulled={false} />
      <InstancedParts geometry={TRIPOD} material={m.wood} items={parts.tripods} />
      <InstancedParts geometry={POT} material={m.iron} items={parts.tripods} />
      <InstancedParts geometry={WOODPILE} material={m.wood} items={parts.woodpiles} />
      <InstancedParts geometry={BANNER_POLE} material={m.wood} items={parts.poles} />
      <InstancedParts geometry={BANNER_TASSEL} material={m.tassel} items={parts.poles} />
      <InstancedParts geometry={BANNER_FLAG} material={m.tinted} items={parts.flags} />
      <InstancedParts geometry={CORRAL} material={m.wood} items={parts.corrals} />
      <InstancedParts geometry={HORSE} material={m.tinted} items={parts.horses} />
      <InstancedParts geometry={SHEEP} material={m.wool} items={parts.sheep} />
      <InstancedParts geometry={SHEEP_HEAD} material={m.sheepHead} items={parts.sheep} />

      {/* Ata Heykeli */}
      {show(MONUMENTS.ataHeykeli) && (
        <group position={at(MONUMENTS.ataHeykeli, -0.4)} rotation-y={0.35}>
          <mesh geometry={ATA} material={m.stone} castShadow receiveShadow />
          <mesh geometry={ATA_STAFF} material={m.stoneDark} castShadow />
        </group>
      )}

      {/* Balbal Yolu ve Yazıtlı Taşlar */}
      <InstancedParts geometry={BALBAL} material={m.stone} items={monuments.balbals} />
      <InstancedParts geometry={STELE} material={m.stoneDark} items={monuments.steles} />
      <InstancedParts geometry={RUNES} material={m.rune} items={monuments.steles} castShadow={false} />

      {/* Kartal Anıtı */}
      {show(MONUMENTS.kartalAniti) && (
        <group position={at(MONUMENTS.kartalAniti, -0.3)} rotation-y={-0.6}>
          <mesh geometry={KARTAL_PILLAR} material={m.stone} castShadow receiveShadow />
          <mesh geometry={KARTAL} material={m.bronze} castShadow />
        </group>
      )}

      {/* Dilek Ağacı */}
      {show(MONUMENTS.dilekAgaci) && (
        <group position={at(MONUMENTS.dilekAgaci, -0.3)}>
          <mesh geometry={TREE_TRUNK} material={m.wood} castShadow />
          <mesh geometry={TREE_CROWN} material={m.leaves} castShadow />
        </group>
      )}
      <InstancedParts geometry={RIBBON} material={m.tinted} items={monuments.ribbons} castShadow={false} />

      {/* Gözcü kuleleri */}
      {MONUMENTS.gozcuKuleleri.map((p, i) => show(p) && (
        <group key={i} position={at(p, -0.3)} rotation-y={i * 0.7}>
          <mesh geometry={TOWER} material={m.wood} castShadow receiveShadow />
          <mesh geometry={TOWER_ROOF} material={m.roof} castShadow />
        </group>
      ))}

      {/* Üçkardeş Feneri: mavi-beyaz kule, dönen huzme */}
      {show(MONUMENTS.uckardesFeneri) && (
        <group position={at(MONUMENTS.uckardesFeneri, -0.3)}>
          <mesh material={m.stone} position-y={0.8} castShadow receiveShadow>
            <cylinderGeometry args={[2.8, 3.2, 1.6, 8]} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} material={i % 2 === 0 ? m.wool : m.blueBand} position-y={1.6 + i * 2.5 + 1.25} castShadow>
              <cylinderGeometry args={[1.7 - (i + 1) * 0.12, 1.7 - i * 0.12, 2.5, 8]} />
            </mesh>
          ))}
          <mesh material={m.flameCore} position-y={10.2}>
            <cylinderGeometry args={[1.25, 1.25, 1.4, 8]} />
          </mesh>
          <mesh material={m.roof} position-y={11.6} castShadow>
            <coneGeometry args={[1.7, 1.4, 8]} />
          </mesh>
          <group
            ref={(el) => {
              if (el) beamsRef.current[0] = el;
            }}
            position-y={10.2}
          >
            <mesh material={m.beam} position-x={12} rotation-z={Math.PI / 2}>
              <coneGeometry args={[2, 24, 8, 1, true]} />
            </mesh>
          </group>
        </group>
      )}

      {/* Fırtına Feneri: kırmızı-beyaz kule */}
      {show(MONUMENTS.firtinaFeneri) && (
        <group position={at(MONUMENTS.firtinaFeneri, -0.3)}>
          <mesh material={m.stone} position-y={0.8} castShadow receiveShadow>
            <cylinderGeometry args={[2.8, 3.2, 1.6, 8]} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} material={i % 2 === 0 ? m.wool : m.roof} position-y={1.6 + i * 2.5 + 1.25} castShadow>
              <cylinderGeometry args={[1.7 - (i + 1) * 0.12, 1.7 - i * 0.12, 2.5, 8]} />
            </mesh>
          ))}
          <mesh material={m.flameCore} position-y={10.2}>
            <cylinderGeometry args={[1.25, 1.25, 1.4, 8]} />
          </mesh>
          <mesh material={m.roof} position-y={11.6} castShadow>
            <coneGeometry args={[1.7, 1.4, 8]} />
          </mesh>
          <group
            ref={(el) => {
              if (el) beamsRef.current[1] = el;
            }}
            position-y={10.2}
          >
            <mesh material={m.beam} position-x={12} rotation-z={Math.PI / 2}>
              <coneGeometry args={[2, 24, 8, 1, true]} />
            </mesh>
          </group>
        </group>
      )}

      {/* Yıkık Kale: yarısı çökmüş surlar, kırık kuleler, moloz */}
      {show(MONUMENTS.yikikKale) && (
        <group position={at(MONUMENTS.yikikKale, -0.6)} rotation-y={0.3}>
          <mesh geometry={RUIN_WALLS} material={m.stoneDark} castShadow receiveShadow />
          <mesh geometry={RUIN_RUBBLE} material={m.stone} castShadow />
        </group>
      )}

      {/* Ulu Kayın: Kuzgunorman'ın dev ağacı */}
      {show(MONUMENTS.uluKayin) && (
        <group position={at(MONUMENTS.uluKayin, -0.5)} scale={2.3}>
          <mesh geometry={TREE_TRUNK} material={m.woodDark} castShadow />
          <mesh geometry={TREE_CROWN} material={m.darkLeaves} castShadow />
        </group>
      )}

      {/* Batık gemi */}
      {monuments.wreck && (
        <group position={[monuments.wreck.x, WATER_LEVEL - 0.5, monuments.wreck.y]} rotation={[0.12, 0.8, 0.32]}>
          <mesh geometry={WRECK} material={m.woodDark} castShadow />
        </group>
      )}

      {/* Donmuş şelale */}
      {show(MONUMENTS.donmusSelale) && (
        <group position={at(MONUMENTS.donmusSelale, -0.5)} rotation-y={0}>
          <mesh geometry={ICE_FALL} material={m.ice} castShadow />
        </group>
      )}

      {/* Patika köprüleri */}
      {bridges.map((b, i) => (
        <group key={i} position={[b.center.x, b.y, b.center.y]} rotation-y={-b.angle}>
          <mesh material={m.wood} castShadow receiveShadow>
            <boxGeometry args={[b.length, 0.35, 3.4]} />
          </mesh>
          {[-1.6, 1.6].map((z) => (
            <mesh key={z} material={m.woodDark} position={[0, 0.9, z]} castShadow>
              <boxGeometry args={[b.length, 0.18, 0.18]} />
            </mesh>
          ))}
          {[-0.5, 0, 0.5].flatMap((f) =>
            [-1.6, 1.6].map((z) => (
              <mesh key={`${f}${z}`} material={m.woodDark} position={[f * b.length, 0.1, z]}>
                <boxGeometry args={[0.25, 1.8, 0.25]} />
              </mesh>
            )),
          )}
        </group>
      ))}
    </group>
  );
}

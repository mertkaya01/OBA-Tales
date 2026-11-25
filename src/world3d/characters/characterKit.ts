/**
 * KARAKTER PARÇA KİTİ — low-poly 3D takipçiler kodla, basit geometrik parçalardan kurulur.
 *
 * Her karakter aynı "gövdeyi" paylaşır: çizmeli bacaklar, yakalı kaftan, kemer ve tokası, kollar ve eller,
 * atkı, kafa, yüz (göz, kaş, burun). Üstüne kişiye özgü seçimler gelir (kitChoice): başlık (tolga, börk,
 * kalpak, külah), bıyık ya da sakal, perçem, örgü. Sonra sınıf ekipmanı (Kalkaneri: kalkan, balta ya da kılıç,
 * omuzluk; Okyeli: başlık, yay, okluk; Ocakcan: davul, fener, kopuz) ve nadirlik süsleri (pelerin, altın etek,
 * madalyon, taç, parlayan runlar) eklenir.
 *
 * Parçalar karakterin ayak tabanı (0,0,0) etrafında, yüzü +z'ye (kameraya) bakacak şekilde konumlanmıştır;
 * boyu ≈ 4,4 birim. Renkler 2D portrelerle aynı kaynaktan gelir (resolveLook): bir takipçi kartta nasıl
 * görünüyorsa dünyada da öyle görünür. Kişiye özgü seçimler takipçi kimliğinden türetilir: herkes her
 * açılışta aynı görünür, ama iki takipçi neredeyse hiç birbirinin aynısı olmaz.
 *
 * Üç kademe (LOD): en uzakta yalnızca `core` parçalar (gövde, kafa, atkı, başlık, pelerin) çizilir; orta mesafede
 * silüet parçaları (kollar, saç, başlıklar, ekipman) eklenir; yakında `detail` parçalar (yüz, toka, el, runlar) belirir.
 */
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { BoxGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry, OctahedronGeometry, TorusGeometry, type BufferGeometry } from "three";
import type { SpriteLook } from "../../game/sprites/composeSprite";
import { hashString } from "../../lib/random";
import type { Character, Rarity } from "../../types";

export interface PartContext {
  inRaid: boolean;
}

export interface PartSpec {
  id: string;
  geometry: BufferGeometry;
  /** Bu parça bu karakterde var mı? */
  applies: (character: Character, look: SpriteLook, ctx: PartContext) => boolean;
  /** Parçanın rengi (hex). */
  color: (look: SpriteLook) => string;
  /** Kendi ışığıyla parlar (fener, madalyon, akın işareti). */
  glow?: boolean;
  /** Ayrıntı: yalnızca yakından çizilir (yüz, toka, el, runlar…). */
  detail?: boolean;
  /** Çekirdek: en uzaktan bile çizilir (gövde, kafa, atkı, başlık, pelerin). Diğerleri orta mesafeden itibaren. */
  core?: boolean;
  /** Gölge düşürür. */
  shadow?: boolean;
  /** Bacaklar: yürürken kalçadan ileri geri sallanır (x < 0 sol, x > 0 sağ bacak). */
  legs?: boolean;
  /** Kollar ve tuttukları: yürürken omuzdan sallanır, Oba Narası'nda havaya kalkar (x < 0 sol, x > 0 sağ). */
  arms?: boolean;
}

// ── Geometri yardımcıları ──────────────────────────────────────────

type Transform = { at?: [number, number, number]; rx?: number; ry?: number; rz?: number };

function place(geometry: BufferGeometry, { at = [0, 0, 0], rx = 0, ry = 0, rz = 0 }: Transform): BufferGeometry {
  if (rx) geometry.rotateX(rx);
  if (ry) geometry.rotateY(ry);
  if (rz) geometry.rotateZ(rz);
  return geometry.translate(at[0], at[1], at[2]);
}

/** Birden çok parçayı tek geometride birleştirir (hepsi indekssiz hale getirilir). */
function merge(...geometries: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(geometries.map((g) => (g.index ? g.toNonIndexed() : g)));
  if (!merged) throw new Error("Karakter parçaları birleştirilemedi");
  return merged;
}

const box = (w: number, h: number, d: number, t: Transform) => place(new BoxGeometry(w, h, d), t);
const cylinder = (rTop: number, rBottom: number, h: number, segments: number, t: Transform) =>
  place(new CylinderGeometry(rTop, rBottom, h, segments), t);
const cone = (r: number, h: number, segments: number, t: Transform) => place(new ConeGeometry(r, h, segments), t);
const ico = (r: number, t: Transform) => place(new IcosahedronGeometry(r, 0), t);
/** Sağ-sol eş parça: aynı kutu x = ±x konumunda. */
const pair = (w: number, h: number, d: number, x: number, y: number, z: number, t: Omit<Transform, "at"> = {}) =>
  merge(box(w, h, d, { ...t, at: [-x, y, z], rz: t.rz ? -t.rz : 0 }), box(w, h, d, { ...t, at: [x, y, z] }));

// ── Kişiye özgü seçimler ───────────────────────────────────────────

export type Hat = "tolga" | "bork" | "kalpak" | "kulah";
export type Beard = "biyik" | "kisa" | "uzun";

export interface KitChoice {
  hat: Hat | null;
  beard: Beard | null;
  /** Alına düşen perçem. */
  bangs: boolean;
  /** Omuzlara inen iki örgü. */
  braids: boolean;
  /** Kalkaneri silahı. */
  weapon: "balta" | "kilic" | null;
  /** Ocakcan kopuzu. */
  kopuz: boolean;
  /** Tolganın üstünde tüy. */
  plume: boolean;
  /** Bilge asası (kadro). */
  staff: boolean;
  /** Kemerde kese. */
  pouch: boolean;
  /** Göğüste nazar boncuğu. */
  nazar: boolean;
  /** Göğüsten çapraz geçen okluk kayışı (Okyeli). */
  strap: boolean;
}

/** Kadronun hikâyedeki görünüşü. */
const CAST_KIT: Readonly<Record<string, Partial<KitChoice>>> = {
  baturay: { hat: "tolga", plume: true, beard: "kisa", weapon: "kilic" },
  dede_toygar: { hat: null, beard: "uzun", staff: true, bangs: false },
  alptug: { hat: "bork", beard: "biyik" },
  kursat: { hat: "kalpak", beard: "kisa" },
};

const variant = (c: Character, key: string, n: number) => hashString(`${key}:${c.id}`) % n;
/** Soğuk bölgelerde yaşayanların çizmeleri kürklü. */
const COLD_REGIONS: ReadonlySet<string> = new Set(["ayazbogazi", "kiragiduzu", "gunozu_tepesi", "pusluada"]);
const isRich = (r: Rarity) => r === "destansi" || r === "efsanevi";
const choices = new Map<string, KitChoice>();

/** Karakterin kişiye özgü görünüş seçimleri (kimlikten türetilir, önbelleğe alınır). */
export function kitChoice(c: Character, look: SpriteLook): KitChoice {
  const key = `${c.id}:${c.class.id}:${c.rarity}:${c.roleType}`;
  const cached = choices.get(key);
  if (cached) return cached;
  const cls = c.class.id;
  const hatRoll = variant(c, "baslik", 10);
  let hat: Hat | null = null;
  if (cls === "kalkaneri") hat = hatRoll < 3 ? "tolga" : hatRoll < 5 ? "bork" : null;
  if (cls === "ocakcan") hat = hatRoll < 3 ? "kalpak" : hatRoll < 5 ? "kulah" : null;
  const beardRoll = variant(c, "sakal", 20);
  const beard: Beard | null = beardRoll < 8 ? null : beardRoll < 12 ? "biyik" : beardRoll < 16 ? "kisa" : "uzun";
  const choice: KitChoice = {
    hat,
    beard,
    bangs: look.hair === "kisa" && variant(c, "percem", 2) === 0,
    braids: look.hair === "uzun" && cls !== "okyeli" && variant(c, "orgu", 2) === 0,
    weapon: cls === "kalkaneri" ? (variant(c, "silah", 2) === 0 ? "balta" : "kilic") : null,
    kopuz: cls === "ocakcan" && variant(c, "kopuz", 5) < 2,
    plume: false,
    staff: false,
    pouch: variant(c, "kese", 2) === 0,
    nazar: variant(c, "nazar", 10) < 3,
    strap: cls === "okyeli",
  };
  const override = c.roleType !== "follower" ? CAST_KIT[c.id] : undefined;
  if (override) Object.assign(choice, override);
  if (cls === "okyeli") choice.hat = null; // Okyeli her zaman tüylü başlığını takar.
  if (choice.hat) choice.bangs = false;
  choice.plume ||= choice.hat === "tolga" && isRich(c.rarity);
  choices.set(key, choice);
  return choice;
}

const has = (pick: (k: KitChoice, c: Character) => boolean) => (c: Character, l: SpriteLook) => pick(kitChoice(c, l), c);

// ── Ortak gövde ────────────────────────────────────────────────────

const LEGS = merge(box(0.42, 1.0, 0.5, { at: [-0.3, 0.5, 0] }), box(0.42, 1.0, 0.5, { at: [0.3, 0.5, 0] }));
const BOOTS = merge(box(0.48, 0.38, 0.64, { at: [-0.3, 0.19, 0.05] }), box(0.48, 0.38, 0.64, { at: [0.3, 0.19, 0.05] }));
const BODY = cylinder(0.72, 0.98, 1.75, 7, { at: [0, 1.875, 0] });
const HEM = cylinder(1.0, 1.02, 0.2, 7, { at: [0, 1.1, 0] });
const COLLAR = merge(box(0.17, 0.85, 0.07, { at: [-0.17, 2.36, 0.8], rz: -0.38 }), box(0.17, 0.85, 0.07, { at: [0.17, 2.36, 0.8], rz: 0.38 }));
const BELT = cylinder(0.84, 0.86, 0.2, 7, { at: [0, 1.65, 0] });
const BUCKLE = box(0.26, 0.22, 0.09, { at: [0, 1.65, 0.88] });
const SLEEVES = pair(0.36, 1.05, 0.44, 0.95, 2.1, 0);
const HANDS = pair(0.3, 0.3, 0.34, 0.95, 1.43, 0.02);
const SCARF = cylinder(0.82, 0.9, 0.34, 7, { at: [0, 2.8, 0] });
const HEAD = box(1.1, 1.0, 1.0, { at: [0, 3.45, 0] });
const EYES = pair(0.14, 0.2, 0.06, 0.22, 3.5, 0.51);
const BROWS = pair(0.24, 0.07, 0.06, 0.22, 3.69, 0.52, { rz: -0.12 });
const NOSE = box(0.14, 0.22, 0.14, { at: [0, 3.36, 0.56] });
const EARS = pair(0.14, 0.3, 0.22, 0.6, 3.42, 0.02);
const MOUTH = box(0.3, 0.06, 0.05, { at: [0, 3.13, 0.51] });
const POUCH = merge(box(0.34, 0.38, 0.22, { at: [0.6, 1.42, 0.62], rz: 0.12 }), box(0.36, 0.1, 0.24, { at: [0.62, 1.62, 0.62], rz: 0.12 }));
// Nazar boncuğu: göğüste mavi, beyaz ve koyu üç halka.
const NAZAR = cylinder(0.17, 0.17, 0.05, 10, { rx: Math.PI / 2, at: [0, 2.05, 0.84] });
const NAZAR_WHITE = cylinder(0.11, 0.11, 0.05, 10, { rx: Math.PI / 2, at: [0, 2.05, 0.86] });
const NAZAR_EYE = cylinder(0.055, 0.055, 0.05, 8, { rx: Math.PI / 2, at: [0, 2.05, 0.88] });
// Göğüs nakışı: altın baklava dizisi (nadir ve üstü).
const EMBROIDERY = merge(
  box(0.18, 0.18, 0.05, { at: [-0.3, 2.0, 0.84], rz: Math.PI / 4 }),
  box(0.18, 0.18, 0.05, { at: [0, 1.95, 0.86], rz: Math.PI / 4 }),
  box(0.18, 0.18, 0.05, { at: [0.3, 2.0, 0.84], rz: Math.PI / 4 }),
);
const BOOT_FUR = pair(0.56, 0.16, 0.7, 0.3, 0.42, 0.05);

// ── Saç ve yüz kılı ────────────────────────────────────────────────

const HAIR = merge(box(1.18, 0.38, 1.08, { at: [0, 4.0, 0] }), box(1.18, 0.75, 0.22, { at: [0, 3.6, -0.5] }));
const HAIR_LONG = box(1.1, 1.0, 0.28, { at: [0, 3.0, -0.56] });
const TOPKNOT = ico(0.3, { at: [0, 4.38, -0.1] });
const BANGS = box(1.12, 0.26, 0.14, { at: [0.06, 3.83, 0.53], rz: -0.08 });
const BRAIDS = merge(
  box(0.2, 1.0, 0.2, { at: [-0.6, 3.05, 0.22] }),
  box(0.2, 1.0, 0.2, { at: [0.6, 3.05, 0.22] }),
  ico(0.15, { at: [-0.6, 2.5, 0.24] }),
  ico(0.15, { at: [0.6, 2.5, 0.24] }),
);
const MUSTACHE = pair(0.32, 0.09, 0.07, 0.16, 3.19, 0.53, { rz: 0.28 });
const BEARD_SHORT = merge(box(1.0, 0.4, 0.32, { at: [0, 3.06, 0.4] }), box(0.2, 0.55, 0.9, { at: [-0.5, 3.15, 0.1] }), box(0.2, 0.55, 0.9, { at: [0.5, 3.15, 0.1] }));
const BEARD_LONG = merge(BEARD_SHORT.clone(), box(0.86, 0.5, 0.5, { at: [0, 2.82, 0.66] }), box(0.66, 0.8, 0.22, { at: [0, 2.45, 0.95] }), cone(0.33, 0.45, 4, { at: [0, 1.85, 0.96], rx: Math.PI }));

// ── Başlıklar ──────────────────────────────────────────────────────

const TOLGA = merge(cone(0.74, 1.05, 8, { at: [0, 4.4, 0] }), cylinder(0.64, 0.64, 0.2, 8, { at: [0, 3.96, 0] }), box(0.11, 0.48, 0.09, { at: [0, 3.64, 0.57] }));
const TOLGA_PLUME = box(0.14, 0.95, 0.55, { at: [0, 4.95, -0.2], rx: -0.35 });
const BORK = cylinder(0.6, 0.56, 1.0, 8, { at: [0, 4.5, 0] });
const BORK_RIM = cylinder(0.67, 0.67, 0.27, 8, { at: [0, 4.04, 0] });
const KALPAK = cylinder(0.66, 0.62, 0.72, 8, { at: [0, 4.32, 0] });
const KALPAK_TOP = cylinder(0.5, 0.5, 0.07, 8, { at: [0, 4.69, 0] });
const KULAH = cone(0.63, 1.25, 7, { at: [0.04, 4.62, -0.02], rz: -0.12 });
const KULAH_BAND = cylinder(0.62, 0.62, 0.16, 7, { at: [0, 4.03, 0] });
const CIRCLET = place(new TorusGeometry(0.6, 0.05, 4, 12), { rx: Math.PI / 2, at: [0, 3.98, 0] });

// ── Kalkaneri: kalkan, balta ya da kılıç, kürk yaka, omuzluk ────────

const FUR_COLLAR = cylinder(0.95, 0.98, 0.22, 7, { at: [0, 2.66, 0] });
const PAULDRONS = pair(0.54, 0.24, 0.64, 0.92, 2.73, 0);
// Kalkan sol kolda, yüzü yarı öne dönük: önden bakınca da yuvarlak okunur.
const SHIELD_TURN = 0.75;
// (place önce y, sonra z ekseninde döndürür; burada sıra tersi gerekir: önce yatır, sonra çevir.)
const SHIELD = cylinder(0.95, 0.95, 0.16, 8, { rz: Math.PI / 2 }).rotateY(SHIELD_TURN).translate(-1.05, 2.05, 0.25);
const SHIELD_BOSS = ico(0.22, { at: [-1.05 - Math.cos(SHIELD_TURN) * 0.13, 2.05, 0.25 + Math.sin(SHIELD_TURN) * 0.13] });
// Kalkan amblemi: yüzeyde artı biçimli şerit (atkı renginde).
const SHIELD_EMBLEM = merge(box(0.05, 1.45, 0.2, {}), box(0.05, 0.2, 1.45, {}))
  .rotateY(SHIELD_TURN)
  .translate(-1.05 - Math.cos(SHIELD_TURN) * 0.1, 2.05, 0.25 + Math.sin(SHIELD_TURN) * 0.1);
const SHIELD_RIM = place(new TorusGeometry(0.93, 0.06, 4, 12), { ry: SHIELD_TURN - Math.PI / 2, at: [-1.05 - Math.cos(SHIELD_TURN) * 0.03, 2.05, 0.25 + Math.sin(SHIELD_TURN) * 0.03] });
const AXE_HANDLE = cylinder(0.07, 0.07, 2.1, 5, { at: [1.0, 1.85, 0.15] });
const AXE_HEAD = box(0.55, 0.6, 0.12, { at: [1.25, 2.75, 0.15] });
const SWORD_BLADE = merge(box(0.13, 1.45, 0.05, { at: [1.0, 2.3, 0.18] }), cone(0.09, 0.22, 4, { at: [1.0, 3.13, 0.18], ry: Math.PI / 4 }));
const SWORD_HILT = merge(box(0.46, 0.08, 0.13, { at: [1.0, 1.56, 0.18] }), box(0.09, 0.3, 0.09, { at: [1.0, 1.38, 0.18] }), ico(0.08, { at: [1.0, 1.2, 0.18] }));

// ── Okyeli: tüylü başlık, gözlük, fildişi yay, okluk ─────────────────

const HOOD = merge(cone(0.82, 1.45, 7, { at: [0, 4.05, -0.05] }), box(1.14, 0.9, 0.25, { at: [0, 3.5, -0.52] }));
const FEATHER = box(0.1, 0.95, 0.32, { rz: -0.35, at: [0.4, 4.75, -0.15] });
const GOGGLES = box(1.16, 0.2, 0.1, { at: [0, 3.72, 0.52] });
const BOW = place(new TorusGeometry(1.15, 0.07, 4, 10, Math.PI), { rz: Math.PI / 2, at: [-0.75, 2.1, 0.2] });
const BOW_STRING = box(0.04, 2.3, 0.04, { at: [-0.75, 2.1, 0.2] });
const BRACER = box(0.42, 0.42, 0.5, { at: [-0.95, 1.78, 0] });
const STRAP = box(0.14, 1.95, 0.06, { rz: 0.72, at: [0.05, 2.15, 0.83] });
const QUIVER = cylinder(0.2, 0.25, 1.35, 6, { rz: -0.42, at: [0.36, 2.35, -0.8] });
const ARROWS = merge(
  box(0.08, 0.42, 0.08, { at: [0.6, 3.05, -0.84], rz: -0.42 }),
  box(0.08, 0.42, 0.08, { at: [0.7, 3.0, -0.72], rz: -0.3 }),
  box(0.08, 0.42, 0.08, { at: [0.52, 3.1, -0.95], rz: -0.55 }),
);

// ── Ocakcan: sırt davulu, fener, kopuz, yumuşak pelerin ─────────────

const DRUM = cylinder(0.62, 0.62, 0.55, 8, { rx: Math.PI / 2, at: [0, 2.3, -0.85] });
const LANTERN = box(0.36, 0.46, 0.36, { at: [0.95, 1.45, 0.25] });
const DRUMSTICKS = merge(cylinder(0.05, 0.05, 1.1, 4, { rz: 0.6, at: [-0.15, 2.55, -1.18] }), cylinder(0.05, 0.05, 1.1, 4, { rz: -0.6, at: [0.15, 2.55, -1.18] }));
const KOPUZ = merge(box(0.55, 0.68, 0.2, { at: [-1.0, 1.5, 0.32], rz: 0.45 }), box(0.09, 0.95, 0.07, { at: [-0.72, 2.15, 0.32], rz: 0.45 }), box(0.22, 0.18, 0.1, { at: [-0.5, 2.6, 0.32], rz: 0.45 }));
const SOFT_CAPE = box(1.55, 2.0, 0.12, { rx: 0.08, at: [0, 1.9, -0.72] });

// ── Kadro ──────────────────────────────────────────────────────────

const STAFF = cylinder(0.08, 0.1, 4.3, 5, { at: [-1.08, 2.16, 0.32] });
const STAFF_GEM = place(new OctahedronGeometry(0.26, 0), { at: [-1.08, 4.5, 0.32] });

// ── Nadirlik süsleri ───────────────────────────────────────────────

const LONG_CAPE = box(1.8, 2.7, 0.12, { rx: 0.06, at: [0, 1.75, -0.78] });
const CAPE_RUNES = merge(box(0.36, 0.1, 0.05, { at: [0, 2.45, -0.88] }), box(0.1, 0.5, 0.05, { at: [0, 1.95, -0.86] }), box(0.36, 0.1, 0.05, { at: [0, 1.45, -0.84] }));
const MEDALLION = place(new OctahedronGeometry(0.24, 0), { at: [0, 2.45, 0.97] });
const PLUME = box(0.1, 1.0, 0.1, { rz: 0.3, at: [-0.38, 4.55, -0.1] });
const RAID_MARKER = place(new OctahedronGeometry(0.3, 0), { at: [0, 5.15, 0] });

const isClass = (id: Character["class"]["id"]) => (c: Character) => c.class.id === id;
const hasLongCape = (c: Character) => isRich(c.rarity);
const showsHair = (c: Character) => c.class.id !== "okyeli";

export const PARTS: readonly PartSpec[] = [
  // Gövde
  { id: "bacaklar", geometry: LEGS, applies: () => true, color: (l) => l.colors.p, legs: true },
  { id: "cizmeler", geometry: BOOTS, applies: () => true, color: (l) => l.colors.b, legs: true },
  { id: "cizme-kurku", geometry: BOOT_FUR, applies: (c) => COLD_REGIONS.has(c.region), color: (l) => l.colors.f, legs: true, detail: true },
  { id: "govde", geometry: BODY, applies: () => true, color: (l) => l.colors.c, shadow: true, core: true },
  { id: "etek", geometry: HEM, applies: (c) => !isRich(c.rarity), color: (l) => l.colors.C, detail: true },
  { id: "altin-etek", geometry: HEM, applies: (c) => isRich(c.rarity), color: (l) => l.colors.g },
  { id: "yaka", geometry: COLLAR, applies: () => true, color: (l) => l.colors.r, detail: true },
  { id: "kemer", geometry: BELT, applies: () => true, color: (l) => l.colors.k, detail: true },
  { id: "toka", geometry: BUCKLE, applies: () => true, color: (l) => l.colors.g, detail: true },
  { id: "kese", geometry: POUCH, applies: has((k) => k.pouch), color: (l) => l.colors.k, detail: true },
  { id: "nakis", geometry: EMBROIDERY, applies: (c, l) => c.rarity !== "siradan" && !kitChoice(c, l).strap, color: (l) => l.colors.g, detail: true },
  { id: "nazar", geometry: NAZAR, applies: has((k, c) => k.nazar && c.rarity === "siradan"), color: () => "#2f6fd1", detail: true },
  { id: "nazar-ici", geometry: NAZAR_WHITE, applies: has((k, c) => k.nazar && c.rarity === "siradan"), color: () => "#f4f8fb", detail: true },
  { id: "nazar-gozu", geometry: NAZAR_EYE, applies: has((k, c) => k.nazar && c.rarity === "siradan"), color: () => "#1b2a4a", detail: true },
  { id: "kollar", geometry: SLEEVES, applies: () => true, color: (l) => l.colors.C, arms: true, shadow: true },
  { id: "eller", geometry: HANDS, applies: () => true, color: (l) => l.colors.s, arms: true, detail: true },
  { id: "atki", geometry: SCARF, applies: () => true, color: (l) => l.colors.w, core: true },
  { id: "kafa", geometry: HEAD, applies: () => true, color: (l) => l.colors.s, shadow: true, core: true },
  { id: "gozler", geometry: EYES, applies: () => true, color: (l) => l.colors.e, detail: true },
  { id: "kaslar", geometry: BROWS, applies: () => true, color: (l) => l.colors.h, detail: true },
  { id: "burun", geometry: NOSE, applies: () => true, color: (l) => l.colors.S, detail: true },
  { id: "kulaklar", geometry: EARS, applies: showsHair, color: (l) => l.colors.s, detail: true },
  { id: "agiz", geometry: MOUTH, applies: has((k) => k.beard === null || k.beard === "biyik"), color: () => "#5a2b26", detail: true },

  // Saç ve yüz kılı
  { id: "sac", geometry: HAIR, applies: showsHair, color: (l) => l.colors.h, core: true },
  { id: "uzun-sac", geometry: HAIR_LONG, applies: (c, l) => showsHair(c) && l.hair === "uzun", color: (l) => l.colors.h },
  { id: "topuz", geometry: TOPKNOT, applies: (c, l) => showsHair(c) && l.hair === "topuz" && !kitChoice(c, l).hat, color: (l) => l.colors.h },
  { id: "percem", geometry: BANGS, applies: has((k, c) => showsHair(c) && k.bangs), color: (l) => l.colors.h },
  { id: "orgu", geometry: BRAIDS, applies: has((k) => k.braids), color: (l) => l.colors.h },
  { id: "biyik", geometry: MUSTACHE, applies: has((k) => k.beard === "biyik"), color: (l) => l.colors.h, detail: true },
  { id: "kisa-sakal", geometry: BEARD_SHORT, applies: has((k) => k.beard === "kisa"), color: (l) => l.colors.h },
  { id: "uzun-sakal", geometry: BEARD_LONG, applies: has((k) => k.beard === "uzun"), color: (l) => l.colors.h },

  // Başlıklar
  { id: "tolga", geometry: TOLGA, applies: has((k) => k.hat === "tolga"), color: (l) => l.colors.m, shadow: true },
  { id: "tolga-tuyu", geometry: TOLGA_PLUME, applies: has((k) => k.plume), color: (l) => l.colors.w },
  { id: "bork", geometry: BORK, applies: has((k) => k.hat === "bork"), color: (l) => l.colors.i, shadow: true },
  { id: "bork-kurku", geometry: BORK_RIM, applies: has((k) => k.hat === "bork"), color: (l) => l.colors.f },
  { id: "kalpak", geometry: KALPAK, applies: has((k) => k.hat === "kalpak"), color: (l) => l.colors.f, shadow: true },
  { id: "kalpak-tepesi", geometry: KALPAK_TOP, applies: has((k) => k.hat === "kalpak"), color: (l) => l.colors.c, detail: true },
  { id: "kulah", geometry: KULAH, applies: has((k) => k.hat === "kulah"), color: (l) => l.colors.C, shadow: true },
  { id: "kulah-bandi", geometry: KULAH_BAND, applies: has((k) => k.hat === "kulah"), color: (l) => l.colors.w },
  { id: "tac", geometry: CIRCLET, applies: (c, l) => c.rarity === "efsanevi" && showsHair(c) && !kitChoice(c, l).hat, color: (l) => l.colors.g, glow: true, detail: true },

  // Kalkaneri
  { id: "kurk-yaka", geometry: FUR_COLLAR, applies: isClass("kalkaneri"), color: (l) => l.colors.f },
  { id: "omuzluk", geometry: PAULDRONS, applies: isClass("kalkaneri"), color: (l) => l.colors.m, arms: true },
  { id: "kalkan", geometry: SHIELD, applies: isClass("kalkaneri"), color: (l) => l.colors.m, shadow: true, arms: true },
  { id: "kalkan-kabarasi", geometry: SHIELD_BOSS, applies: isClass("kalkaneri"), color: (l) => l.colors.M, arms: true, detail: true },
  { id: "kalkan-amblemi", geometry: SHIELD_EMBLEM, applies: isClass("kalkaneri"), color: (l) => l.colors.w, arms: true, detail: true },
  { id: "kalkan-cemberi", geometry: SHIELD_RIM, applies: isClass("kalkaneri"), color: (l) => l.colors.k, arms: true, detail: true },
  { id: "balta-sapi", geometry: AXE_HANDLE, applies: has((k) => k.weapon === "balta"), color: (l) => l.colors.k, arms: true },
  { id: "balta-agzi", geometry: AXE_HEAD, applies: has((k) => k.weapon === "balta"), color: (l) => l.colors.M, arms: true },
  { id: "kilic", geometry: SWORD_BLADE, applies: has((k) => k.weapon === "kilic"), color: (l) => l.colors.M, arms: true },
  { id: "kilic-kabzasi", geometry: SWORD_HILT, applies: has((k) => k.weapon === "kilic"), color: (l) => l.colors.k, arms: true, detail: true },

  // Okyeli
  { id: "baslik", geometry: HOOD, applies: isClass("okyeli"), color: (l) => l.colors.c, shadow: true, core: true },
  { id: "tuy", geometry: FEATHER, applies: isClass("okyeli"), color: (l) => l.colors.w },
  { id: "gozluk", geometry: GOGGLES, applies: isClass("okyeli"), color: (l) => l.colors.M, detail: true },
  { id: "yay", geometry: BOW, applies: isClass("okyeli"), color: (l) => l.colors.i, arms: true },
  { id: "kiris", geometry: BOW_STRING, applies: isClass("okyeli"), color: () => "#e8e2d5", arms: true, detail: true },
  { id: "bileklik", geometry: BRACER, applies: isClass("okyeli"), color: (l) => l.colors.k, arms: true, detail: true },
  { id: "kayis", geometry: STRAP, applies: has((k) => k.strap), color: (l) => l.colors.k },
  { id: "okluk", geometry: QUIVER, applies: isClass("okyeli"), color: (l) => l.colors.k, shadow: true },
  { id: "oklar", geometry: ARROWS, applies: isClass("okyeli"), color: (l) => l.colors.w, detail: true },

  // Ocakcan
  { id: "davul", geometry: DRUM, applies: isClass("ocakcan"), color: (l) => l.colors.d, shadow: true },
  { id: "davul-tokmaklari", geometry: DRUMSTICKS, applies: isClass("ocakcan"), color: (l) => l.colors.i, detail: true },
  { id: "fener", geometry: LANTERN, applies: isClass("ocakcan"), color: (l) => l.colors.l, glow: true, arms: true },
  { id: "kopuz", geometry: KOPUZ, applies: has((k) => k.kopuz && !k.staff), color: (l) => l.colors.k, arms: true },
  { id: "yumusak-pelerin", geometry: SOFT_CAPE, applies: (c) => c.class.id === "ocakcan" && !hasLongCape(c), color: (l) => l.colors.v },

  // Kadro
  { id: "asa", geometry: STAFF, applies: has((k) => k.staff), color: (l) => l.colors.k, arms: true },
  { id: "asa-tasi", geometry: STAFF_GEM, applies: has((k) => k.staff), color: (l) => l.colors.L, glow: true, arms: true },

  // Nadirlik
  { id: "uzun-pelerin", geometry: LONG_CAPE, applies: hasLongCape, color: (l) => l.colors.v, shadow: true, core: true },
  { id: "pelerin-runlari", geometry: CAPE_RUNES, applies: (c) => c.rarity === "efsanevi", color: (l) => l.colors.L, glow: true, detail: true },
  { id: "madalyon", geometry: MEDALLION, applies: hasLongCape, color: (l) => l.colors.g, glow: true, detail: true },
  { id: "kadim-tuy", geometry: PLUME, applies: (c, l) => c.rarity === "efsanevi" && !kitChoice(c, l).plume, color: (l) => l.colors.L, glow: true },
  { id: "akin-isareti", geometry: RAID_MARKER, applies: (_c, _l, ctx) => ctx.inRaid, color: () => "#f6d36f", glow: true, core: true },
];

/** Karakterin taşıdığı parçaların kimlikleri (test ve hata ayıklama için). */
export function partsOf(character: Character, look: SpriteLook, ctx: PartContext): string[] {
  return PARTS.filter((part) => part.applies(character, look, ctx)).map((part) => part.id);
}

/** Tıklama ve üzerine gelme için karakteri saran görünmez silindir. */
export const HIT_GEOMETRY = cylinder(1.3, 1.3, 4.8, 6, { at: [0, 2.4, 0] });

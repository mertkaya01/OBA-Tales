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
 * Takipçiler sınıflarının modelini giyer (modeller/kaynak/takipciler): Kalkaneri savaşçı, Okyeli okçu, Ocakcan büyücü;
 * sıradan, nadir ve destansı kademelerde ekipman ve renkler büyür. Kodla kurulan ortak gövde artık kadronundur.
 *
 * Büyücü-şifacı: efsanevi Ocakcanlar ile Dede Toygar, ortak gövde yerine kendi modelini giyer (sivri şapka,
 * cüppe, asa, iksir). Model modeller/kaynak/buyucu-sifaci.obj dosyasından gelir (npm run model:cevir); renkleri yine
 * takipçinin kendi renkleridir. Parça kimlikleri "buyucu-" ile başlar.
 *
 * Özel kahramanlar (egetunce, mhellingtr) da kendi parçalarını giyer: kova şapkalı, lavantalı ve Gün Kılıçlı bir alp ile
 * yıldızlı pelerinli, Yıldız Yaylı göksel bir okçu; BinTaş ise kullanıcının alev kadını modelini giyer (alev taç,
 * alev kanatlar, ateş küresi). Parça kimlikleri kahramanın adıyla başlar.
 *
 * Üç kademe (LOD): en uzakta yalnızca `core` parçalar (gövde, kafa, atkı, başlık, pelerin) çizilir; orta mesafede
 * silüet parçaları (kollar, saç, başlıklar, ekipman) eklenir; yakında `detail` parçalar (yüz, toka, el, runlar) belirir.
 */
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, Float32BufferAttribute, IcosahedronGeometry, OctahedronGeometry, TorusGeometry } from "three";
import type { SpriteLook } from "../../game/sprites/composeSprite";
import { hashString } from "../../lib/random";
import type { Character, Rarity } from "../../types";
import { alevKadini } from "./models/alevKadini";
import { buyucuSifaci } from "./models/buyucuSifaci";
import { TAKIPCI_MODELLERI, type FollowerBody, type FollowerTier } from "./models/takipciler";

export interface PartContext {
  inRaid: boolean;
}

export interface PartSpec {
  id: string;
  geometry: BufferGeometry;
  /** Bu parça bu karakterde var mı? */
  applies: (character: Character, look: SpriteLook, ctx: PartContext) => boolean;
  /** Parçanın rengi (hex). Takipçi modellerinde kademeye göre değiştiği için karakter de verilir. */
  color: (look: SpriteLook, character?: Character) => string;
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
  /** Takipçi modeli: kollar ve bacaklar onun iskeletine göre döner (characterMaterials → FOLLOWER_JOINTS). */
  rig?: "takipci";
  /** Uzak siluet: yalnızca en uzak görünümde çizilir, yaklaşınca yerini asıl modele bırakır. */
  far?: boolean;
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
  /** Büyücü-şifacı modeli (efsanevi Ocakcan, Dede Toygar). */
  wizard: boolean;
  /** Özel kahraman: ortak gövde yerine kendi parçaları (egetunce, mhellingtr, BinTaş). */
  hero: HeroId | null;
  /** Takipçi modeli kademesi (sınıfın savaşçı / okçu / büyücü modeli); kadroda ve büyücü-şifacıda null. */
  model: FollowerTier | null;
}

/** Kadronun hikâyedeki görünüşü. */
const CAST_KIT: Readonly<Record<string, Partial<KitChoice>>> = {
  baturay: { hat: "tolga", plume: true, beard: "kisa", weapon: "kilic" },
  dede_toygar: { hat: null, beard: "uzun", staff: true, bangs: false, wizard: true },
  alptug: { hat: "bork", beard: "biyik" },
  kursat: { hat: "kalpak", beard: "kisa" },
  egetunce: { hero: "egetunce", hat: null, beard: "kisa" },
  mhellingtr: { hero: "mhellingtr", hat: null, beard: "kisa" },
  bintas: { hero: "bintas", hat: null, beard: null, kopuz: false },
};

const variant = (c: Character, key: string, n: number) => hashString(`${key}:${c.id}`) % n;
/** Soğuk bölgelerde yaşayanların çizmeleri kürklü. */
const COLD_REGIONS: ReadonlySet<string> = new Set(["ayazbogazi", "kiragiduzu", "gunozu_tepesi", "pusluada"]);
const isRich = (r: Rarity) => r === "destansi" || r === "efsanevi";
/** Takipçi modeli kademesi: efsanevi (ve üstü) destansı modeli giyer. */
const tierOf = (rarity: Rarity): FollowerTier => (rarity === "siradan" ? "siradan" : rarity === "nadir" ? "nadir" : "destansi");
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
    // Kadro kendi görünüşünü korur; büyücü olan kadro üyesi CAST_KIT içinde seçilir.
    wizard: cls === "ocakcan" && c.rarity === "efsanevi" && c.roleType === "follower",
    hero: null,
    model: c.roleType === "follower" && !(cls === "ocakcan" && c.rarity === "efsanevi") ? tierOf(c.rarity) : null,
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

const BASE_PARTS: readonly PartSpec[] = [
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

// ── Büyücü-şifacı (modeller/kaynak/buyucu-sifaci.obj) ─────────────

function modelGeometry(part: { readonly p: readonly number[]; readonly i: readonly number[] } | undefined, id: string): BufferGeometry {
  if (!part) throw new Error(`Büyücü-şifacı modelinde "${id}" parçası yok`);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(part.p as number[], 3));
  geometry.setIndex(part.i as number[]);
  geometry.computeVertexNormals();
  return geometry;
}

type Paint = (l: SpriteLook) => string;
type Flags = Pick<PartSpec, "glow" | "detail" | "core" | "shadow" | "legs" | "arms">;
const isWizard = has((k) => k.wizard);
const POTION = "#73e88b";

/** [modeldeki ad, renk, bayraklar, ek koşul]. Renkler takipçinin kendi renkleri: cüppe = kaftan rengi, süsler altın. */
const WIZARD: readonly [string, Paint, Flags, ((c: Character) => boolean)?][] = [
  ["bacaklar", (l) => l.colors.p, { legs: true }],
  ["cizmeler", (l) => l.colors.b, { legs: true }],
  ["etek", (l) => l.colors.c, { shadow: true, core: true }],
  ["etek-kenari", (l) => l.colors.g, { detail: true }],
  ["govde", (l) => l.colors.c, { shadow: true, core: true }],
  ["altin-etek", (l) => l.colors.g, {}, (c) => isRich(c.rarity)],
  ["kemer", (l) => l.colors.k, { detail: true }],
  ["toka", (l) => l.colors.g, { detail: true }],
  ["yaka", (l) => l.colors.i, { detail: true }],
  ["nakis", (l) => l.colors.g, { detail: true }, (c) => c.rarity !== "siradan"],
  ["gogus-amblemi", (l) => l.colors.g, { detail: true }],
  ["madalyon", (l) => l.colors.L, { glow: true, detail: true }, (c) => isRich(c.rarity)],
  ["kollar", (l) => l.colors.c, { arms: true, shadow: true }],
  ["kol-kenari", (l) => l.colors.i, { arms: true, detail: true }],
  ["eller", (l) => l.colors.s, { arms: true, detail: true }],
  ["kafa", (l) => l.colors.s, { shadow: true, core: true }],
  ["gozler", (l) => l.colors.e, { detail: true }],
  ["goz-isigi", (l) => l.colors.L, { glow: true, detail: true }],
  ["kaslar", (l) => l.colors.h, { detail: true }],
  ["burun", (l) => l.colors.S, { detail: true }],
  ["kulaklar", (l) => l.colors.s, { detail: true }],
  ["sac", (l) => l.colors.h, {}],
  ["uzun-sac", (l) => l.colors.h, {}],
  ["uzun-sakal", (l) => l.colors.h, {}],
  ["biyik", (l) => l.colors.h, { detail: true }],
  ["sapka-kenari", (l) => l.colors.C, { shadow: true, core: true }],
  ["sapka", (l) => l.colors.c, { shadow: true, core: true }],
  ["sapka-bandi", (l) => l.colors.g, {}],
  ["sapka-yildizi", (l) => l.colors.g, { glow: true, detail: true }],
  ["asa", (l) => l.colors.k, { arms: true, shadow: true }],
  ["asa-bagi", (l) => l.colors.b, { arms: true, detail: true }],
  ["asa-halkasi", (l) => l.colors.g, { arms: true, detail: true }],
  ["asa-yuvasi", (l) => l.colors.b, { arms: true, detail: true }],
  ["asa-tasi", (l) => l.colors.L, { arms: true, glow: true }],
  ["uzun-pelerin", (l) => l.colors.v, { shadow: true, core: true }, (c) => isRich(c.rarity)],
  ["pelerin-runlari", (l) => l.colors.g, { glow: true, detail: true }, (c) => c.rarity === "efsanevi"],
  ["kese", (l) => l.colors.k, { detail: true }],
  ["iksir", () => POTION, { glow: true }],
  ["iksir-tipasi", (l) => l.colors.b, { detail: true }],
];

const WIZARD_PARTS: readonly PartSpec[] = [
  ...WIZARD.map<PartSpec>(([name, color, flags, when]) => ({
    id: `buyucu-${name}`,
    geometry: modelGeometry(buyucuSifaci[name], name),
    applies: when ? (c, l) => isWizard(c, l) && when(c) : isWizard,
    color,
    ...flags,
  })),
  // Sivri şapkanın üstünde kalsın diye akın işareti biraz daha yukarıda.
  {
    id: "buyucu-akin-isareti",
    geometry: place(new OctahedronGeometry(0.3, 0), { at: [0, 5.7, 0] }),
    applies: (c, l, ctx) => ctx.inRaid && isWizard(c, l),
    color: () => "#f6d36f",
    glow: true,
    core: true,
  },
];

// ── Özel kahramanlar (egetunce, mhellingtr) ───────────────────────
//
// Ortak gövde yerine kendi parçalarını giyerler; renkler composeSprite'taki sabit kadro renklerinden gelir
// (2D portreyle aynı). Parça kimlikleri kahramanın adıyla başlar: "egetunce-kilic", "mhellingtr-yay" …

export type HeroId = "egetunce" | "mhellingtr" | "bintas";

// egetunce: siyah tişört ve şort, beyaz ayakkabı, mor kova şapka (üstünde iki iri göz), omuza inen sarı saç,
// kısa sakal; sol elinde (x > 0) lavanta demeti, sağ elinde (x < 0) dışa eğik uzun sarı-beyaz Gün Kılıcı.
const EGE_SHORTS = pair(0.46, 0.5, 0.54, 0.3, 0.8, 0);
const EGE_CALVES = pair(0.36, 0.36, 0.42, 0.3, 0.46, 0);
const EGE_SNEAKERS = pair(0.5, 0.3, 0.72, 0.3, 0.19, 0.07);
const EGE_SOLES = pair(0.52, 0.07, 0.74, 0.3, 0.035, 0.07);
const EGE_TEE = box(1.46, 1.7, 0.96, { at: [0, 1.9, 0] });
const EGE_NECK = box(0.5, 0.24, 0.5, { at: [0, 2.85, 0] });
const EGE_SLEEVES = pair(0.42, 0.5, 0.5, 0.95, 2.38, 0);
const EGE_ARMS = pair(0.32, 0.78, 0.38, 0.95, 1.76, 0);
const EGE_MOUTH = box(0.3, 0.06, 0.05, { at: [0, 3.12, 0.58] });
const EGE_HAIR = merge(
  box(1.12, 0.22, 1.02, { at: [0, 3.86, 0] }), // şapkanın altında kalsın (köşeleri kenardan taşmasın)
  box(1.16, 1.3, 0.24, { at: [0, 3.25, -0.52] }),
  box(0.2, 1.15, 0.86, { at: [-0.6, 3.3, -0.04] }),
  box(0.2, 1.15, 0.86, { at: [0.6, 3.3, -0.04] }),
);
// Tepe gövdenin biraz içinden başlar: çakışan yüz kalmaz (Blender gidiş-dönüşünde birebir aynı kalsın).
const EGE_HAT = merge(cylinder(0.72, 0.8, 0.62, 10, { at: [0, 4.23, 0] }), cylinder(0.58, 0.71, 0.12, 10, { at: [0, 4.595, 0] }));
const EGE_HAT_BRIM = cylinder(0.82, 1.1, 0.14, 12, { at: [0, 3.88, 0] });
// Şapkanın ön yüzlerine oturan iki iri göz; bebekler yana bakar.
const HAT_FACE = 0.314; // ön yüzün açısı (10 kenarlı silindirde 18°)
const EGE_HAT_EYES = merge(
  cylinder(0.15, 0.15, 0.04, 12, { rx: Math.PI / 2, ry: -HAT_FACE, at: [-0.21, 4.3, 0.71] }),
  cylinder(0.15, 0.15, 0.04, 12, { rx: Math.PI / 2, ry: HAT_FACE, at: [0.21, 4.3, 0.71] }),
);
const EGE_HAT_PUPILS = merge(
  cylinder(0.07, 0.07, 0.04, 10, { rx: Math.PI / 2, ry: -HAT_FACE, at: [-0.265, 4.29, 0.722] }),
  cylinder(0.07, 0.07, 0.04, 10, { rx: Math.PI / 2, ry: HAT_FACE, at: [0.17, 4.29, 0.752] }),
);
// Lavanta: sol elin önünde beş sap, uçlarında mor başaklar.
const LAVENDER: readonly [number, number, number][] = [
  [0.88, 0.3, 0.16],
  [0.95, 0.24, 0],
  [1.03, 0.31, -0.14],
  [0.92, 0.38, 0.08],
  [1.0, 0.4, -0.06],
];
const EGE_LAVENDER_STEMS = merge(...LAVENDER.map(([x, z, tilt]) => box(0.035, 0.95, 0.035, { rz: tilt, at: [x, 1.75, z] })));
const EGE_LAVENDER = merge(...LAVENDER.map(([x, z, tilt]) => box(0.11, 0.34, 0.11, { rz: tilt, at: [x - Math.sin(tilt) * 0.64, 1.75 + Math.cos(tilt) * 0.64, z] })));
// Gün Kılıcı: kabza elde, ağız dışa doğru eğik yükselir (şapkanın kenarına değmez). Önce kılıç kendi ekseninde
// (kabza ortası 0'da, ağız +y) kurulur, sonra ele taşınır.
const SUN_SWORD: Transform = { rz: 0.24, at: [-0.98, 1.45, 0.26] };
const toHand = (g: BufferGeometry) => place(g, SUN_SWORD);
const EGE_BLADE = toHand(merge(box(0.22, 2.3, 0.06, { at: [0, 1.47, 0] }), box(0.155, 0.155, 0.06, { rz: Math.PI / 4, at: [0, 2.62, 0] })));
const EGE_FULLER = toHand(box(0.07, 2.0, 0.075, { at: [0, 1.4, 0] }));
const EGE_GUARD = toHand(
  merge(
    box(0.78, 0.11, 0.16, { at: [0, 0.27, 0] }),
    box(0.18, 0.2, 0.18, { at: [0, 0.3, 0] }),
    ico(0.075, { at: [-0.42, 0.27, 0] }),
    ico(0.075, { at: [0.42, 0.27, 0] }),
    box(0.13, 0.04, 0.13, { at: [0, 0.1, 0] }),
    box(0.13, 0.04, 0.13, { at: [0, -0.1, 0] }),
    ico(0.095, { at: [0, -0.28, 0] }),
  ),
);
const EGE_GRIP = toHand(box(0.1, 0.42, 0.1, {}));
const EGE_GEM = toHand(merge(place(new OctahedronGeometry(0.08, 0), { at: [0, 0.3, 0.1] }), place(new OctahedronGeometry(0.08, 0), { at: [0, 0.3, -0.1] })));

// mhellingtr: gece mavisi ve gümüş zırh, göğüste sekiz köşeli yıldız, yıldızlı uzun pelerin, kıvırcık saç, kısa
// sakal, başının üstünde süzülen beş yıldız; sağ elinde (x < 0) camgöbeği parlayan Yıldız Yayı ve ışıktan ok.
const MHE_BUCKLE = box(0.36, 0.28, 0.1, { at: [0, 1.65, 0.9] });
const MHE_STAR = merge(box(0.3, 0.3, 0.05, { at: [0, 2.2, 0.84] }), box(0.3, 0.3, 0.05, { rz: Math.PI / 4, at: [0, 2.2, 0.85] }));
const MHE_BRACERS = pair(0.44, 0.4, 0.52, 0.95, 1.78, 0);
const MHE_PAULDRON_GEMS = merge(ico(0.08, { at: [-0.92, 2.9, 0.05] }), ico(0.08, { at: [0.92, 2.9, 0.05] }));
const MHE_MOUTH = box(0.28, 0.06, 0.05, { at: [0, 3.12, 0.58] });
const CURLS: readonly [number, number, number, number][] = [
  [-0.4, 4.18, -0.35, 0.2], [0, 4.22, -0.35, 0.2], [0.4, 4.18, -0.35, 0.2],
  [-0.4, 4.2, 0.05, 0.2], [0, 4.25, 0.05, 0.21], [0.4, 4.2, 0.05, 0.2],
  [-0.38, 4.1, 0.38, 0.18], [0, 4.13, 0.4, 0.18], [0.38, 4.1, 0.38, 0.18],
  [-0.6, 3.85, -0.2, 0.17], [-0.6, 3.85, 0.2, 0.15], [0.6, 3.85, -0.2, 0.17], [0.6, 3.85, 0.2, 0.15],
  [-0.35, 3.6, -0.56, 0.18], [0.35, 3.6, -0.56, 0.18],
];
const MHE_HAIR = merge(HAIR.clone(), ...CURLS.map(([x, y, z, r]) => ico(r, { at: [x, y, z] })));
const MHE_CROWN = merge(
  ...Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * Math.PI * 2;
    return place(new OctahedronGeometry(0.1, 0), { at: [Math.sin(a) * 0.62, 4.68, Math.cos(a) * 0.62] });
  }),
);
// Pelerin arka yüzü yukarı doğru hafifçe öne yatık: z(y) = -0.86 + (y - 1.75) · 0.06.
const capeBack = (y: number) => -0.86 + (y - 1.75) * 0.06;
const CAPE_STARS: readonly [number, number][] = [
  [-0.62, 2.7], [0.1, 2.85], [0.55, 2.45], [-0.25, 2.2], [0.68, 1.75], [-0.6, 1.6], [0.2, 1.45], [-0.15, 0.95], [0.5, 0.75], [-0.55, 0.6],
];
const MHE_CAPE = LONG_CAPE.clone();
const MHE_CAPE_STARS = merge(...CAPE_STARS.map(([x, y], i) => place(new OctahedronGeometry(i % 3 === 0 ? 0.09 : 0.06, 0), { at: [x, y, capeBack(y) - 0.03] })));
const MHE_CAPE_TRIM = merge(
  box(0.08, 2.75, 0.13, { rx: 0.06, at: [-0.88, 1.75, -0.805] }),
  box(0.08, 2.75, 0.13, { rx: 0.06, at: [0.88, 1.75, -0.805] }),
  box(1.84, 0.1, 0.13, { rx: 0.06, at: [0, 0.43, -0.875] }),
);
// Okluk pelerinin üstünde, sol omuzdan (x > 0) taşar; altı ok, uçlarında parlayan tüyler.
const QUIVER_TILT = -0.42;
const QUIVER_AXIS = [Math.sin(-QUIVER_TILT), Math.cos(QUIVER_TILT)] as const;
const MHE_QUIVER = cylinder(0.21, 0.26, 1.4, 6, { rz: QUIVER_TILT, at: [0.42, 2.4, -1.06] });
const MHE_QUIVER_BANDS = merge(
  ...[-0.45, 0.45].map((t) => cylinder(0.24, 0.24, 0.08, 6, { rz: QUIVER_TILT, at: [0.42 + QUIVER_AXIS[0] * t, 2.4 + QUIVER_AXIS[1] * t, -1.06] })),
);
const ARROW_OFFSETS: readonly [number, number, number][] = [
  [-0.08, 0, 0.12], [0.06, 0.05, -0.1], [0, -0.08, 0.02], [0.1, -0.04, -0.2], [-0.04, 0.08, 0.2], [0.03, 0, -0.05],
];
const quiverTop = (t: number, dx: number, dz: number): [number, number, number] => [0.42 + QUIVER_AXIS[0] * t + dx, 2.4 + QUIVER_AXIS[1] * t, -1.06 + dz];
const MHE_ARROWS = merge(...ARROW_OFFSETS.map(([dx, dz, turn]) => box(0.045, 0.62, 0.045, { rz: QUIVER_TILT + turn, at: quiverTop(0.95, dx, dz) })));
const MHE_FLETCHING = merge(...ARROW_OFFSETS.map(([dx, dz, turn]) => box(0.12, 0.2, 0.03, { rz: QUIVER_TILT + turn, at: quiverTop(1.28, dx, dz) })));
// Yıldız Yayı: büyük gümüş yay, önünde camgöbeği ışık şeridi, uçlarında taşlar; ışıktan kiriş ve ok.
const BOW_AT: [number, number, number] = [-0.8, 2.1, 0.24];
const BOW_R = 1.32;
const MHE_BOW = place(new TorusGeometry(BOW_R, 0.075, 5, 16, Math.PI), { rz: Math.PI / 2, at: BOW_AT });
const MHE_BOW_LIGHT = place(new TorusGeometry(BOW_R, 0.03, 4, 16, Math.PI), { rz: Math.PI / 2, at: [BOW_AT[0], BOW_AT[1], BOW_AT[2] + 0.08] });
const MHE_BOW_TIPS = merge(
  place(new OctahedronGeometry(0.13, 0), { at: [BOW_AT[0], BOW_AT[1] + BOW_R, BOW_AT[2]] }),
  place(new OctahedronGeometry(0.13, 0), { at: [BOW_AT[0], BOW_AT[1] - BOW_R, BOW_AT[2]] }),
);
const MHE_BOW_GRIP = box(0.22, 0.38, 0.22, { at: [BOW_AT[0] - BOW_R, BOW_AT[1], BOW_AT[2]] });
const MHE_STRING = box(0.035, BOW_R * 2, 0.035, { at: BOW_AT });
const MHE_LIGHT_ARROW = merge(
  box(1.75, 0.045, 0.045, { at: [BOW_AT[0] - 0.875, BOW_AT[1], BOW_AT[2]] }),
  box(0.13, 0.13, 0.045, { rz: Math.PI / 4, at: [BOW_AT[0] - 1.78, BOW_AT[1], BOW_AT[2]] }),
);

type HeroPart = readonly [name: string, geometry: BufferGeometry, color: Paint, flags: Flags];
const GLASS = "#15121c";

// BinTaş: kullanıcının alev kadını modeli (modeller/kaynak/efsanevi-alev-kadini.obj, npm run model:cevir).
// Renkleri modeldeki gibidir; alev parçaları kendi ışığıyla parlar, ateş küresi kaldırdığı sol elindedir (x > 0).
const BINTAS_FLAGS: Readonly<Record<string, Flags>> = {
  bacaklar: { legs: true },
  cizmeler: { legs: true },
  "cizme-kenari": { legs: true, detail: true },
  etek: { core: true, shadow: true },
  "alev-dilleri": { glow: true },
  govde: { core: true, shadow: true },
  "zirh-kenari": { detail: true },
  "gogus-amblemi": { glow: true, detail: true },
  "kor-damar": { glow: true, detail: true },
  toka: { detail: true },
  "toka-tasi": { glow: true, detail: true },
  "kusak-kenari": { detail: true },
  "omuz-alevi": { glow: true },
  kollar: { arms: true, shadow: true },
  bilezik: { arms: true, detail: true },
  eller: { arms: true, detail: true },
  kafa: { core: true, shadow: true },
  gozler: { detail: true },
  "goz-isigi": { glow: true, detail: true },
  "goz-parlamasi": { glow: true, detail: true },
  kaslar: { detail: true },
  burun: { detail: true },
  dudaklar: { detail: true },
  agiz: { detail: true },
  kupe: { detail: true },
  kahkul: { detail: true },
  sac: { core: true },
  "alev-saci": { glow: true, core: true },
  "alev-uclari": { glow: true },
  "tac-alevi": { glow: true },
  "tac-tasi": { glow: true, detail: true },
  "alev-kanatlari": { core: true, shadow: true },
  "kanat-isigi": { glow: true },
  "alev-kuresi": { arms: true, glow: true },
  "kure-cekirdegi": { arms: true, glow: true },
  "kor-parcalari": { arms: true, glow: true, detail: true },
};
const BINTAS_PARTS: readonly HeroPart[] = Object.entries(alevKadini).map(([name, part]) => [
  name,
  modelGeometry(part, name),
  () => part.c ?? "#ffffff",
  BINTAS_FLAGS[name] ?? {},
]);
/** Alev saçının üstünde kalsın diye kendi akın işareti olan kahramanlar. */
const OWN_RAID_MARKER: ReadonlySet<HeroId> = new Set(["bintas"]);
const BINTAS_RAID_MARKER = place(new OctahedronGeometry(0.3, 0), { at: [0, 5.6, 0] });

const HERO_KITS: Readonly<Record<HeroId, readonly HeroPart[]>> = {
  egetunce: [
    ["sort", EGE_SHORTS, (l) => l.colors.p, { legs: true }],
    ["baldir", EGE_CALVES, (l) => l.colors.s, { legs: true }],
    ["ayakkabi", EGE_SNEAKERS, (l) => l.colors.b, { legs: true }],
    ["taban", EGE_SOLES, () => "#9c9a94", { legs: true, detail: true }],
    ["tisort", EGE_TEE, (l) => l.colors.c, { core: true, shadow: true }],
    ["boyun", EGE_NECK, (l) => l.colors.s, { detail: true }],
    ["kollar", EGE_SLEEVES, (l) => l.colors.c, { arms: true, shadow: true }],
    ["kol-teni", EGE_ARMS, (l) => l.colors.s, { arms: true }],
    ["eller", HANDS, (l) => l.colors.s, { arms: true, detail: true }],
    ["kafa", HEAD, (l) => l.colors.s, { core: true, shadow: true }],
    ["gozler", EYES, (l) => l.colors.e, { detail: true }],
    ["kaslar", BROWS, (l) => l.colors.f, { detail: true }],
    ["burun", NOSE, (l) => l.colors.S, { detail: true }],
    ["agiz", EGE_MOUTH, () => "#5a2b26", { detail: true }],
    ["sakal", BEARD_SHORT, (l) => l.colors.f, {}],
    ["sac", EGE_HAIR, (l) => l.colors.h, { core: true }],
    ["sapka", EGE_HAT, (l) => l.colors.m, { core: true, shadow: true }],
    ["sapka-kenari", EGE_HAT_BRIM, (l) => l.colors.m, { core: true, shadow: true }],
    ["sapka-gozleri", EGE_HAT_EYES, (l) => l.colors.i, {}],
    ["sapka-bebekleri", EGE_HAT_PUPILS, () => GLASS, { detail: true }],
    ["lavanta-sapi", EGE_LAVENDER_STEMS, (l) => l.colors.v, { arms: true, detail: true }],
    ["lavanta", EGE_LAVENDER, (l) => l.colors.d, { arms: true }],
    ["kilic", EGE_BLADE, (l) => l.colors.i, { arms: true, shadow: true }],
    ["kilic-isigi", EGE_FULLER, (l) => l.colors.l, { arms: true, glow: true }],
    ["kilic-siperi", EGE_GUARD, (l) => l.colors.g, { arms: true }],
    ["kilic-kabzasi", EGE_GRIP, (l) => l.colors.k, { arms: true, detail: true }],
    ["kilic-tasi", EGE_GEM, (l) => l.colors.L, { arms: true, glow: true, detail: true }],
  ],
  mhellingtr: [
    ["bacaklar", LEGS, (l) => l.colors.p, { legs: true }],
    ["cizmeler", BOOTS, (l) => l.colors.b, { legs: true }],
    ["cizme-kenari", BOOT_FUR, (l) => l.colors.m, { legs: true, detail: true }],
    ["govde", BODY, (l) => l.colors.c, { core: true, shadow: true }],
    ["etek", HEM, (l) => l.colors.g, {}],
    ["kemer", BELT, (l) => l.colors.k, { detail: true }],
    ["toka", MHE_BUCKLE, (l) => l.colors.M, { detail: true }],
    ["yildiz-amblemi", MHE_STAR, (l) => l.colors.l, { glow: true, detail: true }],
    ["boyunluk", FUR_COLLAR, (l) => l.colors.m, {}],
    ["omuzluk", PAULDRONS, (l) => l.colors.m, { arms: true }],
    ["omuz-taslari", MHE_PAULDRON_GEMS, (l) => l.colors.L, { arms: true, glow: true, detail: true }],
    ["kollar", SLEEVES, (l) => l.colors.C, { arms: true, shadow: true }],
    ["bileklik", MHE_BRACERS, (l) => l.colors.m, { arms: true, detail: true }],
    ["eller", HANDS, (l) => l.colors.s, { arms: true, detail: true }],
    ["kafa", HEAD, (l) => l.colors.s, { core: true, shadow: true }],
    ["gozler", EYES, (l) => l.colors.e, { detail: true }],
    ["kaslar", BROWS, (l) => l.colors.h, { detail: true }],
    ["burun", NOSE, (l) => l.colors.S, { detail: true }],
    ["kulaklar", EARS, (l) => l.colors.s, { detail: true }],
    ["agiz", MHE_MOUTH, () => "#5a2b26", { detail: true }],
    ["sakal", BEARD_SHORT, (l) => l.colors.h, {}],
    ["sac", MHE_HAIR, (l) => l.colors.h, { core: true }],
    ["yildiz-taci", MHE_CROWN, (l) => l.colors.L, { glow: true }],
    ["pelerin", MHE_CAPE, (l) => l.colors.v, { core: true, shadow: true }],
    ["pelerin-kenari", MHE_CAPE_TRIM, (l) => l.colors.g, {}],
    ["pelerin-yildizlari", MHE_CAPE_STARS, (l) => l.colors.L, { glow: true, detail: true }],
    ["okluk", MHE_QUIVER, (l) => l.colors.k, { shadow: true }],
    ["okluk-halkalari", MHE_QUIVER_BANDS, (l) => l.colors.m, { detail: true }],
    ["oklar", MHE_ARROWS, (l) => l.colors.i, {}],
    ["ok-tuyleri", MHE_FLETCHING, (l) => l.colors.l, { glow: true, detail: true }],
    ["yay", MHE_BOW, (l) => l.colors.m, { arms: true, shadow: true }],
    ["yay-isigi", MHE_BOW_LIGHT, (l) => l.colors.l, { arms: true, glow: true }],
    ["yay-uclari", MHE_BOW_TIPS, (l) => l.colors.L, { arms: true, glow: true }],
    ["yay-kabzasi", MHE_BOW_GRIP, (l) => l.colors.C, { arms: true, detail: true }],
    ["kiris", MHE_STRING, (l) => l.colors.L, { arms: true, glow: true }],
    ["isik-oku", MHE_LIGHT_ARROW, (l) => l.colors.l, { arms: true, glow: true }],
  ],
  bintas: BINTAS_PARTS,
};

const HERO_PARTS: readonly PartSpec[] = [
  ...(Object.keys(HERO_KITS) as HeroId[]).flatMap((hero) =>
    HERO_KITS[hero].map<PartSpec>(([name, geometry, color, flags]) => ({
      id: `${hero}-${name}`,
      geometry,
      applies: (c, l) => kitChoice(c, l).hero === hero,
      color,
      ...flags,
    })),
  ),
  {
    id: "bintas-akin-isareti",
    geometry: BINTAS_RAID_MARKER,
    applies: (c, l, ctx) => ctx.inRaid && kitChoice(c, l).hero === "bintas",
    color: () => "#f6d36f",
    glow: true,
    core: true,
  },
];

// ── Takipçi modelleri (modeller/kaynak/takipciler, npm run model:takipciler) ──
//
// Sıradan, nadir ve destansı takipçiler (efsanevi Kalkaneri ve Okyeli de destansı modeli) sınıflarının modelini giyer:
// Kalkaneri savaşçı, Okyeli okçu, Ocakcan büyücü. Efsanevi Ocakcan ise büyücü-şifacıdır.
// Gövde, yüz ve saç kademeler arasında ortaktır; renkleri kademeye göre değişir. Ten ve saç rengi takipçinin kendisinden
// gelir (herkes başka görünür). Kollar ve bacaklar modelin iskeletine göre döner (FOLLOWER_JOINTS).

const TIER_NAMES: Readonly<Record<FollowerTier, string>> = { siradan: "siradan", nadir: "nadir", destansi: "destansi" };

const FOLLOWER_SKIN = new Set(["kafa", "eller", "kulaklar"]);
const FOLLOWER_SKIN_SHADE = new Set(["boyun", "burun"]);
const FOLLOWER_HAIR = new Set(["sac", "kaslar", "sakal", "biyik"]);
const FOLLOWER_LEGS = new Set(["bacaklar", "cizmeler", "cizme-tabani", "cizme-plakalari"]);
const FOLLOWER_ARMS = new Set([
  "kollar", "eller", "bileklikler", "bileklik-plakalari", "bileklik-nakis", "kol-zirhlari", "kol-alt", "kol-kenari",
  "omuzluklar", "omuz-plakalari", "omuz-zirhi", "omuz-suslemeleri",
  "kilic", "kilic-koruma", "kilic-kabzasi", "kilic-tasi", "kilic-suslemesi",
  "kalkan", "kalkan-cercedeyi", "kalkan-kabara", "kalkan-kayislari", "kalkan-suslemeleri", "kalkan-amblemi", "kalkan-percinleri",
  "yay", "yay-kavramasi", "yay-kirisi", "yay-plakalari",
  "asa", "asa-bagi", "asa-yuvasi", "asa-tasi", "asa-yuzukleri", "asa-koruma", "asa-sarkilari", "kristaller",
]);
const FOLLOWER_CORE = new Set(["govde", "kafa", "sac", "kapuson", "sapka", "sapka-kenari", "pelerin", "etek", "gogus-zirhi", "yelek"]);
const FOLLOWER_SHADOW = new Set(["govde", "kafa", "kapuson", "sapka", "pelerin", "etek", "kalkan", "yelek"]);
const FOLLOWER_GLOW = new Set(["asa-tasi", "kristaller", "parcaciklar", "sapka-tasi"]);
const FOLLOWER_DETAIL = new Set([
  "gozler", "goz-bebekleri", "goz-parlamasi", "kaslar", "burun", "agiz", "kulaklar", "eller", "boyun", "yaka", "yelek-acikligi",
  "kemer-tokasi", "kemer-suslemesi", "zirh-percinleri", "zirh-kayislari", "kalkan-percinleri", "kalkan-kayislari",
  "nakis", "etek-nakis", "sapka-nakis", "bileklik-nakis", "gogus-suslemesi", "govde-suslemeleri", "cizme-tabani",
  "kilic-tasi", "kilic-suslemesi", "sapka-tasi", "sapka-bandi", "tilsim", "kese-kucuk", "ok-tuyu", "sadak-kayisi",
  "asa-bagi", "asa-yuvasi", "asa-yuzukleri", "asa-sarkilari", "parcaciklar",
]);

/** Süsler (perçin, nakış, süsleme, taş, tüy, kayış…) yalnızca yakından çizilir. */
const FOLLOWER_ORNAMENT = /(susleme|percin|nakis|tasi|tuyu|kayis|tokasi|parcacik|kristal|kenari|bagi|halka|yuzuk|sarki)/;
const followerModel = has((k) => k.model !== null);

// Uzak görünüm: karakterler birkaç piksel boyundayken model yerine sınıfın ve kademenin renginde basit bir siluet
// (bacak, gövde, kafa ve başlık kutuları). Binlerce takipçi uzaktan da akıcı çizilir; yaklaşınca asıl model gelir.
const boxOf = (p: readonly number[]) => {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let k = 0; k < p.length; k += 3)
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], p[k + a]);
      max[a] = Math.max(max[a], p[k + a]);
    }
  return { min, max };
};
const proxyBox = (parts: readonly { p: readonly number[] }[], inset = 0.85) => {
  const all = boxOf(parts.flatMap((m) => [...m.p]));
  const size = [0, 1, 2].map((a) => (all.max[a] - all.min[a]) * (a === 1 ? 1 : inset));
  const at = [0, 1, 2].map((a) => (all.max[a] + all.min[a]) / 2) as [number, number, number];
  return box(size[0], size[1], size[2], { at });
};

const FOLLOWER_FAR_PARTS: readonly PartSpec[] = (Object.keys(TAKIPCI_MODELLERI) as FollowerBody[]).flatMap((body) => {
  const model = TAKIPCI_MODELLERI[body];
  const named = (...names: string[]) => model.filter((m) => names.includes(m.name));
  const tierColor =
    (...names: string[]): PartSpec["color"] =>
    (_l, c) => {
      const tier = c ? tierOf(c.rarity) : "siradan";
      for (const name of names) {
        const hit = model.find((m) => m.name === name && m.k.includes(tier));
        if (hit?.c[tier]) return hit.c[tier]!;
      }
      return "#808080";
    };
  const hat = named("sapka", "kapuson");
  const applies: PartSpec["applies"] = (c, l) => kitChoice(c, l).model !== null && c.class.id === body;
  const far = { far: true, rig: "takipci" as const, applies };
  return [
    { id: `${body}-uzak-bacak`, geometry: proxyBox(named("bacaklar", "cizmeler")), color: tierColor("bacaklar"), legs: true, ...far },
    { id: `${body}-uzak-govde`, geometry: proxyBox(named("govde", "kollar"), 0.8), color: tierColor("gogus-zirhi", "yelek", "govde"), shadow: true, ...far },
    { id: `${body}-uzak-kafa`, geometry: proxyBox(named("kafa")), color: (l: SpriteLook) => l.colors.s, ...far },
    hat.length
      ? { id: `${body}-uzak-baslik`, geometry: proxyBox(hat, 0.75), color: tierColor("sapka", "kapuson"), ...far }
      : { id: `${body}-uzak-sac`, geometry: proxyBox(named("sac"), 0.9), color: (l: SpriteLook) => l.colors.h, ...far },
  ];
});

const FOLLOWER_PARTS: readonly PartSpec[] = [
  ...(Object.keys(TAKIPCI_MODELLERI) as FollowerBody[]).flatMap((body) =>
    TAKIPCI_MODELLERI[body].map<PartSpec>((part) => {
      const everywhere = part.k.length === 3;
      const tiers = new Set(part.k);
      const fallback = part.c[part.k[0]] ?? "#ffffff";
      const color: PartSpec["color"] = FOLLOWER_SKIN.has(part.name)
        ? (l) => l.colors.s
        : FOLLOWER_SKIN_SHADE.has(part.name)
          ? (l) => l.colors.S
          : FOLLOWER_HAIR.has(part.name)
            ? (l) => l.colors.h
            : (_l, c) => (c ? part.c[tierOf(c.rarity)] : undefined) ?? fallback;
      return {
        id: everywhere ? `${body}-${part.name}` : `${body}-${part.name}-${part.k.map((t) => TIER_NAMES[t]).join("-")}`,
        geometry: modelGeometry(part, part.name),
        applies: (c, l) => {
          const tier = kitChoice(c, l).model;
          return tier !== null && c.class.id === body && tiers.has(tier);
        },
        color,
        rig: "takipci",
        legs: FOLLOWER_LEGS.has(part.name) || undefined,
        arms: FOLLOWER_ARMS.has(part.name) || undefined,
        shadow: FOLLOWER_SHADOW.has(part.name) || undefined,
        glow: FOLLOWER_GLOW.has(part.name) || undefined,
        detail: (FOLLOWER_DETAIL.has(part.name) || FOLLOWER_ORNAMENT.test(part.name)) && !FOLLOWER_CORE.has(part.name) && part.name !== "asa-tasi" ? true : undefined,
      };
    }),
  ),
  ...FOLLOWER_FAR_PARTS,
  // Büyücü şapkasının ucu da altında kalsın diye akın işareti biraz daha yukarıda.
  {
    id: "takipci-akin-isareti",
    geometry: place(new OctahedronGeometry(0.3, 0), { at: [0, 5.6, 0] }),
    applies: (c, l, ctx) => ctx.inRaid && followerModel(c, l),
    color: () => "#f6d36f",
    glow: true,
    core: true,
    rig: "takipci",
  },
];

/** Takipçiler, büyücüler ve özel kahramanlar ortak gövdeyi değil kendi modellerini giyer (bazı kahramanlarda akın işareti ortak). */
const unlessCustom = (part: PartSpec): PartSpec => ({
  ...part,
  applies: (c, l, ctx) => {
    const k = kitChoice(c, l);
    return !k.wizard && !k.model && (!k.hero || (part.id === "akin-isareti" && !OWN_RAID_MARKER.has(k.hero))) && part.applies(c, l, ctx);
  },
});

export const PARTS: readonly PartSpec[] = [...BASE_PARTS.map(unlessCustom), ...WIZARD_PARTS, ...HERO_PARTS, ...FOLLOWER_PARTS];

/** Karakterin taşıdığı parçaların kimlikleri (test ve hata ayıklama için). */
export function partsOf(character: Character, look: SpriteLook, ctx: PartContext): string[] {
  return PARTS.filter((part) => part.applies(character, look, ctx)).map((part) => part.id);
}

/** Tıklama ve üzerine gelme için karakteri saran görünmez silindir. */
export const HIT_GEOMETRY = cylinder(1.3, 1.3, 4.8, 6, { at: [0, 2.4, 0] });

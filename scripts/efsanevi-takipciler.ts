/**
 * EFSANEVİ TAKİPÇİ MODELLERİ — kaynağı bu betiktir: `npm run model:efsanevi`
 *
 * Destansı modelin (modeller/kaynak/takipciler/<sinif>-epic.obj) üstüne kurulur: aynı gövde ve iskelet (oba-rig), efsanevi
 * renkler (kızıl, altın, fildişi, kor ışığı) ve kodla çizilmiş yeni parçalar. Çıktı aynı klasörde <sinif>-legendary.obj
 * + .mtl; oyuna `npm run model:takipciler` bağlar (efsanevi kademe). Blockbench ya da Blender'da açılabilir.
 *
 *   Kalkaneri · Alp      altın tolga ve kızıl yele, uzun kızıl pelerin, ışıldayan kılıç, güneşli kalkan
 *   Okyeli · Kartal      fildişi kapüşon, kartal tüyü tacı, kürk yaka, altın yay ve buz ışıklı kiriş
 *   Ocakcan · Ocak Ata   sırtında ateş halesi, alevli asa ve şapka, göğüste ışıklı madalyon
 *
 * Yeni parçaların yeri destansı modelin parçalarından ölçülür (kılıcın, kalkanın, asa taşının, şapka ucunun yeri):
 * destansı model değişirse efsanevi de ona uyar. Parça adları oyundaki kimliklerdir; ışıyanlar ve ele bağlı olanlar
 * src/world3d/characters/characterKit.ts → FOLLOWER_GLOW / FOLLOWER_ARMS listelerindedir.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { box, extrude, lathe, merge, objBlock, octa, place, sheet, torus, type Mesh, type V3 } from "./lib/meshKit";
import { parseObj } from "./lib/objParse";

const DIR = resolve("modeller/kaynak/takipciler");

interface Anchors {
  /** Parçanın köşeleri (oyun birimi). */
  points(name: string): V3[];
  min(name: string): V3;
  max(name: string): V3;
  center(name: string): V3;
  /** En yüksek köşe. */
  top(name: string): V3;
}

interface Legendary {
  file: "warrior" | "ranger" | "mage";
  title: string;
  /** Destansı parçaların efsanevi renkleri (ten, saç ve yüz renkleri oyunda takipçiden gelir, burada önemsiz). */
  recolor: Readonly<Record<string, string>>;
  /** Efsanevide olmayan destansı parçalar. */
  drop?: readonly string[];
  add: (a: Anchors) => [name: string, mesh: Mesh, color: string][];
}

const PI = Math.PI;

// ── Kalkaneri · Alp ──────────────────────────────────────────────
const KALKANERI: Legendary = {
  file: "warrior",
  title: "Savasci - Efsanevi (Legendary Warrior)",
  recolor: {
    bacaklar: "#2a2026", cizmeler: "#3a2418", "cizme-tabani": "#1e1612", "cizme-plakalari": "#e0a93a",
    govde: "#8e2420", kollar: "#8e2420", yaka: "#e8c060", kemer: "#2e1c14", "kemer-tokasi": "#ffd66b", "kemer-suslemesi": "#f0c050",
    bileklikler: "#3a2418", "bileklik-plakalari": "#e0a93a",
    "gogus-zirhi": "#b8862c", "gogus-plakalari": "#e8b33a", "gogus-suslemesi": "#fff0b0",
    "yaka-kurk": "#efe8dc", "omuz-plakalari": "#d4a03a", "kol-zirhlari": "#c8922e", "kalca-plakalari": "#7a2a1e",
    kilic: "#eef1f6", "kilic-koruma": "#ffd66b", "kilic-kabzasi": "#3a1c14", "kilic-tasi": "#ff7a2e",
    kalkan: "#6e1a16", "kalkan-cercedeyi": "#e0a93a", "kalkan-suslemeleri": "#f0c050", "kalkan-amblemi": "#ffd66b",
    "kalkan-kabara": "#fff0b0", "kalkan-kayislari": "#3a2418",
  },
  add: (a) => {
    // Tolga: saçın üstüne oturan açık yüzlü sivri miğfer (kaşların hemen üstünden başlar).
    const hz = (a.min("sac")[2] + a.max("sac")[2]) / 2;
    const dome = place(lathe([[0.5, 3.74], [0.5, 3.84], [0.47, 3.97], [0.41, 4.1], [0.31, 4.23], [0.18, 4.33], [0.07, 4.39], [0, 4.41]], 12), { at: [0, 0, hz] });
    const band = place(lathe([[0.53, 3.71], [0.53, 3.85]], 12), { at: [0, 0, hz] });
    const spike = place(lathe([[0.075, 4.37], [0.06, 4.58], [0, 4.76]], 6), { at: [0, 0, hz] });
    // Yele: tolganın tepesinden arkaya dökülen kızıl at kılı.
    const mane = sheet(
      (u, v) => {
        const w = 0.15 * (1 - 0.55 * v);
        return [(u * 2 - 1) * w, 4.6 + 0.08 * Math.sin(PI * v) - 0.95 * v * v, hz - 0.04 - 0.8 * v];
      },
      2,
      6,
      (_u, v) => 0.07 * (1 - 0.5 * v),
    );
    // Uzun pelerin: kürk yakanın altından topuklara, sırtı saran hafif kavis.
    const cape = (u: number, v: number): V3 => {
      const s = u * 2 - 1;
      return [s * (0.6 + 0.3 * v), 3.02 - 2.45 * v, -0.4 - 0.26 * v - 0.1 * (1 - s * s) * (0.5 + 0.5 * v)];
    };
    const cloak = sheet(cape, 6, 7, 0.045);
    const hem = sheet((u, v) => cape(u, 0.92 + 0.08 * v), 6, 1, 0.075);
    // Kılıcın ağzında kor ışığı çizgisi.
    const [bx0, by0] = a.min("kilic");
    const [bx1, by1, bz1] = a.max("kilic");
    const bz0 = a.min("kilic")[2];
    const bladeH = by1 - by0;
    const bladeGlow = place(box(bx1 - bx0 + 0.03, bladeH * 0.7, 0.05), { at: [(bx0 + bx1) / 2, by0 + bladeH * 0.55, (bz0 + bz1) / 2] });
    // Kalkanın ortasında güneş: ışıyan göbek ve sekiz ışın.
    const [sx, sy] = a.center("kalkan-kabara");
    const sz = a.max("kalkan-kabara")[2];
    const sunCore = place(octa(0.09, 0.09, 0.04), { at: [sx, sy, sz + 0.01] });
    const rays = merge(...Array.from({ length: 8 }, (_, k) => place(box(0.045, 0.15, 0.03), { rot: [0, 0, (k / 8) * PI * 2], at: [sx - Math.sin((k / 8) * PI * 2) * 0.28, sy + Math.cos((k / 8) * PI * 2) * 0.28, sz] })));
    return [
      ["tolga", dome, "#cf9a35"],
      ["tolga-bandi", band, "#f4cf63"],
      ["tolga-sorgucu", spike, "#ffe08a"],
      ["tolga-yelesi", mane, "#b4261e"],
      ["pelerin", cloak, "#9a1f1c"],
      ["pelerin-kenari", hem, "#f0c050"],
      ["kilic-isigi", bladeGlow, "#ffb347"],
      ["kalkan-isigi", sunCore, "#ffe08a"],
      ["kalkan-gunesi", rays, "#ffb347"],
    ];
  },
};

// ── Okyeli · Kartal ──────────────────────────────────────────────
const FEATHER: [number, number][] = [[0, 0], [0.05, 0.08], [0.066, 0.3], [0.046, 0.5], [0, 0.64], [-0.04, 0.5], [-0.062, 0.28], [-0.044, 0.08]];

const OKYELI: Legendary = {
  file: "ranger",
  title: "Okcu - Efsanevi (Legendary Ranger)",
  recolor: {
    bacaklar: "#2a2420", cizmeler: "#4a2e1c", "cizme-tabani": "#241a14", "cizme-plakalari": "#d9a540",
    govde: "#7c1f1c", kollar: "#7c1f1c", kemer: "#3a2418", "kemer-tokasi": "#ffd66b", "kemer-suslemesi": "#f0c050",
    bileklikler: "#4a2e1c", "bileklik-plakalari": "#d9a540", "bileklik-nakis": "#f0c050",
    "gogus-zirhi": "#4a2e1c", "omuz-zirhi": "#c8922e",
    kapuson: "#f1e9d6", "kapuson-kenari": "#d9a540", pelerin: "#8e2420", "pelerin-kenari": "#f0c050",
    sadak: "#8e2420", "sadak-kenari": "#f0c050", "sadak-kayisi": "#6a4628", oklar: "#e9dcc0", "ok-tuyu": "#f1e9d6",
    tuy: "#f6efe0", "tuy-sapi": "#d9a540",
    yay: "#b8862c", "yay-kavramasi": "#3a1c14", "yay-plakalari": "#ffd66b",
  },
  // Düz kiriş yerine ışıyan kiriş gelir.
  drop: ["yay-kirisi"],
  add: (a) => {
    // Kartal tüyü tacı: kapüşonun tepesinden arkaya açılan üç tüy.
    const [tx, ty, tz] = a.top("kapuson");
    const crest = merge(
      ...[-0.38, 0, 0.38].map((splay, k) =>
        place(extrude(FEATHER, 0.025), { scale: k === 1 ? 1.15 : 0.95, rot: [-0.55, 0, splay], at: [tx + splay * 0.12, ty - 0.08, tz - 0.14] }),
      ),
    );
    // Kürk yaka: omuz pelerininin üstünde, boynu saran ak kürk.
    const fur = place(torus(0.47, 0.1, 12, 6, { sx: 1.05, sz: 0.88 }), { at: [0, 3.0, -0.04] });
    // Buz ışıklı kiriş ve yayın altın uçları.
    const [kx0, ky0, kz0] = a.min("yay-kirisi");
    const [kx1, ky1, kz1] = a.max("yay-kirisi");
    const string = place(box(Math.max(0.03, kx1 - kx0 + 0.01), ky1 - ky0, Math.max(0.03, kz1 - kz0 + 0.01)), { at: [(kx0 + kx1) / 2, (ky0 + ky1) / 2, (kz0 + kz1) / 2] });
    const tipX = (kx0 + kx1) / 2 - 0.02;
    const tips = merge(place(octa(0.06, 0.11, 0.06), { at: [tipX, ky1 + 0.03, (kz0 + kz1) / 2] }), place(octa(0.06, 0.11, 0.06), { at: [tipX, ky0 - 0.03, (kz0 + kz1) / 2] }));
    return [
      ["kartal-tuy", crest, "#efe4cf"],
      ["omuz-kurku", fur, "#ece6da"],
      ["yay-isigi", string, "#a8ecff"],
      ["yay-uclari", tips, "#ffd66b"],
    ];
  },
};

// ── Ocakcan · Ocak Ata ───────────────────────────────────────────
const flame = (r: number, h: number) => lathe([[r, 0], [r * 0.7, h * 0.35], [0, h]], 6);

const OCAKCAN: Legendary = {
  file: "mage",
  title: "Buyucu - Efsanevi (Legendary Mage)",
  recolor: {
    bacaklar: "#2a2026", cizmeler: "#4a2e1c", "cizme-tabani": "#241a14",
    govde: "#7a1c22", kollar: "#7a1c22", yaka: "#f0c050", kemer: "#3a2418", "kemer-tokasi": "#ffd66b", "kemer-suslemesi": "#f0c050",
    kese: "#8a6a40", "kol-alt": "#d4541c", "kol-kenari": "#f0c050",
    etek: "#7a1c22", "etek-kaplamasi": "#d4541c", "etek-kenari": "#f0c050", "etek-nakis": "#ffd66b", "govde-suslemeleri": "#ffd66b",
    sapka: "#6e1820", "sapka-kenari": "#d9a540", "sapka-bandi": "#ffd66b", "sapka-nakis": "#f0c050", "sapka-tasi": "#ff9a3d",
    "omuz-suslemeleri": "#f0c050", tilsim: "#ffd66b",
    kristaller: "#ff8a3d", asa: "#3a1c14", "asa-bagi": "#6a2a1c", "asa-yuzukleri": "#f0c050", "asa-koruma": "#ffd66b",
    "asa-tasi": "#ffb347", "asa-sarkilari": "#f0c050", parcaciklar: "#ffcf70",
  },
  add: (a) => {
    // Asanın taşında yanan üç alev dili.
    const [gx, gy, gz] = a.center("asa-tasi");
    const staffFire = merge(
      place(flame(0.075, 0.42), { at: [gx, gy + 0.14, gz] }),
      place(flame(0.06, 0.3), { rot: [0, 0, 0.35], at: [gx + 0.08, gy + 0.08, gz + 0.03] }),
      place(flame(0.06, 0.3), { rot: [0, 0, -0.35], at: [gx - 0.08, gy + 0.08, gz - 0.02] }),
    );
    // Şapkanın ucunda küçük bir alev.
    const [hx, hy, hz] = a.top("sapka");
    const hatFire = place(flame(0.07, 0.3), { at: [hx, hy - 0.03, hz] });
    // Sırtta ateş halesi: dik halka ve çevresinde sekiz alev ucu (şapka kenarının altında, sırtın arkasında).
    const R = 0.82;
    const ring = place(torus(R, 0.04, 24, 4), { rot: [PI / 2, 0, 0] });
    const sparks = Array.from({ length: 8 }, (_, k) => {
      const ang = (k / 8) * PI * 2;
      return place(extrude([[-0.06, 0], [0.06, 0], [0, 0.21]], 0.035), { rot: [0, 0, ang], at: [-Math.sin(ang) * (R + 0.02), Math.cos(ang) * (R + 0.02), 0] });
    });
    const halo = place(merge(ring, ...sparks), { at: [0, 3.2, -0.66] });
    // Göğüste altın madalyon ve ışıyan taşı (sakalın altında).
    const front = a.max("govde")[2];
    const medal = place(lathe([[0.11, 0], [0.11, 0.035]], 10), { rot: [PI / 2, 0, 0], at: [0, 2.62, front + 0.035] });
    const medalGem = place(octa(0.05, 0.05, 0.025), { at: [0, 2.62, front + 0.045] });
    return [
      ["asa-alevi", staffFire, "#ff7a2e"],
      ["sapka-alevi", hatFire, "#ffb347"],
      ["ates-halesi", halo, "#ff8a3d"],
      ["madalyon", medal, "#e8b33a"],
      ["madalyon-tasi", medalGem, "#ffe08a"],
    ];
  },
};

// ── Üretim ───────────────────────────────────────────────────────

function anchorsOf(path: string): Anchors {
  const model = parseObj(path, 0.1);
  const points = (name: string): V3[] => {
    const part = model.parts.get(name);
    if (!part) throw new Error(`${path}: '${name}' parçası yok`);
    const out: V3[] = [];
    for (let k = 0; k < part.p.length; k += 3) out.push([part.p[k], part.p[k + 1], part.p[k + 2]]);
    return out;
  };
  const min = (name: string): V3 => points(name).reduce((m, p) => [Math.min(m[0], p[0]), Math.min(m[1], p[1]), Math.min(m[2], p[2])], [Infinity, Infinity, Infinity]);
  const max = (name: string): V3 => points(name).reduce((m, p) => [Math.max(m[0], p[0]), Math.max(m[1], p[1]), Math.max(m[2], p[2])], [-Infinity, -Infinity, -Infinity]);
  return {
    points,
    min,
    max,
    center: (name) => {
      const [a, b] = [min(name), max(name)];
      return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    },
    top: (name) => points(name).reduce((best, p) => (p[1] > best[1] ? p : best)),
  };
}

const kd = (hex: string) =>
  [1, 3, 5]
    .map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(4))
    .join(" ");

function build(spec: Legendary): void {
  const source = resolve(DIR, `${spec.file}-epic.obj`);
  const anchors = anchorsOf(source);
  const lines = readFileSync(source, "utf8").split(/\r?\n/);
  const drop = new Set(spec.drop ?? []);

  // Destansı gövde: başlık yeni, düşen parçaların yalnızca yüzleri silinir (köşe numaraları kaymasın).
  const out = [
    `# OBA-Tales referans karakteri: ${spec.title}`,
    "# scripts/efsanevi-takipciler.ts ile üretildi (npm run model:efsanevi); destansı modelin üstüne kurulu.",
    "# 10 kat büyütülmüş (boy ~44 birim): Blockbench için. Ayak tabanı y = 0, yüz +z yönünde.",
    "# Her nesnenin adı oyundaki parça kimliğidir; kendi modelinde bu adları koru.",
    `mtllib ${spec.file}-legendary.mtl`,
  ];
  let current = "";
  let vertices = 0;
  let normals = 0;
  for (const line of lines) {
    if (line.startsWith("#") || line.startsWith("mtllib ")) continue;
    if (line.startsWith("o ")) current = line.slice(2).trim();
    if (line.startsWith("v ")) vertices++;
    if (line.startsWith("vn ")) normals++;
    if (line.startsWith("f ") && drop.has(current)) continue;
    if (line.trim()) out.push(line);
  }

  // Yeni parçalar.
  const added = spec.add(anchors);
  let triangles = 0;
  for (const [name, mesh] of added) {
    const block = objBlock(name, mesh, vertices, normals);
    out.push(...block.lines);
    vertices += block.v;
    normals += block.vn;
    triangles += mesh.t.length;
  }
  writeFileSync(resolve(DIR, `${spec.file}-legendary.obj`), out.join("\n") + "\n", "utf8");

  // Malzemeler: destansının adları, efsanevi renkleri; yeni parçalar sona.
  const mtl: string[] = [`# ${spec.title} — scripts/efsanevi-takipciler.ts`];
  let material = "";
  for (const line of readFileSync(resolve(DIR, `${spec.file}-epic.mtl`), "utf8").split(/\r?\n/)) {
    if (line.startsWith("#")) continue;
    if (line.startsWith("newmtl ")) material = line.slice(7).trim();
    if (line.startsWith("Kd ") && spec.recolor[material]) mtl.push(`Kd ${kd(spec.recolor[material])}`);
    else mtl.push(line);
  }
  for (const [name, , color] of added) mtl.push(`newmtl ${name}`, `Kd ${kd(color)}`, "Ka 0 0 0", "Ks 0 0 0", "d 1", "illum 1", "");
  writeFileSync(resolve(DIR, `${spec.file}-legendary.mtl`), mtl.join("\n") + "\n", "utf8");

  const unknown = Object.keys(spec.recolor).filter((name) => !lines.includes(`o ${name}`));
  if (unknown.length) throw new Error(`${spec.file}: destansı modelde olmayan renk adları: ${unknown.join(", ")}`);
  console.log(`${spec.file}-legendary.obj: ${added.length} yeni parça (${triangles} üçgen), ${drop.size} parça çıkarıldı`);
}

for (const spec of [KALKANERI, OKYELI, OCAKCAN]) build(spec);
console.log("Sıradaki adım: npm run model:takipciler");

/**
 * Takipçi sınıf modellerini oyunun kod geometrisine çevirir: `npm run model:takipciler`
 *
 * Kaynak: modeller/kaynak/takipciler/<sinif>-<kademe>.obj (+ .mtl): warrior / ranger / mage × common / rare / epic.
 *   Savaşçı = Kalkaneri, Okçu = Okyeli, Büyücü = Ocakcan; common = sıradan, rare = nadir, epic = destansı (ve efsanevi).
 * Çıktı: src/world3d/characters/models/takipciler.ts
 *
 * Bir sınıfın gövdesi, yüzü ve saçı kademeler arasında ortaktır. Aynı geometri bir kez yazılır ve hangi kademelerde
 * bulunduğu (`k`) ile her kademedeki rengi (`c`) yanına eklenir: oyunda tek InstancedMesh, kademeye göre renk.
 * Üç sınıf aynı iskeleti (oba-rig) paylaşır: omuz ve kalça noktaları characterMaterials.ts → FOLLOWER_JOINTS.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { parseObj, type ObjPart } from "./lib/objParse";

const SOURCE = resolve("modeller/kaynak/takipciler");
const OUT = resolve("src/world3d/characters/models/takipciler.ts");
const CLASSES = [
  ["kalkaneri", "warrior"],
  ["okyeli", "ranger"],
  ["ocakcan", "mage"],
] as const;
const TIERS = [
  ["siradan", "common"],
  ["nadir", "rare"],
  ["destansi", "epic"],
] as const;

interface Merged {
  name: string;
  p: number[];
  i: number[];
  tiers: string[];
  colors: Record<string, string>;
}

const bounds = (p: readonly number[]) => {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let k = 0; k < p.length; k += 3)
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], p[k + a]);
      max[a] = Math.max(max[a], p[k + a]);
    }
  return { min, max };
};
const sameGeometry = (a: ObjPart | Merged, b: ObjPart) => a.p.length === b.p.length && a.i.length === b.i.length && a.p.every((v, k) => v === b.p[k]) && a.i.every((v, k) => v === b.i[k]);

const out: string[] = [
  "/**",
  " * TAKİPÇİ MODELLERİ — modeller/kaynak/takipciler/*.obj dosyalarından üretildi (npm run model:takipciler). Elle düzenleme.",
  " * Her sınıf için parçalar: köşeler (x, y, z), üçgenler, bulunduğu kademeler ve kademedeki renk. Ortak gövde bir kez yazılır.",
  " */",
  'export type FollowerTier = "siradan" | "nadir" | "destansi";',
  '/** Savaşçı modeli Kalkaneri, okçu modeli Okyeli, büyücü modeli Ocakcan. */',
  'export type FollowerBody = "kalkaneri" | "okyeli" | "ocakcan";',
  "",
  "export interface FollowerModelPart {",
  "  readonly name: string;",
  "  readonly p: readonly number[];",
  "  readonly i: readonly number[];",
  "  /** Bu geometrinin bulunduğu kademeler. */",
  "  readonly k: readonly FollowerTier[];",
  "  /** Kademeye göre modeldeki renk. */",
  "  readonly c: Readonly<Partial<Record<FollowerTier, string>>>;",
  "}",
  "",
  "export const TAKIPCI_MODELLERI: Readonly<Record<FollowerBody, readonly FollowerModelPart[]>> = {",
];

for (const [body, file] of CLASSES) {
  const merged: Merged[] = [];
  const report: string[] = [];
  for (const [tier, suffix] of TIERS) {
    const path = resolve(SOURCE, `${file}-${suffix}.obj`);
    if (!existsSync(path)) throw new Error(`Bulunamadı: ${relative(process.cwd(), path)}`);
    const model = parseObj(path, 0.1);
    report.push(`${tier} ${model.parts.size} parça ${model.triangles} üçgen`);
    for (const [name, part] of model.parts) {
      const same = merged.find((m) => m.name === name && sameGeometry(m, part));
      if (same) {
        same.tiers.push(tier);
        same.colors[tier] = part.c ?? "#ffffff";
      } else merged.push({ name, p: part.p, i: part.i, tiers: [tier], colors: { [tier]: part.c ?? "#ffffff" } });
    }
  }
  const shared = merged.filter((m) => m.tiers.length === TIERS.length).length;
  const top = Math.max(...merged.map((m) => bounds(m.p).max[1]));
  console.log(`${body}: ${report.join(" · ")} → ${merged.length} benzersiz parça (${shared} ortak), en yüksek nokta ${top.toFixed(2)}`);

  out.push(`  ${body}: [`);
  for (const m of merged)
    out.push(
      `    { name: ${JSON.stringify(m.name)}, k: ${JSON.stringify(m.tiers)}, c: ${JSON.stringify(m.colors)},`,
      `      p: [${m.p.join(",")}],`,
      `      i: [${m.i.join(",")}] },`,
    );
  out.push("  ],");
}
out.push("};", "");
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out.join("\n"), "utf8");
console.log(`→ ${relative(process.cwd(), OUT)}`);

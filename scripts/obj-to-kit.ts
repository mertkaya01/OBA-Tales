/**
 * Bir OBJ modelini oyunun kod geometrisine çevirir: `npm run model:cevir -- <model.obj> <isim> [--olcek 0.1]`
 *
 * Örnek: npm run model:cevir -- modeller/kaynak/buyucu-sifaci.obj buyucuSifaci
 *   → src/world3d/characters/models/buyucuSifaci.ts
 *
 *   · Her `o` nesnesi bir parça olur (adı korunur); köşeler parça içinde birleştirilir, üçgen indeksleri yazılır.
 *   · Ölçek: `modeller/referans/blockbench/` kalıbından yapılan modeller 10 kat büyüktür → varsayılan --olcek 0.1.
 *   · Koordinat: oyunla aynı (y yukarı, yüz +z, ayak tabanı y = 0). Konumlar milimetreye (0,001) yuvarlanır.
 *   · Yüz yönleri OBJ'deki normallerle denetlenir; ters dönmüş üçgenler düzeltilir ve sayısı yazılır.
 *   · Yanındaki .mtl dosyasındaki renk (Kd) de parçaya yazılır (`c`): modelin tasarlandığı renk.
 * Kaynak dosyaya dokunmaz. Çıktı dosyasını elle düzenleme: modeli değiştirip komutu yeniden çalıştır.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: { olcek: { type: "string", default: "0.1" } },
});
const [input, name] = positionals;
if (!input || !name || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(name)) {
  console.error("Kullanım: npm run model:cevir -- <model.obj> <isim (ör. buyucuSifaci)> [--olcek 0.1]");
  process.exit(1);
}
const scale = Number(args.olcek);
const source = resolve(input);
const out = resolve(`src/world3d/characters/models/${name}.ts`);

type Vec = [number, number, number];
const positions: Vec[] = [];
const normals: Vec[] = [];
const parts = new Map<string, { verts: Vec[]; index: number[]; keys: Map<string, number>; material?: string }>();
const materials = new Map<string, string>();
const hex = (v: number) =>
  Math.round(Math.min(1, Math.max(0, v)) * 255)
    .toString(16)
    .padStart(2, "0");
const LINES = /\r?\n/;
const SPACES = /\s+/;
let current: string | null = null;
let flipped = 0;

const round = (v: number) => Math.round(v * 1000) / 1000;
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function readMaterials(file: string): void {
  if (!existsSync(file)) return;
  let material = "";
  for (const raw of readFileSync(file, "utf8").split(LINES)) {
    const line = raw.trim();
    if (line.startsWith("newmtl ")) material = line.slice(7).trim();
    else if (line.startsWith("Kd ") && material) {
      const rgb = line.slice(3).trim().split(SPACES).map(Number);
      materials.set(material, `#${rgb.map(hex).join("")}`);
    }
  }
}

for (const raw of readFileSync(source, "utf8").split(LINES)) {
  const line = raw.trim();
  if (line.startsWith("mtllib ")) {
    readMaterials(resolve(dirname(source), line.slice(7).trim()));
  } else if (line.startsWith("usemtl ") && current) {
    parts.get(current)!.material ??= line.slice(7).trim();
  } else if (line.startsWith("o ") || line.startsWith("g ")) {
    current = line.slice(2).trim();
    if (!parts.has(current)) parts.set(current, { verts: [], index: [], keys: new Map() });
  } else if (line.startsWith("v ")) {
    const [x, y, z] = line.slice(2).trim().split(SPACES).map(Number);
    positions.push([round(x * scale), round(y * scale), round(z * scale)]);
  } else if (line.startsWith("vn ")) {
    normals.push(line.slice(3).trim().split(SPACES).map(Number) as Vec);
  } else if (line.startsWith("f ")) {
    if (!current) throw new Error("Nesnesiz yüz: OBJ'de 'o' satırı yok");
    const part = parts.get(current)!;
    const refs = line
      .slice(2)
      .trim()
      .split(SPACES)
      .map((token) => {
        const [v, , n] = token.split("/").map((s) => (s ? Number(s) : NaN));
        return { v: v < 0 ? positions.length + v : v - 1, n: Number.isNaN(n) ? -1 : n < 0 ? normals.length + n : n - 1 };
      });
    for (let k = 1; k + 1 < refs.length; k++) {
      let tri = [refs[0], refs[k], refs[k + 1]];
      const [a, b, c] = tri.map((r) => positions[r.v]);
      const face = cross(sub(b, a), sub(c, a));
      const given = tri.map((r) => normals[r.n]).find(Boolean);
      if (dot(face, face) < 1e-12) continue; // sıfır alanlı üçgen
      if (given && dot(face, given) < 0) {
        tri = [tri[0], tri[2], tri[1]];
        flipped++;
      }
      for (const r of tri) {
        const p = positions[r.v];
        const key = p.join(",");
        let id = part.keys.get(key);
        if (id === undefined) {
          id = part.verts.length;
          part.verts.push(p);
          part.keys.set(key, id);
        }
        part.index.push(id);
      }
    }
  }
}

const rel = relative(process.cwd(), source).replaceAll("\\", "/");
const lines = [
  "/**",
  ` * ${name} — ${rel} modelinden üretildi. Elle düzenleme:`,
  ` *   npm run model:cevir -- ${rel} ${name}${scale !== 0.1 ? ` --olcek ${scale}` : ""}`,
  " * Oyun birimi: ayak tabanı y = 0, yüz +z. Her parça: köşe konumları (x, y, z sırayla), üçgen indeksleri ve modeldeki renk.",
  " */",
  "export interface ModelPart {",
  "  readonly p: readonly number[];",
  "  readonly i: readonly number[];",
  "  /** Modelde tasarlanan renk (.mtl Kd). */",
  "  readonly c?: string;",
  "}",
  "",
  `export const ${name}: Readonly<Record<string, ModelPart>> = {`,
];
let triangles = 0;
for (const [id, part] of parts) {
  if (!part.index.length) continue;
  triangles += part.index.length / 3;
  const color = materials.get(part.material ?? id);
  lines.push(`  ${JSON.stringify(id)}: {`, `    p: [${part.verts.flat().join(",")}],`, `    i: [${part.index.join(",")}],`);
  if (color) lines.push(`    c: "${color}",`);
  lines.push("  },");
}
lines.push("};", "");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, lines.join("\n"), "utf8");
console.log(`${basename(source)} → ${relative(process.cwd(), out)}: ${parts.size} parça, ${triangles} üçgen, ${flipped} ters yüz düzeltildi.`);

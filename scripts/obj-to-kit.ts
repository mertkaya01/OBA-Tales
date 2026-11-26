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
 * Takipçi sınıf modelleri (Savaşçı, Okçu, Büyücü) için: npm run model:takipciler
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parseObj } from "./lib/objParse";

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
const model = parseObj(source, scale);

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
for (const [id, part] of model.parts) {
  lines.push(`  ${JSON.stringify(id)}: {`, `    p: [${part.p.join(",")}],`, `    i: [${part.i.join(",")}],`);
  if (part.c) lines.push(`    c: "${part.c}",`);
  lines.push("  },");
}
lines.push("};", "");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, lines.join("\n"), "utf8");
console.log(`${basename(source)} → ${relative(process.cwd(), out)}: ${model.parts.size} parça, ${model.triangles} üçgen, ${model.flipped} ters yüz düzeltildi.`);

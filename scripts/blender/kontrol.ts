/**
 * Blender'dan gelen karakter kitini oyunun gözüyle denetler: `npm run blender:kontrol [dosya.glb]`
 *
 * Oyunun yükleyicisiyle (src/world3d/characters/kitModel.ts) aynı yoldan okur ve her parça için
 * koddaki şekille karşılaştırır: değişmiş mi, kaç üçgen, boy, kol ve bacakların ekleme göre tarafı.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { Box3, type BufferGeometry } from "three";
import { PARTS } from "../../src/world3d/characters/characterKit";
import { parseKitModel } from "../../src/world3d/characters/kitModel";

const file = resolve(process.argv[2] ?? "public/models/karakter-kit.glb");
if (!existsSync(file)) {
  console.error(`✘ Bulunamadı: ${file}\n  Blender'da Alt+P ya da npm run blender:aktar`);
  process.exit(1);
}

const bytes = readFileSync(file);
const kit = await parseKitModel(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);

const flat = (g: BufferGeometry) => (g.index ? g.toNonIndexed() : g);
const triangles = (g: BufferGeometry) => flat(g).getAttribute("position").count / 3;
const box = (g: BufferGeometry) => new Box3().setFromBufferAttribute(flat(g).getAttribute("position") as never);
function area(g: BufferGeometry): number {
  const p = flat(g).getAttribute("position");
  let sum = 0;
  for (let i = 0; i < p.count; i += 3) {
    const [ax, ay, az] = [p.getX(i + 1) - p.getX(i), p.getY(i + 1) - p.getY(i), p.getZ(i + 1) - p.getZ(i)];
    const [bx, by, bz] = [p.getX(i + 2) - p.getX(i), p.getY(i + 2) - p.getY(i), p.getZ(i + 2) - p.getZ(i)];
    sum += Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx) / 2;
  }
  return sum;
}
const near = (a: number, b: number, tolerance = 0.002) => Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(b));

const warnings: string[] = [];
const rows: string[] = [];
let changed = 0;
let top = 0;
const codeTop = Math.max(...PARTS.map((p) => box(p.geometry).max.y));
for (const part of PARTS) {
  const geometry = kit.get(part.id);
  if (!geometry) {
    rows.push(`  ${part.id.padEnd(20)}     —  dosyada yok: koddaki şekil kullanılır`);
    continue;
  }
  const [a, b] = [box(geometry), box(part.geometry)];
  const same = a.min.distanceTo(b.min) < 0.002 && a.max.distanceTo(b.max) < 0.002 && near(area(geometry), area(part.geometry));
  if (!same) changed++;
  top = Math.max(top, a.max.y);
  const tris = triangles(geometry);
  rows.push(`  ${part.id.padEnd(20)}${String(tris).padStart(6)}  ${same ? "aynı" : `DEĞİŞTİ (kodda ${triangles(part.geometry)} üçgen)`}`);
  if (tris > 350) warnings.push(`${part.id}: ${tris} üçgen. 5000 kişilik kalabalıkta ağır gelir, ≤ 350 iyi olur.`);
  // Kol parçaları omuzdan, bacaklar kalçadan döner; köşenin tarafı x işaretinden seçilir.
  if ((part.arms || part.legs) && a.min.x < -0.05 && a.max.x > 0.05 && !(b.min.x < -0.05 && b.max.x > 0.05))
    warnings.push(`${part.id}: x = 0'ın iki yanına da taşıyor; ${part.arms ? "kol" : "bacak"} hareketinde ikiye ayrılır.`);
}
if (top > codeTop * 1.3 || (top > 0 && top < codeTop * 0.6))
  warnings.push(`En yüksek nokta ${top.toFixed(2)} birim, kodda ${codeTop.toFixed(2)}. Karakter ~4,4 birim boyunda olmalı: ölçeği ya da +Y Up ayarını kontrol et.`);

console.log(`OBA-Tales karakter kiti: ${file} (${(statSync(file).size / 1024).toFixed(1)} KB)`);
console.log(rows.join("\n"));
console.log(`\n  ${kit.size}/${PARTS.length} parça dosyada, ${changed} parça değişmiş. En yüksek nokta ${top.toFixed(2)} birim.`);
if (warnings.length) console.log(`\n  Uyarılar:\n${warnings.map((w) => `   ! ${w}`).join("\n")}`);
else console.log("  ✔ Sorun yok. Sayfayı yenile: karakterler bu şekilleriyle gelir.");

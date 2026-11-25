/**
 * Karakterleri modelleme programlarına aktarır: `npm run modeller`
 *
 * Kodla kurulan low-poly karakterleri OBJ + MTL dosyası olarak `modeller/referans/` klasörüne yazar.
 * Blockbench (File → Import → OBJ, "Generic Model") ve Blender (File → Import → Wavefront .obj) açar.
 *
 *   · Her parça ayrı bir nesnedir ve adı oyundaki parça kimliğidir (govde, kafa, sac, kalkan…). Kendi modelini
 *     yaparken bu adları korursan, yükleyici parçaları adlarından tanır ve her takipçinin rengini modele geçirir.
 *   · Renkler MTL dosyasında (her parçanın örnek rengi).
 *   · Birim: oyundaki birim. Ayak tabanı y = 0, yüz +z yönünde, boy ≈ 4,4 birim.
 *     `blockbench/` alt klasöründekiler 10 kat büyütülmüştür (≈ 44 piksel boy): Blockbench'te rahat çalışılır.
 *   · `modeller/kit.json`: bütün parçalar tek dosyada; `npm run blender:kit` bundan Blender dosyasını kurar.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CAST } from "../src/content/cast";
import { resolveLook } from "../src/game/sprites/composeSprite";
import { createStarterCharacter } from "../src/lib/rules";
import type { Character, Platform, Rarity } from "../src/types";
import { PARTS, kitChoice, type KitChoice } from "../src/world3d/characters/characterKit";

const OUT = resolve("modeller/referans");
const SCALES = [
  { dir: OUT, scale: 1, note: "1 birim = oyundaki birim (boy ≈ 4,4)" },
  { dir: resolve(OUT, "blockbench"), scale: 10, note: "10 kat büyütülmüş (boy ≈ 44 birim): Blockbench için" },
];

/** Yalnızca ortak gövde: üzerine kendi karakterini modellemek için çıplak kalıp. */
const BASE_PARTS = new Set(["bacaklar", "cizmeler", "govde", "etek", "yaka", "kemer", "toka", "kollar", "eller", "atki", "kafa", "gozler", "kaslar", "burun", "kulaklar", "agiz", "sac"]);

const now = new Date("2026-11-25T12:00:00Z");

/** İstenen seçimleri veren bir örnek takipçi bulur (seçimler kimlikten türediği için adları dener). */
function sample(platform: Platform, rarity: Rarity, wanted: Partial<KitChoice>): Character {
  for (let i = 0; i < 5000; i++) {
    const c: Character = { ...createStarterCharacter({ handle: `referans_${platform}_${i}`, platform, region: "kutada", coordinates: { x: 1600, y: 1140 }, now }), rarity };
    const k = kitChoice(c, resolveLook(c));
    if (Object.entries(wanted).every(([key, value]) => k[key as keyof KitChoice] === value)) return c;
  }
  throw new Error(`Uygun örnek bulunamadı: ${platform} ${JSON.stringify(wanted)}`);
}

const hexToRgb = (hex: string) => [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(4)).join(" ");

function exportCharacter(name: string, character: Character, filter?: (id: string) => boolean): void {
  const look = resolveLook(character);
  const parts = PARTS.filter((p) => p.applies(character, look, { inRaid: false }) && (!filter || filter(p.id)));
  for (const { dir, scale, note } of SCALES) {
    mkdirSync(dir, { recursive: true });
    const obj: string[] = [
      `# OBA-Tales referans karakteri: ${name}`,
      `# ${note}. Ayak tabanı y = 0, yüz +z yönünde.`,
      "# Her nesnenin adı oyundaki parça kimliğidir; kendi modelinde bu adları koru.",
      `mtllib ${name}.mtl`,
    ];
    const mtl: string[] = [`# OBA-Tales referans renkleri: ${name}`];
    let vertexOffset = 0;
    for (const part of parts) {
      const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
      geometry.computeVertexNormals();
      const pos = geometry.getAttribute("position");
      const nor = geometry.getAttribute("normal");
      obj.push(`o ${part.id}`, `usemtl ${part.id}`);
      for (let i = 0; i < pos.count; i++) obj.push(`v ${(pos.getX(i) * scale).toFixed(4)} ${(pos.getY(i) * scale).toFixed(4)} ${(pos.getZ(i) * scale).toFixed(4)}`);
      for (let i = 0; i < nor.count; i++) obj.push(`vn ${nor.getX(i).toFixed(4)} ${nor.getY(i).toFixed(4)} ${nor.getZ(i).toFixed(4)}`);
      for (let i = 0; i < pos.count; i += 3) {
        const [a, b, c] = [i + 1, i + 2, i + 3].map((k) => k + vertexOffset);
        obj.push(`f ${a}//${a} ${b}//${b} ${c}//${c}`);
      }
      vertexOffset += pos.count;
      mtl.push(`newmtl ${part.id}`, `Kd ${hexToRgb(part.color(look))}`, "Ka 0 0 0", "Ks 0 0 0", "d 1", "illum 1", "");
    }
    writeFileSync(resolve(dir, `${name}.obj`), `${obj.join("\n")}\n`, "utf8");
    writeFileSync(resolve(dir, `${name}.mtl`), `${mtl.join("\n")}\n`, "utf8");
  }
  console.log(`  ${name.padEnd(24)} ${parts.length} parça`);
}

console.log("OBA-Tales referans modelleri → modeller/referans/");
const kalkaneri = sample("instagram", "nadir", { hat: "tolga", weapon: "kilic", beard: "kisa" });
exportCharacter("taban", kalkaneri, (id) => BASE_PARTS.has(id));
exportCharacter("kalkaneri", kalkaneri);
exportCharacter("kalkaneri-borklu-baltali", sample("instagram", "siradan", { hat: "bork", weapon: "balta", beard: "uzun" }));
exportCharacter("okyeli", sample("tiktok", "nadir", { beard: "biyik" }));
exportCharacter("ocakcan", sample("youtube", "nadir", { hat: "kalpak", kopuz: true, beard: null }));
exportCharacter("efsanevi-ocakcan", sample("youtube", "efsanevi", { hat: null, beard: "kisa" })); // büyücü-şifacı modeli
for (const member of CAST) exportCharacter(`kadro-${member.id}`, member);

// ── Blender kiti: bütün parçalar tek dosyada (npm run blender:kit bunu .blend dosyasına çevirir) ──
const GROUPS: Record<string, string[]> = {
  "01 Govde": ["bacaklar", "cizmeler", "cizme-kurku", "govde", "etek", "altin-etek", "yaka", "kemer", "toka", "kese", "nakis", "nazar", "nazar-ici", "nazar-gozu", "kollar", "eller", "atki"],
  "02 Yuz": ["kafa", "gozler", "kaslar", "burun", "kulaklar", "agiz", "biyik", "kisa-sakal", "uzun-sakal"],
  "03 Sac": ["sac", "uzun-sac", "topuz", "percem", "orgu"],
  "04 Baslik": ["tolga", "tolga-tuyu", "bork", "bork-kurku", "kalpak", "kalpak-tepesi", "kulah", "kulah-bandi", "tac"],
  "05 Kalkaneri": ["kurk-yaka", "omuzluk", "kalkan", "kalkan-kabarasi", "kalkan-amblemi", "kalkan-cemberi", "balta-sapi", "balta-agzi", "kilic", "kilic-kabzasi"],
  "06 Okyeli": ["baslik", "tuy", "gozluk", "yay", "kiris", "bileklik", "kayis", "okluk", "oklar"],
  "07 Ocakcan": ["davul", "davul-tokmaklari", "fener", "kopuz", "yumusak-pelerin"],
  "08 Nadirlik ve kadro": ["uzun-pelerin", "pelerin-runlari", "madalyon", "kadim-tuy", "akin-isareti", "asa", "asa-tasi"],
};
const groupOf = (id: string) =>
  id.startsWith("buyucu-") ? "10 Buyucu-sifaci" : (Object.entries(GROUPS).find(([, ids]) => ids.includes(id))?.[0] ?? "09 Diger");
// Her parçanın örnek rengi: o parçayı taşıyan ilk örnek karakterden. Açılışta görünen: tolgalı, kılıçlı Kalkaneri.
const samples = [kalkaneri, sample("tiktok", "nadir", { beard: "biyik" }), sample("youtube", "efsanevi", { hat: "kalpak", kopuz: true }), ...CAST];
const kit = PARTS.map((part) => {
  const owner = samples.find((c) => part.applies(c, resolveLook(c), { inRaid: true })) ?? kalkaneri;
  const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
  const positions = Array.from(geometry.getAttribute("position").array as ArrayLike<number>, (v) => Math.round(v * 10000) / 10000);
  return {
    id: part.id,
    group: groupOf(part.id),
    color: part.color(resolveLook(owner)),
    visible: part.applies(kalkaneri, resolveLook(kalkaneri), { inRaid: false }),
    arms: part.arms ?? false,
    legs: part.legs ?? false,
    positions,
  };
});
writeFileSync(resolve("modeller/kit.json"), `${JSON.stringify({ version: 1, note: "Oyun koordinatı: y yukarı, yüz +z. Üçgenler sırayla.", parts: kit })}\n`, "utf8");
console.log(`  kit.json                 ${kit.length} parça (Blender kiti için)`);
console.log("Bitti. Blockbench: File → Import → OBJ (Generic Model). Blender: npm run blender:kit (ya da File → Import → Wavefront).");

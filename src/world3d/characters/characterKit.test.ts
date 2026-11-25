import { Box3 } from "three";
import { describe, expect, it } from "vitest";
import { CAST } from "../../content/cast";
import { resolveLook } from "../../game/sprites/composeSprite";
import { createStarterCharacter } from "../../lib/rules";
import type { Character, Rarity } from "../../types";
import { generateTerrain } from "../../game/terrain";
import { placeCharacters } from "../living/placement";
import { groundY } from "../worldScale";
import { HIT_GEOMETRY, PARTS, kitChoice, partsOf } from "./characterKit";
import { buildInstanceData, characterScale } from "./instanceData";

const now = new Date("2026-11-24T15:00:00Z");
const make = (handle: string, platform: Character["platform"], rarity: Rarity = "siradan"): Character => ({
  ...createStarterCharacter({ handle, platform, region: "akinburnu", coordinates: { x: 215, y: 560 }, now }),
  rarity,
});
const parts = (c: Character, inRaid = false) => partsOf(c, resolveLook(c), { inRaid });

describe("karakter parça kiti", () => {
  it("her karakter ortak gövdeyi taşır", () => {
    for (const platform of ["instagram", "tiktok", "youtube"] as const) {
      const p = parts(make("ornek", platform));
      for (const id of ["bacaklar", "cizmeler", "govde", "yaka", "kemer", "toka", "kollar", "eller", "atki", "kafa", "gozler", "kaslar", "burun"]) {
        expect(p, `${platform}:${id}`).toContain(id);
      }
    }
  });

  it("sınıflar kendi ekipmanını taşır, başkasınınkini taşımaz", () => {
    const kalkaneri = parts(make("k", "instagram"));
    const okyeli = parts(make("o", "tiktok"));
    const ocakcan = parts(make("c", "youtube"));
    expect(kalkaneri).toEqual(expect.arrayContaining(["kalkan", "kalkan-kabarasi", "omuzluk", "kurk-yaka", "sac"]));
    expect(kalkaneri.includes("balta-sapi") !== kalkaneri.includes("kilic")).toBe(true);
    expect(kalkaneri).not.toContain("yay");
    expect(okyeli).toEqual(expect.arrayContaining(["baslik", "tuy", "gozluk", "yay", "kiris", "okluk", "oklar"]));
    for (const hat of ["tolga", "bork", "kalpak", "kulah"]) expect(okyeli).not.toContain(hat);
    expect(okyeli).not.toContain("sac");
    expect(ocakcan).toEqual(expect.arrayContaining(["davul", "fener", "yumusak-pelerin"]));
    expect(ocakcan).not.toContain("kalkan");
  });

  it("nadirlik yükseldikçe süs eklenir", () => {
    const base = make("kar_tanesi", "instagram");
    expect(parts({ ...base, rarity: "nadir" })).not.toContain("uzun-pelerin");
    const epic = parts({ ...base, rarity: "destansi" });
    expect(epic).toEqual(expect.arrayContaining(["uzun-pelerin", "madalyon", "altin-etek"]));
    expect(epic).not.toContain("etek");
    expect(epic).not.toContain("kadim-tuy");
    expect(parts({ ...base, rarity: "efsanevi" })).toEqual(expect.arrayContaining(["pelerin-runlari"]));
  });

  it("takipçiler kişiye özgü: başlık, sakal, perçem ve silah çeşitleri birbirinden farklı", () => {
    const crowd = Array.from({ length: 240 }, (_, i) => make(`yoldas_${i}`, (["instagram", "tiktok", "youtube"] as const)[i % 3]));
    const kits = crowd.map((c) => kitChoice(c, resolveLook(c)));
    expect(new Set(kits.map((k) => k.hat)).size).toBeGreaterThanOrEqual(5); // 4 başlık + başlıksız
    expect(new Set(kits.map((k) => k.beard)).size).toBe(4);
    expect(kits.some((k) => k.bangs)).toBe(true);
    expect(kits.some((k) => k.braids)).toBe(true);
    expect(kits.some((k) => k.kopuz)).toBe(true);
    // Aynı kimlik her zaman aynı görünür.
    expect(kitChoice(crowd[5], resolveLook(crowd[5]))).toEqual(kits[5]);
    // Başlıklar tek: aynı karakterde iki başlık, başlıkla topuz ya da perçem olmaz.
    for (const c of crowd) {
      const p = parts(c);
      const hats = ["tolga", "bork", "kalpak", "kulah"].filter((h) => p.includes(h));
      expect(hats.length).toBeLessThanOrEqual(1);
      if (hats.length) expect(p).not.toContain("topuz");
      if (hats.length) expect(p).not.toContain("percem");
      expect(["biyik", "kisa-sakal", "uzun-sakal"].filter((h) => p.includes(h)).length).toBeLessThanOrEqual(1);
    }
  });

  it("kadronun imzası: Baturay tüylü tolgalı ve kılıçlı, Dede Toygar sakallı, asalı bir büyücü-şifacı", () => {
    const baturay = CAST.find((c) => c.id === "baturay")!;
    const dede = CAST.find((c) => c.id === "dede_toygar")!;
    expect(parts(baturay)).toEqual(expect.arrayContaining(["tolga", "tolga-tuyu", "kilic", "kisa-sakal"]));
    expect(parts(dede)).toEqual(expect.arrayContaining(["buyucu-uzun-sakal", "buyucu-asa", "buyucu-asa-tasi", "buyucu-sapka"]));
    expect(parts(dede)).not.toContain("kopuz");
    // Öteki kadro Ocakcanları kendi görünüşünde kalır.
    for (const id of ["kursat", "yalvac"]) expect(parts(CAST.find((c) => c.id === id)!), id).toContain("fener");
  });

  it("destansı ve efsanevi Ocakcanlar büyücü-şifacı modelini giyer, ötekiler giymez", () => {
    const base = make("sifaci", "youtube");
    const wizardParts = PARTS.filter((p) => p.id.startsWith("buyucu-")).map((p) => p.id);
    expect(wizardParts.length).toBeGreaterThan(35);
    for (const rarity of ["siradan", "nadir"] as const) {
      const p = parts({ ...base, rarity });
      expect(p.filter((id) => id.startsWith("buyucu-")), rarity).toEqual([]);
    }
    expect(parts({ ...make("kalkanci", "instagram"), rarity: "efsanevi" }).some((id) => id.startsWith("buyucu-"))).toBe(false);
    const epic = parts({ ...base, rarity: "destansi" });
    expect(epic).toEqual(expect.arrayContaining(["buyucu-govde", "buyucu-sapka", "buyucu-asa", "buyucu-iksir", "buyucu-uzun-pelerin"]));
    expect(epic).not.toContain("buyucu-pelerin-runlari");
    // Ortak gövdeden ve sınıf ekipmanından hiçbir şey kalmaz.
    expect(epic.filter((id) => !id.startsWith("buyucu-"))).toEqual([]);
    expect(parts({ ...base, rarity: "efsanevi" })).toContain("buyucu-pelerin-runlari");
    expect(parts({ ...base, rarity: "destansi" }, true)).toContain("buyucu-akin-isareti");
    expect(parts({ ...base, rarity: "destansi" }, true)).not.toContain("akin-isareti");
  });

  it("özel kahramanlar kendi parçalarını giyer: egetunce kova şapkalı ve Gün Kılıçlı, mhellingtr Yıldız Yaylı", () => {
    const ege = CAST.find((c) => c.id === "egetunce")!;
    const mhe = CAST.find((c) => c.id === "mhellingtr")!;
    const pe = parts(ege);
    const pm = parts(mhe);
    expect(pe).toEqual(expect.arrayContaining(["egetunce-sapka", "egetunce-sapka-gozleri", "egetunce-kilic", "egetunce-kilic-isigi", "egetunce-lavanta"]));
    expect(pm).toEqual(expect.arrayContaining(["mhellingtr-yay", "mhellingtr-kiris", "mhellingtr-pelerin-yildizlari", "mhellingtr-yildiz-taci", "mhellingtr-okluk"]));
    expect(pe.every((id) => id.startsWith("egetunce-")), pe.join()).toBe(true);
    expect(pm.every((id) => id.startsWith("mhellingtr-")), pm.join()).toBe(true);
    expect(parts(ege, true)).toContain("akin-isareti");
    // Uzun kılıç dışa eğik yükselir: ucu şapkanın kenarının dışında kalır.
    const blade = PARTS.find((p) => p.id === "egetunce-kilic")!.geometry;
    blade.computeBoundingBox();
    expect(blade.boundingBox!.max.y).toBeGreaterThan(3.9);
    expect(blade.boundingBox!.min.x).toBeLessThan(-1.5);
    // Kılıç ve yay sağ elde (x < 0), lavanta sol elde (x > 0): kollarla doğru tarafta sallanır.
    for (const [id, side] of [["egetunce-kilic", -1], ["mhellingtr-yay", -1], ["egetunce-lavanta", 1]] as const) {
      const g = PARTS.find((p) => p.id === id)!.geometry;
      g.computeBoundingBox();
      expect(side < 0 ? g.boundingBox!.max.x < 0 : g.boundingBox!.min.x > 0, id).toBe(true);
    }
  });

  it("elde tutulanlar kollarla birlikte hareket eder", () => {
    for (const id of ["kollar", "eller", "kalkan", "balta-sapi", "kilic", "yay", "fener", "kopuz", "asa", "buyucu-kollar", "buyucu-eller", "buyucu-asa", "buyucu-asa-tasi"]) {
      expect(PARTS.find((p) => p.id === id)?.arms, id).toBe(true);
    }
    expect(PARTS.find((p) => p.id === "govde")?.arms).toBeFalsy();
    // Kemerdeki iksir ve kese yürürken sallanmaz; asa kolun kendi tarafında (x < 0) durur.
    expect(PARTS.find((p) => p.id === "buyucu-iksir")?.arms).toBeFalsy();
    const staff = PARTS.find((p) => p.id === "buyucu-asa")!.geometry;
    staff.computeBoundingBox();
    expect(staff.boundingBox!.max.x).toBeLessThan(0);
  });

  it("akın işareti yalnızca aktif akındakilerde", () => {
    const c = make("akinci", "tiktok");
    expect(parts(c, true)).toContain("akin-isareti");
    expect(parts(c, false)).not.toContain("akin-isareti");
  });

  it("kadro üyelerinin renkleri portreleriyle aynı kaynaktan gelir", () => {
    const baturay = CAST.find((c) => c.id === "baturay")!;
    const body = PARTS.find((p) => p.id === "govde")!;
    expect(body.color(resolveLook(baturay))).toBe("#2a3f6b");
  });

  it("parçalar makul bir boy ve genişlikte, ayak tabanı yerde", () => {
    const all = new Box3();
    for (const part of PARTS) {
      part.geometry.computeBoundingBox();
      all.union(part.geometry.boundingBox!);
      expect(part.color(resolveLook(make("renk", "instagram"))), part.id).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(all.min.y).toBeCloseTo(0, 1);
    expect(all.max.y).toBeLessThan(6.1); // büyücünün akın işareti sivri şapkanın üstünde
    expect(all.max.x - all.min.x).toBeLessThan(4.5);
    HIT_GEOMETRY.computeBoundingBox();
    expect(HIT_GEOMETRY.boundingBox!.max.y).toBeGreaterThan(4.4);
  });
});

describe("kopya verisi", () => {
  const terrain = generateTerrain({ seed: 20261124 });
  const followers = [make("okcu_bir", "tiktok"), make("kalkan_iki", "instagram", "efsanevi"), make("ocak_uc", "youtube", "nadir"), make("buyucu_dort", "youtube", "efsanevi")];
  const everyone = [...CAST, ...followers];
  const placements = placeCharacters(everyone, terrain);
  const data = buildInstanceData(everyone, placements, new Set(["alptug", "okcu_bir"]));
  const part = (id: string) => data.parts.find((p) => p.spec.id === id)!;
  const wizards = everyone.filter((c) => kitChoice(c, resolveLook(c)).wizard);
  const heroes = everyone.filter((c) => kitChoice(c, resolveLook(c)).hero);

  it("her parçanın kopya sayısı o parçayı taşıyan karakter sayısı kadar", () => {
    expect(data.ids).toHaveLength(everyone.length);
    expect(wizards.map((c) => c.id).sort()).toEqual(["buyucu_dort", "dede_toygar"]);
    expect(heroes.map((c) => c.id).sort()).toEqual(["egetunce", "mhellingtr"]);
    expect(part("govde").count).toBe(everyone.length - wizards.length - heroes.length);
    expect(part("buyucu-govde").count).toBe(wizards.length);
    expect(part("kalkan").count).toBe(everyone.filter((c) => c.class.id === "kalkaneri" && !heroes.includes(c)).length);
    expect(part("yay").count).toBe(everyone.filter((c) => c.class.id === "okyeli" && !heroes.includes(c)).length);
    expect(part("egetunce-kilic").count).toBe(1);
    expect(part("mhellingtr-yay").count).toBe(1);
    expect(part("akin-isareti").count).toBe(2);
    expect(part("pelerin-runlari").count + part("buyucu-pelerin-runlari").count).toBe(everyone.filter((c) => c.rarity === "efsanevi").length);
  });

  it("karakterler kendi koordinatlarında ve zeminin üstünde durur", () => {
    everyone.forEach((c, i) => {
      const m = data.matrices.subarray(i * 16, i * 16 + 16);
      expect(m[12]).toBeCloseTo(c.coordinates.x);
      expect(m[14]).toBeCloseTo(c.coordinates.y);
      expect(m[13]).toBeCloseTo(groundY(terrain, c.coordinates));
      // Dönüş matriste değil (ekran kartında); ölçek köşegende.
      expect(m[0]).toBeCloseTo(placements.get(c.id)!.scale);
      expect(m[2]).toBeCloseTo(0);
    });
  });

  it("her parça kendi kopyalarının hareket bilgisini taşır", () => {
    const yay = part("yay");
    const okcu = placements.get("okcu_bir")!;
    const k = everyone.filter((c) => c.class.id === "okyeli" && !heroes.includes(c)).findIndex((c) => c.id === "okcu_bir");
    expect([...yay.motion.subarray(k * 4, k * 4 + 4)].map((v) => +v.toFixed(4))).toEqual(
      [okcu.motion.radius, okcu.motion.seed, okcu.motion.yaw, okcu.motion.cheer].map((v) => +Math.fround(v).toFixed(4)),
    );
    expect(data.motion).toHaveLength(everyone.length * 4);
  });

  it("kadro takipçilerden iri, renkler 0–1 aralığında", () => {
    expect(characterScale(CAST[0])).toBeGreaterThan(characterScale(followers[0]));
    for (const p of data.parts) {
      for (const v of p.colors) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

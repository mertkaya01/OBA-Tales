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
/** Kodla kurulan kit artık kadronun: onu denemek için kadrodan sayılan (takipçi olmayan) bir karakter. */
const makeKit = (handle: string, platform: Character["platform"], rarity: Rarity = "siradan"): Character => ({ ...make(handle, platform, rarity), roleType: "side" });
const parts = (c: Character, inRaid = false) => partsOf(c, resolveLook(c), { inRaid });
const box = (id: string) => {
  const g = PARTS.find((p) => p.id === id)!.geometry;
  g.computeBoundingBox();
  return g.boundingBox!;
};

describe("takipçi modelleri", () => {
  const CLASSES = [
    ["instagram", "kalkaneri"],
    ["tiktok", "okyeli"],
    ["youtube", "ocakcan"],
  ] as const;

  it("takipçiler sınıflarının modelini giyer: gövde ortak, ekipman kademeyle büyür", () => {
    const sizes = { kalkaneri: [30, 40, 40], okyeli: [30, 37, 39], ocakcan: [32, 37, 43] };
    for (const [platform, cls] of CLASSES) {
      (["siradan", "nadir", "destansi"] as const).forEach((rarity, t) => {
        const p = parts(make(`model_${cls}`, platform, rarity));
        expect(p.every((id) => id.startsWith(`${cls}-`)), `${cls}:${rarity} ${p.join()}`).toBe(true);
        // Modelin parçaları ve en uzak görünüm için 4 parçalık siluet (bacak, gövde, kafa, başlık ya da saç).
        expect(p.filter((id) => !id.includes("-uzak-")), `${cls}:${rarity}`).toHaveLength(sizes[cls][t]);
        expect(p.filter((id) => id.includes("-uzak-")), `${cls}:${rarity}`).toHaveLength(4);
        expect(p).toEqual(expect.arrayContaining([`${cls}-kafa`, `${cls}-govde`, `${cls}-bacaklar`, `${cls}-kollar`]));
      });
    }
    // Efsanevi Kalkaneri ve Okyeli şimdilik destansı modeli giyer.
    expect(parts(make("efsane", "instagram", "efsanevi")).sort()).toEqual(parts(make("efsane", "instagram", "destansi")).sort());
    expect(parts(make("efsane", "tiktok", "efsanevi")).sort()).toEqual(parts(make("efsane", "tiktok", "destansi")).sort());
  });

  it("ten ve saç kişiye özgü; kumaş ve zırh kademenin rengi", () => {
    const crowd = Array.from({ length: 40 }, (_, i) => make(`renk_${i}`, "instagram", "nadir"));
    const head = PARTS.find((p) => p.id === "kalkaneri-kafa")!;
    const hair = PARTS.find((p) => p.id === "kalkaneri-sac")!;
    const body = PARTS.find((p) => p.id === "kalkaneri-govde")!;
    expect(new Set(crowd.map((c) => head.color(resolveLook(c), c))).size).toBeGreaterThan(2);
    expect(new Set(crowd.map((c) => hair.color(resolveLook(c), c))).size).toBeGreaterThan(2);
    expect(new Set(crowd.map((c) => body.color(resolveLook(c), c)))).toEqual(new Set(["#36486a"]));
    const common = make("renk_sade", "instagram", "siradan");
    expect(body.color(resolveLook(common), common)).toBe("#4a423a");
  });

  it("silahlar kolla, çizmeler bacakla birlikte modelin iskeletine göre sallanır", () => {
    for (const prefix of ["kalkaneri-kilic", "kalkaneri-kalkan", "okyeli-yay", "ocakcan-asa", "kalkaneri-kollar", "okyeli-eller"]) {
      const group = PARTS.filter((p) => p.id.startsWith(prefix));
      expect(group.length, prefix).toBeGreaterThan(0);
      for (const p of group) {
        expect(p.arms, p.id).toBe(true);
        expect(p.rig, p.id).toBe("takipci");
      }
    }
    expect(PARTS.find((p) => p.id === "kalkaneri-bacaklar")?.legs).toBe(true);
    // Kılıç ve asa sağ elde (x < 0), kalkan ve yay sol elde (x > 0).
    const side = (prefix: string) => PARTS.filter((p) => p.id.startsWith(prefix)).map((p) => box(p.id));
    for (const b of side("kalkaneri-kilic")) expect(b.max.x).toBeLessThan(0);
    for (const b of side("ocakcan-asa")) expect(b.max.x).toBeLessThan(0);
    for (const b of side("kalkaneri-kalkan")) expect(b.min.x).toBeGreaterThan(0);
    for (const b of side("okyeli-yay")) expect(b.min.x).toBeGreaterThan(0);
  });

  it("akında takipçinin işareti şapkanın üstünde", () => {
    const c = make("akinci", "youtube", "destansi");
    expect(parts(c, true)).toContain("takipci-akin-isareti");
    expect(parts(c, true)).not.toContain("akin-isareti");
    expect(parts(c, false)).not.toContain("takipci-akin-isareti");
  });
});

describe("kadro kiti (kodla kurulan)", () => {
  it("her karakter ortak gövdeyi taşır", () => {
    for (const platform of ["instagram", "tiktok", "youtube"] as const) {
      const p = parts(makeKit("ornek", platform));
      for (const id of ["bacaklar", "cizmeler", "govde", "yaka", "kemer", "toka", "kollar", "eller", "atki", "kafa", "gozler", "kaslar", "burun"]) {
        expect(p, `${platform}:${id}`).toContain(id);
      }
    }
  });

  it("sınıflar kendi ekipmanını taşır, başkasınınkini taşımaz", () => {
    const kalkaneri = parts(makeKit("k", "instagram"));
    const okyeli = parts(makeKit("o", "tiktok"));
    const ocakcan = parts(makeKit("c", "youtube"));
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
    const base = makeKit("kar_tanesi", "instagram");
    expect(parts({ ...base, rarity: "nadir" })).not.toContain("uzun-pelerin");
    const epic = parts({ ...base, rarity: "destansi" });
    expect(epic).toEqual(expect.arrayContaining(["uzun-pelerin", "madalyon", "altin-etek"]));
    expect(epic).not.toContain("etek");
    expect(epic).not.toContain("kadim-tuy");
    expect(parts({ ...base, rarity: "efsanevi" })).toEqual(expect.arrayContaining(["pelerin-runlari"]));
  });

  it("kişiye özgü: başlık, sakal, perçem ve silah çeşitleri birbirinden farklı", () => {
    const crowd = Array.from({ length: 240 }, (_, i) => makeKit(`yoldas_${i}`, (["instagram", "tiktok", "youtube"] as const)[i % 3]));
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

  it("kadro insansı gövdeyi kendi eşyalarıyla giyer: Baturay tolgalı, Dede Toygar asalı, Kürşat fenerli", () => {
    const member = (id: string) => CAST.find((c) => c.id === id)!;
    const baturay = parts(member("baturay"));
    expect(baturay).toEqual(expect.arrayContaining(["kalkaneri-govde", "kalkaneri-kafa", "baturay-tolga", "baturay-tolga-tuyu", "baturay-sakal", "baturay-atki"]));
    expect(baturay.some((id) => id.startsWith("kalkaneri-kilic"))).toBe(true);
    const dede = parts(member("dede_toygar"));
    expect(dede.some((id) => id.startsWith("ocakcan-asa"))).toBe(true);
    expect(dede.some((id) => id.startsWith("ocakcan-sakal"))).toBe(true);
    expect(dede.some((id) => id.startsWith("buyucu-"))).toBe(false); // artık büyücü-şifacı değil
    const kursat = parts(member("kursat"));
    expect(kursat).toEqual(expect.arrayContaining(["kursat-kalpak", "kursat-fener"]));
    expect(kursat.some((id) => id.startsWith("ocakcan-asa") || id.startsWith("ocakcan-sapka"))).toBe(false);
    const isikay = parts(member("isikay"));
    expect(isikay).toEqual(expect.arrayContaining(["isikay-tac", "isikay-uzun-sac"]));
    expect(isikay.some((id) => id.startsWith("okyeli-kapuson"))).toBe(false);
    // Kadroda kumaş kişinin kendi rengi, takipçide kademenin.
    const body = PARTS.find((p) => p.id === "kalkaneri-govde")!;
    const leader = member("baturay");
    expect(body.color(resolveLook(leader), leader)).toBe("#2a3f6b");
  });

  it("efsanevi Ocakcanlar büyücü-şifacı modelini giyer; öteki kademeler büyücü takipçi modelini", () => {
    const base = make("sifaci", "youtube");
    const wizardParts = PARTS.filter((p) => p.id.startsWith("buyucu-")).map((p) => p.id);
    expect(wizardParts.length).toBeGreaterThan(35);
    for (const rarity of ["siradan", "nadir", "destansi"] as const) {
      const p = parts({ ...base, rarity });
      expect(p.filter((id) => id.startsWith("buyucu-")), rarity).toEqual([]);
      expect(p.every((id) => id.startsWith("ocakcan-")), rarity).toBe(true);
    }
    expect(parts({ ...make("kalkanci", "instagram"), rarity: "efsanevi" }).some((id) => id.startsWith("buyucu-"))).toBe(false);
    const legend = parts({ ...base, rarity: "efsanevi" });
    expect(legend).toEqual(expect.arrayContaining(["buyucu-govde", "buyucu-sapka", "buyucu-asa", "buyucu-iksir", "buyucu-uzun-pelerin", "buyucu-pelerin-runlari"]));
    // Ortak gövdeden ve sınıf ekipmanından hiçbir şey kalmaz.
    expect(legend.filter((id) => !id.startsWith("buyucu-"))).toEqual([]);
    expect(parts({ ...base, rarity: "efsanevi" }, true)).toContain("buyucu-akin-isareti");
    expect(parts({ ...base, rarity: "efsanevi" }, true)).not.toContain("akin-isareti");
  });

  it("egetunce ve mhellingtr insansı gövdede: kova şapka ve Gün Kılıcı, kapüşon, hale ve takımyıldızlı pelerin", () => {
    const ege = CAST.find((c) => c.id === "egetunce")!;
    const mhe = CAST.find((c) => c.id === "mhellingtr")!;
    const pe = parts(ege);
    const pm = parts(mhe);
    expect(pe).toEqual(expect.arrayContaining(["kalkaneri-govde", "egetunce-sapka", "egetunce-sapka-gozleri", "egetunce-kilic", "egetunce-kilic-isigi", "egetunce-lavanta", "egetunce-uzun-sac"]));
    expect(pe.some((id) => id.startsWith("kalkaneri-kalkan") || id.startsWith("kalkaneri-kilic") || id.startsWith("kalkaneri-yelek"))).toBe(false);
    expect(pm).toEqual(expect.arrayContaining(["okyeli-govde", "okyeli-gozler", "okyeli-sac", "mhellingtr-hale", "mhellingtr-hale-yildizi", "mhellingtr-uzun-pelerin", "mhellingtr-takimyildiz", "mhellingtr-ok-kristalleri"]));
    expect(pm.some((id) => id.startsWith("okyeli-kapuson"))).toBe(true);
    expect(pm.some((id) => id.startsWith("okyeli-yay"))).toBe(true);
    // Yüzü ve teni normal: kafa takipçinin değil kendi ten rengini alır.
    expect(PARTS.find((p) => p.id === "okyeli-kafa")!.color(resolveLook(mhe), mhe)).toBe("#eebd94");
    expect(parts(ege, true)).toContain("takipci-akin-isareti");
    // Uzun kılıç dışa eğik yükselir: ucu şapkanın kenarının dışında kalır.
    const blade = box("egetunce-kilic");
    expect(blade.max.y).toBeGreaterThan(3.9);
    expect(blade.min.x).toBeLessThan(-1.45);
    // Kılıç sağ elde (x < 0), lavanta ve yay sol elde (x > 0): kollarla doğru tarafta sallanır.
    expect(box("egetunce-kilic").max.x).toBeLessThan(0);
    expect(box("egetunce-lavanta").min.x).toBeGreaterThan(0);
    expect(box("mhellingtr-yay-uclari").min.x).toBeGreaterThan(0);
    for (const id of ["egetunce-kilic", "egetunce-lavanta", "mhellingtr-yay-uclari"]) expect(PARTS.find((p) => p.id === id)?.rig, id).toBe("takipci");
  });

  it("BinTaş alev kadını modelini giyer: alev taç, kanatlar, ateş küresi; akın işareti saçının üstünde", () => {
    const bintas = CAST.find((c) => c.id === "bintas")!;
    const p = parts(bintas);
    expect(p).toEqual(expect.arrayContaining(["bintas-tac", "bintas-alev-saci", "bintas-alev-kanatlari", "bintas-alev-kuresi", "bintas-alev-dilleri"]));
    expect(p.every((id) => id.startsWith("bintas-")), p.join()).toBe(true);
    const raid = parts(bintas, true);
    expect(raid).toContain("bintas-akin-isareti");
    expect(raid).not.toContain("akin-isareti");
    expect(PARTS.find((x) => x.id === "bintas-alev-kuresi")?.arms).toBe(true);
    expect(PARTS.find((x) => x.id === "bintas-alev-saci")?.glow).toBe(true);
    expect(PARTS.find((x) => x.id === "bintas-etek")!.color(resolveLook(bintas))).toBe("#b4211c");
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
    const c = makeKit("akinci", "tiktok");
    expect(parts(c, true)).toContain("akin-isareti");
    expect(parts(c, false)).not.toContain("akin-isareti");
  });

  it("kadro üyelerinin renkleri portreleriyle aynı kaynaktan gelir", () => {
    const baturay = CAST.find((c) => c.id === "baturay")!;
    const body = PARTS.find((p) => p.id === "kalkaneri-govde")!;
    expect(body.color(resolveLook(baturay), baturay)).toBe("#2a3f6b");
  });

  it("parçalar makul bir boy ve genişlikte, ayak tabanı yerde", () => {
    const all = new Box3();
    for (const part of PARTS) {
      part.geometry.computeBoundingBox();
      all.union(part.geometry.boundingBox!);
      const sample = make("renk", "instagram");
      expect(part.color(resolveLook(sample), sample), part.id).toMatch(/^#[0-9a-f]{6}$/i);
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
  const models = everyone.filter((c) => kitChoice(c, resolveLook(c)).model);
  const kitOnly = (c: Character) => !heroes.includes(c) && !models.includes(c);

  it("her parçanın kopya sayısı o parçayı taşıyan karakter sayısı kadar", () => {
    expect(data.ids).toHaveLength(everyone.length);
    expect(wizards.map((c) => c.id).sort()).toEqual(["buyucu_dort"]);
    expect(heroes.map((c) => c.id).sort()).toEqual(["bintas"]);
    // Kadro (BinTaş dışında) ve takipçiler insansı modeli giyer.
    expect(models.map((c) => c.id).sort()).toEqual([...CAST.filter((c) => c.id !== "bintas").map((c) => c.id), "kalkan_iki", "ocak_uc", "okcu_bir"].sort());
    expect(part("govde").count).toBe(everyone.length - wizards.length - heroes.length - models.length);
    for (const cls of ["kalkaneri", "okyeli", "ocakcan"]) expect(part(`${cls}-govde`).count, cls).toBe(models.filter((c) => c.class.id === cls).length);
    expect(part("buyucu-govde").count).toBe(wizards.length);
    expect(part("kalkan").count).toBe(everyone.filter((c) => c.class.id === "kalkaneri" && kitOnly(c)).length);
    expect(part("yay").count).toBe(everyone.filter((c) => c.class.id === "okyeli" && kitOnly(c)).length);
    expect(part("egetunce-kilic").count).toBe(1);
    expect(part("mhellingtr-hale").count).toBe(1);
    expect(part("akin-isareti").count).toBe(0);
    expect(part("takipci-akin-isareti").count).toBe(2); // alptug, okcu_bir
    expect(part("pelerin-runlari").count + part("buyucu-pelerin-runlari").count).toBe(everyone.filter((c) => c.rarity === "efsanevi" && kitOnly(c)).length);
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
    const legs = part("okyeli-bacaklar");
    const okcu = placements.get("okcu_bir")!;
    const k = everyone.filter((c) => c.class.id === "okyeli" && models.includes(c)).findIndex((c) => c.id === "okcu_bir");
    expect(legs.count).toBe(models.filter((c) => c.class.id === "okyeli").length);
    expect([...legs.motion.subarray(k * 4, k * 4 + 4)].map((v) => +v.toFixed(4))).toEqual(
      [okcu.motion.radius, okcu.motion.seed, okcu.motion.yaw, okcu.motion.cheer].map((v) => +Math.fround(v).toFixed(4)),
    );
    expect(data.motion).toHaveLength(everyone.length * 4);
  });

  it("herkes aynı boyda (kadro, kahraman, takipçi), renkler 0–1 aralığında", () => {
    const sizes = new Set(everyone.map((c) => characterScale(c)));
    expect(sizes.size).toBe(1);
    for (const c of everyone) expect(placements.get(c.id)!.scale, c.id).toBe(characterScale(CAST[0]));
    for (const p of data.parts) {
      for (const v of p.colors) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

import { describe, expect, it } from "vitest";
import { TEMPLATE_IDS, WORD_INTERVAL, buildTemplate, cameraAt, cameraDirection, captionAt, cardAt, signatureFrom, totalDuration, type StudioContext } from "./reel";

const ctx: StudioContext = {
  island: { x: 500, y: 350 },
  portal: { x: 520, y: 360 },
  unnamedIsland: { position: { x: 700, y: 120 }, nickname: "Kartalyuva" },
  newcomers: 12,
  village: { x: 215, y: 580 },
  episode: { number: 3, title: "Buzul Geçidi", question: "Cesaret taktiği mi, buz eritme planı mı?", options: ["Cesaret Taktiği", "Buz Eritme Planı"] },
  raid: { square: { x: 236, y: 336 }, focus: { x: 236, y: 290 }, facing: Math.PI, count: 90 },
  boss: { name: "Buzkıran Tekgöz" },
  hero: { id: "baturay", position: { x: 220, y: 570 }, displayName: "Baturay", handle: "baturay", title: "Akın Lideri", rarity: "Efsanevi", className: "Kalkaneri", region: "Akınburnu" },
};

describe("kamera çekimleri", () => {
  const script = buildTemplate("bolum", ctx);

  it("ilk ve son poz çekimlerin uçlarıyla aynı; yakınlık hep pozitif, akış kesintisiz", () => {
    const total = totalDuration(script.shots);
    expect(cameraAt(script.shots, 0).pose).toMatchObject({ x: 500, z: 350, zoom: 1 });
    const end = cameraAt(script.shots, total).pose;
    const last = script.shots[script.shots.length - 1].to;
    expect(end.x).toBeCloseTo(last.x);
    expect(end.zoom).toBeCloseTo(last.zoom);
    let prev = cameraAt(script.shots, 0).pose;
    for (let t = 0.05; t <= total; t += 0.05) {
      const p = cameraAt(script.shots, t).pose;
      expect(p.zoom).toBeGreaterThan(0);
      // Çekim içinde ani sıçrama yok (çekim geçişleri hariç: orada kurgu kesmesi olabilir)
      if (cameraAt(script.shots, t).shot === cameraAt(script.shots, t - 0.05).shot) {
        expect(Math.hypot(p.x - prev.x, p.z - prev.z)).toBeLessThan(15);
      }
      prev = p;
    }
  });

  it("yakınlık logaritmik akar: yarı yolda geometrik ortalama", () => {
    const shots = [{ duration: 2, from: { x: 0, z: 0, zoom: 1, yaw: 0 }, to: { x: 0, z: 0, zoom: 16, yaw: 0 }, ease: "linear" as const }];
    expect(cameraAt(shots, 1).pose.zoom).toBeCloseTo(4);
  });

  it("kamera yönü birim vektör; tepeden bakınca yukarıda, yaw=0'da güneyde", () => {
    const [x, y, z] = cameraDirection(0, 0.6);
    expect(Math.hypot(x, y, z)).toBeCloseTo(1);
    expect(z).toBeGreaterThan(0);
    expect(cameraDirection(0, 0)[1]).toBeCloseTo(1);
  });

  it("bölüm tanıtımında kamera akıncıların arkasından boss'a bakar ve sonunda oylama kartı açılır", () => {
    const behind = ctx.raid!.facing + Math.PI;
    expect(script.shots[3].to).toMatchObject({ x: 236, z: 290, yaw: behind });
    const total = totalDuration(script.shots);
    expect(total).toBeGreaterThan(14);
    expect(total).toBeLessThan(25);
    const card = cardAt(script.cards, total - 2);
    expect(card?.card.lines).toEqual(["CESARET TAKTİĞİ", "BUZ ERİTME PLANI"]);
    expect(script.captions[0]).toBe("Bölüm 3: Buzul Geçidi");
  });

  it("akın yoksa oba çekimleriyle kurulur; kahraman şablonu karakteri takip eder", () => {
    const noRaid = buildTemplate("bolum", { ...ctx, raid: null, boss: null });
    expect(noRaid.shots[1].to.x).toBe(215);
    const hero = buildTemplate("kahraman", ctx);
    expect(hero.shots.every((s) => s.to.follow === "baturay")).toBe(true);
    expect(hero.captions).toContain("@baturay obada!");
    // Kahraman yoksa katıl şablonuna düşer
    expect(buildTemplate("kahraman", { ...ctx, hero: null }).template).toBe("katil");
    for (const id of TEMPLATE_IDS) expect(buildTemplate(id, ctx).captions.length).toBeGreaterThan(2);
  });
});

describe("altyazı ve kartlar", () => {
  it("satırlar eşit dilimlere yayılır, kelimeler sırayla belirir", () => {
    const lines = ["Bir iki üç", "Dört beş"];
    expect(captionAt(lines, 0.1, 10)).toBeNull(); // dilimin başındaki kısa boşluk
    expect(captionAt(lines, 0.2, 10)).toMatchObject({ words: ["Bir", "iki", "üç"], shown: 1 });
    expect(captionAt(lines, 0.15 + WORD_INTERVAL * 2 + 0.01, 10)?.shown).toBe(3);
    expect(captionAt(lines, 4, 10)?.shown).toBe(3);
    expect(captionAt(lines, 5.5, 10)?.words).toEqual(["Dört", "beş"]);
    expect(captionAt(lines, 10, 10)).toBeNull();
    expect(captionAt(["", "  "], 1, 10)).toBeNull();
  });

  it("kart açılır, tam görünür, kapanır", () => {
    const cards = [{ at: 2, duration: 3, title: "A", lines: [] }];
    expect(cardAt(cards, 1.9)).toBeNull();
    expect(cardAt(cards, 2.1)?.presence).toBeCloseTo(0.4);
    expect(cardAt(cards, 3.5)?.presence).toBe(1);
    expect(cardAt(cards, 4.9)?.presence).toBeCloseTo(0.4);
    expect(cardAt(cards, 5.1)).toBeNull();
  });

  it("kartlarda Türkçe büyük harf: KALKANERİ, OKYELİ", () => {
    const join = buildTemplate("katil", ctx);
    expect(join.cards[0].lines).toEqual(["INSTAGRAM → KALKANERİ", "TIKTOK → OKYELİ", "YOUTUBE → OCAKCAN"]);
    expect(buildTemplate("kahraman", ctx).cards[0].lines[0]).toBe("SINIF: KALKANERİ");
  });

  it("imza Instagram adresinden çıkar", () => {
    expect(signatureFrom("https://www.instagram.com/oba.tales/")).toBe("@oba.tales");
    expect(signatureFrom(null)).toBe("");
  });
});

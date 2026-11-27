import { describe, expect, it } from "vitest";
import { createStarterCharacter } from "../lib/rules";
import { RAID_DAY_LENGTH, actAt } from "../world3d/living/raidDay";
import { ORB_STAGGER, orbAt } from "../world3d/story/arrival";
import { AKIN_REEL_START, ARRIVAL_REEL_AT, SKILL_PART, TEMPLATE_IDS, WORD_INTERVAL, buildTemplate, cameraAt, cameraDirection, captionAt, cardAt, signatureFrom, totalDuration, type StudioContext } from "./reel";

const raiders = ["kalkan_a", "ok_b", "ocak_c"].map((handle, i) =>
  createStarterCharacter({ handle, platform: (["instagram", "tiktok", "youtube"] as const)[i], region: "ayazbogazi", coordinates: { x: 236, y: 336 }, now: new Date("2026-11-26T12:00:00Z") }),
);

const ctx: StudioContext = {
  island: { x: 500, y: 350 },
  portal: { x: 520, y: 360 },
  unnamedIsland: { position: { x: 700, y: 120 }, nickname: "Kartalyuva" },
  newcomers: 12,
  village: { x: 215, y: 580 },
  episode: { number: 3, title: "Buzul Geçidi", question: "Cesaret taktiği mi, buz eritme planı mı?", options: ["Cesaret Taktiği", "Buz Eritme Planı"] },
  raid: { square: { x: 236, y: 336 }, focus: { x: 236, y: 290 }, facing: Math.PI, count: 90, raiders },
  boss: { name: "Buzkıran Tekgöz" },
  hero: { id: "baturay", position: { x: 220, y: 570 }, displayName: "Baturay", handle: "baturay", title: "Akın Lideri", rarity: "Efsanevi", className: "Kalkaneri", region: "Akınburnu" },
  heroes: [
    { character: { ...raiders[1], id: "mhellingtr", displayName: "mhellingtr", title: "Yıldızların Okçusu" }, position: { x: 210, y: 575 }, skill: "Gök Gürültüsü" },
    { character: { ...raiders[0], id: "egetunce", displayName: "egetunce", title: "Gün Kılıçlı Alp" }, position: { x: 222, y: 585 }, skill: "Lavanta Kalkanı · Gün Kılıcı" },
    { character: { ...raiders[2], id: "bintas", displayName: "BinTaş", title: "Alev Hatun" }, position: { x: 230, y: 572 }, skill: "Bin Taş Ocağı" },
  ],
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
    // Akın şablonunda perde başlıkları altyazının yerini tutar.
    for (const id of TEMPLATE_IDS) if (id !== "akin") expect(buildTemplate(id, ctx).captions.length).toBeGreaterThan(2);
  });

  it("Akın Günü reeli Oba Narası'ndan zafere kadar sürer; akın yoksa bölüm tanıtımına düşer", () => {
    const reel = buildTemplate("akin", ctx);
    const total = totalDuration(reel.shots);
    expect(reel.raidDay).toMatchObject({ start: AKIN_REEL_START, boss: "Buzkıran Tekgöz" });
    expect(reel.raidDay!.raiders).toHaveLength(3);
    expect(actAt(AKIN_REEL_START).act.id).toBe("nara");
    expect(actAt(AKIN_REEL_START + total - 0.1).act.id).toBe("zafer");
    expect(AKIN_REEL_START + total).toBeLessThanOrEqual(RAID_DAY_LENGTH);
    // Son kart zafer perdesinin içinde açılıp kapanır.
    const card = reel.cards.at(-1)!;
    expect(card.at + card.duration).toBeLessThanOrEqual(total);
    expect(actAt(AKIN_REEL_START + card.at).act.id).toBe("zafer");
    expect(buildTemplate("akin", { ...ctx, raid: null }).template).toBe("bolum");
  });

  it("karşılama: geliş sineması kapıya inince başlar, kahramanlar inişten sonra kartta, video bitmeden kart kapanır", () => {
    const reel = buildTemplate("karsilama", ctx);
    const total = totalDuration(reel.shots);
    expect(reel.arrival).toEqual({ at: ARRIVAL_REEL_AT, heroes: ["mhellingtr", "egetunce", "bintas"] });
    // Son küre indiğinde kahramanlar kartı açılır; adlar Türkçe büyük harfle.
    const landed = ARRIVAL_REEL_AT + 4.8 + 2 * ORB_STAGGER;
    expect(orbAt(landed - ARRIVAL_REEL_AT, 2).revealed).toBe(true);
    const heroesCard = reel.cards[0];
    expect(heroesCard.at).toBeGreaterThanOrEqual(landed);
    expect(heroesCard.lines).toContain("BİNTAŞ · ALEV HATUN");
    for (const card of reel.cards) expect(card.at + card.duration).toBeLessThanOrEqual(total);
    // Küreler uçarken kamera kapı ile oba arasında.
    expect(cameraAt(reel.shots, ARRIVAL_REEL_AT + 3.5).shot).toBe(1);
    expect(buildTemplate("karsilama", { ...ctx, heroes: [] }).template).toBe("kapi");
  });

  it("yetenekler: her kahramana eşit bölüm, kamera onu takip eder, panel bölümün içinde açılıp kapanır", () => {
    const reel = buildTemplate("yetenekler", ctx);
    const total = totalDuration(reel.shots);
    expect(total).toBeCloseTo(SKILL_PART * 5);
    expect(reel.skills?.map((s) => s.hero.id)).toEqual(["mhellingtr", "egetunce", "bintas"]);
    reel.skills!.forEach((s, i) => {
      expect(s.at).toBeGreaterThanOrEqual(SKILL_PART * (i + 1));
      expect(s.at + s.duration).toBeLessThanOrEqual(SKILL_PART * (i + 2));
      expect(cameraAt(reel.shots, s.at + 1).pose.follow).toBe(s.hero.id);
    });
    // Altyazılar bölümlerle aynı anda değişir: ikinci satır ilk kahramanın bölümünde.
    expect(captionAt(reel.captions, SKILL_PART + 1.5, total)?.words.join(" ")).toBe("mhellingtr: Gök Gürültüsü");
    expect(buildTemplate("yetenekler", { ...ctx, heroes: [] }).template).toBe("katil");
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

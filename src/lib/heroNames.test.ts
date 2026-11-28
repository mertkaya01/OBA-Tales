import { describe, expect, it } from "vitest";
import { cleanHeroName, cleanPlaceName, isBlockedName, isNewerOrSame, parseNameCommand, parsePlaceCommand, placeCandidate } from "./heroNames";

describe("yorumdaki kahraman adı komutu", () => {
  it.each([
    ["ad: Kara Şahin", "Kara Şahin"],
    ["Ad - Kara Şahin", "Kara Şahin"],
    ["adım Kara Şahin", "Kara Şahin"],
    ["Adım: Kara Şahin olsun lütfen", "Kara Şahin"],
    ["İSİM: Ayaz Hatun", "Ayaz Hatun"],
    ["ismim Gökbörü", "Gökbörü"],
    ["adım Atilla", "Atilla"],
    ["kahramanımın adı Yağız Alp", "Yağız Alp"],
    ["kahraman adı: Tolga Er", "Tolga Er"],
    ["#katıl Kara Şahin", "Kara Şahin"],
    ["!ad Kopuzcu Ece", "Kopuzcu Ece"],
    ["katil: Demir Yay", "Demir Yay"],
    ["obaya katıl Bozkurt Ece", "Bozkurt Ece"],
    ["🔥🔥 ad: Kara Şahin 🔥", "Kara Şahin"],
    ["@OBA-tales ad: Kara Şahin", "Kara Şahin"],
    ["ad: Kara Şahin. Harika video, devamı gelsin!", "Kara Şahin"],
    ["ad: \"Kara Şahin\"", "Kara Şahin"],
    ["Harika bölüm!\nad: Kara Şahin", "Kara Şahin"],
  ])("%s → %s", (comment, name) => {
    expect(parseNameCommand(comment)).toBe(name);
  });

  it.each(["ad koymak çok güzel olmuş", "Adımı haritada gördüm!", "Harika video", "katılıyorum", "adım adım ilerliyoruz", "Adım attık obaya","ada: Yıldız Koyu", "ad önerim: Yıldız Koyu", ""])(
    "sıradan cümle komut sayılmaz: %s",
    (comment) => {
      expect(parseNameCommand(comment)).toBeNull();
    },
  );
});

describe("yer adı önerisi", () => {
  it("komutla", () => {
    expect(parsePlaceCommand("yer: Yıldız Koyu")).toBe("Yıldız Koyu");
    expect(parsePlaceCommand("ada adı: Kartal Yuvası")).toBe("Kartal Yuvası");
    expect(parsePlaceCommand("ad önerim: Ayışığı Burnu")).toBe("Ayışığı Burnu");
    expect(parsePlaceCommand("#yer Rüzgâr Kayası")).toBe("Rüzgâr Kayası");
    expect(parsePlaceCommand("ad: Kara Şahin")).toBeNull();
  });

  it("kısa yorum aday olur, uzun cümle olmaz", () => {
    expect(placeCandidate("Yıldız Koyu 🌟")).toBe("Yıldız Koyu 🌟");
    expect(placeCandidate("öneri: Ayışığı Burnu")).toBe("Ayışığı Burnu");
    expect(placeCandidate("Bence buranın adı Yıldız Koyu olmalı çünkü gece çok güzel")).toBeNull();
    expect(placeCandidate("Yıldız\nKoyu")).toBeNull();
  });
});

describe("ad denetimi", () => {
  it("temizler ve baş harfleri büyütür", () => {
    expect(cleanHeroName("kara şahin")).toEqual({ ok: true, name: "Kara Şahin" });
    expect(cleanHeroName("KARA ŞAHİN")).toEqual({ ok: true, name: "Kara Şahin" });
    expect(cleanHeroName("  Kara   Şahin ✨ ")).toEqual({ ok: true, name: "Kara Şahin" });
    expect(cleanHeroName("deMir Yay")).toEqual({ ok: true, name: "deMir Yay" });
    expect(cleanHeroName("Ay-Ece")).toEqual({ ok: true, name: "Ay-Ece" });
    expect(cleanHeroName("Ali 2007")).toEqual({ ok: true, name: "Ali 2007" });
  });

  it("uygunsuz, bağlantılı, kadro adı, kısa ve uzun adları geri çevirir", () => {
    expect(cleanHeroName("www.site.com")).toMatchObject({ ok: false, reason: "bağlantı içeriyor" });
    // Komuttan gelen bağlantı noktada bölünüp "Www" adına dönüşmez.
    expect(cleanHeroName(parseNameCommand("ad: www.benimsitem.com") ?? "")).toMatchObject({ ok: false, reason: "bağlantı içeriyor" });
    expect(cleanHeroName("@baskasi")).toMatchObject({ ok: false, reason: "başka birinin etiketi" });
    expect(cleanHeroName("a")).toMatchObject({ ok: false, reason: "çok kısa" });
    expect(cleanHeroName("Gökyüzünün Sonsuz Kanatlı Okçusu")).toMatchObject({ ok: false });
    expect(cleanHeroName("Bir İki Üç Dört Beş")).toMatchObject({ ok: false, reason: "en çok 4 sözcük" });
    expect(cleanHeroName("Baturay")).toMatchObject({ ok: false, reason: "kadronun ya da sitenin adı" });
    expect(cleanHeroName("bin taş")).toMatchObject({ ok: false, reason: "kadronun ya da sitenin adı" });
    expect(cleanHeroName("OBA Tales")).toMatchObject({ ok: false, reason: "kadronun ya da sitenin adı" });
    expect(cleanHeroName("S1KT1R")).toMatchObject({ ok: false, reason: "uygunsuz söz" });
  });

  it("küfürleri yakalar ama masum adlara takılmaz", () => {
    for (const bad of ["Orospu Çocuğu", "y4rrrak", "siiiiktir git", "amk", "Aq Kral", "piç", "F.u.c.k"]) expect(isBlockedName(bad), bad).toBe(true);
    for (const good of ["Nazif", "Kamil", "Işıkay Ece", "Amina", "Nigar", "Sıkı Okçu", "Göktürk", "Ahmet", "Epik Kalkan", "Pusluada Bekçisi"]) expect(isBlockedName(good), good).toBe(false);
  });

  it("yer adı 32 harfe kadar", () => {
    expect(cleanPlaceName("yıldız koyu")).toEqual({ ok: true, name: "Yıldız Koyu" });
    expect(cleanPlaceName("Kuzgun Ormanının Sessiz Yamacı")).toMatchObject({ ok: true });
    expect(cleanPlaceName("Kuzgun Ormanının Çok Sessiz Yamacı")).toMatchObject({ ok: false });
  });
});

describe("tarih sırası", () => {
  it("tarihsiz kayıt en yeni sayılır", () => {
    expect(isNewerOrSame("2026-11-28T10:00:00Z", "2026-11-27T10:00:00Z")).toBe(true);
    expect(isNewerOrSame("2026-11-26T10:00:00Z", "2026-11-27T10:00:00Z")).toBe(false);
    expect(isNewerOrSame(undefined, "2026-11-27T10:00:00Z")).toBe(true);
    expect(isNewerOrSame("2026-11-27T10:00:00Z", undefined)).toBe(false);
  });
});

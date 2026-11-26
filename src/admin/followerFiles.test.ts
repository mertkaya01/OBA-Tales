import { describe, expect, it } from "vitest";
import { parseFollowerCsv, parseFollowerFile, parseInstagramHtml, parseInstagramJson, parseTikTokJson, parseTikTokText } from "./followerFiles";

describe("takipçi dosyaları", () => {
  it("Instagram followers_1.json: eski ve yeni biçim", () => {
    const old = [
      { title: "", string_list_data: [{ href: "https://www.instagram.com/kopuz_okcu", value: "kopuz_okcu", timestamp: 1 }] },
      { title: "", string_list_data: [{ href: "https://www.instagram.com/ayaz.kiz", value: "ayaz.kiz", timestamp: 2 }] },
    ];
    expect(parseInstagramJson(old)).toEqual(["kopuz_okcu", "ayaz.kiz"]);
    const wrapped = { relationships_followers: [{ title: "demir_davul", string_list_data: [{ href: "https://www.instagram.com/_u/demir_davul" }] }] };
    expect(parseInstagramJson(wrapped)).toEqual(["demir_davul"]);
    expect(parseInstagramJson([{ string_list_data: [{ href: "https://www.instagram.com/yalniz_link/" }] }])).toEqual(["yalniz_link"]);
  });

  it("Instagram HTML: profil bağlantıları", () => {
    const html = '<div><a target="_blank" href="https://www.instagram.com/kar_tanesi">kar_tanesi</a><a href="https://www.instagram.com/buz.yolcu/">x</a></div>';
    expect(parseInstagramHtml(html)).toEqual(["kar_tanesi", "buz.yolcu"]);
  });

  it("TikTok JSON: takipçiler alınır, takip edilenler alınmaz", () => {
    const data = {
      Activity: {
        "Follower List": { FansList: [{ Date: "2026-11-01", UserName: "ok_yeli" }, { Date: "2026-11-02", UserName: "sis_kartal" }] },
        "Following List": { Following: [{ Date: "2026-10-01", UserName: "benim_takip_ettigim" }] },
      },
    };
    expect(parseTikTokJson(data)).toEqual(["ok_yeli", "sis_kartal"]);
    // Yeni biçim: "Your Activity" → "Follower" → "FansList"
    expect(parseTikTokJson({ "Your Activity": { Follower: { FansList: [{ UserName: "yeni_bicim" }] } } })).toEqual(["yeni_bicim"]);
  });

  it("TikTok TXT ve CSV", () => {
    expect(parseTikTokText("Date: 2026-11-01 10:00:00 UTC\nUsername: ates.kurdu\n\nDate: x\nUsername: buz_ayi\n")).toEqual(["ates.kurdu", "buz_ayi"]);
    const csv = "platform,kullanici,ad\ninstagram,@kopuz_okcu,Kopuz Okçu\ntiktok,ayaz_kiz,\nyoutube,demir davul,\nfacebook,biri,\ninstagram,kopuz_okcu,tekrar\n";
    expect(parseFollowerCsv(csv, "instagram")).toEqual([
      { platform: "instagram", handle: "kopuz_okcu", displayName: "Kopuz Okçu" },
      { platform: "tiktok", handle: "ayaz_kiz", displayName: "ayaz_kiz" },
    ]);
    // Başlıksız düz liste: seçilen platform.
    expect(parseFollowerCsv("bir_kisi\n@iki.kisi\n", "youtube").map((e) => `${e.platform}:${e.handle}`)).toEqual(["youtube:bir_kisi", "youtube:iki.kisi"]);
  });

  it("dosyayı türünden tanır, tekrarları ve geçersiz adları atar", () => {
    const ig = parseFollowerFile("followers_1.json", JSON.stringify([{ string_list_data: [{ value: "a.b" }] }, { string_list_data: [{ value: "a.b" }] }]), "instagram");
    expect(ig.kind).toContain("Instagram");
    expect(ig.entries).toHaveLength(1);
    expect(ig.skipped).toBe(1);
    const tt = parseFollowerFile("user_data_tiktok.json", JSON.stringify({ Activity: { "Follower List": { FansList: [{ UserName: "x_y" }] } } }), "instagram");
    expect(tt.kind).toContain("TikTok");
    expect(tt.entries[0]).toEqual({ platform: "tiktok", handle: "x_y", displayName: "x_y" });
    expect(parseFollowerFile("bozuk.json", "{bozuk", "tiktok").entries).toEqual([]);
  });
});

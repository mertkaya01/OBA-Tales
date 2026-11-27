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

  it("TikTok'un 2026 biçimi: Profile And Settings → Follower → FansList; ziyaretçiler, takip edilenler ve hesabın kendisi alınmaz", () => {
    const data = {
      Comment: { Comments: { App: 1, CommentsList: [] } },
      "Profile And Settings": {
        Follower: { App: 1, IsFastLane: true, FansList: [{ Date: "2026-11-27 08:52:34", UserName: "bozkir_atlisi" }] },
        Following: { App: 1, IsFastLane: true, Following: [{ Date: "2026-11-20", UserName: "benim_takip_ettigim" }] },
        ProfileViews: { ProfileViewList: [{ Date: "2026-11-27 08:52:37 UTC", Username: "ziyaretci" }] },
        "Profile Info": { App: 1, ProfileMap: { userName: "hesabin_kendisi", followerCount: 1, emailAddress: "gizli@ornek.com", birthDate: "01-Jan-2000" } },
      },
    };
    const parsed = parseFollowerFile("user_data_tiktok.json", JSON.stringify(data), "tiktok");
    expect(parsed.kind).toContain("TikTok");
    expect(parsed.entries.map((e) => e.handle)).toEqual(["bozkir_atlisi"]);
    // Takipçisi olmayan TikTok dosyası da TikTok diye tanınır (Instagram seçili olsa bile).
    const empty = parseFollowerFile("user_data_tiktok.json", JSON.stringify({ "Profile And Settings": { Follower: { FansList: [] } } }), "instagram");
    expect(empty.kind).toContain("TikTok");
    expect(empty.note).toMatch(/takipçi yok/);
  });

  it("Instagram ZIP'indeki öbür listeler takipçi sanılmaz", () => {
    const following = parseFollowerFile("following.json", JSON.stringify({ relationships_following: [{ title: "x_y", string_list_data: [{ href: "https://www.instagram.com/x_y" }] }] }), "instagram");
    expect(following.entries).toEqual([]);
    expect(following.kind).toMatch(/takip ettiğin/);
    expect(following.note).toMatch(/followers_1\.json/);
    const requests = parseFollowerFile("recent_follow_requests.json", JSON.stringify([{ timestamp: 1, media: [], label_values: [{ label: "Kullanıcı adı", value: "istek_atan" }] }]), "instagram");
    expect(requests.entries).toEqual([]);
    expect(parseFollowerFile("Following.txt", "Date: 2026-11-01\nUsername: takip_ettigim\n", "tiktok").entries).toEqual([]);
    expect(parseFollowerFile("Profile Views.txt", "Date: 2026-11-01\nUsername: ziyaretci\n", "tiktok").entries).toEqual([]);
    expect(parseFollowerFile("Follower.txt", "Date: 2026-11-01\nUsername: gercek_takipci\n", "tiktok").entries.map((e) => e.handle)).toEqual(["gercek_takipci"]);
  });

  it("aynı kişiyi büyük-küçük harf farkıyla iki kez saymaz (Türkçe I/ı tuzağı dahil)", () => {
    const parsed = parseFollowerFile("followers_1.json", JSON.stringify([{ string_list_data: [{ value: "ISIK.yolcu" }] }, { string_list_data: [{ value: "isik.yolcu" }] }]), "instagram");
    expect(parsed.entries).toHaveLength(1);
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

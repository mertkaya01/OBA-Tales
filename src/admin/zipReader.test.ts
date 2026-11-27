import { describe, expect, it } from "vitest";
import { readFollowerFile } from "./followerFiles";
import { isZip, listZip } from "./zipReader";

/** Testler için küçük ZIP yazıcı: method 0 (sıkıştırmasız) ya da 8 (deflate). CRC okuyucu tarafından denetlenmez. */
async function makeZip(files: { name: string; text: string; deflate?: boolean }[]): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const raw = enc.encode(f.text);
    const data = f.deflate ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer()) : raw;
    const name = enc.encode(f.name);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(8, f.deflate ? 8 : 0, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, raw.length, true);
    local.setUint16(26, name.length, true);
    const head = new DataView(new ArrayBuffer(46));
    head.setUint32(0, 0x02014b50, true);
    head.setUint16(10, f.deflate ? 8 : 0, true);
    head.setUint32(20, data.length, true);
    head.setUint32(24, raw.length, true);
    head.setUint16(28, name.length, true);
    head.setUint32(42, offset, true);
    parts.push(new Uint8Array(local.buffer), name, data);
    central.push(new Uint8Array(head.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of all) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const igFollowers = JSON.stringify([
  { title: "", media_list_data: [], string_list_data: [{ href: "https://www.instagram.com/kopuz_okcu", value: "kopuz_okcu", timestamp: 1 }] },
  { title: "", media_list_data: [], string_list_data: [{ href: "https://www.instagram.com/ayaz.kiz", value: "ayaz.kiz", timestamp: 2 }] },
]);
const igFollowing = JSON.stringify({ relationships_following: [{ title: "takip_ettigim", string_list_data: [{ href: "https://www.instagram.com/takip_ettigim", timestamp: 3 }] }] });

describe("ZIP okuyucu", () => {
  it("içindekileri listeler, sıkıştırılmış ve sıkıştırılmamış dosyaları açar", async () => {
    const zip = await makeZip([
      { name: "connections/followers_and_following/followers_1.json", text: igFollowers, deflate: true },
      { name: "connections/followers_and_following/following.json", text: igFollowing },
    ]);
    expect(isZip(zip)).toBe(true);
    expect(isZip(new TextEncoder().encode("{}"))).toBe(false);
    const entries = listZip(zip);
    expect(entries.map((e) => e.name)).toEqual(["connections/followers_and_following/followers_1.json", "connections/followers_and_following/following.json"]);
    expect(await entries[0].text()).toBe(igFollowers);
    expect(await entries[1].text()).toBe(igFollowing);
  });

  it("Instagram ZIP'i olduğu gibi: yalnızca followers dosyaları okunur, following.json alınmaz", async () => {
    const zip = await makeZip([
      { name: "connections/followers_and_following/followers_1.json", text: igFollowers, deflate: true },
      { name: "connections/followers_and_following/followers_2.json", text: JSON.stringify([{ string_list_data: [{ value: "demir_davul" }] }]), deflate: true },
      { name: "connections/followers_and_following/following.json", text: igFollowing, deflate: true },
      { name: "connections/followers_and_following/recent_follow_requests.json", text: "[]" },
    ]);
    const read = await readFollowerFile("instagram-oba.tales.zip", zip, "instagram");
    expect(read.map((r) => r.name.split(" → ")[1])).toEqual(["connections/followers_and_following/followers_1.json", "connections/followers_and_following/followers_2.json"]);
    expect(read.flatMap((r) => r.parsed.entries.map((e) => `${e.platform}:${e.handle}`))).toEqual(["instagram:kopuz_okcu", "instagram:ayaz.kiz", "instagram:demir_davul"]);
  });

  it("TikTok ZIP'i olduğu gibi (platform yanlış seçilse de TikTok olarak tanır)", async () => {
    const tiktok = JSON.stringify({ "Profile And Settings": { Follower: { App: 1, IsFastLane: true, FansList: [{ Date: "2026-11-27 08:52:34", UserName: "ok_yeli" }] } } });
    const zip = await makeZip([{ name: "user_data_tiktok.json", text: tiktok, deflate: true }]);
    const [read] = await readFollowerFile("TikTok_Data.zip", zip, "instagram");
    expect(read.parsed.kind).toContain("TikTok");
    expect(read.parsed.entries).toEqual([{ platform: "tiktok", handle: "ok_yeli", displayName: "ok_yeli" }]);
  });

  it("takipçi dosyası olmayan ve bozuk ZIP için açıklama verir", async () => {
    const empty = await makeZip([{ name: "your_instagram_activity/likes/liked_posts.json", text: "[]" }]);
    const [none] = await readFollowerFile("baska.zip", empty, "instagram");
    expect(none.parsed.entries).toEqual([]);
    expect(none.parsed.note).toMatch(/followers_1\.json/);
    const broken = (await makeZip([{ name: "followers_1.json", text: igFollowers }])).slice(0, 40);
    const [bad] = await readFollowerFile("yarim.zip", broken, "instagram");
    expect(bad.parsed.entries).toEqual([]);
    expect(bad.parsed.note).toMatch(/bozuk|yarım/);
  });

  it("ZIP olmayan dosyayı doğrudan okur", async () => {
    const [plain] = await readFollowerFile("followers_1.json", new TextEncoder().encode(igFollowers), "instagram");
    expect(plain.parsed.entries.map((e) => e.handle)).toEqual(["kopuz_okcu", "ayaz.kiz"]);
  });
});

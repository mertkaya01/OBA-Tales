import { describe, expect, it } from "vitest";
import { parseFollowerCsv } from "../../src/admin/followerFiles";
import { asciiHandle, channelComments, commentEntries, commentsCsv, voteCandidates, type YoutubeComment } from "./youtube";

const settings = { key: "deneme", channel: "OBA-tales" };

/** YouTube API'sini taklit eder: istenen adrese göre hazır yanıt verir. */
function fakeFetch(routes: Record<string, unknown>, calls: string[] = []) {
  return async (url: string) => {
    calls.push(url);
    const path = new URL(url).pathname.split("/").pop() ?? "";
    const pageToken = new URL(url).searchParams.get("pageToken");
    const body = routes[pageToken ? `${path}:${pageToken}` : path];
    if (body instanceof Error) return { ok: false, status: 403, json: async () => ({}), text: async () => `{"error":{"errors":[{"reason":"${body.message}"}]}}` };
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
  };
}

const thread = (id: string, handle: string, text: string, at: string, likes = 0) => ({
  id,
  snippet: { videoId: "v1", topLevelComment: { snippet: { authorDisplayName: `@${handle}`, authorChannelUrl: `http://www.youtube.com/@${encodeURIComponent(handle)}`, textOriginal: text, likeCount: likes, publishedAt: at } } },
});

describe("YouTube yorumları", () => {
  it("videoları ve sayfalı yorumları okur; yorumu kapalı video atlanır", async () => {
    const calls: string[] = [];
    const fetcher = fakeFetch(
      {
        channels: { items: [{ contentDetails: { relatedPlaylists: { uploads: "UU1" } } }] },
        playlistItems: { items: [{ snippet: { title: "1. gün" }, contentDetails: { videoId: "v1", videoPublishedAt: "2026-11-27T10:00:00Z" } }] },
        commentThreads: { nextPageToken: "p2", items: [thread("c1", "kara-şahin", "ad: Kara Şahin", "2026-11-28T10:00:00Z")] },
        "commentThreads:p2": { items: [thread("c2", "Ayaz", "harika", "2026-11-28T09:00:00Z")] },
      },
      calls,
    );
    const { videos, comments } = await channelComments(settings, {}, fetcher);
    expect(videos).toEqual([{ id: "v1", title: "1. gün", at: "2026-11-27T10:00:00Z" }]);
    expect(comments.map((c) => c.handle)).toEqual(["kara-sahin", "ayaz"]);
    expect(calls.every((u) => u.includes("key=deneme"))).toBe(true);

    const closed = fakeFetch({
      channels: { items: [{ contentDetails: { relatedPlaylists: { uploads: "UU1" } } }] },
      playlistItems: { items: [{ contentDetails: { videoId: "v1" } }] },
      commentThreads: new Error("commentsDisabled"),
    });
    expect((await channelComments(settings, {}, closed)).comments).toEqual([]);
  });

  it("hiç videosu olmayan kanal hata değil, boş liste", async () => {
    const empty = fakeFetch({
      channels: { items: [{ contentDetails: { relatedPlaylists: { uploads: "UU1" } } }] },
      playlistItems: new Error("playlistNotFound"),
    });
    expect(await channelComments(settings, {}, empty)).toEqual({ videos: [], comments: [] });
  });

  it("kota dolunca anlaşılır hata verir", async () => {
    const fetcher = fakeFetch({ channels: new Error("quotaExceeded") });
    await expect(channelComments(settings, {}, fetcher)).rejects.toThrow(/kotası doldu/);
  });

  const comments: YoutubeComment[] = [
    { id: "a", videoId: "v1", handle: "kara-sahin", displayName: "@kara-şahin", text: "ad: Eski", likes: 1, at: "2026-11-20T10:00:00Z" },
    { id: "b", videoId: "v1", handle: "kara-sahin", displayName: "@kara-şahin", text: "ad: Kara Şahin", likes: 9, at: "2026-11-28T10:00:00Z" },
    { id: "c", videoId: "v1", handle: "ayaz", displayName: "@ayaz", text: "Yıldız Koyu", likes: 12, at: "2026-11-28T11:00:00Z" },
    { id: "d", videoId: "v1", handle: "tolga", displayName: "@tolga", text: "yer: yıldız koyu", likes: 3, at: "2026-11-28T12:00:00Z" },
    { id: "e", videoId: "v1", handle: "ece", displayName: "@ece", text: "Bence en güzeli Ayışığı Burnu olur çünkü gece parlıyor", likes: 40, at: "2026-11-28T12:00:00Z" },
  ];

  it("kişi başına bir girdi, en yeni ad komutuyla", () => {
    expect(commentEntries(comments)).toEqual([
      { platform: "youtube", handle: "kara-sahin", displayName: "@kara-şahin", heroName: "Kara Şahin", at: "2026-11-28T10:00:00Z" },
      { platform: "youtube", handle: "ayaz", displayName: "@ayaz" },
      { platform: "youtube", handle: "tolga", displayName: "@tolga" },
      { platform: "youtube", handle: "ece", displayName: "@ece" },
    ]);
  });

  it("oylama adayları beğeniye göre; aynı ad bir kez; uzun cümle ve kahraman adı komutu aday değil", () => {
    expect(voteCandidates(comments).map((c) => [c.name, c.handle, c.likes])).toEqual([["Yıldız Koyu", "ayaz", 12]]);
    const more = [...comments, { id: "f", videoId: "v1", handle: "bora", displayName: "@bora", text: "#yer Ayışığı Burnu", likes: 30, at: "2026-11-28T13:00:00Z" }];
    expect(voteCandidates(more).map((c) => c.name)).toEqual(["Ayışığı Burnu", "Yıldız Koyu"]);
  });

  it("CSV'ye yazılan yorumlar geri okununca aynı adı verir", () => {
    const entries = parseFollowerCsv(commentsCsv(comments), "youtube");
    expect(entries.find((e) => e.handle === "kara-sahin")?.heroName).toBe("Kara Şahin");
  });

  it("Türkçe harfli YouTube adını düz yazar", () => {
    expect(asciiHandle("@Kara-Şahin.Işık")).toBe("kara-sahin.isik");
  });
});

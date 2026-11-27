import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAST } from "../content/cast";
import { createStarterCharacter } from "../lib/rules";
import type { RosterFile, SeasonState, WorldState } from "../types";
import {
  DATA_URLS,
  DataLoadError,
  STRESS_ROSTER_URL,
  buildGameData,
  clearDataCache,
  loadDataFile,
  loadGameData,
  resolveRosterUrl,
} from "./loaders";

const now = new Date("2026-11-24T15:00:00Z");
const iso = now.toISOString();

const follower = createStarterCharacter({ handle: "ayaz_okcu", platform: "tiktok", region: "ayazbogazi", coordinates: { x: 235, y: 330 }, now });
const impostor = createStarterCharacter({ handle: "baturay", platform: "instagram", region: "akinburnu", coordinates: { x: 215, y: 560 }, now });

const roster: RosterFile = { version: 1, season: 1, generatedAt: iso, characters: [follower, impostor] };
const season: SeasonState = {
  version: 1,
  season: 1,
  activeEpisode: 2,
  updatedAt: iso,
  episodes: [
    { episodeNumber: 1, status: "tamamlandi", participantIds: ["baturay"], results: [], airedAt: iso, recap: "Oba yola çıktı." },
    { episodeNumber: 2, status: "aktif", participantIds: ["alptug", "ayaz_okcu", "kayip_biri"], results: [], airedAt: iso, recap: null },
  ],
};
const world: WorldState = {
  version: 1,
  seed: 1,
  fogSoftness: 24,
  revealedRegions: ["akinburnu"],
  glimpses: [],
  weather: "kar",
  namedPlaces: [],
  socialLinks: { instagram: null, tiktok: null, youtube: null },
  supportUrl: null,
  revealedIslands: [],
  story: { day: 1, arrivals: [{ id: "mhellingtr", at: iso }, { id: "egetunce", at: iso }], welcome: "uclu" },
  updatedAt: iso,
};

describe("buildGameData", () => {
  const data = buildGameData(roster, season, world);

  it("yalnızca gelmiş kahramanları ve takipçileri alır; kadro kimliğini taşıyan kaydı atlar", () => {
    // 2 gelmiş kahraman (mhellingtr, egetunce) + 1 takipçi; BinTaş henüz gelmedi, hikâye kadrosu haritada yok.
    expect(data.characters.map((c) => c.id)).toEqual(["mhellingtr", "egetunce", "ayaz_okcu"]);
    expect(data.characterById.get("bintas")).toBeUndefined();
    expect(data.characterById.get("baturay")).toBeUndefined();
    expect(CAST.some((c) => c.id === "baturay")).toBe(true);
    expect(data.characterById.get("ayaz_okcu")).toBe(follower);
    expect(data.skippedIds).toEqual(["baturay"]);
  });

  it("12 bölümü durumlarıyla birlikte verir", () => {
    expect(data.episodes).toHaveLength(12);
    expect(data.episodes.map((ep) => ep.status).slice(0, 3)).toEqual(["tamamlandi", "aktif", "kilitli"]);
    expect(data.episodes[2].progress).toBeNull();
    expect(data.activeEpisode.number).toBe(2);
    expect(data.activeEpisode.title).toBe("Fısıltılı İskele");
  });

  it("aktif akın katılımcılarından haritada olmayanları ayıklar", () => {
    // alptug hikâye kadrosunda ama henüz haritada değil; kayip_biri hiç yok.
    expect([...data.activeParticipantIds].sort()).toEqual(["ayaz_okcu"]);
    expect(data.revealedRegions.has("akinburnu")).toBe(true);
    expect(data.revealedRegions.has("pusluada")).toBe(false);
  });
});

describe("dosya yükleme", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const respond = (body: string, status = 200) => fetchMock.mockResolvedValueOnce(new Response(body, { status }));

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    clearDataCache();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("geçerli dosyayı doğrulayıp döndürür", async () => {
    respond(JSON.stringify(world));
    await expect(loadDataFile("world")).resolves.toEqual(world);
    expect(fetchMock).toHaveBeenCalledWith(DATA_URLS.world, expect.objectContaining({ cache: "no-cache" }));
  });

  it("sunucu hatasını, bozuk JSON'u ve şema hatasını anlaşılır biçimde bildirir", async () => {
    respond("bulunamadı", 404);
    await expect(loadDataFile("world")).rejects.toThrow("world.json yüklenemedi: sunucu 404 döndürdü");

    respond("{ bozuk");
    await expect(loadDataFile("season")).rejects.toThrow("dosya geçerli JSON değil");

    respond(JSON.stringify({ ...world, seed: -5 }));
    const error = await loadDataFile("world").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DataLoadError);
    expect((error as DataLoadError).file).toBe("world");
    expect((error as DataLoadError).message).toContain("seed");
  });

  it("bağlantı hatasını yakalar", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(loadDataFile("roster")).rejects.toThrow("bağlantı kurulamadı");
  });

  it("üç dosyayı birlikte yükler, sonucu paylaşır, hatadan sonra yeniden dener", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url === DATA_URLS.roster) return new Response(JSON.stringify(roster));
      if (url === DATA_URLS.season) return new Response(JSON.stringify(season));
      return new Response(JSON.stringify(world));
    });
    const first = loadGameData();
    expect(loadGameData()).toBe(first);
    expect((await first).characters).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    clearDataCache();
    fetchMock.mockImplementationOnce(async () => new Response("", { status: 500 }));
    await expect(loadGameData()).rejects.toThrow("500");
    await expect(loadGameData()).resolves.toBeTruthy();
  });
});

describe("stres verisi", () => {
  it("yalnızca geliştirme sırasında ve ?stres varsa açılır", () => {
    expect(resolveRosterUrl("?stres", true)).toBe(STRESS_ROSTER_URL);
    expect(resolveRosterUrl("?bolge=pusluada&stres=1", true)).toBe(STRESS_ROSTER_URL);
    expect(resolveRosterUrl("?stres", false)).toBeUndefined();
    expect(resolveRosterUrl("?bolge=pusluada", true)).toBeUndefined();
  });
});

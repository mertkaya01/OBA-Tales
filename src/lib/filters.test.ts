import { describe, expect, it } from "vitest";
import { CAST } from "../content/cast";
import { createEmptyFilters } from "../types";
import type { Character, FilterState } from "../types";
import {
  applyFilters,
  countActiveFilters,
  facetCounts,
  filtersFromSearchParams,
  isFilterEmpty,
  readSelectedId,
  readViewMode,
  toggleInList,
  writeFiltersToSearchParams,
} from "./filters";
import { createStarterCharacter } from "./rules";
import { normalizeSearch, slugify } from "./text";

const now = new Date("2026-11-24T15:00:00Z");
const followers: Character[] = [
  createStarterCharacter({ handle: "ayaz_okcu", platform: "tiktok", region: "ayazbogazi", coordinates: { x: 235, y: 330 }, now }),
  createStarterCharacter({
    handle: "kar_tanesi",
    platform: "youtube",
    linkedPlatforms: ["instagram"],
    region: "suzulkoy",
    coordinates: { x: 470, y: 545 },
    now,
  }),
  createStarterCharacter({
    handle: "simsek.kiz",
    displayName: "Şimşek Kız",
    platform: "instagram",
    linkedPlatforms: ["tiktok", "youtube"],
    region: "kiragiduzu",
    coordinates: { x: 510, y: 310 },
    now,
  }),
];
const everyone: Character[] = [...CAST.filter((c) => c.roleType !== "hero"), ...followers];

const filters = (patch: Partial<FilterState>): FilterState => ({ ...createEmptyFilters(), ...patch });
const ids = (list: Character[]) => list.map((c) => c.id).sort();

describe("Türkçe metin", () => {
  it("büyük/küçük harf ve Türkçe karakterden bağımsız sadeleştirir", () => {
    expect(normalizeSearch("KÜRŞAT")).toBe("kursat");
    expect(normalizeSearch("Işıkay")).toBe("isikay");
    expect(normalizeSearch("ISIKAY")).toBe("isikay");
    expect(normalizeSearch("İzmir  Çiğdem ")).toBe("izmir cigdem");
  });

  it("kimlik üretir", () => {
    expect(slugify("Buz.Kalkan_42")).toBe("buz-kalkan-42");
    expect(slugify("Şimşek Kız", "_")).toBe("simsek_kiz");
  });
});

describe("filtre motoru", () => {
  it("boş filtre herkesi döndürür", () => {
    expect(applyFilters(everyone, createEmptyFilters())).toHaveLength(everyone.length);
  });

  it("grup içinde OR çalışır", () => {
    expect(ids(applyFilters(everyone, filters({ classes: ["okyeli"] })))).toEqual(["ayaz_okcu", "isikay", "suheyla"]);
    expect(applyFilters(everyone, filters({ classes: ["okyeli", "ocakcan"] }))).toHaveLength(7);
  });

  it("gruplar arasında AND çalışır", () => {
    expect(ids(applyFilters(everyone, filters({ classes: ["okyeli"], rarities: ["efsanevi"] })))).toEqual(["isikay"]);
    expect(ids(applyFilters(everyone, filters({ regions: ["suzulkoy"] })))).toEqual(["kar_tanesi"]);
    expect(applyFilters(everyone, filters({ classes: ["kalkaneri"], regions: ["pusluada"] }))).toEqual([]);
  });

  it("özel durumlar kendi aralarında AND çalışır", () => {
    expect(applyFilters(everyone, filters({ special: ["kadro"] }))).toHaveLength(7);
    expect(ids(applyFilters(everyone, filters({ special: ["coklu"] })))).toEqual(
      ["baturay", "dede_toygar", "isikay", "kar_tanesi", "simsek_kiz", "yalvac"],
    );
    expect(ids(applyFilters(everyone, filters({ special: ["kadro", "coklu"] })))).toEqual(
      ["baturay", "dede_toygar", "isikay", "yalvac"],
    );
  });

  it("aktif akın filtresi bağlamdaki katılımcıları kullanır", () => {
    const ctx = { activeParticipantIds: new Set(["ayaz_okcu", "alptug"]) };
    expect(ids(applyFilters(everyone, filters({ special: ["akin"] }), ctx))).toEqual(["alptug", "ayaz_okcu"]);
    expect(applyFilters(everyone, filters({ special: ["akin"] }))).toEqual([]);
  });

  it("Türkçe karakterden bağımsız arar", () => {
    expect(ids(applyFilters(everyone, filters({ query: "kursat" })))).toEqual(["kursat"]);
    expect(ids(applyFilters(everyone, filters({ query: "KÜRŞAT" })))).toEqual(["kursat"]);
    expect(ids(applyFilters(everyone, filters({ query: "ISIKAY" })))).toEqual(["isikay"]);
    expect(ids(applyFilters(everyone, filters({ query: "simsek" })))).toEqual(["simsek_kiz"]);
    expect(ids(applyFilters(everyone, filters({ query: "kar_tanesi" })))).toEqual(["kar_tanesi"]);
  });

  it("çok kelimeli aramada her kelime eşleşmeli", () => {
    expect(ids(applyFilters(everyone, filters({ query: "cirak okyeli" })))).toEqual(["ayaz_okcu"]);
    expect(applyFilters(everyone, filters({ query: "   " }))).toHaveLength(everyone.length);
  });

  it("aktif filtreleri sayar", () => {
    expect(isFilterEmpty(createEmptyFilters())).toBe(true);
    expect(countActiveFilters(filters({ query: " ayaz ", classes: ["okyeli", "ocakcan"], special: ["kadro"] }))).toBe(4);
  });

  it("çip seçimini açıp kapatır", () => {
    expect(toggleInList(["nadir"], "efsanevi")).toEqual(["nadir", "efsanevi"]);
    expect(toggleInList(["nadir", "efsanevi"], "nadir")).toEqual(["efsanevi"]);
  });
});

describe("seçenek sayıları", () => {
  it("filtre yokken toplam dağılımı verir", () => {
    const facets = facetCounts(everyone, createEmptyFilters());
    expect(facets.classes).toEqual({ kalkaneri: 3, okyeli: 3, ocakcan: 4 });
    expect(facets.regions.akinburnu).toBe(7);
    expect(facets.special.kadro).toBe(7);
    expect(facets.special.coklu).toBe(6);
  });

  it("bir grubun sayısı kendi seçiminden etkilenmez, diğer grupların seçiminden etkilenir", () => {
    const facets = facetCounts(everyone, filters({ classes: ["okyeli"], special: ["kadro"] }));
    // Sınıf sayıları yalnızca "kadro" seçimine göre: kadroda 2 kalkaneri, 2 okyeli, 3 ocakcan.
    expect(facets.classes).toEqual({ kalkaneri: 2, okyeli: 2, ocakcan: 3 });
    // Nadirlik sayıları hem okyeli hem kadro seçimine göre: Süheyla (destansı), Işıkay (efsanevi).
    expect(facets.rarities).toEqual({ siradan: 0, nadir: 0, destansi: 1, efsanevi: 1, ulu: 0, goksel: 0 });
    // Özel durumlar AND: okyeli + kadro + çoklu → yalnızca Işıkay.
    expect(facets.special.coklu).toBe(1);
    expect(facets.special.kadro).toBe(2);
  });
});

describe("URL ↔ filtre", () => {
  it("yazıp okuyunca aynı filtreyi verir ve diğer parametreleri korur", () => {
    const state = filters({
      query: "ayaz",
      classes: ["ocakcan", "okyeli"],
      rarities: ["efsanevi"],
      regions: ["pusluada"],
      special: ["coklu"],
    });
    const params = writeFiltersToSearchParams(state, new URLSearchParams("k=alptug&gorunum=harita"));
    expect(params.get("sinif")).toBe("okyeli,ocakcan");
    expect(params.get("k")).toBe("alptug");
    expect(filtersFromSearchParams(params)).toEqual({ ...state, classes: ["okyeli", "ocakcan"] });
  });

  it("bilinmeyen değerleri ve tekrarları atar", () => {
    const parsed = filtersFromSearchParams(new URLSearchParams("sinif=okyeli,buyucu,okyeli&nadirlik=mitik&bolge=pusluada"));
    expect(parsed.classes).toEqual(["okyeli"]);
    expect(parsed.rarities).toEqual([]);
    expect(parsed.regions).toEqual(["pusluada"]);
  });

  it("boş filtre ilgili parametreleri siler", () => {
    const params = writeFiltersToSearchParams(createEmptyFilters(), new URLSearchParams("q=ayaz&sinif=okyeli&k=alptug"));
    expect(params.toString()).toBe("k=alptug");
  });

  it("görünümü ve seçili karakteri güvenle okur", () => {
    expect(readViewMode(new URLSearchParams("gorunum=harita"))).toBe("harita");
    expect(readViewMode(new URLSearchParams("gorunum=uzay"))).toBe("dunya");
    expect(readSelectedId(new URLSearchParams("k=dede_toygar"))).toBe("dede_toygar");
    expect(readSelectedId(new URLSearchParams("k=<script>"))).toBeNull();
  });
});

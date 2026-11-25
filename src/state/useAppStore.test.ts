import { beforeEach, describe, expect, it } from "vitest";
import { createEmptyFilters } from "../types";
import { useAppStore } from "./useAppStore";
import { readableSearch, writeAppStateToSearchParams } from "./useUrlSync";

const initial = useAppStore.getState();

beforeEach(() => {
  useAppStore.setState(initial, true);
});

describe("uygulama durumu", () => {
  it("çipleri açıp kapatır ve filtreleri sıfırlar", () => {
    const s = useAppStore.getState();
    s.toggleClass("okyeli");
    s.toggleRarity("efsanevi");
    s.toggleRegion("pusluada");
    s.toggleSpecial("kadro");
    s.toggleClass("ocakcan");
    s.toggleClass("okyeli");
    expect(useAppStore.getState().filters).toEqual({
      query: "",
      classes: ["ocakcan"],
      rarities: ["efsanevi"],
      regions: ["pusluada"],
      special: ["kadro"],
    });
    useAppStore.getState().resetFilters();
    expect(useAppStore.getState().filters).toEqual(createEmptyFilters());
  });

  it("seçim, görünüm ve üzerine gelme durumunu tutar", () => {
    const s = useAppStore.getState();
    s.select("isikay");
    s.setView("harita");
    s.setHovered("alptug");
    expect(useAppStore.getState()).toMatchObject({ selectedId: "isikay", view: "harita", hoveredId: "alptug" });
  });

  it("karaktere odaklanmak onu seçer ve her seferinde yeni bir odak isteği üretir", () => {
    const s = useAppStore.getState();
    s.focusCharacter("isikay");
    const first = useAppStore.getState().focus;
    s.focusCharacter("isikay");
    expect(useAppStore.getState().selectedId).toBe("isikay");
    expect(useAppStore.getState().focus).toEqual({ id: "isikay", nonce: first!.nonce + 1 });
  });

  it("aynı karakterin üzerine tekrar gelmek durumu değiştirmez", () => {
    useAppStore.getState().setHovered("alptug");
    const before = useAppStore.getState();
    useAppStore.getState().setHovered("alptug");
    expect(useAppStore.getState()).toBe(before);
  });

  it("URL'den durumu kurar", () => {
    useAppStore.getState().hydrateFromUrl(new URLSearchParams("q=ayaz&sinif=okyeli&bolge=pusluada&k=isikay&gorunum=harita"));
    expect(useAppStore.getState()).toMatchObject({
      filters: { query: "ayaz", classes: ["okyeli"], regions: ["pusluada"] },
      selectedId: "isikay",
      view: "harita",
    });
  });

  it("yazılmakta olan aramayı URL'deki kırpılmış hâliyle ezmez", () => {
    useAppStore.getState().setQuery("ayaz ");
    const typed = useAppStore.getState().filters;
    useAppStore.getState().hydrateFromUrl(new URLSearchParams("q=ayaz"));
    expect(useAppStore.getState().filters).toBe(typed);
    expect(useAppStore.getState().filters.query).toBe("ayaz ");
  });
});

describe("durum → URL", () => {
  it("filtreyi, seçimi ve görünümü yazar; ilgisiz parametreleri korur", () => {
    const params = writeAppStateToSearchParams(
      { filters: { ...createEmptyFilters(), classes: ["ocakcan", "okyeli"] }, selectedId: "kursat", view: "harita" },
      new URLSearchParams("stres=1&k=eski"),
    );
    expect(readableSearch(params)).toBe("stres=1&k=kursat&sinif=okyeli,ocakcan&gorunum=harita");
  });

  it("varsayılan görünümü ve boş seçimi URL'den siler", () => {
    const params = writeAppStateToSearchParams(
      { filters: createEmptyFilters(), selectedId: null, view: "dunya" },
      new URLSearchParams("k=kursat&gorunum=harita&q=ayaz"),
    );
    expect(params.toString()).toBe("");
  });
});

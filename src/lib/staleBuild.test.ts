import { afterEach, describe, expect, it, vi } from "vitest";
import { RELOAD_GAP_MS, isStaleBuildError, reloadForNewBuild, resetStaleBuildState, withStaleReload } from "./staleBuild";

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

afterEach(() => resetStaleBuildState());

describe("isStaleBuildError", () => {
  it("tarayıcıların parça yüklenemedi iletilerini tanır", () => {
    expect(isStaleBuildError(new TypeError("Failed to fetch dynamically imported module: https://x/assets/MapPage-abc.js"))).toBe(true);
    expect(isStaleBuildError(new TypeError("error loading dynamically imported module: https://x/a.js"))).toBe(true);
    expect(isStaleBuildError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(
      isStaleBuildError(
        new TypeError('Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html".'),
      ),
    ).toBe(true);
    expect(isStaleBuildError(new Error("Unable to preload CSS for /assets/index-abc.css"))).toBe(true);
  });

  it("başka hataları eski sürüm saymaz", () => {
    expect(isStaleBuildError(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(false);
    expect(isStaleBuildError(new Error("roster.json okunamadı"))).toBe(false);
    expect(isStaleBuildError(null)).toBe(false);
  });
});

describe("reloadForNewBuild", () => {
  it("bir kez yeniler, kısa sürede ikinciye izin vermez", () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    expect(reloadForNewBuild(1_000, storage, reload)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    resetStaleBuildState(); // sayfa yenilendi: modül baştan yüklenir
    expect(reloadForNewBuild(1_000 + RELOAD_GAP_MS - 1, storage, reload)).toBe(false);
    expect(reloadForNewBuild(1_000 + RELOAD_GAP_MS + 1, storage, reload)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("oturum deposu yoksa döngü riskine girmez", () => {
    const reload = vi.fn();
    expect(reloadForNewBuild(1_000, null, reload)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("withStaleReload", () => {
  it("eski sürüm hatasında yeniler ve hata fırlatmaz", async () => {
    const recover = vi.fn(() => true);
    const load = withStaleReload(() => Promise.reject(new TypeError("Failed to fetch dynamically imported module: /a.js")), recover);
    const outcome = await Promise.race([load().then(() => "çözüldü", () => "hata"), new Promise((r) => setTimeout(() => r("bekliyor"), 20))]);
    expect(outcome).toBe("bekliyor");
    expect(recover).toHaveBeenCalledTimes(1);
  });

  it("yenileme engellenirse ya da hata başkaysa olduğu gibi fırlatır", async () => {
    const stale = new TypeError("Importing a module script failed.");
    await expect(withStaleReload(() => Promise.reject(stale), () => false)()).rejects.toBe(stale);
    const other = new Error("bozuk");
    const recover = vi.fn(() => true);
    await expect(withStaleReload(() => Promise.reject(other), recover)()).rejects.toBe(other);
    expect(recover).not.toHaveBeenCalled();
  });

  it("başarılı yüklemeyi aynen döndürür", async () => {
    await expect(withStaleReload(() => Promise.resolve({ default: 1 }))()).resolves.toEqual({ default: 1 });
  });
});

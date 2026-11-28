/**
 * ESKİ SÜRÜM KURTARMA — site yeniden yayınlanınca açık kalan sekmeler takılmasın.
 *
 * Her yayında parça (chunk) dosyalarının adları değişir; Cloudflare eski adları siler ve onlar istenince ana sayfanın
 * HTML'ini döndürür. Yeni sürümden önce açılmış bir sekme (ya da telefonun önbellekten geri getirdiği sayfa) eski bir
 * parçayı isteyince yükleme başarısız olur: sayfa "Bir fırtına koptu" der ya da yükleme ekranında kalır.
 *
 * Böyle bir hata görülünce sayfa kendini bir kez yeniler; yeni index.html yeni parçaları getirir. Aynı hata kısa sürede
 * yeniden çıkarsa (gerçek bir bozukluk) döngüye girmemek için yenilemez, hata sayfası "Sayfayı yenile" düğmesini gösterir.
 */

const RELOAD_KEY = "oba-tales:surum-yenileme";
/** Bu süre içinde ikinci kez kendiliğinden yenilenmez. */
export const RELOAD_GAP_MS = 30_000;

/** Tarayıcıların "dinamik parça yüklenemedi" iletileri ve Vite'ın ön yükleme hatası. */
const STALE_PATTERNS = [
  /failed to fetch dynamically imported module/i, // Chrome, Edge
  /error loading dynamically imported module/i, // Firefox
  /importing a module script failed/i, // Safari
  /expected a javascript(-or-wasm)? module script/i, // HTML gelen parça (MIME türü)
  /unable to preload css/i, // Vite CSS ön yüklemesi
  /loading (css )?chunk [\w-]+ failed/i,
];

export function isStaleBuildError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? "");
  return STALE_PATTERNS.some((pattern) => pattern.test(message));
}

type SessionLike = Pick<Storage, "getItem" | "setItem">;

function session(): SessionLike | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

let reloading = false;

/** Yenileme başladıysa true: arkadan gelen aynı hatalar hata sayfası göstermesin. */
export function isReloadingForNewBuild(): boolean {
  return reloading;
}

/**
 * Yeni sürüm için sayfayı yeniler. Yakın zamanda zaten yenilendiyse ya da oturum deposu yoksa (döngüyü engelleyemeyiz)
 * yenilemez ve false döner.
 */
export function reloadForNewBuild(
  now: number = Date.now(),
  storage: SessionLike | null = session(),
  reload: () => void = () => window.location.reload(),
): boolean {
  if (reloading) return true;
  if (!storage) return false;
  try {
    const last = Number(storage.getItem(RELOAD_KEY) ?? 0);
    if (last && now - last >= 0 && now - last < RELOAD_GAP_MS) return false;
    storage.setItem(RELOAD_KEY, String(now));
  } catch {
    return false;
  }
  reloading = true;
  reload();
  return true;
}

/** Testler için: modül durumunu sıfırlar. */
export function resetStaleBuildState(): void {
  reloading = false;
}

/**
 * Dinamik içe aktarmayı sarar: eski sürüm hatasında sayfayı yeniler ve yükleme ekranında bekler (söz hiç çözülmez,
 * sayfa zaten yenileniyor). Başka hatalar olduğu gibi fırlatılır.
 */
export function withStaleReload<T>(load: () => Promise<T>, recover: () => boolean = reloadForNewBuild): () => Promise<T> {
  return () =>
    load().catch((error: unknown) => {
      if (isStaleBuildError(error) && recover()) return new Promise<T>(() => {});
      throw error;
    });
}

/** Sarılmamış içe aktarmalar (model yükleyicileri, Vite'ın CSS ön yüklemesi) için genel ağ: main.tsx bir kez kurar. */
export function installStaleBuildRecovery(target: Window = window): void {
  target.addEventListener("vite:preloadError", () => {
    // Hata yine fırlatılır. Önce sarılmış yükleyici yakalasın (ör. yönlendirici tıklanan sayfayı açar), diye bir tur
    // beklenir; o zaten yenilemeyi başlattıysa buradaki çağrı bir şey yapmaz.
    target.setTimeout(() => reloadForNewBuild(), 0);
  });
  target.addEventListener("unhandledrejection", (event) => {
    if (isStaleBuildError(event.reason)) reloadForNewBuild();
  });
}

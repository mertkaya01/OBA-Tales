/**
 * ARAZİ ÖNBELLEĞİ (tarayıcıda kalıcı) — siteye yeniden gelen, araziyi baştan üretmeyi beklemesin.
 *
 * İşçinin ürettiği arazi, patikalar ve boyalı haritalar IndexedDB'de tek kayıt olarak saklanır. Anahtar tohum ve sitenin
 * o anki derleme dosyasının adıdır (terrainWorker.ts): arazi kodu değişip site yeniden yayınlanınca anahtar değişir,
 * eski kayıt silinir. IndexedDB yoksa ya da hata verirse sessizce geçer (arazi her zamanki gibi üretilir).
 */
import type { Trails } from "./paths";
import type { Terrain } from "./terrain";
import type { PaintStyle, PaintedImage } from "./terrainPaint";

export interface StoredTerrain {
  terrain: Terrain;
  trails: Trails;
  paintings: { style: PaintStyle; image: PaintedImage }[];
}

const DB_NAME = "oba-tales-arazi";
const STORE = "arazi";

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Kayıtlı araziyi getirir (yoksa null). */
export async function loadStoredTerrain(key: string): Promise<StoredTerrain | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      request.onsuccess = () => {
        const value = request.result as StoredTerrain | undefined;
        resolve(value && value.terrain && value.trails && Array.isArray(value.paintings) ? value : null);
        db.close();
      };
      request.onerror = () => {
        resolve(null);
        db.close();
      };
    } catch {
      resolve(null);
      db.close();
    }
  });
}

/** Araziyi kaydeder; başka anahtardaki (eski sürüm ya da tohum) kayıtları siler. */
export async function storeTerrain(key: string, value: StoredTerrain): Promise<void> {
  const db = await open();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const keys = store.getAllKeys();
      keys.onsuccess = () => {
        for (const k of keys.result) if (k !== key) store.delete(k);
        store.put(value, key);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}

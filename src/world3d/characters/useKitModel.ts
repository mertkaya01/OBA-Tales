/**
 * Blender kitini tarayıcıda yükler: public/models/karakter-kit.glb (ayrıntı: kitModel.ts).
 * Dosya yoksa (ya da sunucu dosya yerine sayfayı döndürürse) hiçbir şey değişmez, hata gösterilmez.
 */
import { useEffect, useState } from "react";
import { parseKitModel, type KitGeometries } from "./kitModel";

const isGlb = (data: ArrayBuffer) =>
  data.byteLength > 20 && new TextDecoder().decode(new Uint8Array(data, 0, 4)) === "glTF";

let pending: Promise<KitGeometries | null> | null = null;

/** Kiti bir kez indirir; dosya yoksa ya da bozuksa null. */
export function loadKitModel(): Promise<KitGeometries | null> {
  pending ??= (async () => {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}models/karakter-kit.glb`, { cache: "no-cache" });
      if (!response.ok) return null;
      const data = await response.arrayBuffer();
      if (!isGlb(data)) return null;
      const kit = await parseKitModel(data);
      return kit.size > 0 ? kit : null;
    } catch (error) {
      console.warn("[OBA-Tales] karakter-kit.glb okunamadı, koddaki karakterler kullanılıyor.", error);
      return null;
    }
  })();
  return pending;
}

/** Blender kiti yüklenince parça geometrilerini verir; yoksa null kalır. */
export function useKitModel(): KitGeometries | null {
  const [kit, setKit] = useState<KitGeometries | null>(null);
  useEffect(() => {
    let live = true;
    void loadKitModel().then((loaded) => {
      if (live) setKit(loaded);
    });
    return () => {
      live = false;
    };
  }, []);
  return kit;
}

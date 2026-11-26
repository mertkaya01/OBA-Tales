/**
 * PIXI SAHNESİ — küçük, piksel çözünürlüklü bir Pixi uygulaması; CSS ile keskin büyütülür.
 *
 *   <PixiStage width={320} height={180} label="…" setup={(app) => { …; return () => temizle(); }} />
 *
 * Mantıksal boy (ör. 320 × 180) tuvalin gerçek piksel boyudur; tuval kabına sığacak şekilde büyür
 * (image-rendering: pixelated). `resolution` verilirse tuval o kadar kat sık çizilir: piksel efektler yine keskin
 * (nearest) büyür ama pürüzsüz dokular (ör. 3D portre) bulanıklaşmaz. Kurulum bir kez çalışır; farklı içerik için
 * `key` değiştirilir.
 * React'in çift bağlama (StrictMode) yarışına karşı: init bitmeden kaldırılırsa uygulama hemen yok edilir.
 */
import { Application } from "pixi.js";
// Pixi varsayılanda gölgelendirici eşitleme kodunu eval ile üretir; sitenin CSP'si (public/_headers) buna izin vermez.
import "pixi.js/unsafe-eval";
import { useEffect, useRef } from "react";
import { cn } from "../lib/cn";

interface PixiStageProps {
  width: number;
  height: number;
  /** Ekran okuyucu için sahnenin anlatımı. */
  label: string;
  setup: (app: Application) => void | (() => void);
  /** Mantıksal piksel başına gerçek piksel (varsayılan 1: tam piksel sanatı). */
  resolution?: number;
  className?: string;
}

export function PixiStage({ width, height, label, setup, resolution = 1, className }: PixiStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const setupRef = useRef(setup);

  useEffect(() => {
    setupRef.current = setup;
  }, [setup]);

  useEffect(() => {
    let cancelled = false;
    let ready = false;
    let cleanup: void | (() => void);
    const app = new Application();

    app
      .init({ width, height, backgroundAlpha: 0, antialias: false, resolution, autoDensity: false, preference: "webgl", roundPixels: resolution === 1 })
      .then(() => {
        if (cancelled) {
          app.destroy(true, { children: true, texture: true, textureSource: true });
          return;
        }
        ready = true;
        const canvas = app.canvas;
        Object.assign(canvas.style, { width: "100%", height: "100%", display: "block", imageRendering: resolution === 1 ? "pixelated" : "auto" });
        canvas.setAttribute("aria-hidden", "true");
        hostRef.current?.appendChild(canvas);
        cleanup = setupRef.current(app);
        // Geliştirme sırasında konsoldan incelemek için: window.__kbPixi (en son açılan sahne)
        if (import.meta.env.DEV) Object.assign(window, { __kbPixi: app });
      })
      .catch(() => {
        // WebGL açılamadıysa sahne boş kalır; çağıran durağan görüntüyü arkasında tutar.
      });

    return () => {
      cancelled = true;
      if (!ready) return;
      cleanup?.();
      app.destroy(true, { children: true, texture: true, textureSource: true });
    };
  }, [width, height, resolution]);

  return <div ref={hostRef} role="img" aria-label={label} className={cn("relative", className)} style={{ aspectRatio: `${width} / ${height}` }} />;
}

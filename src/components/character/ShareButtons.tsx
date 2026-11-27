/**
 * Paylaş ve Kartı indir — çekmecede karakterin paylaşım kartı (1080 × 1920) ve bağlantısı.
 *
 *   Paylaş       telefonda paylaşım menüsü açılır (Instagram hikâyesi, WhatsApp…): kart görseli, metin ve bağlantı.
 *                Görsel paylaşamayan tarayıcıda yalnızca metin ve bağlantı; o da yoksa bağlantı panoya kopyalanır.
 *   Kartı indir  kartı PNG olarak indirir (bilgisayardan paylaşmak için).
 *
 * Kart tıklanınca çizilir (lib/shareCard); 3D portre ve kart çizici yalnızca o an yüklenir.
 */
import { Check, Download, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getPortraitUrl } from "../../game/sprites/portraitCache";
import { requestPortrait } from "../../game/sprites/usePortrait3d";
import type { Character } from "../../types";

type Status = { kind: "idle" } | { kind: "busy" } | { kind: "done"; message: string } | { kind: "error"; message: string };

async function makeCard(c: Character): Promise<{ file: File; url: string; text: string }> {
  const { drawShareCard, shareText, shareUrl } = await import("../../lib/shareCard");
  // Kartta büyük durur: 3D portreyi yüksek yoğunlukta iste (WebGL yoksa piksel portre).
  const portrait = await requestPortrait(c, 160, 200, 4);
  const blob = await drawShareCard(c, { portrait, pixelPortrait: getPortraitUrl(c, 16), host: window.location.host });
  return { file: new File([blob], `oba-tales-${c.handle}.png`, { type: "image/png" }), url: shareUrl(c, window.location.origin), text: shareText(c) };
}

export function ShareButtons({ character }: { character: Character }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    if (status.kind !== "done" && status.kind !== "error") return;
    const timer = window.setTimeout(() => setStatus({ kind: "idle" }), 3000);
    return () => window.clearTimeout(timer);
  }, [status]);

  const share = async () => {
    setStatus({ kind: "busy" });
    try {
      const { file, url, text } = await makeCard(character);
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "OBA-Tales", text: `${text} ${url}` });
        setStatus({ kind: "idle" });
      } else if (navigator.share) {
        await navigator.share({ title: "OBA-Tales", text, url });
        setStatus({ kind: "idle" });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setStatus({ kind: "done", message: "Metin ve bağlantı kopyalandı" });
      }
    } catch (error) {
      // Paylaşım menüsünü kapatmak hata değildir.
      if ((error as Error).name === "AbortError") setStatus({ kind: "idle" });
      else setStatus({ kind: "error", message: "Paylaşılamadı; Kartı indir'i dene." });
    }
  };

  const download = async () => {
    setStatus({ kind: "busy" });
    try {
      const { file } = await makeCard(character);
      const href = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = href;
      a.download = file.name;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(href), 5000);
      setStatus({ kind: "done", message: "Kart indirildi" });
    } catch {
      setStatus({ kind: "error", message: "Kart oluşturulamadı." });
    }
  };

  const busy = status.kind === "busy";
  return (
    <div className="mt-3 flex flex-col items-center gap-1.5">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void share()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gunozu-400 px-4 py-2 font-display text-sm text-gece-950 shadow hover:bg-gunozu-300 disabled:opacity-60"
        >
          <Share2 aria-hidden className="size-4" />
          {busy ? "Kart hazırlanıyor…" : "Paylaş"}
        </button>
        <button
          type="button"
          onClick={() => void download()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-sm text-buz-100 hover:bg-white/10 disabled:opacity-60"
        >
          <Download aria-hidden className="size-4" />
          Kartı indir
        </button>
      </div>
      <p aria-live="polite" className="min-h-4 text-xs text-buz-300">
        {status.kind === "done" && (
          <span className="inline-flex items-center gap-1 text-zumrut-300">
            <Check aria-hidden className="size-3.5" />
            {status.message}
          </span>
        )}
        {status.kind === "error" && <span className="text-alev-300">{status.message}</span>}
      </p>
    </div>
  );
}

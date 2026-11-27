/**
 * Üst menüdeki sosyal medya hesapları ve "Destek" düğmesi. Bağlantılar world.json'dan (yönetim panelinden girilir).
 * Destek bağlantısı yoksa düğme "Destek yakında" der, hiçbir yere gitmez.
 */
import { Heart } from "lucide-react";
import { useState } from "react";
import { PLATFORM_LABELS } from "../../content/classes";
import { cn } from "../../lib/cn";
import { PLATFORMS, type SocialLinks as Links } from "../../types";
import { PlatformIcon } from "../character/PlatformIcon";

export function SocialLinks({ links, supportUrl, className, compact = false }: { links: Links; supportUrl: string | null; className?: string; compact?: boolean }) {
  const [soon, setSoon] = useState(false);
  const pill = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm";
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {PLATFORMS.map((p) => {
        const href = links[p];
        if (!href) return null;
        return (
          <a
            key={p}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="grid size-9 place-items-center rounded-full text-buz-200 transition-colors hover:bg-white/10 hover:text-buz-50"
            aria-label={`OBA-Tales ${PLATFORM_LABELS[p]} hesabı (yeni sekmede açılır)`}
            title={PLATFORM_LABELS[p]}
          >
            <PlatformIcon platform={p} className="size-[18px]" />
          </a>
        );
      })}
      {supportUrl ? (
        <a href={supportUrl} target="_blank" rel="noopener noreferrer" className={cn(pill, "ml-1 border-kilim-400/50 bg-kilim-400/10 text-kilim-200 hover:bg-kilim-400/20")}>
          <Heart aria-hidden className="size-4" />
          Destek ol
        </a>
      ) : (
        <span className="relative ml-1">
          <button
            type="button"
            className={cn(pill, "border-white/15 text-buz-200 hover:bg-white/10")}
            aria-describedby={soon ? "destek-yakinda" : undefined}
            onClick={() => setSoon((s) => !s)}
            onBlur={() => setSoon(false)}
          >
            <Heart aria-hidden className="size-4" />
            {compact ? "Destek · yakında" : "Destek"}
          </button>
          {soon && !compact && (
            <span id="destek-yakinda" role="status" className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-white/15 bg-gece-900/95 px-3 py-2 text-xs text-buz-100 shadow-lg">
              Destek yakında! Obaya katkı yolları hazırlanıyor; o zamana kadar takip edip paylaşman yeter.
            </span>
          )}
        </span>
      )}
    </div>
  );
}

/**
 * Dede Toygar'ın sözü: küçük piksel portresi ve anlatısı (sezon girişi, bölüm sonu özetleri).
 */
import type { ReactNode } from "react";
import { CAST } from "../../content/cast";
import { cn } from "../../lib/cn";
import { CharacterPortrait } from "../character/CharacterPortrait";

const NARRATOR = CAST.find((c) => c.roleType === "narrator")!;

export function NarratorQuote({ children, className, compact = false }: { children: ReactNode; className?: string; compact?: boolean }) {
  return (
    <figure className={cn("flex gap-3", className)}>
      <CharacterPortrait character={NARRATOR} size={compact ? "sm" : "md"} className="shrink-0 self-start" />
      <div className="min-w-0">
        <blockquote className={cn("italic text-yun-100", compact ? "text-sm" : "text-base")}>{children}</blockquote>
        <figcaption className="mt-1 text-xs text-buz-300">
          — {NARRATOR.displayName}, {NARRATOR.epithet.toLocaleLowerCase("tr")}
        </figcaption>
      </div>
    </figure>
  );
}

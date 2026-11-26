/**
 * Karartılı (hikâyede henüz açılmamış) bölge ya da adanın üstündeki "?" işareti. Fareyle üzerine gelince, klavyeyle
 * odaklanınca ya da dokununca ipucu çıkar: "Sizlerin desteğiyle yakında".
 *
 * İşaret ekranın kenarına yakınsa ipucu içeri doğru açılır (soldaysa sağa, sağdaysa sola, üstteyse aşağı): kesilmez.
 */
import { useState } from "react";
import { HIDDEN_LAND_HINT } from "../../content/story";
import { cn } from "../../lib/cn";

/** İpucunun kenara olan payı (piksel): ipucu yaklaşık bu genişliğin iki katı. */
const EDGE = 120;
const TOP_EDGE = 70;

export function HiddenMark({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  const [side, setSide] = useState("");
  const place = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const parts: string[] = [];
    if (r.left + r.width / 2 < EDGE) parts.push("sol");
    else if (window.innerWidth - (r.left + r.width / 2) < EDGE) parts.push("sag");
    if (r.top < TOP_EDGE) parts.push("alt");
    setSide(parts.join(" "));
  };
  return (
    <button
      type="button"
      className={cn("kb-gizli pointer-events-auto", size === "lg" && "kb-gizli--buyuk", className)}
      aria-label={`Gizli kara. ${HIDDEN_LAND_HINT}`}
      data-yer={side || undefined}
      onPointerEnter={(e) => place(e.currentTarget)}
      onFocus={(e) => place(e.currentTarget)}
    >
      <span aria-hidden className="kb-gizli__isaret">
        ?
      </span>
      <span role="tooltip" className="kb-gizli__ipucu">
        {HIDDEN_LAND_HINT}
      </span>
    </button>
  );
}

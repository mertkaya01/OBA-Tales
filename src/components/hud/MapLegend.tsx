/**
 * Lejant: nadirlik çerçeveleri, sınıf simgeleri, akın işareti ve sis. Açılıp kapanabilir.
 */
import { Info } from "lucide-react";
import { CLASS_LIST } from "../../content/classes";
import { RARITY_LIST } from "../../content/rarities";
import { cn } from "../../lib/cn";
import type { Rarity } from "../../types";
import { ClassIcon } from "../character/ClassIcon";

const SWATCH: Record<Rarity, string> = {
  siradan: "frame-siradan",
  nadir: "frame-nadir",
  destansi: "frame-destansi",
  efsanevi: "frame-efsanevi",
  ulu: "frame-ulu",
  goksel: "frame-goksel",
};

export function MapLegend({ className }: { className?: string }) {
  return (
    <details className={cn("group rounded-xl border border-white/15 bg-gece-900/90 text-sm shadow-lg backdrop-blur", className)}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 font-display text-buz-100 [&::-webkit-details-marker]:hidden">
        <Info aria-hidden className="size-4" />
        Lejant
      </summary>
      <div className="grid gap-3 border-t border-white/10 px-3 py-3 sm:w-64">
        <ul className="grid grid-cols-2 gap-1.5">
          {RARITY_LIST.map((r) => (
            <li key={r.id} className="flex items-center gap-2 text-buz-200">
              <span aria-hidden className={cn("size-4 rounded border-2", SWATCH[r.id])} />
              {r.label}
            </li>
          ))}
        </ul>
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {CLASS_LIST.map((c) => (
            <li key={c.id} className="flex items-center gap-1 text-buz-200">
              <ClassIcon classId={c.id} />
              {c.name}
            </li>
          ))}
        </ul>
        <ul className="grid gap-1 text-buz-300">
          <li className="flex items-center gap-2">
            <span aria-hidden className="size-2 bg-gunozu-300 shadow-[0_0_6px_var(--color-gunozu-300)]" />
            Aktif bölüm akınında
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="size-3 rounded-sm bg-buz-100/60" />
            Sisli bölge: akın henüz ulaşmadı
          </li>
        </ul>
      </div>
    </details>
  );
}

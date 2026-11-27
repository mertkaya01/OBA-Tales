/**
 * Sınıf sayaçları (haritanın orta üstü): haritadaki Kalkaneri, Okyeli ve Ocakcan sayıları. Kahramanlar da sayılır.
 * Süzgeçten bağımsızdır: obanın bütün gücünü gösterir.
 */
import { CLASS_LIST } from "../../content/classes";
import { formatNumber } from "../../lib/text";
import { cn } from "../../lib/cn";
import type { Character } from "../../types";
import { ClassIcon } from "../character/ClassIcon";

export function ClassCounts({ characters, className }: { characters: readonly Character[]; className?: string }) {
  const counts = new Map<string, number>();
  for (const c of characters) counts.set(c.class.id, (counts.get(c.class.id) ?? 0) + 1);
  return (
    <ul
      aria-label="Haritadaki sınıf sayıları"
      className={cn("flex items-center gap-1 rounded-full border border-white/15 bg-gece-900/90 px-2 py-1 shadow-lg backdrop-blur", className)}
    >
      {CLASS_LIST.map((cls) => (
        <li key={cls.id} className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs text-buz-100" title={`${cls.name} · ${cls.archetypeLabel}`}>
          <ClassIcon classId={cls.id} className="size-4" />
          <span className="font-display tabular-nums text-buz-50">{formatNumber(counts.get(cls.id) ?? 0)}</span>
          <span className="hidden text-buz-300 sm:inline">{cls.name}</span>
        </li>
      ))}
    </ul>
  );
}

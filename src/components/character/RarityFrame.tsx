/**
 * Nadirlik çerçevesi — portrenin etrafındaki kenar, aura ve yıldız-ayaz izi.
 *
 *   Sıradan  düz yün kenar
 *   Nadir    zümrüt kenar
 *   Destansı mor-altın gradyan kenar + nabız gibi atan aura
 *   Efsanevi kızıl-altın gradyan kenar + aura + parıldayan yıldızlar
 * Alev ya da ışık aurası olan karakterlerde auranın rengi elemente göre değişir.
 */
import type { ReactNode } from "react";
import { RARITY_INFO } from "../../content/rarities";
import { cn } from "../../lib/cn";
import type { ElementAura, Rarity } from "../../types";

const FRAME_CLASS: Record<Rarity, string> = {
  siradan: "frame-siradan",
  nadir: "frame-nadir",
  destansi: "frame-destansi",
  efsanevi: "frame-efsanevi",
  ulu: "frame-ulu",
  goksel: "frame-goksel",
};

const AURA_CLASS = {
  alev: "bg-alev-400/50",
  isik: "bg-buz-100/45",
  destansi: "bg-destansi/40",
  efsanevi: "bg-efsanevi/45",
  ulu: "bg-ulu/50",
  goksel: "bg-goksel/55",
} as const;

const SPARKLES = [
  { position: "-right-1 -top-1", delay: "0s" },
  { position: "-left-1 bottom-2", delay: "0.6s" },
  { position: "right-2 -bottom-1", delay: "1.2s" },
];

interface RarityFrameProps {
  rarity: Rarity;
  elementAura?: ElementAura;
  children: ReactNode;
  className?: string;
}

export function RarityFrame({ rarity, elementAura = null, children, className }: RarityFrameProps) {
  const info = RARITY_INFO[rarity];
  const aura = elementAura ?? (info.hasAura ? (rarity as "destansi" | "efsanevi" | "ulu" | "goksel") : null);

  return (
    <span className={cn("relative isolate inline-flex shrink-0 items-center justify-center rounded-xl border-2", FRAME_CLASS[rarity], className)}>
      {aura && <span aria-hidden className={cn("absolute -inset-1.5 -z-10 rounded-2xl blur-md motion-safe:animate-aura", AURA_CLASS[aura])} />}
      {info.hasTrail &&
        SPARKLES.map((s) => (
          <span
            key={s.position}
            aria-hidden
            className={cn("absolute size-1.5 bg-gunozu-200 shadow-[0_0_6px_var(--color-gunozu-300)] motion-safe:animate-ayaz", s.position)}
            style={{ animationDelay: s.delay }}
          />
        ))}
      {children}
    </span>
  );
}

/**
 * Rozet listesi. Kısa hâli çekmece başlığında, ayrıntılı hâli açıklamalarıyla birlikte gösterilir.
 */
import {
  Award,
  Compass,
  Flag,
  Footprints,
  Music,
  PartyPopper,
  Snowflake,
  Sprout,
  Sun,
  Tent,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { BADGES } from "../../content/badges";
import { cn } from "../../lib/cn";
import type { BadgeId } from "../../types";

/** content/badges.ts içindeki `icon` adları → simge bileşenleri. */
const ICONS: Readonly<Record<string, LucideIcon>> = {
  footprints: Footprints,
  flag: Flag,
  tent: Tent,
  sprout: Sprout,
  snowflake: Snowflake,
  "party-popper": PartyPopper,
  compass: Compass,
  wind: Wind,
  sun: Sun,
  music: Music,
};

interface BadgeListProps {
  badges: readonly BadgeId[];
  /** Açıklamaları da göster. */
  detailed?: boolean;
  /** Ayrıntılı hâlde nasıl kazanıldığını da yaz (Obaya Katıl sayfası). */
  howToEarn?: boolean;
  className?: string;
}

export function BadgeList({ badges, detailed = false, howToEarn = false, className }: BadgeListProps) {
  if (badges.length === 0) {
    return detailed ? <p className={cn("text-sm text-buz-300", className)}>Henüz rozet yok; ilk akın yakında!</p> : null;
  }

  return (
    <ul className={cn(detailed ? "flex flex-col gap-2" : "flex flex-wrap gap-1.5", className)}>
      {badges.map((id) => {
        const badge = BADGES[id];
        const Icon = ICONS[badge.icon] ?? Award;
        return detailed ? (
          <li key={id} className="flex gap-3 rounded-xl border border-gunozu-400/20 bg-gunozu-400/5 p-2.5">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-gunozu-400/15 text-gunozu-300">
              <Icon aria-hidden className="size-4" />
            </span>
            <span>
              <span className="block font-semibold text-buz-50">{badge.name}</span>
              <span className="block text-sm text-buz-300">{badge.description}</span>
              {howToEarn && <span className="mt-0.5 block text-xs text-gunozu-200">Nasıl kazanılır: {badge.howToEarn}</span>}
            </span>
          </li>
        ) : (
          <li
            key={id}
            title={badge.description}
            className="inline-flex items-center gap-1 rounded-full border border-gunozu-400/30 bg-gunozu-400/10 px-2 py-0.5 text-xs text-gunozu-200"
          >
            <Icon aria-hidden className="size-3.5" />
            {badge.name}
          </li>
        );
      })}
    </ul>
  );
}

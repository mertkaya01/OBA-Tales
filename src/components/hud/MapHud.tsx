/**
 * Haritanın üst bilgi bandı: aktif bölüm ve görünen karakterlerin sınıf sayaçları.
 */
import { Sparkles, Swords } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";
import { BOSSES } from "../../content/bosses";
import { EPISODE_STATUS_LABELS } from "../../content/episodes";
import { useGameData } from "../../data/useGameData";
import { countByClass } from "../../lib/clustering";
import { cn } from "../../lib/cn";
import { formatNumber } from "../../lib/text";
import { useAppStore } from "../../state/useAppStore";
import { CLASS_IDS } from "../../types";
import type { Character } from "../../types";
import { ClassIcon } from "../character/ClassIcon";
import { CLASS_TEXT } from "../character/styles";
import { CLASSES } from "../../content/classes";

interface MapHudProps {
  visible: readonly Character[];
  className?: string;
}

export function MapHud({ visible, className }: MapHudProps) {
  const { activeEpisode } = useGameData();
  const counts = useMemo(() => countByClass(visible), [visible]);
  const setRaidOpen = useAppStore((s) => s.setRaidOpen);
  const boss = activeEpisode.bossId ? BOSSES[activeEpisode.bossId] : null;

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-gece-900/85 px-3 py-2 text-center shadow-lg backdrop-blur",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Link
          to={`/bolumler#${activeEpisode.id}`}
          className="flex items-center gap-1.5 whitespace-nowrap font-display text-sm text-gunozu-300 hover:text-gunozu-200 sm:text-base"
        >
          {boss ? <Swords aria-hidden className="size-4 shrink-0" /> : <Sparkles aria-hidden className="size-4 shrink-0" />}
          <span>
            Bölüm {activeEpisode.number} · {activeEpisode.title}
          </span>
        </Link>
        {boss && activeEpisode.status === "aktif" ? (
          <button
            type="button"
            onClick={() => setRaidOpen(true)}
            className="rounded-full border border-alev-400/50 bg-alev-400/15 px-2 py-0.5 text-xs whitespace-nowrap text-alev-300 transition-colors hover:bg-alev-400/25"
            title={`${boss.name} akınını izle ve provasını yap`}
          >
            Akını izle<span className="hidden lg:inline"> · {boss.name}</span>
          </button>
        ) : (
          <span className="hidden rounded-full bg-gunozu-400/15 px-2 text-xs text-gunozu-200 lg:inline">
            {boss ? `Boss: ${boss.name}` : EPISODE_STATUS_LABELS[activeEpisode.status]}
          </span>
        )}
      </div>
      <ul className="flex items-center gap-3 text-xs sm:text-sm" aria-label="Görünen karakterler">
        {CLASS_IDS.map((id) => (
          <li key={id} className="flex items-center gap-1">
            <ClassIcon classId={id} className="size-3.5" />
            <span className={cn("font-display tabular-nums", CLASS_TEXT[id])}>{formatNumber(counts[id])}</span>
            <span className="text-buz-300">{CLASSES[id].name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

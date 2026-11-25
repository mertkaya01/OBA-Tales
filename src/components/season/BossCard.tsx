/**
 * Boss kartı — bölüm ilerledikçe açılır:
 *   kilitli → koyu siluet ve "???"     yakında → siluet ve adı
 *   aktif   → renkli, öfkeli hâli, zayıf noktası ve "Akını izle"
 *   bitti   → sakinleşmiş hâli ve obanın dostu oluşu
 */
import { Lock, Swords } from "lucide-react";
import { REGIONS } from "../../content/regions";
import { cn } from "../../lib/cn";
import { bossReveal } from "../../lib/season";
import { useAppStore } from "../../state/useAppStore";
import type { Boss, EpisodeStatus } from "../../types";
import { Badge } from "../ui/Badge";
import { ELEMENT_LABELS, bossImageUrl } from "./seasonArt";

export function BossCard({ boss, status, episodeId }: { boss: Boss; status: EpisodeStatus; episodeId: string }) {
  const reveal = bossReveal(status);
  const setRaidOpen = useAppStore((s) => s.setRaidOpen);
  const hidden = reveal === "gizem";

  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border bg-gece-900/70",
        reveal === "tam" ? "border-alev-400/60 shadow-[0_0_30px_rgb(240_122_69/0.15)]" : "border-white/10",
      )}
    >
      <div
        className={cn(
          "relative grid h-40 place-items-end justify-center overflow-hidden pb-3",
          reveal === "sakin" ? "bg-gradient-to-b from-gunozu-400/10 to-gece-950" : "bg-gradient-to-b from-buz-500/10 to-gece-950",
        )}
      >
        <img src={bossImageUrl(boss.id, reveal)} alt={hidden ? "Gizemli boss silueti" : `${boss.name} piksel resmi`} className="pixelated h-32 w-auto max-w-[88%] object-contain" />
        {hidden && (
          <span className="absolute inset-0 grid place-items-center font-display text-5xl text-buz-300/60" aria-hidden>
            ?
          </span>
        )}
        <a href={`#${episodeId}`} className="absolute left-3 top-3">
          <Badge tone={reveal === "tam" ? "red" : reveal === "sakin" ? "gold" : "neutral"} icon={reveal === "gizem" ? <Lock aria-hidden className="size-3" /> : undefined}>
            Bölüm {boss.episode}
          </Badge>
        </a>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <header>
          <h3 className="font-display text-xl text-buz-50">{hidden ? "???" : boss.name}</h3>
          <p className="text-sm text-gunozu-200">{hidden ? "Sis henüz dağılmadı" : boss.epithet}</p>
        </header>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="ice">{REGIONS[boss.region].name}</Badge>
          {!hidden && <Badge>{ELEMENT_LABELS[boss.element]}</Badge>}
        </div>

        {reveal === "siluet" && <p className="text-sm text-buz-300">Akın günü yaklaşıyor. Obanın kulakları rüzgârda: kimdir, ne ister?</p>}
        {(reveal === "tam" || reveal === "sakin") && <p className="text-sm text-buz-200">{boss.description}</p>}
        {reveal === "tam" && (
          <p className="rounded-lg border border-gunozu-400/20 bg-gunozu-400/5 p-2 text-sm text-gunozu-100">
            <b className="font-semibold">Zayıf noktası:</b> {boss.weakness}
          </p>
        )}
        {reveal === "sakin" && (
          <p className="rounded-lg border border-zumrut-400/25 bg-zumrut-500/10 p-2 text-sm text-zumrut-300">
            <b className="font-semibold">Akından sonra:</b> {boss.resolution}
          </p>
        )}

        {reveal === "tam" && (
          <button
            type="button"
            onClick={() => setRaidOpen(true)}
            className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-alev-400/50 bg-alev-400/15 px-3 py-2 font-display text-alev-300 hover:bg-alev-400/25"
          >
            <Swords aria-hidden className="size-4" />
            Akını izle
          </button>
        )}
      </div>
    </article>
  );
}

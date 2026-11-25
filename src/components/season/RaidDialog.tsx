/**
 * BOSS AKINI PANELİ — aktif bölümün boss'u, akın provası sahnesi ve akının bilgileri.
 *
 * Haritadaki üst banttan ("Akını izle") ya da 3D dünyadaki boss plakasından açılır. Modal bir diyalogdur:
 * odak içeri taşınır, Esc ile ya da arka plana tıklayınca kapanır, kapanınca odak geri döner.
 * Pixi sahnesi tembel yüklenir; WebGL yoksa boss'un durağan piksel resmi görünür.
 */
import { Eye, Swords, Users, X } from "lucide-react";
import { lazy, Suspense, useEffect, useId, useMemo, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { BOSSES } from "../../content/bosses";
import { REGIONS } from "../../content/regions";
import { useGameData } from "../../data/useGameData";
import { bossSprite } from "../../game/fx/bossSprites";
import { rgbaToDataUrl } from "../../game/sprites/portraitCache";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useWebGLSupport } from "../../hooks/useWebGLSupport";
import { formatNumber } from "../../lib/text";
import { usePixiTurn } from "../../pixi/pixiLease";
import { useAppStore } from "../../state/useAppStore";
import type { BossId, Character } from "../../types";

const BossRaidScene = lazy(() => import("../../pixi/BossRaidScene"));

function StillBoss({ bossId }: { bossId: BossId }) {
  const url = useMemo(() => rgbaToDataUrl(bossSprite(bossId).sprite), [bossId]);
  return (
    <div className="grid aspect-[16/9] place-items-center rounded-xl border border-white/10 bg-gece-950">
      <img src={url} alt={`${BOSSES[bossId].name} piksel resmi`} className="pixelated h-3/4 w-auto" />
    </div>
  );
}

export function RaidDialog() {
  const open = useAppStore((s) => s.raidOpen);
  const setOpen = useAppStore((s) => s.setRaidOpen);
  const { activeEpisode, activeParticipantIds, characterById } = useGameData();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const webgl = useWebGLSupport();
  const boss = activeEpisode.bossId ? BOSSES[activeEpisode.bossId] : null;
  const live = usePixiTurn("akin", open && webgl && boss !== null);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Canlı izleme 3D dünya ister: WebGL olmalı ve aktif bölümde akıncılar saf tutmuş olmalı.
  const formationReady = webgl && activeEpisode.status === "aktif" && activeParticipantIds.size > 0;
  const watchOnMap = () => {
    if (pathname !== "/") navigate("/");
    useAppStore.getState().watchRaid();
  };
  const titleId = useId();

  const participants = useMemo(
    () => [...activeParticipantIds].map((id) => characterById.get(id)).filter((c): c is Character => !!c),
    [activeParticipantIds, characterById],
  );

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus({ preventScroll: true });
    // Yakalama aşamasında dinlenir: Esc yalnızca bu paneli kapatsın, arkadaki karakter çekmecesini değil.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open, setOpen]);

  if (!open || !boss) return null;
  const region = REGIONS[boss.region];

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-gece-950/70 p-3 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-gece-900/95 shadow-2xl outline-none"
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-alev-300">
              <Swords aria-hidden className="size-3.5" />
              Bölüm {activeEpisode.number} akını · {region.name}
            </p>
            <h2 id={titleId} className="truncate text-xl text-gunozu-300">
              {boss.name} <span className="text-base text-buz-200">· {boss.epithet}</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-buz-200 hover:bg-white/10 hover:text-buz-50"
            aria-label="Akın panelini kapat"
          >
            <X aria-hidden className="size-5" />
          </button>
        </header>

        <div className="grid gap-4 px-4 py-4">
          {live ? (
            <Suspense fallback={<StillBoss bossId={boss.id} />}>
              <BossRaidScene bossId={boss.id} participants={participants} reducedMotion={reducedMotion} />
            </Suspense>
          ) : (
            <StillBoss bossId={boss.id} />
          )}

          {formationReady && (
            <button
              type="button"
              onClick={watchOnMap}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-alev-400/50 bg-alev-400/15 px-4 py-2.5 font-display text-alev-300 hover:bg-alev-400/25"
            >
              <Eye aria-hidden className="size-4" />
              Savaşı haritada canlı izle
            </button>
          )}

          <p className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-buz-300">
            Bu bir <b className="text-buz-100">akın provası</b>: istediğin kadar dene. Gerçek akın bölüm boyunca obanın
            oylarıyla ilerler; sonunu Dede Toygar bölüm özetinde anlatır.
          </p>

          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <h3 className="mb-1 font-display text-xs uppercase tracking-widest text-buz-300">Kim bu?</h3>
              <p className="text-buz-100">{boss.description}</p>
            </div>
            <div className="grid content-start gap-3">
              <div>
                <h3 className="mb-1 font-display text-xs uppercase tracking-widest text-buz-300">Zayıf noktası</h3>
                <p className="text-gunozu-100">{boss.weakness}</p>
              </div>
              <div className="flex items-center gap-2 text-buz-200">
                <Users aria-hidden className="size-4" />
                <span>
                  <b className="font-display text-buz-50 tabular-nums">{formatNumber(participants.length)}</b> akıncı bu akında
                </span>
              </div>
              <Link
                to="/katil"
                onClick={() => setOpen(false)}
                className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-gunozu-400/50 bg-gunozu-400/10 px-3 py-1.5 font-display text-gunozu-200 hover:bg-gunozu-400/20"
              >
                Sen de akına katıl
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

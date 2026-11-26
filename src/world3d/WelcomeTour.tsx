/**
 * İlk oba turu: Dede Toygar'ın anlattığı, kamerayı adalar, Kut Kapısı, Akınburnu obası ve akın meydanı arasında
 * uçuran kısa tanıtım (adımlar: content/tour.ts). İleri/Geri düğmeleri ya da ok tuşları; Esc ya da "Turu geç" kapatır.
 * Haritayı kapatmaz: dünya arkada çalışmaya devam eder, ama tur açıkken kamerayı tur yönetir.
 */
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useState, type RefObject } from "react";
import { Link } from "react-router";
import { CharacterPortrait } from "../components/character/CharacterPortrait";
import { tourSteps, type TourStep } from "../content/tour";
import { cn } from "../lib/cn";
import type { Character, Coordinates } from "../types";
import type { CameraRigHandle } from "./CameraRig";
import { LANDMARKS, VILLAGES } from "./layout";

interface WelcomeTourProps {
  rig: RefObject<CameraRigHandle | null>;
  narrator: Character | undefined;
  boss: string | null;
  /** Akın meydanının ortası (aktif akın yoksa null). */
  raidCenter: Coordinates | null;
  onClose: () => void;
}

/** Arama kutusuna odaklanır (HeroSearch, data-hero-search). */
function focusSearch(): void {
  document.querySelector<HTMLInputElement>("[data-hero-search]")?.focus();
}

export function WelcomeTour({ rig, narrator, boss, raidCenter, onClose }: WelcomeTourProps) {
  const steps = useMemo(() => tourSteps(raidCenter ? boss : null), [boss, raidCenter]);
  const [index, setIndex] = useState(0);
  const step: TourStep = steps[index];
  const last = index === steps.length - 1;

  // Her adımda kamera o yere uçar.
  useEffect(() => {
    const camera = rig.current;
    if (!camera) return;
    if (step.target === "adalar" || step.target === "arama") camera.reset();
    else if (step.target === "kapi") camera.flyTo(LANDMARKS.kutKapisi, 9);
    else if (step.target === "oba") camera.flyTo(VILLAGES[0].center, 7.5);
    else if (step.target === "meydan" && raidCenter) camera.flyTo(raidCenter, 6.5);
  }, [step, rig, raidCenter]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") setIndex((i) => Math.min(steps.length - 1, i + 1));
      else if (event.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, steps.length]);

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="tur-baslik"
      className="pointer-events-auto absolute inset-x-3 bottom-24 z-20 mx-auto max-w-lg rounded-2xl border border-gunozu-400/40 bg-gece-900/95 p-4 shadow-2xl backdrop-blur sm:bottom-20"
    >
      <div className="flex gap-3">
        {narrator && <CharacterPortrait character={narrator} size="md" alt="" className="shrink-0 self-start" />}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-buz-300">Dede Toygar · Anlatıcı</p>
          <h2 id="tur-baslik" className="font-display text-xl text-gunozu-200">
            {step.title}
          </h2>
          <p key={step.id} className="mt-1 text-sm text-buz-50 motion-safe:animate-fade-in" aria-live="polite">
            {step.text}
          </p>
        </div>
        <button type="button" onClick={onClose} className="self-start rounded-lg p-1 text-buz-300 hover:bg-white/10 hover:text-buz-50" aria-label="Turu kapat">
          <X aria-hidden className="size-4" />
        </button>
      </div>

      {last && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              window.setTimeout(focusSearch, 50);
            }}
            className="rounded-xl border border-gunozu-400/60 bg-gunozu-400/15 px-3 py-1.5 font-display text-sm text-gunozu-100 hover:bg-gunozu-400/25"
          >
            Kendimi bul
          </button>
          <Link to="/katil" onClick={onClose} className="rounded-xl border border-white/15 px-3 py-1.5 font-display text-sm text-buz-100 hover:bg-white/10">
            Obaya katıl
          </Link>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex gap-1.5" aria-label={`Adım ${index + 1} / ${steps.length}`} role="img">
          {steps.map((s, i) => (
            <span key={s.id} aria-hidden className={cn("size-2 rounded-full", i === index ? "bg-gunozu-300" : i < index ? "bg-gunozu-300/40" : "bg-white/20")} />
          ))}
        </div>
        <div className="flex gap-2">
          {index > 0 ? (
            <button type="button" onClick={() => setIndex(index - 1)} className="inline-flex items-center gap-1 rounded-xl border border-white/15 px-3 py-1.5 text-sm text-buz-100 hover:bg-white/10">
              <ChevronLeft aria-hidden className="size-4" />
              Geri
            </button>
          ) : (
            <button type="button" onClick={onClose} className="rounded-xl px-3 py-1.5 text-sm text-buz-300 hover:bg-white/10 hover:text-buz-100">
              Turu geç
            </button>
          )}
          {!last && (
            <button
              type="button"
              onClick={() => setIndex(index + 1)}
              className="inline-flex items-center gap-1 rounded-xl border border-gunozu-400/60 bg-gunozu-400/15 px-3 py-1.5 font-display text-sm text-gunozu-100 hover:bg-gunozu-400/25"
            >
              İleri
              <ChevronRight aria-hidden className="size-4" />
            </button>
          )}
          {last && (
            <button type="button" onClick={onClose} className="rounded-xl border border-white/15 px-3 py-1.5 text-sm text-buz-100 hover:bg-white/10">
              Bitir
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Geliş sineması (DOM tarafı): zamanı yürütür, kamerayı Kut Kapısı'ndan kahramanın obasına uçurur, sinema bantlarını,
 * altyazıyı ve "… geldi!" kartını gösterir. 3D efektler (kapının parlaması, ışık küresi, sütun) aynı runtime'ı okur.
 * "Atla" ya da Esc sinemayı bitirir. Hareket azaltma tercihinde küre uçmaz: kahraman kartla birlikte hemen belirir.
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import { LANDMARKS } from "../../content/sites";
import type { Character, Coordinates } from "../../types";
import type { CameraRigHandle } from "../CameraRig";
import { ARRIVAL_LENGTH, arrivalAt, type ArrivalRuntime } from "./arrival";

interface ArrivalCinematicProps {
  hero: Character;
  /** Kahramanın belireceği yer (obasındaki yeri). */
  spot: Coordinates;
  runtime: ArrivalRuntime;
  rig: RefObject<CameraRigHandle | null>;
  reducedMotion: boolean;
  /** Kahraman belirdiğinde (haritaya eklenir). */
  onReveal: () => void;
  onDone: () => void;
}

interface Shown {
  caption: string | null;
  card: boolean;
  letterbox: boolean;
}

export function ArrivalCinematic({ hero, spot, runtime, rig, reducedMotion, onReveal, onDone }: ArrivalCinematicProps) {
  const [shown, setShown] = useState<Shown>({ caption: null, card: false, letterbox: false });
  const doneRef = useRef(false);
  const callbacks = useRef({ onReveal, onDone });
  useEffect(() => {
    callbacks.current = { onReveal, onDone };
  }, [onReveal, onDone]);

  useEffect(() => {
    doneRef.current = false;
    // Hareket azaltılmışsa sinema kartın başladığı andan açılır (küre uçmaz).
    const offset = reducedMotion ? 5 : 0;
    let start = -1;
    let revealed = false;
    let followedOrb = false;
    let flewToHero = false;
    let raf = 0;
    const tick = () => {
      // Kamera (CameraRig) sahne kurulunca hazır olur: sinema ancak o zaman başlar.
      if (start < 0) {
        if (!rig.current) {
          raf = requestAnimationFrame(tick);
          return;
        }
        start = performance.now() - offset * 1000;
        runtime.active = true;
        rig.current.flyTo(reducedMotion ? spot : LANDMARKS.kutKapisi, reducedMotion ? 11 : 7.5);
      }
      const t = (performance.now() - start) / 1000;
      runtime.t = t;
      const frame = arrivalAt(t);
      // Küre uçarken kamera yolun ortasına çekilir (kapı ve oba birlikte kadrajda); inerken kahramana yaklaşır.
      if (!followedOrb && t >= 2.6) {
        followedOrb = true;
        const portal = LANDMARKS.kutKapisi;
        if (!reducedMotion) rig.current?.flyTo({ x: (portal.x + spot.x) / 2, y: (portal.y + spot.y) / 2 }, 6);
      }
      if (!flewToHero && t >= 4.2) {
        flewToHero = true;
        if (!reducedMotion) rig.current?.flyTo(spot, 11);
      }
      if (!revealed && frame.revealed) {
        revealed = true;
        callbacks.current.onReveal();
      }
      setShown((prev) => {
        const next = { caption: frame.caption, card: frame.card, letterbox: frame.letterbox > 0.5 };
        return prev.caption === next.caption && prev.card === next.card && prev.letterbox === next.letterbox ? prev : next;
      });
      if (t >= ARRIVAL_LENGTH) {
        finish();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      cancelAnimationFrame(raf);
      runtime.active = false;
      if (!revealed) callbacks.current.onReveal();
      callbacks.current.onDone();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    raf = requestAnimationFrame(tick);
    skipRef.current = finish;
    return () => {
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(raf);
      runtime.active = false;
    };
  }, [hero.id, spot, runtime, rig, reducedMotion]);
  const skipRef = useRef<() => void>(() => {});

  const signature = "signature" in hero && typeof hero.signature === "string" ? hero.signature : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30" aria-live="polite">
      {/* Sinema bantları */}
      <div className={`absolute inset-x-0 top-0 h-[9vh] bg-black/85 transition-transform duration-500 ${shown.letterbox ? "translate-y-0" : "-translate-y-full"}`} />
      <div className={`absolute inset-x-0 bottom-0 h-[9vh] bg-black/85 transition-transform duration-500 ${shown.letterbox ? "translate-y-0" : "translate-y-full"}`} />

      {shown.caption && (
        <p key={shown.caption} className="absolute inset-x-0 bottom-[14vh] text-center font-display text-2xl text-buz-50 drop-shadow-[0_2px_0_rgba(0,0,0,0.9)] motion-safe:animate-fade-in">
          {shown.caption}
        </p>
      )}

      {shown.card && (
        <div className="absolute inset-x-4 top-[16vh] mx-auto max-w-md rounded-2xl border border-gunozu-400/50 bg-gece-900/90 p-5 text-center shadow-2xl backdrop-blur motion-safe:animate-fade-in">
          <p className="text-xs uppercase tracking-[0.2em] text-buz-300">Kut Kapısı'ndan yeni bir kahraman</p>
          <p className="mt-1 font-display text-4xl text-gunozu-200">{hero.displayName} geldi!</p>
          <p className="mt-1 font-display text-lg text-buz-100">{hero.title}</p>
          {signature && <p className="mt-3 text-sm italic text-yun-200">{signature}</p>}
        </div>
      )}

      {/* Alt bandın ortasında: sağ alttaki saat ve yakınlaştırma düğmelerinin üstüne binmesin
          (alt ortadaki hızlı görünümler sinema sürerken gizli). */}
      <div className="absolute inset-x-0 bottom-0 flex h-[9vh] items-center justify-center px-4">
        <button
          type="button"
          onClick={() => skipRef.current()}
          className="pointer-events-auto rounded-full border border-white/25 bg-black/70 px-3 py-1 text-xs text-buz-100 hover:bg-white/10"
        >
          Atla
        </button>
      </div>
    </div>
  );
}

/**
 * Karşılama sineması (DOM tarafı): kahramanlar Kut Kapısı'ndan birlikte doğar, kapının önünde yan yana durur, kamera
 * her birini yakından tanıtır (kart: unvan, sınıf, nadirlik, özel yetenekler, imza). Zamanlama: welcome.ts.
 * 3D efektler (kapı, küreler, sütunlar) aynı runtime'ı okur; kahramanların duruşu story.stage ile (onStage).
 * "Atla" ya da Esc bitirir. Hareket azaltma tercihinde küreler uçmaz: tanıtıma doğrudan geçilir.
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import { RARITY_TEXT } from "../../components/character/styles";
import { LANDMARKS } from "../../content/sites";
import { cn } from "../../lib/cn";
import type { CameraRigHandle } from "../CameraRig";
import { orbAt, type ArrivalRuntime } from "./arrival";
import type { ArrivingHero } from "./ArrivalCinematic";
import { heroIntro, welcomeAt, welcomeLanded, welcomeLength } from "./welcome";

interface WelcomeCinematicProps {
  heroes: readonly ArrivingHero[];
  runtime: ArrivalRuntime;
  rig: RefObject<CameraRigHandle | null>;
  reducedMotion: boolean;
  /** Kahraman belirdi (haritaya eklenir). */
  onReveal: (id: string) => void;
  /** Kahramanı kapının önünde durdur (wave: el sallasın) ya da sahneden bırak (null). */
  onStage: (id: string, wave: boolean | null) => void;
  onDone: () => void;
}

interface Shown {
  caption: string | null;
  focus: number | null;
  letterbox: boolean;
}

export function WelcomeCinematic({ heroes, runtime, rig, reducedMotion, onReveal, onStage, onDone }: WelcomeCinematicProps) {
  const [shown, setShown] = useState<Shown>({ caption: null, focus: null, letterbox: false });
  const callbacks = useRef({ onReveal, onStage, onDone });
  const heroesRef = useRef(heroes);
  const skipRef = useRef<() => void>(() => {});
  useEffect(() => {
    callbacks.current = { onReveal, onStage, onDone };
    heroesRef.current = heroes;
  }, [onReveal, onStage, onDone, heroes]);
  const key = heroes.map((h) => h.hero.id).join(",");

  useEffect(() => {
    const list = heroesRef.current;
    const n = list.length;
    const length = welcomeLength(n);
    const spots = list.map((h) => h.spot);
    const center = { x: spots.reduce((s, p) => s + p.x, 0) / n, y: spots.reduce((s, p) => s + p.y, 0) / n };
    const portal = LANDMARKS.kutKapisi;
    // Hareket azaltılmışsa küreler uçmaz: grup çekiminden başlar.
    const offset = reducedMotion ? welcomeLanded(n) : 0;
    let start = -1;
    let done = false;
    let raf = 0;
    const revealed = new Set<number>();
    const shots = new Set<string>();
    let waving = -1;
    const shot = (id: string, fn: () => void) => {
      if (shots.has(id)) return;
      shots.add(id);
      fn();
    };
    const tick = () => {
      if (start < 0) {
        if (!rig.current) {
          raf = requestAnimationFrame(tick);
          return;
        }
        start = performance.now() - offset * 1000;
        runtime.active = true;
        rig.current.flyTo(reducedMotion ? center : portal, reducedMotion ? 16 : 7.5);
      }
      const t = (performance.now() - start) / 1000;
      runtime.t = t;
      const frame = welcomeAt(t, n);
      const camera = rig.current;
      // Küreler uçarken: kapı ve duruş yerleri birlikte kadrajda.
      if (t >= 2.6) shot("kureler", () => camera?.flyTo({ x: (portal.x + center.x) / 2, y: (portal.y + center.y) / 2 }, 11));
      // Hepsi inince: yan yana üçlü.
      if (frame.group) shot("grup", () => camera?.flyTo(center, 15));
      // Sırayla yakın tanıtım: kamera o kahramana, o el sallar.
      if (frame.focus !== null) shot(`tanitim${frame.focus}`, () => camera?.flyTo(spots[frame.focus!], 20));
      list.forEach((h, i) => {
        if (!revealed.has(i) && (reducedMotion || orbAt(t, i).revealed)) {
          revealed.add(i);
          callbacks.current.onStage(h.hero.id, true);
          callbacks.current.onReveal(h.hero.id);
        }
      });
      // Grup çekiminde hepsi el sallar; tanıtımda yalnızca o kahraman.
      const wave = frame.group ? -2 : (frame.focus ?? -1);
      if (wave !== waving) {
        waving = wave;
        list.forEach((h, i) => {
          if (revealed.has(i)) callbacks.current.onStage(h.hero.id, wave === -2 || wave === i);
        });
      }
      setShown((prev) => {
        const next = { caption: frame.caption, focus: frame.focus, letterbox: frame.letterbox > 0.5 };
        return prev.caption === next.caption && prev.focus === next.focus && prev.letterbox === next.letterbox ? prev : next;
      });
      if (t >= length) {
        finish();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      runtime.active = false;
      for (const h of list) {
        callbacks.current.onReveal(h.hero.id);
        callbacks.current.onStage(h.hero.id, null);
      }
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
  }, [key, runtime, rig, reducedMotion]);

  const focused = shown.focus !== null ? heroes[shown.focus] : undefined;
  const intro = focused ? heroIntro(focused.hero) : null;
  const n = heroes.length;

  return (
    <div className="pointer-events-none absolute inset-0 z-30" aria-live="polite">
      <div className={`absolute inset-x-0 top-0 h-[9vh] bg-black/85 transition-transform duration-500 ${shown.letterbox ? "translate-y-0" : "-translate-y-full"}`} />
      <div className={`absolute inset-x-0 bottom-0 h-[9vh] bg-black/85 transition-transform duration-500 ${shown.letterbox ? "translate-y-0" : "translate-y-full"}`} />

      {shown.caption && (
        <p key={shown.caption} className="absolute inset-x-0 bottom-[14vh] text-center font-display text-2xl text-buz-50 drop-shadow-[0_2px_0_rgba(0,0,0,0.9)] motion-safe:animate-fade-in sm:text-3xl">
          {shown.caption}
        </p>
      )}

      {focused && intro && (
        <div
          key={focused.hero.id}
          className="absolute inset-x-3 bottom-[11vh] mx-auto max-w-md rounded-2xl border border-gunozu-400/50 bg-gece-900/92 p-4 shadow-2xl backdrop-blur motion-safe:animate-fade-in sm:inset-x-auto sm:right-[6vw] sm:bottom-auto sm:top-1/2 sm:w-[22rem] sm:-translate-y-1/2"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-buz-300">
            {shown.focus! + 1} / {n} · {intro.epithet ?? "Kutada'nın kahramanı"}
          </p>
          <p className="mt-1 font-display text-3xl text-buz-50">{intro.name}</p>
          <p className={cn("font-display text-lg", RARITY_TEXT[focused.hero.rarity])}>{intro.title}</p>
          <p className="mt-0.5 text-sm text-buz-300">{intro.tags}</p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {intro.features.map((f) => (
              <li key={f} className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-buz-100">
                {f}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-gunozu-200">✦ İmza yeteneği: {intro.skill}</p>
        </div>
      )}

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

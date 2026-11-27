/**
 * Geliş sineması (DOM tarafı): zamanı yürütür, kamerayı Kut Kapısı'ndan kahramanların yerine uçurur, sinema bantlarını,
 * altyazıyı ve kartı gösterir. 3D efektler (kapının parlaması, ışık küreleri, sütunlar) aynı runtime'ı okur.
 *
 *   Tek kahraman (yeni geliş)    "mhellingtr geldi!" kartı, unvanı ve imza sözü
 *   Karşılama (ilk ziyaret)      küreler arayla kalkar, kamera hepsini kadraja alır; kart: "Kutada'nın kahramanları"
 *
 * "Atla" ya da Esc sinemayı bitirir. Hareket azaltma tercihinde küreler uçmaz: kahramanlar kartla birlikte hemen belirir.
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import { RARITY_TEXT } from "../../components/character/styles";
import { LANDMARKS } from "../../content/sites";
import { cn } from "../../lib/cn";
import type { Bounds, Character, Coordinates } from "../../types";
import type { CameraRigHandle } from "../CameraRig";
import { arrivalAt, arrivalLength, orbAt, type ArrivalRuntime } from "./arrival";

export interface ArrivingHero {
  hero: Character;
  /** Kahramanın belireceği yer (gün düzenindeki o anki yeri). */
  spot: Coordinates;
}

interface ArrivalCinematicProps {
  heroes: readonly ArrivingHero[];
  /** İlk ziyaret karşılaması mı (kartın başlığı değişir)? */
  welcome: boolean;
  runtime: ArrivalRuntime;
  rig: RefObject<CameraRigHandle | null>;
  reducedMotion: boolean;
  /** Bir kahraman belirdiğinde (haritaya eklenir). */
  onReveal: (id: string) => void;
  onDone: () => void;
}

interface Shown {
  caption: string | null;
  card: boolean;
  letterbox: boolean;
}

/** Noktaları (ve kapıyı) kapsayan kutu, kenarlarda pay bırakarak. */
function boundsOf(points: readonly Coordinates[], pad: number): Bounds {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { minX: Math.min(...xs) - pad, minY: Math.min(...ys) - pad, maxX: Math.max(...xs) + pad, maxY: Math.max(...ys) + pad };
}

export function ArrivalCinematic({ heroes, welcome, runtime, rig, reducedMotion, onReveal, onDone }: ArrivalCinematicProps) {
  const [shown, setShown] = useState<Shown>({ caption: null, card: false, letterbox: false });
  const doneRef = useRef(false);
  const callbacks = useRef({ onReveal, onDone });
  // Kahraman listesi her çizimde yeni dizi gelebilir: sinema yalnızca kimlikler değişince baştan başlar.
  const heroesRef = useRef(heroes);
  useEffect(() => {
    callbacks.current = { onReveal, onDone };
    heroesRef.current = heroes;
  }, [onReveal, onDone, heroes]);
  const key = heroes.map((h) => h.hero.id).join(",");

  useEffect(() => {
    doneRef.current = false;
    const heroes = heroesRef.current;
    const count = heroes.length;
    const length = arrivalLength(count);
    const spots = heroes.map((h) => h.spot);
    const center = { x: spots.reduce((s, p) => s + p.x, 0) / count, y: spots.reduce((s, p) => s + p.y, 0) / count };
    // Hareket azaltılmışsa sinema kartın başladığı andan açılır (küreler uçmaz).
    const offset = reducedMotion ? 5 + (count - 1) * 0.5 : 0;
    let start = -1;
    const revealed = new Set<number>();
    let followedOrb = false;
    let flewToHeroes = false;
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
        if (reducedMotion) {
          if (count === 1) rig.current.flyTo(spots[0], 11);
          else rig.current.flyToBounds(boundsOf(spots, 18));
        } else rig.current.flyTo(LANDMARKS.kutKapisi, 7.5);
      }
      const t = (performance.now() - start) / 1000;
      runtime.t = t;
      const frame = arrivalAt(t, count);
      // Küreler uçarken kamera yolun ortasına çekilir (kapı ve oba birlikte kadrajda); inerken kahramanlara yaklaşır.
      if (!followedOrb && t >= 2.6) {
        followedOrb = true;
        const portal = LANDMARKS.kutKapisi;
        if (!reducedMotion) {
          if (count === 1) rig.current?.flyTo({ x: (portal.x + center.x) / 2, y: (portal.y + center.y) / 2 }, 6);
          else rig.current?.flyToBounds(boundsOf([portal, ...spots], 24));
        }
      }
      if (!flewToHeroes && t >= 4.2) {
        flewToHeroes = true;
        if (!reducedMotion) {
          if (count === 1) rig.current?.flyTo(spots[0], 11);
          else rig.current?.flyToBounds(boundsOf(spots, 18));
        }
      }
      heroes.forEach((h, i) => {
        if (!revealed.has(i) && orbAt(t, i).revealed) {
          revealed.add(i);
          callbacks.current.onReveal(h.hero.id);
        }
      });
      setShown((prev) => {
        const next = { caption: frame.caption, card: frame.card, letterbox: frame.letterbox > 0.5 };
        return prev.caption === next.caption && prev.card === next.card && prev.letterbox === next.letterbox ? prev : next;
      });
      if (t >= length) {
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
      heroes.forEach((h, i) => {
        if (!revealed.has(i)) callbacks.current.onReveal(h.hero.id);
      });
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
  const skipRef = useRef<() => void>(() => {});

  const single = heroes.length === 1 ? heroes[0].hero : null;
  const signature = single && "signature" in single && typeof single.signature === "string" ? single.signature : null;

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

      {shown.card && single && (
        <div className="absolute inset-x-4 top-[16vh] mx-auto max-w-md rounded-2xl border border-gunozu-400/50 bg-gece-900/90 p-5 text-center shadow-2xl backdrop-blur motion-safe:animate-fade-in">
          <p className="text-xs uppercase tracking-[0.2em] text-buz-300">{welcome ? "OBA-Tales'e hoş geldin" : "Kut Kapısı'ndan yeni bir kahraman"}</p>
          <p className="mt-1 font-display text-4xl text-gunozu-200">{single.displayName} geldi!</p>
          <p className="mt-1 font-display text-lg text-buz-100">{single.title}</p>
          {signature && <p className="mt-3 text-sm italic text-yun-200">{signature}</p>}
        </div>
      )}

      {shown.card && !single && (
        <div className="absolute inset-x-4 top-[14vh] mx-auto max-w-xl rounded-2xl border border-gunozu-400/50 bg-gece-900/90 p-5 text-center shadow-2xl backdrop-blur motion-safe:animate-fade-in">
          <p className="text-xs uppercase tracking-[0.2em] text-buz-300">OBA-Tales'e hoş geldin</p>
          <p className="mt-1 font-display text-3xl text-gunozu-200 sm:text-4xl">Kutada'nın kahramanları</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {heroes.map(({ hero }) => (
              <li key={hero.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="font-display text-lg text-buz-50">{hero.displayName}</p>
                <p className={cn("text-sm", RARITY_TEXT[hero.rarity])}>{hero.title}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-buz-200">Kut Kapısı'ndan ilk onlar geçti. Bizi takip edenler de buradan doğacak.</p>
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

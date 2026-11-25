/**
 * Harita denetimleri (sağ alt köşe): yakınlaştır / uzaklaştır / bütün adaları göster.
 * 3D dünyada üstte bir de döndürme grubu: sola çevir · pusula (tıklayınca kuzey yukarı) · sağa çevir.
 * Masaüstünde detay çekmecesi açıkken onun soluna kayar.
 */
import { Maximize2, Minus, Navigation2, Plus, RotateCcw, RotateCw } from "lucide-react";
import type { RefObject } from "react";
import { cn } from "../../lib/cn";
import { useAppStore } from "../../state/useAppStore";

interface RotationControls {
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onNorth: () => void;
  /** Pusula iğnesi: kamera döndükçe CameraRig döndürür. */
  compassRef: RefObject<HTMLSpanElement | null>;
}

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  /** Yalnızca 3D dünyada: kamerayı döndürme düğmeleri ve pusula. */
  rotation?: RotationControls;
}

const groupClass = "flex flex-col overflow-hidden rounded-xl border border-white/15 bg-gece-900/90 shadow-lg backdrop-blur";
const buttonClass =
  "grid size-10 place-items-center text-buz-100 transition-colors hover:bg-white/10 hover:text-buz-50 focus-visible:relative";

export function ZoomControls({ onZoomIn, onZoomOut, onReset, rotation }: ZoomControlsProps) {
  const drawerOpen = useAppStore((s) => s.selectedId !== null);
  return (
    <div className={cn("absolute bottom-4 right-3 z-10 flex flex-col gap-2", drawerOpen && "md:right-[412px]")}>
      {rotation && (
        <div className={groupClass} role="group" aria-label="Kamera yönü">
          <button type="button" className={buttonClass} onClick={rotation.onRotateLeft} aria-label="Kamerayı sola çevir" title="Sola çevir (Q)">
            <RotateCcw aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            className={cn(buttonClass, "border-y border-white/10")}
            onClick={rotation.onNorth}
            aria-label="Kuzeyi yukarı al"
            title="Kuzeyi yukarı al · Döndürmek için sağ tıkla sürükle ya da iki parmakla çevir"
          >
            <span ref={rotation.compassRef} className="grid place-items-center" aria-hidden>
              <Navigation2 className="size-4 fill-kilim-400 text-kilim-400" />
            </span>
          </button>
          <button type="button" className={buttonClass} onClick={rotation.onRotateRight} aria-label="Kamerayı sağa çevir" title="Sağa çevir (E)">
            <RotateCw aria-hidden className="size-4" />
          </button>
        </div>
      )}
      <div className={groupClass} role="group" aria-label="Harita yakınlığı">
        <button type="button" className={buttonClass} onClick={onZoomIn} aria-label="Yakınlaştır">
          <Plus aria-hidden className="size-5" />
        </button>
        <button type="button" className={cn(buttonClass, "border-y border-white/10")} onClick={onZoomOut} aria-label="Uzaklaştır">
          <Minus aria-hidden className="size-5" />
        </button>
        <button type="button" className={buttonClass} onClick={onReset} aria-label="Bütün adaları göster">
          <Maximize2 aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}

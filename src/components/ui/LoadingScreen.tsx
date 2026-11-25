/**
 * Yükleme ekranı — veri ve sayfa parçaları yüklenirken gösterilir.
 */
import { WORLD } from "../../content/world";
import { cn } from "../../lib/cn";
import { Logo } from "./Logo";

interface LoadingScreenProps {
  message?: string;
  /** Bütün ekranı kaplasın mı? (false: bulunduğu alanı ortalar) */
  fullScreen?: boolean;
}

export function LoadingScreen({ message = "Harita hazırlanıyor…", fullScreen = true }: LoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex flex-col items-center justify-center gap-4 p-6 text-center", fullScreen ? "min-h-dvh" : "flex-1 py-16")}
    >
      <Logo size={72} className="motion-safe:animate-float drop-shadow-[0_0_18px_rgb(246_211_111/0.45)]" />
      <p className="font-display text-xl text-gunozu-300">{message}</p>
      <p className="max-w-sm text-sm text-buz-300">{WORLD.slogan}</p>
    </div>
  );
}

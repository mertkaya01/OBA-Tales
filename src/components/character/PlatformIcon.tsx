/**
 * Platform simgeleri (sade, genel çizimler).
 */
import { PLATFORM_LABELS } from "../../content/classes";
import { cn } from "../../lib/cn";
import type { Platform } from "../../types";

interface PlatformIconProps {
  platform: Platform;
  className?: string;
  /** true: platform adını ekran okuyuculara söyler. */
  labelled?: boolean;
}

export function PlatformIcon({ platform, className, labelled = false }: PlatformIconProps) {
  const label = labelled ? PLATFORM_LABELS[platform] : undefined;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4 shrink-0", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {platform === "instagram" && (
        <>
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17" cy="7" r="0.6" fill="currentColor" />
        </>
      )}
      {platform === "tiktok" && (
        <>
          <path d="M14 3v11a3.5 3.5 0 1 1-3.5-3.5" />
          <path d="M14 3c.6 2.6 2.5 4.3 5 4.5" />
        </>
      )}
      {platform === "youtube" && (
        <>
          <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
          <path d="M10 9.2l5 2.8-5 2.8z" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

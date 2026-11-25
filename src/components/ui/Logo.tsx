/**
 * Günözü Taşı logosu: kilim kırmızısı taş, ortasında güneş çekirdeği, çevresinde yavaşça dönen ışınlar.
 */
import { cn } from "../../lib/cn";

const RAYS = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
  const rad = (deg * Math.PI) / 180;
  const at = (r: number) => ({ x: 16 + r * Math.cos(rad), y: 16 + r * Math.sin(rad) });
  return { from: at(11.5), to: at(14.2) };
});

interface LogoProps {
  size?: number;
  className?: string;
  /** Ekran okuyucu metni; süs olarak kullanılıyorsa boş bırakın. */
  title?: string;
  /** Işınlar dönsün mü? */
  animated?: boolean;
}

export function Logo({ size = 36, className, title, animated = true }: LogoProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <g
        stroke="var(--color-gunozu-300)"
        strokeWidth={2.4}
        strokeLinecap="round"
        style={{ transformOrigin: "16px 16px" }}
        className={animated ? "motion-safe:animate-[spin_40s_linear_infinite]" : undefined}
      >
        {RAYS.map(({ from, to }, i) => (
          <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
        ))}
      </g>
      <path
        d="M16 6 L24 16 L16 26 L8 16 Z"
        fill="var(--color-kilim-500)"
        stroke="var(--color-gunozu-200)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="4.5" fill="var(--color-gunozu-300)" />
    </svg>
  );
}

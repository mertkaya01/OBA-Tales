/**
 * Bölüm başlığı: küçük üst etiket, başlık ve kısa açıklama.
 */
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface SectionTitleProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** Sayfanın ana başlığıysa h1, değilse h2. */
  as?: "h1" | "h2";
  className?: string;
}

export function SectionTitle({ title, eyebrow, description, as: Heading = "h2", className }: SectionTitleProps) {
  return (
    <header className={cn("max-w-3xl", className)}>
      {eyebrow && <p className="font-display text-sm uppercase tracking-widest text-buz-300">{eyebrow}</p>}
      <Heading className={cn("text-gunozu-300", Heading === "h1" ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl")}>
        {title}
      </Heading>
      {description && <p className="mt-2 text-buz-200">{description}</p>}
    </header>
  );
}

/**
 * Boş durum: filtreye uyan kimse yoksa ya da aranan bulunamazsa.
 */
import { Compass } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface EmptyStateProps {
  title: string;
  message?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ title, message, action, icon, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/15 p-6 text-center", className)}>
      <div className="text-buz-300">{icon ?? <Compass aria-hidden className="size-8" />}</div>
      <p className="font-display text-lg text-buz-50">{title}</p>
      {message && <p className="max-w-sm text-sm text-buz-300">{message}</p>}
      {action}
    </div>
  );
}

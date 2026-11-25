/**
 * Sınıf simgeleri: Kalkaneri kalkan, Okyeli yay ve ok, Ocakcan fener.
 */
import { CLASSES } from "../../content/classes";
import { cn } from "../../lib/cn";
import type { ClassId } from "../../types";
import { CLASS_TEXT } from "./styles";

interface ClassIconProps {
  classId: ClassId;
  className?: string;
  /** true: sınıf adını ekran okuyuculara söyler. */
  labelled?: boolean;
}

export function ClassIcon({ classId, className, labelled = false }: ClassIconProps) {
  const label = labelled ? CLASSES[classId].name : undefined;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4 shrink-0", CLASS_TEXT[classId], className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {classId === "kalkaneri" && (
        <>
          <path d="M12 3l7 3v5c0 4.6-3 8.1-7 10-4-1.9-7-5.4-7-10V6l7-3z" />
          <path d="M12 7v10M8.5 11h7" />
        </>
      )}
      {classId === "okyeli" && (
        <>
          <path d="M7 3c5.5 3 5.5 15 0 18" />
          <path d="M7 3v18" />
          <path d="M4 12h15M16 9l3 3-3 3" />
        </>
      )}
      {classId === "ocakcan" && (
        <>
          <path d="M10 6V5a2 2 0 0 1 4 0v1" />
          <path d="M8.5 6h7l1 3v8a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2V9l1-3z" />
          <path d="M12 11.5c1.1 1.2 1.1 2.6 0 3.6-1.1-1-1.1-2.4 0-3.6z" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

/**
 * Başlıklı çip grubu (sınıf, nadirlik, bölge, özel durum).
 */
import { useId, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Chip } from "../ui/Chip";

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  count?: number;
  activeClassName?: string;
}

interface FilterGroupProps<T extends string> {
  title: string;
  hint?: string;
  options: readonly FilterOption<T>[];
  selected: readonly T[];
  onToggle: (value: T) => void;
}

export function FilterGroup<T extends string>({ title, hint, options, selected, onToggle }: FilterGroupProps<T>) {
  const titleId = useId();
  return (
    <div role="group" aria-labelledby={titleId}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p id={titleId} className="font-display text-sm uppercase tracking-widest text-buz-300">
          {title}
        </p>
        {hint && <p className="text-xs text-buz-300/80">{hint}</p>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const pressed = selected.includes(option.value);
          return (
            <Chip
              key={option.value}
              pressed={pressed}
              onToggle={() => onToggle(option.value)}
              icon={option.icon}
              count={option.count}
              activeClassName={option.activeClassName}
              className={cn(!pressed && option.count === 0 && "opacity-50")}
            >
              {option.label}
            </Chip>
          );
        })}
      </div>
    </div>
  );
}

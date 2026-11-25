/**
 * Arama kutusu: büyüteç simgesi ve dolu olduğunda temizleme düğmesi.
 */
import { Search, X } from "lucide-react";
import { useId } from "react";
import { cn } from "../../lib/cn";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  /** Etiket görünür olsun mu? (false: yalnızca ekran okuyucular için) */
  showLabel?: boolean;
  className?: string;
}

export function SearchInput({ value, onChange, label, placeholder, showLabel = false, className }: SearchInputProps) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={cn("mb-1 block text-sm text-buz-200", !showLabel && "sr-only")}>
        {label}
      </label>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-buz-300" />
        <input
          id={id}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-xl border border-white/15 bg-gece-950/80 py-2 pl-9 pr-9 text-buz-50 placeholder:text-buz-300/60 focus:border-gunozu-400/70 [&::-webkit-search-cancel-button]:hidden"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-buz-300 hover:bg-white/10 hover:text-buz-50"
            aria-label="Aramayı temizle"
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

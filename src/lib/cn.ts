/**
 * Koşullu className birleştirici.
 * Örnek: cn("pin", isSelected && "pin--secili", `pin--${rarity}`)
 */
import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

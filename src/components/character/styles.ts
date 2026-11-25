/**
 * Sınıf ve nadirlik renklerindeki Tailwind class'ları.
 * Tailwind class adlarını kaynakta tam haliyle görmelidir; `text-${rarity}` gibi birleştirmeler çalışmaz.
 */
import type { ClassId, Rarity } from "../../types";

export const CLASS_TEXT: Readonly<Record<ClassId, string>> = {
  kalkaneri: "text-kalkaneri",
  okyeli: "text-okyeli",
  ocakcan: "text-ocakcan",
};

export const RARITY_TEXT: Readonly<Record<Rarity, string>> = {
  siradan: "text-siradan",
  nadir: "text-nadir",
  destansi: "text-destansi",
  efsanevi: "text-efsanevi",
};

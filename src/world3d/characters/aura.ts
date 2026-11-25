/**
 * Aura kuralları: kimin ayak altında ışık halkası olur ve hangi renkte?
 */
import { AURA_COLORS } from "../../game/palette";
import type { Character } from "../../types";

export function hasAura(c: Character): boolean {
  return c.elementAura !== null || c.rarity === "destansi" || c.rarity === "efsanevi";
}

/** Alev → turuncu, ışık → buz beyazı; aksi halde nadirlik rengi. */
export function auraColor(c: Character): string {
  if (c.elementAura) return AURA_COLORS[c.elementAura];
  return c.rarity === "efsanevi" ? AURA_COLORS.efsanevi : AURA_COLORS.destansi;
}

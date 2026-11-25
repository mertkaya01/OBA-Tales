/**
 * Aura kuralları: kimin ayak altında ışık halkası olur ve hangi renkte?
 */
import { AURA_COLORS } from "../../game/palette";
import type { Character } from "../../types";
import { rarityRank } from "../../lib/rules";

export function hasAura(c: Character): boolean {
  return c.elementAura !== null || rarityRank(c.rarity) >= rarityRank("destansi");
}

/** Alev → turuncu, ışık → buz beyazı; aksi halde nadirlik rengi. */
export function auraColor(c: Character): string {
  if (c.elementAura) return AURA_COLORS[c.elementAura];
  return c.rarity === "siradan" || c.rarity === "nadir" ? AURA_COLORS.destansi : AURA_COLORS[c.rarity];
}

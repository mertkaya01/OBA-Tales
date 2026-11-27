/**
 * Bütün efektler: pixelfx'in (src/vendor/pixelfx, değiştirilmeden) ve OBA-Tales'e özel olanlar (src/game/fx/oba).
 * Oynatıcı ve katalog efektleri buradan, kimlikle bulur.
 */
import type { EffectModule } from "../../vendor/pixelfx/core/index.js";
import { EFFECTS, type EffectId } from "../../vendor/pixelfx/effects.js";
import { OBA_EFFECTS, type ObaEffectId } from "./oba/index.js";

export type FxId = EffectId | ObaEffectId;

export const ALL_EFFECTS: Readonly<Record<FxId, EffectModule>> = { ...EFFECTS, ...OBA_EFFECTS };

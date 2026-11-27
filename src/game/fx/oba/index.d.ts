// index.js için TypeScript bildirimi.
import type { EffectModule } from "../../../vendor/pixelfx/core/index.js";

export type ObaEffectId = "oba/shield-wall" | "oba/blade-arc" | "oba/lightning" | "oba/ember-ring";

export declare const OBA_EFFECTS: Readonly<Record<ObaEffectId, EffectModule>>;

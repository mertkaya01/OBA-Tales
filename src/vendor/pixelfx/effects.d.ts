// effects.js için TypeScript bildirimi.
import type { EffectModule } from "./core/index.js";

export type EffectId =
  | "fire/spirit-flame"
  | "fire/campfire"
  | "holy/halo"
  | "holy/heal"
  | "holy/sunburst"
  | "ice/frost-nova"
  | "ice/ice-shatter"
  | "ice/ice-crystal"
  | "ice/frost-breath"
  | "weather/snow"
  | "weather/blizzard"
  | "weather/aurora"
  | "weather/fog"
  | "weather/fireflies"
  | "shadow/eclipse"
  | "shadow/shadow-flames"
  | "ui/confetti"
  | "impacts/shield-block"
  | "projectiles/arrow";

export declare const EFFECTS: Readonly<Record<EffectId, EffectModule>>;

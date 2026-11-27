// OBA-Tales'e özel efektler (kimlik → efekt modülü). pixelfx'in efekt biçimindedir; vendor'daki çekirdeği kullanır,
// vendor'a dokunmaz. Kayıt: src/game/fx/effects.ts (pixelfx'in efektleriyle birlikte).

import * as shield_wall from "./shield-wall.js";
import * as blade_arc from "./blade-arc.js";
import * as lightning from "./lightning.js";
import * as ember_ring from "./ember-ring.js";

export const OBA_EFFECTS = {
  "oba/shield-wall": shield_wall,
  "oba/blade-arc": blade_arc,
  "oba/lightning": lightning,
  "oba/ember-ring": ember_ring,
};

// OBA-Tales sitesinin kullandığı pixelfx efektleri (kimlik → efekt modülü).
// Bu dosya upstream'de yok; efektlerin kendileri değiştirilmeden fx/ altında duruyor (README.md).

import * as fire_spirit_flame from "./fx/fire/spirit-flame.js";
import * as fire_campfire from "./fx/fire/campfire.js";
import * as holy_halo from "./fx/holy/halo.js";
import * as holy_heal from "./fx/holy/heal.js";
import * as holy_sunburst from "./fx/holy/sunburst.js";
import * as ice_frost_nova from "./fx/ice/frost-nova.js";
import * as ice_ice_shatter from "./fx/ice/ice-shatter.js";
import * as ice_ice_crystal from "./fx/ice/ice-crystal.js";
import * as ice_frost_breath from "./fx/ice/frost-breath.js";
import * as weather_snow from "./fx/weather/snow.js";
import * as weather_blizzard from "./fx/weather/blizzard.js";
import * as weather_aurora from "./fx/weather/aurora.js";
import * as weather_fog from "./fx/weather/fog.js";
import * as weather_fireflies from "./fx/weather/fireflies.js";
import * as shadow_eclipse from "./fx/shadow/eclipse.js";
import * as shadow_shadow_flames from "./fx/shadow/shadow-flames.js";
import * as ui_confetti from "./fx/ui/confetti.js";
import * as impacts_shield_block from "./fx/impacts/shield-block.js";
import * as projectiles_arrow from "./fx/projectiles/arrow.js";

export const EFFECTS = {
  "fire/spirit-flame": fire_spirit_flame,
  "fire/campfire": fire_campfire,
  "holy/halo": holy_halo,
  "holy/heal": holy_heal,
  "holy/sunburst": holy_sunburst,
  "ice/frost-nova": ice_frost_nova,
  "ice/ice-shatter": ice_ice_shatter,
  "ice/ice-crystal": ice_ice_crystal,
  "ice/frost-breath": ice_frost_breath,
  "weather/snow": weather_snow,
  "weather/blizzard": weather_blizzard,
  "weather/aurora": weather_aurora,
  "weather/fog": weather_fog,
  "weather/fireflies": weather_fireflies,
  "shadow/eclipse": shadow_eclipse,
  "shadow/shadow-flames": shadow_shadow_flames,
  "ui/confetti": ui_confetti,
  "impacts/shield-block": impacts_shield_block,
  "projectiles/arrow": projectiles_arrow,
};

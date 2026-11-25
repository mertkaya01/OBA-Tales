/**
 * CANLI PORTRE — karakter çekmecesindeki piksel portre, pixelfx auralarıyla.
 *
 *   arka katman   güneş halesi (efsanevi), ruh alevi (alev aurası)
 *   karakter      2 kat büyütülmüş sprite, hafifçe nefes alır
 *   ön katman     hale (ışık / destansı), ateşböcekleri (nadir), kar (sıradan)
 *
 * Portreye dokununca sınıfın imza yeteneği oynar: Kalkan Duvarı, Buz Oku ya da Ocak Çayı.
 * Bu dosya Pixi'yi getirir; yalnızca çekmece açılınca, tembel (lazy) yüklenir.
 */
import { Sprite, type Application, type Ticker } from "pixi.js";
import { useCallback, useRef } from "react";
import { CLASSES } from "../content/classes";
import { actorFromSprite } from "../game/fx/actor";
import { CLASS_SKILL_NAMES, PORTRAIT, classSkill, portraitAuras } from "../game/fx/fxCatalog";
import { PixelFxPlayer } from "../game/fx/PixelFxPlayer";
import { composeSprite } from "../game/sprites/composeSprite";
import type { Character } from "../types";
import { LayerTexture, textureFromRgba } from "./fxTexture";
import { PixiStage } from "./PixiStage";

/** CSS büyütmesi: 88 × 96 piksel → 264 × 288. */
export const PORTRAIT_CSS_SCALE = 3;

export default function LivePortrait({ character }: { character: Character }) {
  const skillRef = useRef<(() => void) | null>(null);

  const setup = useCallback(
    (app: Application) => {
      const { width, height, feetX, feetY, spriteScale } = PORTRAIT;
      const sprite = composeSprite(character);
      const actor = actorFromSprite(sprite, spriteScale);
      const player = new PixelFxPlayer(width, height);
      for (const recipe of portraitAuras(character)) player.playRecipe(recipe, { actor });

      const back = new LayerTexture(player.back);
      const front = new LayerTexture(player.front);
      const hero = new Sprite(textureFromRgba(sprite, spriteScale));
      const heroX = feetX - (sprite.width * spriteScale) / 2;
      const heroY = feetY - sprite.height * spriteScale;
      hero.position.set(heroX, heroY);
      app.stage.addChild(new Sprite(back.texture), hero, new Sprite(front.texture));

      let t = 0;
      let hop = 0;
      const tick = (ticker: Ticker) => {
        const dt = Math.min(ticker.deltaMS / 1000, 0.1);
        t += dt;
        hop = Math.max(0, hop - dt);
        // Piksel piksel nefes: arada bir 1 piksel yukarı; yetenek kullanınca küçük bir zıplama.
        hero.y = heroY - (Math.sin(t * 2.2) > 0.4 ? 1 : 0) - (hop > 0 ? Math.round(Math.sin((hop / 0.3) * Math.PI) * 3) : 0);
        player.update(dt);
        player.render();
        back.sync();
        front.sync();
      };
      app.ticker.add(tick);

      skillRef.current = () => {
        hop = 0.3;
        for (const recipe of classSkill(character.class.id, { x: feetX, y: feetY })) player.playRecipe(recipe, { actor });
      };
      return () => {
        app.ticker.remove(tick);
        skillRef.current = null;
      };
    },
    [character],
  );

  const skill = CLASS_SKILL_NAMES[character.class.id];
  return (
    <button
      type="button"
      onClick={() => skillRef.current?.()}
      className="group relative block cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gunozu-400"
      style={{ width: PORTRAIT.width * PORTRAIT_CSS_SCALE }}
      aria-label={`${character.displayName}, ${CLASSES[character.class.id].name}. Dokun: ${skill}`}
      title={`Dokun: ${skill}`}
    >
      <PixiStage key={character.id} width={PORTRAIT.width} height={PORTRAIT.height} label={`${character.displayName} canlı portresi`} setup={setup} />
      <span className="pointer-events-none absolute bottom-1 right-1 rounded-md bg-gece-950/70 px-1.5 py-0.5 text-[10px] text-buz-200 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        Dokun: {skill}
      </span>
    </button>
  );
}

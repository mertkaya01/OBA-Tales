/**
 * CANLI PORTRE — karakter çekmecesindeki portre, pixelfx auralarıyla.
 *
 *   arka katman   güneş halesi (efsanevi), ruh alevi (alev aurası)
 *   karakter      3D modelden ekran çözünürlüğünde, pürüzsüz çizilen tam boy portre; hafifçe nefes alır
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
import { renderPortrait } from "../world3d/characters/portrait3d";
import type { Character } from "../types";
import { LayerTexture, smoothTextureFromRgba, textureFromRgba } from "./fxTexture";
import { PixiStage } from "./PixiStage";

/** CSS büyütmesi: 88 × 96 piksel → 264 × 288. */
export const PORTRAIT_CSS_SCALE = 3;

/** Sahnenin gerçek çözünürlüğü: CSS büyütmesi × ekran yoğunluğu (efektler yine keskin piksel büyür). */
const stageResolution = () => Math.min(8, PORTRAIT_CSS_SCALE * Math.min(2.5, Math.max(1, window.devicePixelRatio || 1)));

export default function LivePortrait({ character }: { character: Character }) {
  const skillRef = useRef<(() => void) | null>(null);

  const setup = useCallback(
    (app: Application) => {
      const { width, height, feetX, feetY, spriteScale } = PORTRAIT;
      // Karakter 3D modelinden çizilir (16×20'lik kutunun spriteScale katı): efektlerin maskesi için küçük, görünen karakter
      // için sahnenin gerçek çözünürlüğünde pürüzsüz. WebGL yoksa eski piksel portre.
      const boxW = 16 * spriteScale;
      const boxH = 20 * spriteScale;
      const model = renderPortrait(character, boxW, boxH);
      const sharp = model ? renderPortrait(character, boxW, boxH, { density: app.renderer.resolution }) : null;
      const sprite = model ?? composeSprite(character);
      const scale = model ? 1 : spriteScale;
      const actor = actorFromSprite(sprite, scale);
      // Pürüzsüz karakterin üstüne efektler onun düşük çözünürlüklü kopyasını boyamasın: siluet (maske) kalır, renkler boş.
      if (sharp) actor.pixels.fill(0);
      const player = new PixelFxPlayer(width, height);
      for (const recipe of portraitAuras(character)) player.playRecipe(recipe, { actor });

      const back = new LayerTexture(player.back);
      const front = new LayerTexture(player.front);
      const hero = new Sprite(sharp ? smoothTextureFromRgba(sharp) : textureFromRgba(sprite, scale));
      hero.setSize(boxW, boxH);
      const heroX = feetX - boxW / 2;
      const heroY = feetY - boxH;
      hero.position.set(heroX, heroY);
      app.stage.addChild(new Sprite(back.texture), hero, new Sprite(front.texture));

      let t = 0;
      let hop = 0;
      const tick = (ticker: Ticker) => {
        const dt = Math.min(ticker.deltaMS / 1000, 0.1);
        t += dt;
        hop = Math.max(0, hop - dt);
        // Yumuşak nefes; yetenek kullanınca küçük bir zıplama.
        hero.y = heroY - (Math.sin(t * 2.2) * 0.5 + 0.5) * 0.7 - (hop > 0 ? Math.sin((hop / 0.3) * Math.PI) * 3 : 0);
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
      <PixiStage
        key={character.id}
        width={PORTRAIT.width}
        height={PORTRAIT.height}
        resolution={stageResolution()}
        label={`${character.displayName} canlı portresi`}
        setup={setup}
      />
      <span className="pointer-events-none absolute bottom-1 right-1 rounded-md bg-gece-950/70 px-1.5 py-0.5 text-[10px] text-buz-200 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        Dokun: {skill}
      </span>
    </button>
  );
}

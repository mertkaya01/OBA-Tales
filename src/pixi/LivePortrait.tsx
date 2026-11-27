/**
 * CANLI PORTRE — karakter çekmecesindeki portre, pixelfx auralarıyla.
 *
 *   arka katman   güneş halesi (efsanevi), ruh alevi (alev aurası)
 *   karakter      3D modelden ekran çözünürlüğünde, pürüzsüz çizilen tam boy portre; hafifçe nefes alır
 *   ön katman     hale (ışık / destansı), ateşböcekleri (nadir), kar (sıradan)
 *
 * Portreye dokununca imza yeteneği oynar: sınıfınki (Kalkan Duvarı nadirlik ve rozetle büyür, Buz Oku, Ocak Çayı) ya da
 * kahramanın kendisine özel olanı (fxCatalog.signatureSkill). Gök Gürültüsü'nde portre kararır, karakter simsiyah bir
 * siluete döner, yıldırımlar çakar ve her şey eski hâline gelir.
 * Bu dosya Pixi'yi getirir; yalnızca çekmece açılınca, tembel (lazy) yüklenir.
 */
import { Graphics, Sprite, type Application, type Ticker } from "pixi.js";
import { useCallback, useMemo, useRef } from "react";
import { CLASSES } from "../content/classes";
import { actorFromSprite } from "../game/fx/actor";
import { PORTRAIT, darknessAt, portraitAuras, signatureSkill } from "../game/fx/fxCatalog";
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
  const skill = useMemo(() => signatureSkill(character, { x: PORTRAIT.feetX, y: PORTRAIT.feetY }), [character]);

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
      // Karanlık örtü: arka efektlerin önünde, karakterin arkasında (karakter ayrıca siluete döner); ön efektler üstte.
      const dark = new Graphics().rect(0, 0, width, height).fill(0x04050b);
      dark.alpha = 0;
      app.stage.addChild(new Sprite(back.texture), dark, hero, new Sprite(front.texture));

      let t = 0;
      let hop = 0;
      let darkT = -1;
      const tick = (ticker: Ticker) => {
        const dt = Math.min(ticker.deltaMS / 1000, 0.1);
        t += dt;
        hop = Math.max(0, hop - dt);
        // Yumuşak nefes; yetenek kullanınca küçük bir zıplama.
        hero.y = heroY - (Math.sin(t * 2.2) * 0.5 + 0.5) * 0.7 - (hop > 0 ? Math.sin((hop / 0.3) * Math.PI) * 3 : 0);
        if (darkT >= 0 && skill.darkness) {
          darkT += dt;
          const k = darknessAt(darkT, skill.darkness);
          dark.alpha = 0.94 * k;
          const v = Math.round(255 * (1 - 0.96 * k));
          hero.tint = (v << 16) | (v << 8) | v;
          if (darkT >= skill.darkness[3]) {
            darkT = -1;
            dark.alpha = 0;
            hero.tint = 0xffffff;
          }
        }
        player.update(dt);
        player.render();
        back.sync();
        front.sync();
      };
      app.ticker.add(tick);

      skillRef.current = () => {
        hop = 0.3;
        if (skill.darkness) darkT = 0;
        for (const recipe of skill.recipes) player.playRecipe(recipe, { actor });
      };
      return () => {
        app.ticker.remove(tick);
        skillRef.current = null;
      };
    },
    [character, skill],
  );

  return (
    <button
      type="button"
      onClick={() => skillRef.current?.()}
      className="group relative block cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gunozu-400"
      style={{ width: PORTRAIT.width * PORTRAIT_CSS_SCALE }}
      aria-label={`${character.displayName}, ${CLASSES[character.class.id].name}. Dokun: ${skill.name}`}
      title={`Dokun: ${skill.name}`}
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
        Dokun: {skill.name}
      </span>
    </button>
  );
}

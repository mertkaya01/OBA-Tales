/**
 * Çekmecedeki portre yeri: mümkünse canlı (Pixi + pixelfx), değilse durağan.
 *
 * Durağan kalır: hareket azaltma tercihi açıksa, tarayıcı WebGL desteklemiyorsa ya da canlı sahne
 * o an başka yerdeyse (ör. akın paneli açık). Pixi yüklenirken aynı boyda durağan portre görünür; kayma olmaz.
 */
import { lazy, Suspense, useMemo } from "react";
import { PORTRAIT } from "../../game/fx/fxCatalog";
import { getPortraitUrl } from "../../game/sprites/portraitCache";
import { usePortrait3d } from "../../game/sprites/usePortrait3d";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useWebGLSupport } from "../../hooks/useWebGLSupport";
import { usePixiTurn } from "../../pixi/pixiLease";
import type { Character } from "../../types";
import { RarityFrame } from "./RarityFrame";

const LivePortrait = lazy(() => import("../../pixi/LivePortrait"));

/** LivePortrait.tsx'teki PORTRAIT_CSS_SCALE ile aynı (o dosya tembel yüklendiği için burada tekrar). */
const CSS_SCALE = 3;

function StillPortrait({ character, alt }: { character: Character; alt: string }) {
  const { width, height, feetX, feetY, spriteScale } = PORTRAIT;
  const scale = spriteScale * CSS_SCALE;
  const pixel = useMemo(() => getPortraitUrl(character, scale), [character, scale]);
  // 3D modelden ekran çözünürlüğünde çizilen tam boy portre (canlı portreyle aynı yer ve boy); hazır olana kadar piksel.
  const model = usePortrait3d(character, 16 * scale, 20 * scale);
  const url = model ?? pixel;
  return (
    <div className="relative" style={{ width: width * CSS_SCALE, height: height * CSS_SCALE }}>
      <img
        src={url}
        alt={alt}
        draggable={false}
        className={model ? "absolute" : "pixelated absolute"}
        width={16 * scale}
        height={20 * scale}
        style={{ left: (feetX - 8 * spriteScale) * CSS_SCALE, top: (feetY - 20 * spriteScale) * CSS_SCALE }}
      />
    </div>
  );
}

export function LivePortraitSlot({ character }: { character: Character }) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const webgl = useWebGLSupport();
  const live = usePixiTurn("portre", webgl && !reducedMotion);
  const alt = `${character.displayName} portresi`;

  return (
    <RarityFrame rarity={character.rarity} elementAura={character.elementAura} className="p-1.5">
      {live ? (
        <Suspense fallback={<StillPortrait character={character} alt={alt} />}>
          <LivePortrait character={character} />
        </Suspense>
      ) : (
        <StillPortrait character={character} alt={alt} />
      )}
    </RarityFrame>
  );
}

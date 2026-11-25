/**
 * Karakterin piksel portresi, nadirlik çerçevesi içinde.
 */
import { useMemo } from "react";
import { getPortraitUrl } from "../../game/sprites/portraitCache";
import { SPRITE_HEIGHT, SPRITE_WIDTH } from "../../game/sprites/pixelMaps";
import { cn } from "../../lib/cn";
import type { Character } from "../../types";
import { RarityFrame } from "./RarityFrame";

const SIZES = {
  sm: { scale: 2, padding: "p-0.5" },
  md: { scale: 3, padding: "p-1" },
  lg: { scale: 5, padding: "p-1.5" },
  xl: { scale: 8, padding: "p-2" },
} as const;

interface CharacterPortraitProps {
  character: Character;
  size?: keyof typeof SIZES;
  /** Ekran okuyucu metni. Ad yanında yazıyorsa boş bırakın. */
  alt?: string;
  className?: string;
}

export function CharacterPortrait({ character, size = "md", alt = "", className }: CharacterPortraitProps) {
  const { scale, padding } = SIZES[size];
  const url = useMemo(() => getPortraitUrl(character, scale), [character, scale]);

  return (
    <RarityFrame rarity={character.rarity} elementAura={character.elementAura} className={cn(padding, className)}>
      <img
        src={url}
        width={SPRITE_WIDTH * scale}
        height={SPRITE_HEIGHT * scale}
        alt={alt}
        draggable={false}
        className="pixelated"
      />
    </RarityFrame>
  );
}

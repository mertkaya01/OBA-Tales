/**
 * Kadro bölümü — akına öncülük eden yedi kahraman: lider, anlatıcı, ana ve yan kadro.
 * Her kartta portre, lakap, sınıf, kısa hikâye ve imza sözü; tıklanınca karakter çekmecesi açılır.
 */
import { CLASSES } from "../../content/classes";
import { CAST, ROLE_LABELS } from "../../content/cast";
import { RARITY_INFO } from "../../content/rarities";
import { cn } from "../../lib/cn";
import { useAppStore } from "../../state/useAppStore";
import { CharacterPortrait } from "../character/CharacterPortrait";
import { ClassIcon } from "../character/ClassIcon";
import { RARITY_TEXT } from "../character/styles";
import { Badge } from "../ui/Badge";

/** Lider ve anlatıcı önce, sonra ana kadro, en son yan kadro. */
const ROLE_ORDER = { leader: 0, narrator: 1, core: 2, side: 3 } as const;

export function CoreCastSection() {
  const select = useAppStore((s) => s.select);
  const cast = [...CAST].sort((a, b) => ROLE_ORDER[a.roleType] - ROLE_ORDER[b.roleType]);

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cast.map((member) => (
        <li key={member.id} className={cn(member.roleType === "leader" && "sm:col-span-2 lg:col-span-1")}>
          <button
            type="button"
            onClick={() => select(member.id)}
            className="flex h-full w-full gap-4 rounded-2xl border border-white/10 bg-gece-900/70 p-4 text-left transition hover:-translate-y-0.5 hover:border-white/25"
            aria-label={`${member.displayName}, ${member.epithet}. Kartını aç`}
          >
            <CharacterPortrait character={member} size="lg" className="shrink-0 self-start" />
            <span className="flex min-w-0 flex-col gap-1.5">
              <span className="flex flex-wrap items-center gap-1.5">
                <Badge tone={member.roleType === "leader" ? "gold" : member.roleType === "narrator" ? "purple" : "neutral"}>
                  {ROLE_LABELS[member.roleType]}
                </Badge>
              </span>
              <span className="font-display text-xl leading-tight text-buz-50">{member.displayName}</span>
              <span className="text-sm text-gunozu-200">{member.epithet}</span>
              <span className="flex items-center gap-1 text-xs text-buz-300">
                <ClassIcon classId={member.class.id} className="size-3.5" />
                {CLASSES[member.class.id].name} ·{" "}
                <span className={cn("font-semibold", RARITY_TEXT[member.rarity])}>{RARITY_INFO[member.rarity].label}</span>
              </span>
              <span className="line-clamp-3 text-sm text-buz-200">{member.bio}</span>
              <span className="mt-auto text-sm italic text-yun-200">{member.signature}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

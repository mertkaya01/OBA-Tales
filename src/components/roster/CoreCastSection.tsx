/**
 * Kahramanlar bölümü — hikâyede sırayla gelen kahramanlar (content/story.ts → ARRIVAL_ORDER).
 * Gelenlerin kartında portre, lakap, sınıf, kısa hikâye ve imza sözü; tıklanınca karakter çekmecesi açılır.
 * Henüz gelmeyenler koyu bir silüet ve "?" olarak durur: kim olduğu gelince belli olur.
 */
import { CLASSES } from "../../content/classes";
import { CAST, ROLE_LABELS } from "../../content/cast";
import { RARITY_INFO } from "../../content/rarities";
import { ARRIVAL_ORDER } from "../../content/story";
import { useGameData } from "../../data/useGameData";
import { cn } from "../../lib/cn";
import { useAppStore } from "../../state/useAppStore";
import { CharacterPortrait } from "../character/CharacterPortrait";
import { ClassIcon } from "../character/ClassIcon";
import { RARITY_TEXT } from "../character/styles";
import { Badge } from "../ui/Badge";

export function CoreCastSection() {
  const select = useAppStore((s) => s.select);
  const { characterById } = useGameData();

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {ARRIVAL_ORDER.map((id, index) => {
        const member = CAST.find((c) => c.id === id);
        const arrived = characterById.has(id);
        if (!member || !arrived) {
          return (
            <li key={id}>
              <div className="flex h-full gap-4 rounded-2xl border border-dashed border-white/15 bg-gece-950/60 p-4" aria-label={`${index + 1}. kahraman henüz gelmedi`}>
                <div aria-hidden className="grid h-[100px] w-[80px] shrink-0 place-items-center rounded-xl border border-white/10 bg-[radial-gradient(circle_at_50%_35%,#1c2a42,#0b1322_70%)] font-display text-4xl text-gunozu-200/70">
                  ?
                </div>
                <span className="flex min-w-0 flex-col gap-1.5">
                  <Badge tone="neutral">{index + 1}. kahraman</Badge>
                  <span className="font-display text-xl leading-tight text-buz-200">Henüz gelmedi</span>
                  <span className="text-sm text-buz-300">Kut Kapısı'ndan doğduğu gün kim olduğu burada belli olacak.</span>
                </span>
              </div>
            </li>
          );
        }
        return (
          <li key={id}>
            <button
              type="button"
              onClick={() => select(member.id)}
              className="flex h-full w-full gap-4 rounded-2xl border border-white/10 bg-gece-900/70 p-4 text-left transition hover:-translate-y-0.5 hover:border-white/25"
              aria-label={`${member.displayName}, ${member.epithet}. Kartını aç`}
            >
              <CharacterPortrait character={member} size="lg" className="shrink-0 self-start" />
              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={member.rarity === "goksel" ? "ice" : "gold"}>{ROLE_LABELS[member.roleType]}</Badge>
                  <Badge tone="neutral">{index + 1}. gelen</Badge>
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
        );
      })}
    </ul>
  );
}

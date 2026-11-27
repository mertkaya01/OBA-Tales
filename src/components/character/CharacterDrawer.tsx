/**
 * Karakter detay çekmecesi — seçili karakterin (?k=) bütün bilgileri.
 *
 * Harita ve kadro sayfası bu bileşeni bir kez yerleştirir; hangi karakterin gösterileceğini
 * depodaki selectedId belirler. Kimlik bulunamazsa nazik bir uyarı gösterir.
 */
import { Check, Link2, MapPin } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { ROLE_LABELS, isCastMember } from "../../content/cast";
import { CLASSES, PLATFORM_LABELS } from "../../content/classes";
import { RARITY_INFO } from "../../content/rarities";
import { REGIONS } from "../../content/regions";
import { useGameData } from "../../data/useGameData";
import { cn } from "../../lib/cn";
import { formatDate, formatNumber } from "../../lib/text";
import { useAppStore } from "../../state/useAppStore";
import type { Character } from "../../types";
import { Badge, type BadgeTone } from "../ui/Badge";
import { Drawer } from "../ui/Drawer";
import { EmptyState } from "../ui/EmptyState";
import { AttributeBars } from "./AttributeBars";
import { BadgeList } from "./BadgeList";
import { ClassIcon } from "./ClassIcon";
import { LivePortraitSlot } from "./LivePortraitSlot";
import { PlatformIcon } from "./PlatformIcon";
import { ShareButtons } from "./ShareButtons";
import { RARITY_TEXT } from "./styles";

const RARITY_TONE: Record<Character["rarity"], BadgeTone> = {
  siradan: "neutral",
  nadir: "green",
  destansi: "purple",
  efsanevi: "red",
  ulu: "gold",
  goksel: "ice",
};

export function CharacterDrawer() {
  const selectedId = useAppStore((s) => s.selectedId);
  const select = useAppStore((s) => s.select);
  const { characterById } = useGameData();
  const close = useCallback(() => select(null), [select]);

  if (!selectedId) return null;
  const character = characterById.get(selectedId);

  if (!character) {
    return (
      <Drawer open onClose={close} title="Kahraman bulunamadı">
        <EmptyState
          title="Bu iz rüzgârla silinmiş"
          message="Aradığın kahraman obanın listesinde yok. Bağlantı eski olabilir ya da kullanıcı adı değişmiş olabilir."
        />
      </Drawer>
    );
  }

  return (
    <Drawer open onClose={close} eyebrow={ROLE_LABELS[character.roleType]} title={character.displayName}>
      <CharacterDetails character={character} />
    </Drawer>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 font-display text-sm uppercase tracking-widest text-buz-300">{title}</h3>
      {children}
    </section>
  );
}

function CharacterDetails({ character: c }: { character: Character }) {
  const setRegions = useAppStore((s) => s.setRegions);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const cls = CLASSES[c.class.id];
  const rarity = RARITY_INFO[c.rarity];
  const region = REGIONS[c.region];

  return (
    <article>
      <div className="flex flex-col items-center text-center">
        <div className="mt-1">
          <LivePortraitSlot character={c} />
        </div>
        <p className="mt-3 text-sm text-buz-300">@{c.handle}</p>
        <p className={cn("font-display text-lg", RARITY_TEXT[c.rarity])}>{c.title}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          <Badge tone={RARITY_TONE[c.rarity]}>
            {rarity.label} · {rarity.title}
          </Badge>
          <Badge tone="ice" icon={<ClassIcon classId={c.class.id} className="size-3.5" />}>
            {cls.name} · {cls.archetypeLabel}
          </Badge>
        </div>
        <ShareButtons character={c} />
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
        {[
          ["Puan", c.points],
          ["Rozet", c.badges.length],
          ["Platform", c.linkedPlatforms.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white/5 p-2">
            <dt className="text-xs text-buz-300">{label}</dt>
            <dd className="font-display text-xl text-buz-50 tabular-nums">{formatNumber(Number(value))}</dd>
          </div>
        ))}
      </dl>

      {isCastMember(c) && (
        <Section title={c.epithet}>
          <p className="text-sm text-buz-100">{c.bio}</p>
          <p className="mt-2 text-sm text-buz-300">
            <span className="font-semibold text-buz-200">Görünüş: </span>
            {c.appearance}
          </p>
          <p className="mt-2 rounded-xl border border-gunozu-400/20 bg-gunozu-400/5 p-2.5 text-sm italic text-gunozu-100">
            {c.signature}
          </p>
        </Section>
      )}

      <Section title="Nitelikler">
        <AttributeBars character={c} />
      </Section>

      {isCastMember(c) && c.specialAbilities && (
        <Section title="Özel yetenekler">
          <ul className="space-y-1.5">
            {c.specialAbilities.map((ability) => {
              const [name, ...rest] = ability.split(": ");
              return (
                <li key={ability} className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-sm text-buz-200">
                  <span className={cn("font-semibold", RARITY_TEXT[c.rarity])}>{name}</span>
                  {rest.length > 0 && <>: {rest.join(": ")}</>}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <Section title="Sınıf">
        <p className="text-sm text-buz-100">
          <span className="font-semibold">{cls.name}</span> · {cls.role}
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-buz-300">
          {cls.abilities.map((ability) => (
            <li key={ability}>{ability}</li>
          ))}
        </ul>
      </Section>

      <Section title="Platformlar">
        <ul className="flex flex-wrap gap-2">
          {c.linkedPlatforms.map((p) => (
            <li key={p} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-sm text-buz-100">
              <PlatformIcon platform={p} />
              {PLATFORM_LABELS[p]}
              {p === c.platform && <span className="text-xs text-gunozu-300">ana</span>}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Bölge">
        <div className="flex items-start justify-between gap-3 rounded-xl bg-white/5 p-3">
          <div>
            <p className="font-semibold text-buz-50">{region.name}</p>
            <p className="text-sm text-buz-300">{region.tagline}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              // Haritadaysak bölgeye odaklan; başka sayfadaysak haritayı bu kahraman seçili açılsın.
              if (pathname === "/") setRegions([c.region]);
              else navigate(`/?k=${encodeURIComponent(c.id)}`);
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-sm text-buz-100 hover:bg-white/10"
          >
            <MapPin aria-hidden className="size-4" />
            Haritada göster
          </button>
        </div>
      </Section>

      <Section title="Rozetler">
        <BadgeList badges={c.badges} detailed />
      </Section>

      <Section title="Nadirlik">
        <p className="text-sm text-buz-300">
          <span className={cn("font-semibold", RARITY_TEXT[c.rarity])}>{rarity.frameLabel}</span> · {rarity.description}
        </p>
      </Section>

      <footer className="mt-6 flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs text-buz-300">
        <span>Son güncelleme: {formatDate(c.updatedAt)}</span>
        <CopyLinkButton />
      </footer>
    </article>
  );
}

function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!navigator.clipboard) return null;

  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(window.location.href).then(() => setCopied(true), () => undefined)}
      className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-buz-100 hover:bg-white/10"
    >
      {copied ? <Check aria-hidden className="size-4 text-zumrut-300" /> : <Link2 aria-hidden className="size-4" />}
      <span aria-live="polite">{copied ? "Kopyalandı" : "Bağlantıyı kopyala"}</span>
    </button>
  );
}

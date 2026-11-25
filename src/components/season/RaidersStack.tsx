/**
 * Akına katılanlar: üst üste binen küçük piksel portreler ve "+78". Portreye tıklayınca haritada o kahraman açılır.
 */
import { Link } from "react-router";
import { rarityRank } from "../../lib/rules";
import { formatNumber } from "../../lib/text";
import type { Character } from "../../types";
import { CharacterPortrait } from "../character/CharacterPortrait";


export function RaidersStack({ raiders, max = 10 }: { raiders: readonly Character[]; max?: number }) {
  if (raiders.length === 0) return null;
  // Önce kadro, sonra nadirlik: en göz alıcılar önde.
  const shown = [...raiders]
    .sort((a, b) => Number(b.roleType !== "follower") - Number(a.roleType !== "follower") || rarityRank(b.rarity) - rarityRank(a.rarity) || a.id.localeCompare(b.id))
    .slice(0, max);
  const rest = raiders.length - shown.length;

  return (
    <div className="flex items-center">
      <ul className="flex -space-x-2" aria-label={`${formatNumber(raiders.length)} akıncı`}>
        {shown.map((c) => (
          <li key={c.id}>
            <Link to={`/?k=${encodeURIComponent(c.id)}`} title={`${c.displayName} · haritada göster`} className="block rounded-md transition-transform hover:-translate-y-0.5">
              <CharacterPortrait character={c} size="sm" alt={c.displayName} />
            </Link>
          </li>
        ))}
      </ul>
      {rest > 0 && <span className="ml-3 font-display text-sm text-buz-200">+{formatNumber(rest)}</span>}
    </div>
  );
}

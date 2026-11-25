/**
 * OBA KADROSU ( /karakterler )
 *
 *   kadro            akına öncülük eden yedi kahraman
 *   nadirlik dizini  obada her nadirlikten kaç kişi var (tıklanınca ızgara süzülür)
 *   yoldaşlar        bütün takipçiler: arama, süzgeç, sıralama
 *
 * Bir karta tıklanınca karakter çekmecesi açılır; çekmeceden haritaya geçilebilir.
 */
import { useState } from "react";
import { Link } from "react-router";
import { CharacterDrawer } from "../components/character/CharacterDrawer";
import { CoreCastSection } from "../components/roster/CoreCastSection";
import { FollowerGrid } from "../components/roster/FollowerGrid";
import { RarityIndex } from "../components/roster/RarityIndex";
import { SectionTitle } from "../components/ui/SectionTitle";
import { useGameData } from "../data/useGameData";
import { rarityBreakdown } from "../lib/roster";
import { formatNumber } from "../lib/text";
import type { Rarity } from "../types";

export default function CharactersPage() {
  const { roster, activeParticipantIds } = useGameData();
  const followers = roster.characters;
  const [rarities, setRarities] = useState<Rarity[]>([]);
  const toggleRarity = (rarity: Rarity) => setRarities((list) => (list.includes(rarity) ? list.filter((r) => r !== rarity) : [...list, rarity]));

  return (
    <>
      <title>Oba Kadrosu · OBA-Tales</title>
      <meta name="description" content={`OBA-Tales dünyasının yedi kahramanı ve obaya katılan ${formatNumber(followers.length)} yoldaş.`} />

      <SectionTitle
        as="h1"
        eyebrow="Oba Kadrosu"
        title="Omuz omuza bir oba"
        description={
          <>
            Akına öncülük eden kadro ve obaya katılan {formatNumber(followers.length)} yoldaş. Sen de aralarında yer almak
            istersen{" "}
            <Link to="/katil" className="text-gunozu-300 underline-offset-4 hover:underline">
              obaya katıl
            </Link>
            .
          </>
        }
      />

      <section aria-labelledby="kadro" className="mt-8">
        <h2 id="kadro" className="mb-4 font-display text-2xl text-buz-50">
          Kadro
        </h2>
        <CoreCastSection />
      </section>

      <section aria-labelledby="nadirlik" className="mt-12">
        <h2 id="nadirlik" className="font-display text-2xl text-buz-50">
          Nadirlik dizini
        </h2>
        <p className="mb-4 mt-1 text-sm text-buz-300">Bir kutuya dokun: aşağıdaki yoldaşlar o nadirliğe göre süzülür.</p>
        <RarityIndex shares={rarityBreakdown(followers)} selected={rarities} onToggle={toggleRarity} />
      </section>

      <section aria-labelledby="yoldaslar" className="mt-12">
        <h2 id="yoldaslar" className="mb-4 font-display text-2xl text-buz-50">
          Yoldaşlar
        </h2>
        <FollowerGrid followers={followers} activeParticipantIds={activeParticipantIds} rarities={rarities} onRaritiesChange={setRarities} />
      </section>

      <CharacterDrawer />
    </>
  );
}

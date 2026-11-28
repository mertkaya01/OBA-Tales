/**
 * OBAYA KATIL ( /katil )
 *
 *   üç adım           takip et → sınıfın belli olur, adını sen seçersin → yorumlarla hikâyeye yön ver
 *   kahramanını bul   kullanıcı adıyla obada ara; yoksa karakterinin nasıl başlayacağını önizle
 *   yorumla katıl     "ad: Kara Şahin" ile kahraman adı, "yer: …" ile ad koyma oylaması
 *   sınıflar          Instagram → Kalkaneri · TikTok → Okyeli · YouTube → Ocakcan
 *   çoklu takip       2 platform: bir kademe nadirlik + Çift İz · 3 platform: Oba Öncülüğü
 *   nadirlik ve rozetler
 */
import { Compass, MessageCircle, UserPlus } from "lucide-react";
import { CharacterDrawer } from "../components/character/CharacterDrawer";
import { BadgeList } from "../components/character/BadgeList";
import { CharacterLookup } from "../components/join/CharacterLookup";
import { CommentJoinGuide } from "../components/join/CommentJoinGuide";
import { MultiPlatformRules } from "../components/join/MultiPlatformRules";
import { PlatformClassGuide } from "../components/join/PlatformClassGuide";
import { RarityGuide } from "../components/join/RarityGuide";
import { SectionTitle } from "../components/ui/SectionTitle";
import { BADGE_IDS } from "../types";
import { WORLD } from "../content/world";
import { useGameData } from "../data/useGameData";

const STEPS = [
  { icon: UserPlus, title: "Takip et", text: "Instagram, TikTok ya da YouTube'da OBA-Tales hesabını takip et. Birden fazlasında takip edersen daha güçlü başlarsın." },
  { icon: Compass, title: "Sınıfın belli olur, adını sen seçersin", text: "Ana platformun sınıfını seçer: Kalkaneri, Okyeli ya da Ocakcan. Yorumuna “ad: Kahramanının Adı” yazarsan haritada o adla belirirsin." },
  { icon: MessageCircle, title: "Hikâyeye yön ver", text: "Yorumlarla yerlere ad koy, kapalı adaların açılmasına destek ol, rozet topla. Oba senin kararınla ilerler." },
] as const;

/** Takip edenlere kendiliğinden verilen rozetler dışındakiler (kadroya özel olan gösterilmez). */
const EARNABLE_BADGES = BADGE_IDS.filter((id) => id !== "kurucu_oba");

export default function JoinPage() {
  const { world } = useGameData();

  return (
    <>
      <title>Obaya Katıl · OBA-Tales</title>
      <meta name="description" content="OBA-Tales hesabını takip et, sınıfını öğren, karakterini önizle ve yorumlarınla destana yön ver." />

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,460px)] lg:items-start">
        <div>
          <SectionTitle as="h1" eyebrow="Obaya Katıl" title="İzini destana bırak" description={WORLD.slogan} />
          <ol className="mt-6 grid gap-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="flex gap-3 rounded-2xl border border-white/10 bg-gece-900/70 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gunozu-400/15 font-display text-gunozu-300">
                  <Icon aria-hidden className="size-5" />
                </span>
                <span>
                  <span className="block font-display text-lg text-buz-50">
                    {i + 1}. {title}
                  </span>
                  <span className="block text-sm text-buz-200">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <section aria-label="Kahramanını bul">
          <CharacterLookup />
        </section>
      </div>

      <section aria-labelledby="yorumla" className="mt-14">
        <SectionTitle title={<span id="yorumla">Yorumla katıl</span>} description="Kahramanının adını ve haritadaki yerlerin adlarını yorumlarınla sen koyarsın." />
        <div className="mt-5">
          <CommentJoinGuide />
        </div>
      </section>

      <section aria-labelledby="siniflar" className="mt-14">
        <SectionTitle title={<span id="siniflar">Hangi platform, hangi sınıf?</span>} description="OBA-Tales hesabını ilk takip ettiğin platform ana platformun olur ve sınıfını belirler." />
        <div className="mt-5">
          <PlatformClassGuide socialLinks={world.socialLinks} />
        </div>
      </section>

      <section aria-labelledby="coklu" className="mt-14">
        <SectionTitle
          title={<span id="coklu">Birden çok platformda takip</span>}
          description="Sınıfın değişmez; ama ikinci platform başlangıç nadirliğini bir kademe yükseltir ve rozet kazandırır."
        />
        <div className="mt-5">
          <MultiPlatformRules />
        </div>
      </section>

      <section aria-labelledby="nadirlik" className="mt-14">
        <SectionTitle
          title={<span id="nadirlik">Nadirlik kademeleri</span>}
          description="Nadirlik yükseldikçe çerçeve, kıyafet ve aura değişir. Başlangıç nadirliğini takip ettiğin platform sayısı belirler."
        />
        <div className="mt-5">
          <RarityGuide />
        </div>
      </section>

      <section aria-labelledby="rozetler" className="mt-14">
        <SectionTitle title={<span id="rozetler">Rozetler</span>} description="Hikâyede yer aldıkça ve yorumlarla yön verdikçe rozet kazanırsın; hepsi kartında ve çekmecende görünür." />
        <BadgeList badges={EARNABLE_BADGES} detailed howToEarn className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" />
      </section>

      <CharacterDrawer />
    </>
  );
}

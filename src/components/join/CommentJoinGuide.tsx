/**
 * Yorumla katılma kuralları (Obaya Katıl sayfası):
 *   · "ad: Kara Şahin" → kahramanın o adla doğar (yeniden yazarsan en son yazdığın geçer)
 *   · "yer: Yıldız Koyu" → ad koyma oylamasında en çok beğenilen öneri yerin adı olur, "Ad Koyan" rozeti
 * Komutların tam listesi ve ad denetimi: src/lib/heroNames.ts
 */
import { MessageSquareText, Signpost } from "lucide-react";
import type { ReactNode } from "react";
import { HERO_NAME_MAX } from "../../lib/heroNames";

function CommentBubble({ handle, children }: { handle: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl rounded-tl-sm border border-white/10 bg-black/30 px-4 py-3">
      <p className="text-xs text-buz-300">@{handle}</p>
      <p className="font-display text-lg text-buz-50">{children}</p>
    </div>
  );
}

export function CommentJoinGuide() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <article className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-gece-900/70 p-5">
        <h3 className="flex items-center gap-2 font-display text-xl text-buz-50">
          <MessageSquareText aria-hidden className="size-5 text-gunozu-300" />
          Kahramanına ad ver
        </h3>
        <CommentBubble handle="senin_adin">
          <span className="text-gunozu-300">ad:</span> Kara Şahin
        </CommentBubble>
        <p className="text-sm text-buz-200">
          Videolarımızın altına böyle yaz: kahramanın bu adla Kut Kapısı'ndan doğar. Adını değiştirmek istersen yeniden yaz; en son yazdığın geçer.
        </p>
        <p className="text-sm text-buz-300">
          <span className="text-buz-100">adım Kara Şahin</span> ya da <span className="text-buz-100">#katıl Kara Şahin</span> da olur. Ad en çok {HERO_NAME_MAX} harf ve 4 sözcük olabilir;
          küfürlü, bağlantılı ya da kadronun adını taşıyan adlar kabul edilmez.
        </p>
      </article>

      <article className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-gece-900/70 p-5">
        <h3 className="flex items-center gap-2 font-display text-xl text-buz-50">
          <Signpost aria-hidden className="size-5 text-gunozu-300" />
          Haritaya ad koy
        </h3>
        <CommentBubble handle="senin_adin">
          <span className="text-gunozu-300">yer:</span> Yıldız Koyu
        </CommentBubble>
        <p className="text-sm text-buz-200">
          Ad koyma videolarında bir adayı ya da obayı soruyoruz. En çok beğenilen öneri o yerin adı olur; haritada etiketin altında "adını koyan @sen" yazar ve
          Ad Koyan rozetini kazanırsın.
        </p>
        <p className="text-sm text-buz-300">Oba her güncellendiğinde yeni yorumlar işlenir; yorumun birkaç gün içinde haritada görünür.</p>
      </article>
    </div>
  );
}

/**
 * Alt bilgi — slogan ve kısa açıklama. Harita sayfasında gösterilmez (tam ekran).
 */
import { Link } from "react-router";
import { WORLD } from "../../content/world";
import { Logo } from "../ui/Logo";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-gece-900/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-buz-300 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Logo size={28} animated={false} />
          <p className="italic text-buz-200">“{WORLD.slogan}”</p>
        </div>
        <div className="max-w-md sm:text-right">
          <p>
            {WORLD.name}, {WORLD.archipelago} topluluğu için yazılmış özgün bir masaldır. Bütün karakterler ve yerler hayal ürünüdür.
          </p>
          <p className="mt-1 text-xs">
            <Link to="/studyo" className="text-gunozu-300 underline-offset-4 hover:underline">
              Reel Stüdyosu
            </Link>{" "}
            · Açık kaynakla yapıldı:{" "}
            <a href="/lisanslar/ucuncu-taraf.txt" className="underline-offset-4 hover:text-buz-50 hover:underline">
              kütüphane lisansları
            </a>{" "}
            ·{" "}
            <a href="/lisanslar/pixelfx.txt" className="underline-offset-4 hover:text-buz-50 hover:underline">
              piksel efektleri (pixelfx)
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

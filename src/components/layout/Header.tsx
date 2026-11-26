/**
 * Üst menü — logo, sayfa bağlantıları, aktif bölüm rozeti ve mobil menü.
 */
import { Menu, Sparkles, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { WORLD } from "../../content/world";
import { useGameData } from "../../data/useGameData";
import { cn } from "../../lib/cn";
import { useAppStore } from "../../state/useAppStore";
import { Logo } from "../ui/Logo";

const NAV_ITEMS = [
  { to: "/", label: "Harita", end: true },
  { to: "/karakterler", label: "Oba Kadrosu", end: false },
  { to: "/katil", label: "Obaya Katıl", end: false },
] as const;

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-lg px-3 py-2 font-display text-[15px] transition-colors",
    isActive ? "bg-gunozu-400/15 text-gunozu-300" : "text-buz-200 hover:bg-white/5 hover:text-buz-50",
  );

export function Header() {
  const { world } = useGameData();
  const navigate = useNavigate();
  // Hikâye günü: tıklanınca haritaya gider ve tanıtım turunu açar.
  const openStory = () => {
    closeMenu();
    navigate("/");
    useAppStore.getState().startTour();
  };
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  // Mobil menü açıkken Esc ile kapat.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-gece-900/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link to="/" className="flex items-center gap-2" onClick={closeMenu}>
          <Logo size={34} />
          <span className="font-display text-xl text-gunozu-300">{WORLD.name}</span>
        </Link>

        <nav aria-label="Ana menü" className="ml-4 hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          onClick={openStory}
          className="ml-auto hidden items-center gap-2 rounded-full border border-gunozu-400/40 bg-gunozu-400/10 px-3 py-1 text-sm text-gunozu-200 hover:bg-gunozu-400/20 sm:flex"
          title="Tanıtım turunu izle"
        >
          <Sparkles aria-hidden className="size-4" />
          <span>Hikâye · {world.story.day}. gün</span>
        </button>

        <button
          type="button"
          className="ml-auto rounded-lg p-2 text-buz-100 hover:bg-white/10 sm:ml-2 md:hidden"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label={menuOpen ? "Menüyü kapat" : "Menüyü aç"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X aria-hidden className="size-6" /> : <Menu aria-hidden className="size-6" />}
        </button>
      </div>

      {menuOpen && (
        <nav id={menuId} aria-label="Mobil menü" className="border-t border-white/10 bg-gece-900/95 px-4 py-3 md:hidden">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={navLinkClass} onClick={closeMenu}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <button type="button" onClick={openStory} className="mt-3 flex w-full items-center gap-2 rounded-lg bg-gunozu-400/10 px-3 py-2 text-left text-sm text-gunozu-200">
            <Sparkles aria-hidden className="size-4" />
            Hikâye · {world.story.day}. gün · tanıtım turunu izle
          </button>
        </nav>
      )}
    </header>
  );
}

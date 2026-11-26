/**
 * "Akını izle" şeridindeki ses düğmesi: davul ve kopuz müziği, Akın Günü'nün saatine bağlı nara, kalkan, ok, ocak,
 * patlama ve zafer sesleri (audio/obaSound.ts). Tarayıcılar sesi ancak tıklamayla başlattığı için hep kapalı açılır.
 */
import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ObaSound, followRaid, soundSupported } from "../../audio/obaSound";
import type { BattleRuntime } from "./raid";

export function RaidSoundToggle({ battle }: { battle: BattleRuntime }) {
  const [on, setOn] = useState(false);
  const session = useRef<{ sound: ObaSound; stop: () => void } | null>(null);

  const close = () => {
    const current = session.current;
    session.current = null;
    if (!current) return;
    current.stop();
    current.sound.stopMusic(0.4);
    window.setTimeout(() => void current.sound.close(), 500);
  };
  useEffect(() => close, []);

  if (!soundSupported()) return null;

  const toggle = async () => {
    if (on) {
      close();
      setOn(false);
      return;
    }
    const sound = new ObaSound();
    await sound.resume();
    sound.startMusic(1);
    session.current = { sound, stop: followRaid(sound, () => battle.day?.t ?? null) };
    setOn(true);
  };

  const Icon = on ? Volume2 : VolumeX;
  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-pressed={on}
      title={on ? "Sesi kapat" : "Müzik ve akın seslerini aç"}
      aria-label={on ? "Sesi kapat" : "Müzik ve akın seslerini aç"}
      className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-xs text-buz-100 hover:bg-white/10"
    >
      <Icon aria-hidden className="size-3.5" />
      <span className="hidden sm:inline">{on ? "Ses açık" : "Ses"}</span>
    </button>
  );
}

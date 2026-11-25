/**
 * BOSS AKINI SAHNESİ — 320 × 180 piksellik canlı bir akın provası (Pixi + pixelfx).
 *
 *   solda  oba: önde kalkanlı Kalkaneriler, ocağın başında Ocakcanlar, arkada yaylı Okyeliler
 *   sağda  boss: kendi gökyüzü ve havasıyla (Tekgöz için kutup ışıkları ve kar)
 *
 * Boss arada bir (çocuk dostu) saldırır: sarkıt düşer, ayaz dalgası yayılır. Oyuncu üç düğmeyle obayı yönetir:
 *   Kalkan Duvarı (Kalkaneri) · Buz Oku (Okyeli) · boss'un zayıf noktası (Ocakcan, ör. Ocak Ninnisi)
 * Her hamle "sakinleşme" çubuğunu doldurur; dolunca boss sakinleşir, gözünü kapar, konfeti patlar.
 * Bu bir provadır: gerçek akının sonucu bölüm sonunda açıklanır (sahnenin altında yazar).
 *
 * Bu dosya Pixi'yi getirir; yalnızca akın paneli açılınca, tembel (lazy) yüklenir.
 */
import { Sprite, type Application, type Ticker } from "pixi.js";
import { RotateCcw, Shield, Sparkles, Target } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { BOSSES } from "../content/bosses";
import { actorFromSprite } from "../game/fx/actor";
import { bossSprite } from "../game/fx/bossSprites";
import { BOSS_SCENES, RAID_STAGE, anchorPoint, pickRaiders, raidSkills, type AnchoredFx } from "../game/fx/fxCatalog";
import { PixelFxPlayer } from "../game/fx/PixelFxPlayer";
import { raidBackdrop } from "../game/fx/raidBackdrop";
import { composeSprite } from "../game/sprites/composeSprite";
import { cn } from "../lib/cn";
import type { BossId, Character, ClassId } from "../types";
import { LayerTexture, textureFromRgba } from "./fxTexture";
import { PixiStage } from "./PixiStage";

const { width: W, height: H, groundY: G, bossX: BX, campfireX: CX } = RAID_STAGE;

/** Her hamlenin sakinleşme çubuğuna katkısı (yüzde). */
const CALM_GAIN: Readonly<Record<ClassId, number>> = { kalkaneri: 8, okyeli: 11, ocakcan: 19 };
/** Boss bu aralıklarla saldırır (saniye). */
const ATTACK_EVERY = 6.5;

interface Member {
  character: Character;
  sprite: Sprite;
  x: number;
  y: number;
  phase: number;
}

/** Sahnedeki obanın yerleri: sınıfına göre. */
const SLOTS: Readonly<Record<ClassId, readonly [number, number][]>> = {
  kalkaneri: [
    [150, 156],
    [138, 154],
    [162, 153],
    [126, 156],
  ],
  ocakcan: [
    [CX - 20, 152],
    [CX + 22, 153],
    [CX - 6, 158],
    [CX + 8, 147],
  ],
  okyeli: [
    [44, 148],
    [30, 152],
    [56, 155],
    [18, 147],
  ],
};

interface SceneApi {
  skill: (classId: ClassId) => void;
  reset: () => void;
}

interface BossRaidSceneProps {
  bossId: BossId;
  participants: readonly Character[];
  /** Hareket azaltma: ortam efektleri, saldırılar ve kıpırdanma kapalı; yalnızca düğme efektleri oynar. */
  reducedMotion: boolean;
}

export default function BossRaidScene({ bossId, participants, reducedMotion }: BossRaidSceneProps) {
  const boss = BOSSES[bossId];
  const scene = BOSS_SCENES[bossId];
  const skills = raidSkills(scene);
  const apiRef = useRef<SceneApi | null>(null);
  const [calm, setCalm] = useState(0);
  const calmRef = useRef(0);
  const raiders = useMemo(() => pickRaiders(participants), [participants]);

  const setup = useCallback(
    (app: Application) => {
      const player = new PixelFxPlayer(W, H);
      const backLayer = new LayerTexture(player.back);
      const frontLayer = new LayerTexture(player.front);

      // Arka plan, boss ve oba
      const backdrop = new Sprite(textureFromRgba(raidBackdrop(scene.sky, scene.ground, W, H, G)));
      const angry = bossSprite(bossId, false);
      const calmLook = bossSprite(bossId, true);
      const angryTexture = textureFromRgba(angry.sprite);
      const calmTexture = textureFromRgba(calmLook.sprite);
      const bossView = new Sprite(angryTexture);
      const bossHome = { x: Math.round(BX - angry.sprite.width / 2), y: G - angry.sprite.height + 3 };
      bossView.position.set(bossHome.x, bossHome.y);

      const members: Member[] = [];
      for (const classId of ["okyeli", "ocakcan", "kalkaneri"] as const) {
        raiders[classId].forEach((character, i) => {
          const [x, y] = SLOTS[classId][i];
          const view = new Sprite(textureFromRgba(composeSprite(character)));
          view.position.set(x - 8, y - 20);
          members.push({ character, sprite: view, x, y, phase: i * 1.7 + x * 0.1 });
        });
      }
      // Arkadakiler önce çizilsin.
      members.sort((a, b) => a.y - b.y);

      app.stage.addChild(backdrop, new Sprite(backLayer.texture), bossView, ...members.map((m) => m.sprite), new Sprite(frontLayer.texture));

      const anchors = {
        boss: { x: BX, y: G },
        cekirdek: { x: BX + angry.core.x, y: G + angry.core.y },
        ocak: { x: CX, y: G + 2 },
        oba: () => {
          const m = members[Math.floor(Math.random() * members.length)];
          return m ? { x: m.x, y: m.y } : { x: 70, y: G };
        },
      };
      const playAt = (fx: AnchoredFx, extra: Record<string, unknown> = {}) => player.playRecipe(fx, { ...anchorPoint(fx, anchors), ...extra });

      // Obanın ocağı hep yanar; diğer ortam efektleri hareket azaltılmadıysa.
      player.play("fire/campfire", { x: CX, y: G + 2, height: 14, tag: "ortam" });
      if (!reducedMotion) for (const fx of scene.ambient) playAt(fx, { tag: "ortam" });

      let t = 0;
      let nextAttack = 3;
      let attackIndex = 0;
      let flinch = 0;
      const cheers = new Map<ClassId, number>();

      const tick = (ticker: Ticker) => {
        const dt = Math.min(ticker.deltaMS / 1000, 0.1);
        t += dt;
        flinch = Math.max(0, flinch - dt);
        for (const [classId, left] of cheers) cheers.set(classId, Math.max(0, left - dt));

        // Boss saldırısı (sakinleşmediyse)
        if (!reducedMotion && calmRef.current < 100 && t >= nextAttack) {
          playAt(scene.attacks[attackIndex % scene.attacks.length], { tag: "saldiri" });
          attackIndex++;
          nextAttack = t + ATTACK_EVERY + Math.random() * 2;
        }

        // Boss: yavaş nefes, vurulunca titrer
        const breathe = reducedMotion ? 0 : Math.sin(t * 1.3) > 0.6 ? 1 : 0;
        bossView.position.set(bossHome.x + (flinch > 0 ? (Math.round(t * 40) % 2 ? 1 : -1) : 0), bossHome.y - breathe);
        bossView.tint = flinch > 0.15 ? 0xcfefff : 0xffffff;

        // Oba: arada bir kıpırdanır; hamle yapan sınıf zıplar
        for (const m of members) {
          const idle = reducedMotion ? 0 : Math.sin(t * 2.4 + m.phase) > 0.75 ? 1 : 0;
          const cheer = cheers.get(m.character.class.id) ?? 0;
          const hop = cheer > 0 ? Math.round(Math.sin((cheer / 0.4) * Math.PI) * 3) : 0;
          m.sprite.position.set(m.x - 8, m.y - 20 - idle - hop);
        }

        player.update(dt);
        player.render();
        backLayer.sync();
        frontLayer.sync();
      };
      app.ticker.add(tick);

      const membersOf = (classId: ClassId) => members.filter((m) => m.character.class.id === classId);
      apiRef.current = {
        skill: (classId) => {
          cheers.set(classId, 0.4);
          if (classId === "kalkaneri") {
            const front = membersOf("kalkaneri").sort((a, b) => b.x - a.x)[0];
            const at = front ?? { x: 150, y: 156 };
            const actor = front ? actorFromSprite(composeSprite(front.character), 1) : undefined;
            player.play("impacts/shield-block", { x: at.x + 4, y: at.y, actor });
          } else if (classId === "okyeli") {
            const archers = membersOf("okyeli");
            const sources = archers.length > 0 ? archers : [{ x: 40, y: 150 }];
            const target = anchors.cekirdek;
            for (let i = 0; i < 5; i++) {
              const from = sources[i % sources.length];
              const sx = from.x + 6;
              const sy = from.y - 14;
              const dx = target.x + (i - 2) * 3 - sx;
              const dy = target.y + ((i * 7) % 9) - 4 - sy;
              const dist = Math.hypot(dx, dy);
              const speed = 260;
              player.play("projectiles/arrow", {
                x: sx,
                y: sy,
                angle: Math.atan2(dy, dx),
                velocity: { x: (dx / dist) * speed, y: (dy / dist) * speed },
                lifetime: dist / speed,
                delay: i * 0.12,
                layer: "front",
              });
            }
            window.setTimeout(() => (flinch = 0.45), 520);
          } else {
            for (const fx of scene.weakness.fx) playAt(fx);
            window.setTimeout(() => (flinch = 0.3), 600);
          }
          calmRef.current = Math.min(100, calmRef.current + CALM_GAIN[classId]);
          setCalm(calmRef.current);
          if (calmRef.current >= 100 && bossView.texture !== calmTexture) {
            bossView.texture = calmTexture;
            player.stop("saldiri");
            player.play("ui/confetti", { x: W / 2, y: G + 4, delay: 0.4 });
          }
        },
        reset: () => {
          calmRef.current = 0;
          setCalm(0);
          bossView.texture = angryTexture;
          nextAttack = t + 2;
        },
      };

      return () => {
        app.ticker.remove(tick);
        apiRef.current = null;
        // Paylaşılmayan dokular sahneyle birlikte yok edilir; kullanılmayan sakin dokuyu da bırak.
        if (bossView.texture !== calmTexture) calmTexture.destroy(true);
        if (bossView.texture !== angryTexture) angryTexture.destroy(true);
      };
    },
    [bossId, reducedMotion, scene, raiders],
  );

  const calmed = calm >= 100;
  const icons: Record<ClassId, typeof Shield> = { kalkaneri: Shield, okyeli: Target, ocakcan: Sparkles };

  return (
    <div className="grid gap-3">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-gece-950">
        <PixiStage
          key={`${bossId}:${reducedMotion}:${participants.length}`}
          width={W}
          height={H}
          setup={setup}
          label={`${boss.name} akın sahnesi: solda oba ocağın başında, sağda ${boss.name}.`}
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex justify-between text-xs text-buz-200">
            <span>Sakinleşme</span>
            <span className="tabular-nums">%{calm}</span>
          </div>
          <div
            className="h-2.5 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={calm}
            aria-label={`${boss.name} sakinleşme`}
          >
            <div className={cn("h-full rounded-full transition-[width] duration-300", calmed ? "bg-gunozu-400" : "bg-buz-400")} style={{ width: `${calm}%` }} />
          </div>
        </div>
        {calmed && (
          <button
            type="button"
            onClick={() => apiRef.current?.reset()}
            className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-sm text-buz-100 hover:bg-white/10"
          >
            <RotateCcw aria-hidden className="size-4" />
            Yeniden
          </button>
        )}
      </div>

      <p className="min-h-5 text-sm text-buz-100" aria-live="polite">
        {calmed ? `${boss.name} sakinleşti! Gözlerini kapadı, obaya gülümsüyor.` : "Hamleni seç: her sınıfın kendi yeteneği var."}
      </p>

      <div className="grid grid-cols-3 gap-2">
        {(["kalkaneri", "okyeli", "ocakcan"] as const).map((classId) => {
          const Icon = icons[classId];
          return (
            <button
              key={classId}
              type="button"
              disabled={calmed}
              onClick={() => apiRef.current?.skill(classId)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-sm transition-colors disabled:opacity-50",
                classId === "ocakcan"
                  ? "border-gunozu-400/50 bg-gunozu-400/10 text-gunozu-100 hover:bg-gunozu-400/20"
                  : "border-white/15 bg-white/5 text-buz-100 hover:bg-white/10",
              )}
            >
              <Icon aria-hidden className="size-4" />
              <span className="font-display">{skills[classId]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

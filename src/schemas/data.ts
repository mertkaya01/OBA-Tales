/**
 * VERİ ŞEMALARI (zod) — public/data/*.json dosyaları yüklenirken ve derleme öncesi doğrulanır.
 *
 * Her şema `satisfies z.ZodType<...>` ile src/types içindeki tiplere bağlıdır:
 * tip değişip şema güncellenmezse TypeScript derlemesi hata verir.
 *
 * Bu dosyada içerik (bölge poligonları vb.) gerektiren kontroller yok; onlar
 * scripts/validate-data.ts içinde src/content ile birlikte yapılır.
 */
import { z } from 'zod';
import {
  ARCHETYPES,
  BADGE_IDS,
  CLASS_ARCHETYPE,
  CLASS_IDS,
  ELEMENT_AURAS,
  EPISODE_STATUSES,
  PLACE_IDS,
  PLATFORMS,
  PLATFORM_TO_CLASS,
  RARITIES,
  FOLLOWER_RARITY_CAP,
  REGION_IDS,
  ROLE_TYPES,
  SEASON_LENGTH,
  WEATHERS,
  WORLD_SIZE,
} from '../types';
import type { Character, RosterFile, SeasonState, WorldState } from '../types';

// Yerleşik hata mesajları Türkçe olsun.
z.config(z.locales.tr());
// İçerik Güvenlik Politikası (public/_headers) eval'e izin vermez: zod çalışma anında kod üretmesin.
z.config({ jitless: true });

// ── Ortak parçalar ─────────────────────────────────────────────────

const isoDateTime = z.iso.datetime({ offset: true });
const nonNegativeInt = z.number().int().nonnegative();
const episodeNumber = z.number().int().min(1).max(SEASON_LENGTH);
const slug = z
  .string()
  .regex(/^[a-z0-9][a-z0-9_-]*$/, 'Yalnızca küçük harf, rakam, "-" ve "_" kullanılabilir');
/** Instagram, TikTok ve YouTube kullanıcı adlarının ortak kümesi ("@" olmadan). */
const handle = z
  .string()
  .regex(/^[A-Za-z0-9._-]{2,30}$/, 'Kullanıcı adı 2–30 karakter olmalı; harf, rakam, ".", "_" ve "-" içerebilir ("@" yazmayın)');
/** Bağlantılar yalnızca https olabilir (javascript: gibi tehlikeli adresler reddedilir). */
const httpsUrlOrNull = z.url({ protocol: /^https$/ }).nullable();

const hasDuplicates = (values: readonly string[]): boolean => new Set(values).size !== values.length;

export const platformSchema = z.enum(PLATFORMS);
export const regionIdSchema = z.enum(REGION_IDS);

const rarityRankOf = (r: (typeof RARITIES)[number]) => RARITIES.indexOf(r);

export const coordinatesSchema = z.object({
  x: z.number().min(0).max(WORLD_SIZE.width),
  y: z.number().min(0).max(WORLD_SIZE.height),
});

// ── Karakter ve roster.json ────────────────────────────────────────

export const characterSchema = z
  .object({
    id: slug,
    handle,
    displayName: z.string().trim().min(1).max(40),
    roleType: z.enum(ROLE_TYPES),
    platform: platformSchema,
    linkedPlatforms: z.array(platformSchema).min(1).max(PLATFORMS.length),
    class: z.object({
      id: z.enum(CLASS_IDS),
      name: z.string().trim().min(1),
      archetype: z.enum(ARCHETYPES),
    }),
    rarity: z.enum(RARITIES),
    title: z.string().trim().min(1).max(60),
    points: nonNegativeInt,
    region: regionIdSchema,
    coordinates: coordinatesSchema,
    badges: z.array(z.enum(BADGE_IDS)),
    elementAura: z.enum(ELEMENT_AURAS).nullable(),
    seasonContributions: z.object({
      votesCast: nonNegativeInt,
      raidsJoined: nonNegativeInt,
    }),
    updatedAt: isoDateTime,
  })
  .superRefine((c, ctx) => {
    if (!c.linkedPlatforms.includes(c.platform)) {
      ctx.addIssue({
        code: 'custom',
        path: ['linkedPlatforms'],
        message: `Ana platform "${c.platform}" linkedPlatforms listesinde de yer almalı`,
      });
    }
    if (hasDuplicates(c.linkedPlatforms)) {
      ctx.addIssue({ code: 'custom', path: ['linkedPlatforms'], message: 'Aynı platform iki kez yazılmış' });
    }
    const expectedClass = PLATFORM_TO_CLASS[c.platform];
    if (c.class.id !== expectedClass) {
      ctx.addIssue({
        code: 'custom',
        path: ['class', 'id'],
        message: `"${c.platform}" platformunun sınıfı "${expectedClass}" olmalı`,
      });
    }
    if (c.roleType === 'follower' && rarityRankOf(c.rarity) > rarityRankOf(FOLLOWER_RARITY_CAP)) {
      ctx.addIssue({
        code: 'custom',
        path: ['rarity'],
        message: `"${c.rarity}" yalnızca özel kahramanlara verilir; takipçilerde en yüksek nadirlik "${FOLLOWER_RARITY_CAP}"`,
      });
    }
    if (c.class.archetype !== CLASS_ARCHETYPE[c.class.id]) {
      ctx.addIssue({
        code: 'custom',
        path: ['class', 'archetype'],
        message: `"${c.class.id}" sınıfının arketipi "${CLASS_ARCHETYPE[c.class.id]}" olmalı`,
      });
    }
    if (hasDuplicates(c.badges)) {
      ctx.addIssue({ code: 'custom', path: ['badges'], message: 'Aynı rozet iki kez yazılmış' });
    }
  }) satisfies z.ZodType<Character>;

export const rosterSchema = z
  .object({
    version: z.literal(1),
    season: z.number().int().min(1),
    generatedAt: isoDateTime,
    characters: z.array(characterSchema),
  })
  .superRefine((roster, ctx) => {
    const ids = new Set<string>();
    const handles = new Set<string>();
    roster.characters.forEach((c, i) => {
      if (c.roleType !== 'follower') {
        ctx.addIssue({
          code: 'custom',
          path: ['characters', i, 'roleType'],
          message: 'roster.json yalnızca takipçi ("follower") içerir; kadro src/content/cast.ts içinde tanımlıdır',
        });
      }
      if (ids.has(c.id)) {
        ctx.addIssue({ code: 'custom', path: ['characters', i, 'id'], message: `"${c.id}" kimliği iki kez kullanılmış` });
      }
      ids.add(c.id);
      const key = `${c.platform}:${c.handle.toLowerCase()}`;
      if (handles.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['characters', i, 'handle'],
          message: `"${c.handle}" (${c.platform}) kullanıcı adı iki kez kullanılmış`,
        });
      }
      handles.add(key);
    });
  }) satisfies z.ZodType<RosterFile>;

// ── season.json ────────────────────────────────────────────────────

const pollResultSchema = z
  .object({
    pollId: slug,
    tallies: z.record(z.string(), nonNegativeInt),
    winnerOptionId: z.string().nullable(),
  })
  .refine((r) => r.winnerOptionId === null || r.winnerOptionId in r.tallies, {
    path: ['winnerOptionId'],
    message: 'Kazanan seçenek, oy sayımında (tallies) da bulunmalı',
  });

const episodeProgressSchema = z.object({
  episodeNumber,
  status: z.enum(EPISODE_STATUSES),
  participantIds: z.array(slug),
  results: z.array(pollResultSchema),
  airedAt: isoDateTime.nullable(),
  recap: z.string().trim().min(1).nullable(),
});

export const seasonStateSchema = z
  .object({
    version: z.literal(1),
    season: z.number().int().min(1),
    activeEpisode: episodeNumber,
    episodes: z.array(episodeProgressSchema).max(SEASON_LENGTH),
    updatedAt: isoDateTime,
  })
  .superRefine((season, ctx) => {
    const seen = new Set<number>();
    let activeCount = 0;
    season.episodes.forEach((ep, i) => {
      if (seen.has(ep.episodeNumber)) {
        ctx.addIssue({
          code: 'custom',
          path: ['episodes', i, 'episodeNumber'],
          message: `Bölüm ${ep.episodeNumber} iki kez yazılmış`,
        });
      }
      seen.add(ep.episodeNumber);
      if (hasDuplicates(ep.participantIds)) {
        ctx.addIssue({
          code: 'custom',
          path: ['episodes', i, 'participantIds'],
          message: 'Aynı katılımcı iki kez yazılmış',
        });
      }
      if (ep.status === 'aktif') {
        activeCount += 1;
        if (ep.episodeNumber !== season.activeEpisode) {
          ctx.addIssue({
            code: 'custom',
            path: ['episodes', i, 'status'],
            message: `Aktif bölüm ${ep.episodeNumber}, ama activeEpisode ${season.activeEpisode} yazıyor`,
          });
        }
      }
    });
    if (activeCount > 1) {
      ctx.addIssue({ code: 'custom', path: ['episodes'], message: 'Aynı anda en fazla bir bölüm "aktif" olabilir' });
    }
  }) satisfies z.ZodType<SeasonState>;

// ── world.json ─────────────────────────────────────────────────────

export const worldStateSchema = z
  .object({
    version: z.literal(1),
    seed: z.number().int().min(0).max(0xffffffff),
    fogSoftness: z.number().positive().max(200),
    revealedRegions: z.array(regionIdSchema),
    glimpses: z.array(
      z.object({
        name: z.string().trim().min(1),
        center: coordinatesSchema,
        radius: z.number().positive().max(WORLD_SIZE.width),
      }),
    ),
    weather: z.enum(WEATHERS).default('kar'),
    namedPlaces: z
      .array(
        z.object({
          place: z.enum(PLACE_IDS),
          name: z.string().trim().min(2).max(40),
          namedBy: slug,
        }),
      )
      .default([]),
    socialLinks: z.object({
      instagram: httpsUrlOrNull,
      tiktok: httpsUrlOrNull,
      youtube: httpsUrlOrNull,
    }),
    updatedAt: isoDateTime,
  })
  .superRefine((world, ctx) => {
    if (hasDuplicates(world.revealedRegions)) {
      ctx.addIssue({ code: 'custom', path: ['revealedRegions'], message: 'Aynı bölge iki kez yazılmış' });
    }
    if (hasDuplicates(world.namedPlaces.map((p) => p.place))) {
      ctx.addIssue({ code: 'custom', path: ['namedPlaces'], message: 'Aynı yere iki ad verilmiş' });
    }
  }) satisfies z.ZodType<WorldState>;

// ── Dosya adı → şema eşlemesi (loaders ve validate-data script'i kullanır) ──

export const DATA_SCHEMAS = {
  roster: rosterSchema,
  season: seasonStateSchema,
  world: worldStateSchema,
} as const;

export type DataFileName = keyof typeof DATA_SCHEMAS;

/** Doğrulama hatasını okunur, satır satır bir metne çevirir. */
export function formatDataError(error: z.ZodError): string {
  return z.prettifyError(error);
}

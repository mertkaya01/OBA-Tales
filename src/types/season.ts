/**
 * SEZON MODELİ — 12 bölüm, oylamalar, boss'lar ve canlı sezon durumu (public/data/season.json).
 *
 * Bölümlerin başlıkları ve oylama soruları kanondur (src/content/episodes.ts).
 * Hangi bölümün aktif olduğu, oy sonuçları ve akına katılanlar ise season.json içinde güncellenir.
 */
import type { RegionId } from './world';

export const SEASON_LENGTH = 12;

// ── Boss ───────────────────────────────────────────────────────────

export const BOSS_IDS = ['buzkiran_tekgoz', 'sisci_karacay', 'ayazkurt', 'kisgolgesi_han'] as const;
export type BossId = (typeof BOSS_IDS)[number];

export const BOSS_ELEMENTS = ['buz', 'sis', 'ayaz', 'golge'] as const;
export type BossElement = (typeof BOSS_ELEMENTS)[number];

export interface Boss {
  id: BossId;
  name: string;
  /** Lakap, ör. "Buzulların Şaşkın Devi". */
  epithet: string;
  /** Boss'un çıktığı bölüm numarası. */
  episode: number;
  region: RegionId;
  element: BossElement;
  description: string;
  /** Obanın akında kullanabileceği zayıf nokta. */
  weakness: string;
  /** Boss yok edilmez, sakinleşir: akının çocuk dostu kapanışı. */
  resolution: string;
}

// ── Bölüm ve oylama ────────────────────────────────────────────────

export interface VoteOption {
  /** Bölüm içinde benzersiz kısa kimlik, ör. "kuzey-kiyisi". */
  id: string;
  label: string;
  description?: string;
}

/** Bir bölümde 1 ya da 2 oylama sorusu olabilir. */
export interface Poll {
  /** Sezon içinde benzersiz kimlik, ör. "b02-fener". */
  id: string;
  question: string;
  options: VoteOption[];
}

/** Kanon bölüm tanımı — src/content/episodes.ts. */
export interface Episode {
  /** 1–12 */
  number: number;
  /** URL dostu kimlik, ör. "b01-obaya-ilk-adim". */
  id: string;
  title: string;
  summary: string;
  region: RegionId;
  bossId: BossId | null;
  polls: Poll[];
}

/**
 * kilitli     → henüz duyurulmadı
 * yakinda     → duyuruldu, akın başlamadı
 * aktif       → oylama ve akın sürüyor (aynı anda en fazla bir bölüm)
 * tamamlandi  → sonuçlar açıklandı
 */
export const EPISODE_STATUSES = ['kilitli', 'yakinda', 'aktif', 'tamamlandi'] as const;
export type EpisodeStatus = (typeof EPISODE_STATUSES)[number];

export interface PollResult {
  pollId: string;
  /** Seçenek kimliği → oy sayısı. */
  tallies: Record<string, number>;
  /** Kazanan seçenek; oylama sürerken null. */
  winnerOptionId: string | null;
}

export interface EpisodeProgress {
  episodeNumber: number;
  status: EpisodeStatus;
  /** Bu bölümün akınına katılan karakter kimlikleri ("Aktif Bölüm Akınındakiler" filtresi buradan beslenir). */
  participantIds: string[];
  results: PollResult[];
  /** Yayın tarihi (ISO 8601) ya da henüz yayınlanmadıysa null. */
  airedAt: string | null;
  /** Dede Toygar'ın bölüm sonu özeti. */
  recap: string | null;
}

/**
 * public/data/season.json dosyasının şekli.
 * Listede olmayan bölümler "kilitli" sayılır.
 */
export interface SeasonState {
  version: 1;
  season: number;
  activeEpisode: number;
  episodes: EpisodeProgress[];
  /** ISO 8601 tarih-saat. */
  updatedAt: string;
}

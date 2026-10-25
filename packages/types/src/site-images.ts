import { z } from 'zod';

// ─── Admin-managed site images ──────────────────────────────────────
// Each slot is one photo on a public page. An admin can upload a replacement;
// until then (or after a reset) the web app shows the bundled default.

export const SITE_IMAGE_SLOTS = [
  'landing-1',
  'landing-2',
  'landing-3',
  'auth',
  'home-hero',
  'community-hero',
  'games-hero',
  'polls-hero',
  'rewards-hero',
] as const;

export type SiteImageSlot = (typeof SITE_IMAGE_SLOTS)[number];

export const siteImageSlotSchema = z.enum(SITE_IMAGE_SLOTS);

export interface SiteImageSlotInfo {
  label: string;
  /** Where the image appears, shown to admins. */
  usedOn: string;
  /** Bundled image under apps/web/public, used when no custom upload exists. */
  defaultUrl: string;
  /** Upload guidance for admins: `tall` fills half the screen, `wide` is a short banner. */
  shape: 'tall' | 'wide';
}

export const SITE_IMAGE_SLOT_INFO: Record<SiteImageSlot, SiteImageSlotInfo> = {
  'landing-1': { label: 'Landing photo 1', usedOn: 'Landing page slideshow', defaultUrl: '/images/people-hero.jpg', shape: 'tall' },
  'landing-2': { label: 'Landing photo 2', usedOn: 'Landing page slideshow', defaultUrl: '/images/landing-2.jpg', shape: 'tall' },
  'landing-3': { label: 'Landing photo 3', usedOn: 'Landing page slideshow', defaultUrl: '/images/landing-3.jpg', shape: 'tall' },
  auth: { label: 'Sign-in & register', usedOn: 'Login, register and password pages', defaultUrl: '/images/people-hero.jpg', shape: 'tall' },
  'home-hero': { label: 'Home banner', usedOn: 'Member home page', defaultUrl: '/images/people-hero.jpg', shape: 'wide' },
  'community-hero': { label: 'Community banner', usedOn: 'Community page', defaultUrl: '/images/community-hero.jpg', shape: 'wide' },
  'games-hero': { label: 'Games banner', usedOn: 'Games page', defaultUrl: '/images/games-hero.jpg', shape: 'wide' },
  'polls-hero': { label: 'Polls banner', usedOn: 'Polls page', defaultUrl: '/images/polls-hero.jpg', shape: 'wide' },
  'rewards-hero': { label: 'Rewards banner', usedOn: 'Rewards page', defaultUrl: '/images/rewards-hero.jpg', shape: 'wide' },
};

export const SITE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const SITE_IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * Public map of slots that have a custom upload → API path (relative to the
 * `/v1` base, cache-busted by version). Slots without an upload are absent.
 */
export type SiteImageMap = Partial<Record<SiteImageSlot, string>>;

export interface AdminSiteImageView {
  slot: SiteImageSlot;
  /** API path of the custom image, or null when the default is in use. */
  path: string | null;
  contentType: string | null;
  byteSize: number | null;
  updatedAt: string | null;
}

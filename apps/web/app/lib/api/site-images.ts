import { SITE_IMAGE_SLOT_INFO, type ApiResponse, type SiteImageMap, type SiteImageSlot } from '@binaryiq/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

/**
 * Which slots have an admin-uploaded image. Never throws: on any failure it
 * returns null and every page keeps its bundled default.
 */
export async function fetchSiteImages(init?: RequestInit & { next?: { revalidate?: number } }): Promise<SiteImageMap | null> {
  try {
    const res = await fetch(`${BASE_URL}/site-images`, init);
    if (!res.ok) return null;
    const body = (await res.json()) as ApiResponse<SiteImageMap>;
    return body.data ?? null;
  } catch {
    return null;
  }
}

/** Absolute URL of an API image path (as returned in SiteImageMap / AdminSiteImageView). */
export function apiImageUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

/** The custom image for a slot if one was uploaded, otherwise the bundled default. */
export function siteImageUrl(map: SiteImageMap, slot: SiteImageSlot): string {
  const path = map[slot];
  return path ? apiImageUrl(path) : SITE_IMAGE_SLOT_INFO[slot].defaultUrl;
}

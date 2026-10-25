'use client';

import type { SiteImageMap, SiteImageSlot } from '@binaryiq/types';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { fetchSiteImages, siteImageUrl } from '@/lib/api/site-images';

const SiteImagesContext = createContext<SiteImageMap>({});

/**
 * Provides the admin-managed page images. `initial` comes from the server
 * render; if that fetch failed (e.g. the API was waking up) it retries from
 * the browser so a custom image still replaces the default.
 */
export function SiteImagesProvider({
  initial,
  children,
}: {
  initial: SiteImageMap | null;
  children: ReactNode;
}): React.JSX.Element {
  const [map, setMap] = useState<SiteImageMap>(initial ?? {});

  useEffect(() => {
    if (initial !== null) return;
    let cancelled = false;
    void fetchSiteImages().then((m) => {
      if (!cancelled && m) setMap(m);
    });
    return () => {
      cancelled = true;
    };
  }, [initial]);

  return <SiteImagesContext.Provider value={map}>{children}</SiteImagesContext.Provider>;
}

/** URL to render for a slot: the admin's upload, or the bundled default. */
export function useSiteImage(slot: SiteImageSlot): string {
  return siteImageUrl(useContext(SiteImagesContext), slot);
}

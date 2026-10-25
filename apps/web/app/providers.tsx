'use client';

import type { SiteImageMap } from '@binaryiq/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useEffect, useState, type ReactNode } from 'react';

import { SiteImagesProvider } from '@/features/site-images/SiteImages';
import { warmUpApi } from '@/lib/api/client';

/** Root client providers: server-state (TanStack Query), theming (dark mode) and admin-managed page images. */
export function Providers({
  siteImages,
  children,
}: {
  siteImages: SiteImageMap | null;
  children: ReactNode;
}): React.JSX.Element {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
      }),
  );

  useEffect(warmUpApi, []);

  return (
    <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <SiteImagesProvider initial={siteImages}>{children}</SiteImagesProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

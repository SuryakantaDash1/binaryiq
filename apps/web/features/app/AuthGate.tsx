'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { tryRefresh } from '@/lib/api/client';
import { getToken } from '@/lib/api/session';

/**
 * Renders the member app only for a signed-in member. The access token is
 * memory-only, so on a fresh load the session is restored from the httpOnly
 * refresh cookie; without one the visitor is sent to the login page instead of
 * seeing the app shell.
 */
export function AuthGate({ children }: { children: ReactNode }): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(() => getToken() !== null);

  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    void tryRefresh().then((ok) => {
      if (cancelled) return;
      if (ok) setReady(true);
      else router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, pathname, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" aria-label="Loading" />
      </div>
    );
  }
  return <>{children}</>;
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { adminApi, clearAdminToken, getAdminToken } from '@/lib/api/admin';

const NAV = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Users', href: '/admin/users' },
  { label: 'Surveys', href: '/admin/surveys' },
  { label: 'Polls', href: '/admin/polls' },
  { label: 'Rewards', href: '/admin/rewards' },
  { label: 'Games', href: '/admin/games' },
  { label: 'Support', href: '/admin/support' },
  { label: 'Audit Logs', href: '/admin/audit-logs' },
  { label: 'Consents', href: '/admin/consents' },
];

export default function AdminLayout({ children }: { children: ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/admin/login';
  const [state, setState] = useState<'checking' | 'ok'>('checking');
  const [name, setName] = useState('');

  useEffect(() => {
    if (isLogin) return;
    if (!getAdminToken()) {
      router.replace('/admin/login');
      return;
    }
    adminApi
      .me()
      .then((a) => {
        setName(a.name);
        setState('ok');
      })
      .catch(() => {
        clearAdminToken();
        router.replace('/admin/login');
      });
  }, [isLogin, pathname, router]);

  // The login page renders standalone (no chrome, no guard).
  if (isLogin) return <>{children}</>;

  if (state === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-secondary">Loading…</div>
    );
  }

  function signOut(): void {
    clearAdminToken();
    router.replace('/admin/login');
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <span className="font-bold text-text">Admin Console</span>
            <nav className="flex flex-wrap gap-1 text-sm">
              {NAV.map((n) => {
                const active = n.href === '/admin' ? pathname === '/admin' : pathname.startsWith(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={`rounded-full px-3 py-1.5 transition-colors ${
                      active ? 'bg-primary text-on-primary' : 'text-text/60 hover:bg-surface-alt hover:text-text'
                    }`}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {name && <span className="text-secondary">{name}</span>}
            <button type="button" onClick={signOut} className="rounded-full border border-border px-4 py-1.5 font-medium text-text transition hover:bg-surface-alt">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}

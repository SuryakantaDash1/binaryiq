'use client';

import type { AdminSession } from '@binaryiq/types';
import {
  BarChart3,
  ChevronDown,
  ClipboardList,
  FileCheck2,
  Gamepad2,
  Gift,
  ImageIcon,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  Rss,
  ScrollText,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { adminApi, clearAdminToken, getAdminToken, refreshAdminSession } from '@/lib/api/admin';

const NAV: { label: string; href: string; icon: LucideIcon; subtitle: string }[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, subtitle: 'Platform overview' },
  { label: 'Users', href: '/admin/users', icon: Users, subtitle: 'Manage member accounts' },
  { label: 'Surveys', href: '/admin/surveys', icon: ClipboardList, subtitle: 'Survey catalogue' },
  { label: 'Polls', href: '/admin/polls', icon: BarChart3, subtitle: 'Sponsored polls' },
  { label: 'Rewards', href: '/admin/rewards', icon: Gift, subtitle: 'Rewards catalogue' },
  { label: 'Games', href: '/admin/games', icon: Gamepad2, subtitle: 'Games & spin wheel' },
  { label: 'News Sources', href: '/admin/news', icon: Rss, subtitle: 'RSS feeds for Industry Updates' },
  { label: 'Site Images', href: '/admin/site-images', icon: ImageIcon, subtitle: 'Photos on the landing, sign-in and section pages' },
  { label: 'Announcements', href: '/admin/announcements', icon: Megaphone, subtitle: 'Community "News" tab posts' },
  { label: 'Support', href: '/admin/support', icon: LifeBuoy, subtitle: 'Member support tickets' },
  { label: 'Audit Logs', href: '/admin/audit-logs', icon: ScrollText, subtitle: 'System activity trail' },
  { label: 'Consents', href: '/admin/consents', icon: FileCheck2, subtitle: 'Consent records' },
];

function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'A';
}

export default function AdminLayout({ children }: { children: ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/admin/login';
  const [state, setState] = useState<'checking' | 'ok'>('checking');
  const [admin, setAdmin] = useState<AdminSession['admin'] | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLogin) return;
    let cancelled = false;
    (async () => {
      // The access token is memory-only, so after a reload re-mint it from the session cookie.
      if (!getAdminToken() && !(await refreshAdminSession())) throw new Error('no session');
      return adminApi.me();
    })()
      .then((a) => {
        if (cancelled) return;
        setAdmin(a);
        setState('ok');
      })
      .catch(() => {
        if (cancelled) return;
        clearAdminToken();
        router.replace('/admin/login');
      });
    return () => {
      cancelled = true;
    };
  }, [isLogin, pathname, router]);

  useEffect(() => {
    function onClick(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (isLogin) return <>{children}</>;

  if (state === 'checking') {
    return <div className="flex min-h-screen items-center justify-center bg-background text-secondary">Loading…</div>;
  }

  function signOut(): void {
    // Revokes the session server-side; redirect regardless of the outcome.
    void adminApi.logout().finally(() => router.replace('/admin/login'));
  }

  const isActive = (href: string): boolean => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href));
  const current = [...NAV].reverse().find((n) => isActive(n.href)) ?? NAV[0];

  return (
    <div className="min-h-screen bg-[#f6f8f9]">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/10 bg-ink md:flex">
        <div className="flex h-16 shrink-0 items-center justify-center border-b border-white/10 px-5">
          <Image
            src="/BinaryIQ_logo.svg"
            alt="BinaryIQ"
            width={1600}
            height={420}
            priority
            className="h-9 w-auto"
          />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = isActive(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-sm'
                    : 'text-white/55 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className={`h-[18px] w-[18px] ${active ? 'text-white' : 'text-white/40 group-hover:text-white'}`} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4 text-xs text-white/40">BinaryIQ · Admin</div>
      </aside>

      {/* Main column */}
      <div className="md:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-black/20 bg-ink px-5 md:px-8">
          {/* Page title — shown on desktop */}
          <div className="hidden min-w-0 md:block">
            <h1 className="truncate text-lg font-bold leading-tight text-white">{current?.label}</h1>
            <p className="truncate text-xs text-white/45">{current?.subtitle}</p>
          </div>

          {/* Mobile: horizontal nav (title shown per-page instead) */}
          <nav className="flex gap-1 overflow-x-auto md:hidden">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
                  isActive(n.href) ? 'bg-brand-500 text-white' : 'text-white/50'
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>

          {/* Profile dropdown — right, one line */}
          {admin && (
            <div className="relative shrink-0" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-2.5 transition hover:bg-white/10"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">
                  {initials(admin.name)}
                </span>
                <span className="hidden text-sm font-semibold text-white sm:block">{admin.name}</span>
                <ChevronDown className={`h-4 w-4 text-white/50 transition ${menuOpen ? 'rotate-180' : ''}`} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
                  <div className="border-b border-border px-4 py-3">
                    <p className="truncate text-sm font-semibold text-text">{admin.name}</p>
                    <p className="truncate text-xs text-secondary">{admin.email}</p>
                    <span className="mt-2 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-800">
                      {admin.role.replace('_', ' ')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={signOut}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </header>

        <main className="mx-auto max-w-7xl p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}

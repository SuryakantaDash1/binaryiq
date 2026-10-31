'use client';

import {
  BarChart3,
  ChevronDown,
  ClipboardList,
  Coins,
  Gamepad2,
  Gift,
  Home,
  ListChecks,
  LogOut,
  Menu,
  MessagesSquare,
  User,
  X,
  type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { POINTS_ENABLED } from '@/features/flags';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { accountApi } from '@/lib/api/account';
import { authApi } from '@/lib/api/auth';

type NavLink = { label: string; href: string; icon: LucideIcon; points?: boolean };

/** Main sections — shown in the top bar on desktop and at the top of the mobile drawer. */
const MAIN_LINKS: NavLink[] = [
  { label: 'Home', href: '/home', icon: Home },
  { label: 'Surveys', href: '/surveys', icon: ClipboardList },
  { label: 'Polls', href: '/polls', icon: BarChart3 },
  { label: 'Rewards', href: '/rewards', icon: Gift, points: true },
  { label: 'Games', href: '/games', icon: Gamepad2, points: true },
  { label: 'Community', href: '/community', icon: MessagesSquare },
].filter((l) => POINTS_ENABLED || !l.points);

/** Personal pages — in the account menu on desktop, below the main links on mobile. */
const ACCOUNT_LINKS: NavLink[] = [
  { label: 'My account', href: '/account/profile', icon: User },
  { label: 'Profile surveys', href: '/account/profile-surveys', icon: ListChecks },
  { label: 'Points history', href: '/account/points', icon: Coins, points: true },
].filter((l) => POINTS_ENABLED || !l.points);

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export function AppHeader(): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [name, setName] = useState('');
  const [points, setPoints] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    accountApi
      .getProfile()
      .then((p) => setName(`${p.firstName} ${p.surname}`.trim()))
      .catch(() => void 0);
    // `points` stays null while points are switched off, which hides every balance below.
    if (POINTS_ENABLED) {
      accountApi
        .getBalance()
        .then((b) => setPoints(b.balance))
        .catch(() => void 0);
    }
  }, []);

  // Close menus on navigation and on outside clicks.
  useEffect(() => {
    setDrawerOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function signOut(): Promise<void> {
    try {
      await authApi.logout();
    } finally {
      router.push('/login');
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-gray-200/70 bg-white/85 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-700 transition hover:bg-gray-100 lg:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
            <Link href="/home" className="flex shrink-0 items-center">
              <Image src="/BinaryIQ_logo.svg" alt="BinaryIQ" width={1600} height={420} className="h-7 w-auto" />
            </Link>
          </div>

          {/* Desktop navigation */}
          <nav className="hidden items-center gap-1 lg:flex">
            {MAIN_LINKS.map((l) => {
              const active = isActive(pathname, l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active ? 'bg-brand-50 text-brand-800' : 'text-gray-600 hover:bg-gray-100 hover:text-ink'
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {points !== null && (
              <Link
                href="/account/points"
                className="hidden items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-600 to-brand-900 px-3.5 py-1.5 text-sm font-bold text-white shadow-md shadow-brand-700/20 transition hover:brightness-110 sm:inline-flex"
              >
                <Coins className="h-4 w-4" />
                {points.toLocaleString()}
              </Link>
            )}
            <NotificationBell />

            {/* Account menu */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Account menu"
                aria-expanded={menuOpen}
                className="flex items-center gap-1 rounded-full p-0.5 pr-1.5 transition hover:bg-gray-100"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-900 text-xs font-bold text-white">
                  {initials(name) || <User className="h-4 w-4" />}
                </span>
                <ChevronDown className={`hidden h-4 w-4 text-gray-400 transition sm:block ${menuOpen ? 'rotate-180' : ''}`} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
                  <div className="border-b border-gray-100 px-4 py-3">
                    <p className="truncate text-sm font-bold text-ink">{name || 'Member'}</p>
                    {points !== null && (
                      <p className="text-xs font-medium text-gray-500">{points.toLocaleString()} points</p>
                    )}
                  </div>
                  <div className="py-1">
                    {ACCOUNT_LINKS.map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50 hover:text-ink"
                      >
                        <l.icon className="h-4 w-4 text-gray-400" />
                        {l.label}
                      </Link>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="flex w-full items-center gap-3 border-t border-gray-100 px-4 py-3 text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <div onClick={() => setDrawerOpen(false)} className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm" aria-hidden />
          <div className="fixed inset-y-0 left-0 z-50 flex w-[290px] max-w-[85vw] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4">
              <Image src="/BinaryIQ_logo.svg" alt="BinaryIQ" width={1600} height={420} className="h-6 w-auto" />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mx-4 rounded-2xl bg-gradient-to-br from-ink via-brand-950 to-brand-800 p-4 text-white">
              <p className="truncate font-bold">{name || 'Member'}</p>
              {points !== null && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-white/75">
                  <Coins className="h-4 w-4" />
                  {points.toLocaleString()} points
                </p>
              )}
            </div>

            <nav className="mt-3 flex-1 overflow-y-auto px-3">
              {[MAIN_LINKS, ACCOUNT_LINKS].map((group, gi) => (
                <div key={gi} className={gi > 0 ? 'mt-3 border-t border-gray-100 pt-3' : ''}>
                  {group.map((l) => {
                    const active = isActive(pathname, l.href);
                    return (
                      <Link
                        key={l.href}
                        href={l.href}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                          active ? 'bg-brand-50 font-semibold text-brand-800' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <l.icon className={`h-5 w-5 ${active ? 'text-brand-700' : 'text-gray-400'}`} />
                        {l.label}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>

            <button
              type="button"
              onClick={() => void signOut()}
              className="m-3 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="h-5 w-5" />
              Sign out
            </button>
          </div>
        </>
      )}
    </>
  );
}

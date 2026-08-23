'use client';

import {
  BarChart3,
  Bell,
  ClipboardList,
  Gamepad2,
  Gift,
  Home,
  LogOut,
  Menu,
  User,
  UserCircle2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { accountApi } from '@/lib/api/account';
import { authApi } from '@/lib/api/auth';

const LINKS = [
  { label: 'Home', href: '/home', icon: Home },
  { label: 'Account', href: '/account/profile', icon: User },
  { label: 'Surveys', href: '/surveys', icon: ClipboardList },
  { label: 'Profile Surveys', href: '/account/profile-surveys', icon: User },
  { label: 'Rewards', href: '/rewards', icon: Gift },
  { label: 'Sponsored Polls', href: '/polls', icon: BarChart3 },
  { label: 'Games', href: '/games', icon: Gamepad2 },
];

export function AppHeader(): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [points, setPoints] = useState<number | null>(null);

  useEffect(() => {
    accountApi
      .getProfile()
      .then((p) => setName(`${p.firstName} ${p.surname}`.trim()))
      .catch(() => void 0);
    accountApi
      .getBalance()
      .then((b) => setPoints(b.balance))
      .catch(() => void 0);
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
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-3 md:px-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 transition hover:bg-gray-100"
        >
          <Menu className="h-6 w-6" />
        </button>

        <Link href="/home" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 text-white">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-lg font-bold text-gray-900">Influencers</span>
        </Link>

        <div className="flex items-center gap-3">
          {points !== null && (
            <span className="hidden rounded-full bg-pink-50 px-3 py-1 text-sm font-semibold text-pink-600 sm:inline">
              🪙 {points.toLocaleString()}
            </span>
          )}
          <button type="button" aria-label="Notifications" className="text-gray-400 transition hover:text-gray-700">
            <Bell className="h-5 w-5" />
          </button>
          <Link href="/account/profile" aria-label="Account" className="text-gray-400 transition hover:text-gray-700">
            <UserCircle2 className="h-6 w-6" />
          </Link>
        </div>
      </header>

      {open && (
        <>
          <div onClick={() => setOpen(false)} className="fixed inset-0 z-50 bg-black/40" aria-hidden />
          <div className="fixed left-0 top-0 z-50 flex h-full w-[280px] max-w-[85vw] flex-col bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="m-3 flex h-9 w-9 items-center justify-center self-start rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="px-5 pb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400 shadow-inner">
                  <UserCircle2 className="h-9 w-9" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-gray-900">{name || 'Member'}</p>
                  {points !== null && (
                    <p className="text-sm font-semibold text-pink-600">
                      🪙 Points: {points.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto border-t border-gray-100 py-2">
              {LINKS.map((l) => {
                const Icon = l.icon;
                return (
                  <Link
                    key={l.label}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-5 py-3 text-sm text-gray-700 transition hover:bg-gray-50"
                  >
                    <Icon className="h-5 w-5 text-gray-500" />
                    {l.label}
                  </Link>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={() => void signOut()}
              className="flex items-center gap-3 border-t border-gray-100 px-5 py-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <LogOut className="h-5 w-5 text-gray-500" />
              Sign Out
            </button>
          </div>
        </>
      )}
    </>
  );
}

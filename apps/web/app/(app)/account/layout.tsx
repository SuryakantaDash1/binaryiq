'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';

const TOP_TABS = [
  { key: 'details', label: 'Details', href: '/account/profile', match: ['profile', 'email', 'password', 'paypal', 'about-you'] },
  { key: 'points', label: 'Points', href: '/account/points', match: ['points'] },
  { key: 'profile-surveys', label: 'Profile Surveys', href: '/account/profile-surveys', match: ['profile-surveys'] },
  { key: 'notifications', label: 'Notifications', href: '/account/notifications', match: ['notifications'] },
  { key: 'unsubscribe', label: 'Unsubscribe', href: '/account/unsubscribe', match: ['unsubscribe', 'privacy'] },
];

const SUB_TABS = [
  { key: 'profile', label: 'Profile' },
  { key: 'email', label: 'Email' },
  { key: 'password', label: 'Password' },
  { key: 'paypal', label: 'PayPal' },
  { key: 'about-you', label: 'About You' },
];

export default function AccountLayout({ children }: { children: ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  const seg = pathname.split('/').pop() ?? 'profile';
  const activeTop = TOP_TABS.find((t) => t.match.includes(seg))?.key ?? 'details';
  const detailsActive = activeTop === 'details';

  return (
    <div className="mx-auto max-w-5xl">
      {/* Hero */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-black via-teal-900 to-teal-800 px-6 py-12 md:px-10">
        <h1 className="max-w-md text-2xl font-black leading-snug text-white md:text-3xl">
          Need to update your personal details or track your rewards history? This is the place!
        </h1>
      </div>

      {/* Card with tabs */}
      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm md:p-8">
        {/* Top tabs */}
        <div className="flex flex-wrap gap-2">
          {TOP_TABS.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                activeTop === t.key ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {/* Details sub-tabs */}
        {detailsActive && (
          <div className="mt-5 flex flex-wrap gap-5 border-b border-gray-100 pb-3">
            {SUB_TABS.map((s) => (
              <Link
                key={s.key}
                href={`/account/${s.key}`}
                className={`text-sm font-medium transition ${
                  seg === s.key ? 'text-teal-800' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {s.label}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

import Link from 'next/link';
import type { ReactNode } from 'react';

import { AppHeader } from '../../features/app/AppHeader.js';
import { AuthGate } from '../../features/app/AuthGate.js';
import { LunaBubble } from '../../features/landing/LunaBubble.js';

const FOOTER_LINKS = [
  { href: '/faqs', label: 'Help & FAQs' },
  { href: '/contact', label: 'Contact' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
];

export default function AppGroupLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <AuthGate>
      <div className="flex min-h-screen flex-col bg-gray-50">
        <AppHeader />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6 md:py-8">{children}</main>

        {/* Same Byte bubble as the public pages, but backed by real chatbot flows +
            actual SupportTicket creation now that the user is authenticated. */}
        <LunaBubble authenticated />

        <footer className="border-t border-gray-200/70 bg-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between md:px-6">
            <nav className="flex flex-wrap gap-x-5 gap-y-1">
              {FOOTER_LINKS.map((l) => (
                <Link key={l.href} href={l.href} className="transition hover:text-gray-700">
                  {l.label}
                </Link>
              ))}
            </nav>
            <p>SSL Secured · DPDP 2023 Compliant · CERT-In Registered</p>
          </div>
        </footer>
      </div>
    </AuthGate>
  );
}

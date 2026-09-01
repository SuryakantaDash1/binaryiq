import Link from 'next/link';
import type { ReactNode } from 'react';

import { AuthPanelProvider, AuthRightPanel } from '@/features/auth/AuthPanel.js';
import { LunaBubble } from '@/features/landing/LunaBubble.js';

const FOOTER = [
  { href: '/about', label: 'About Us' },
  { href: '/cookies', label: 'Cookies Policy' },
  { href: '/contact', label: 'Contact Us' },
  { href: '/faqs', label: "FAQ's" },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
];

export default function AuthLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <AuthPanelProvider>
      <div className="flex h-screen">
        {/* ── Left — form column (fixed height, scrolls internally) ── */}
        <div className="flex h-screen w-full flex-col bg-white md:w-1/2">
          {/* Logo */}
          <div className="shrink-0 px-8 pt-8 lg:px-14">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-700 to-teal-900 text-white">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="leading-tight">
                <p className="text-base font-bold text-gray-900">Influencers</p>
                <p className="text-[10px] text-gray-500">surveys &amp; rewards</p>
              </div>
            </Link>
          </div>

          {/* Scrollable form area */}
          <div className="flex-1 overflow-y-auto">
            <div className="flex min-h-full flex-col justify-center px-8 py-8 lg:px-14">
              <div className="mx-auto w-full max-w-md">{children}</div>
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-gray-100 px-8 py-5 lg:px-14">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
              {FOOTER.map((f) => (
                <Link key={f.href} href={f.href} className="transition hover:text-gray-700">
                  {f.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right — reactive image panel ── */}
        <AuthRightPanel />

        {/* Luna chatbot */}
        <LunaBubble />
      </div>
    </AuthPanelProvider>
  );
}

import Link from 'next/link';
import type { ReactNode } from 'react';

import { LunaBubble } from '@/features/landing/LunaBubble.js';

const AUTH_IMAGE =
  'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=1400&q=80';

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
    <div className="flex h-screen">
      {/* ── Left — form column (fixed viewport height, scrolls internally) ── */}
      <div className="flex h-screen w-full flex-col bg-white md:w-1/2">
        {/* Logo */}
        <div className="shrink-0 px-8 pt-8 lg:px-14">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 text-white">
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

        {/* Scrollable form area — vertically centered when it fits, scrolls when tall */}
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

      {/* ── Right — image + gradient + centered "Let's START" ──────────── */}
      <div className="relative hidden h-screen overflow-hidden md:block md:w-1/2">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${AUTH_IMAGE})` }} />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-700/75 via-purple-700/65 to-pink-600/70" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-5xl font-semibold text-white/90 drop-shadow">Let&apos;s</p>
          <p className="text-8xl font-black uppercase leading-none tracking-tight text-white drop-shadow-lg">
            Start
          </p>
        </div>
      </div>

      {/* Luna chatbot — floats bottom-right */}
      <LunaBubble />
    </div>
  );
}

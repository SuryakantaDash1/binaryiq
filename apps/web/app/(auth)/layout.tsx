import { ArrowLeft, Lock } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { AuthBackdrop } from '@/features/auth/AuthBackdrop';
import { AuthShowcase } from '@/features/auth/AuthShowcase';
import { LanguageSelect } from '@/features/landing/LanguageSelect';
import { LunaBubble } from '@/features/landing/LunaBubble.js';

const FOOTER = [
  { href: '/terms', key: 'terms' },
  { href: '/privacy', key: 'privacy' },
  { href: '/contact', key: 'contact' },
] as const;

export default async function AuthLayout({ children }: { children: ReactNode }): Promise<React.JSX.Element> {
  const tf = await getTranslations('footer');
  const tl = await getTranslations('landing');
  const ta = await getTranslations('auth');

  return (
    <div className="relative isolate flex min-h-screen flex-col">
      <AuthBackdrop />

      <header className="flex items-center justify-between px-4 py-4 sm:px-8 sm:py-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {ta('backToHome')}
        </Link>
        <LanguageSelect label={tl('language')} tone="dark" />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-10 pt-2 sm:px-6">
        {/* Showcase card: brand panel + form on desktop, form only below lg */}
        <div className="w-full max-w-[460px] lg:max-w-5xl">
          <div className="grid overflow-hidden rounded-[28px] bg-white shadow-2xl shadow-black/40 ring-1 ring-white/10 motion-safe:animate-fade-up lg:min-h-[640px] lg:grid-cols-[1.05fr_1fr] lg:rounded-[32px]">
            <AuthShowcase />

            <div className="flex flex-col justify-center p-7 sm:p-10 lg:px-14 lg:py-12">
              <div className="mx-auto w-full max-w-sm">
                <Link href="/" className="mb-8 flex justify-center">
                  <Image src="/BinaryIQ_logo.svg" alt="BinaryIQ" width={1600} height={420} priority className="h-9 w-auto" />
                </Link>
                {children}
              </div>
            </div>
          </div>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-white/50 lg:hidden">
            <Lock className="h-3.5 w-3.5" />
            {ta('secureNote')}
          </p>
        </div>
      </main>

      <footer className="flex flex-wrap justify-center gap-x-6 gap-y-1 px-4 pb-6 text-xs text-white/40">
        {FOOTER.map((f) => (
          <Link key={f.href} href={f.href} className="transition hover:text-white/80">
            {tf(f.key)}
          </Link>
        ))}
      </footer>

      <LunaBubble showTeaser={false} />
    </div>
  );
}

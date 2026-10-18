import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

import { Providers } from './providers';
import './globals.css';

const CookieBanner = dynamic(
  () => import('../features/privacy/CookieBanner.js').then((m) => ({ default: m.CookieBanner })),
  { ssr: false },
);

const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-sans', display: 'swap' });

const RTL_LANGS = new Set(['ar']);

export const metadata: Metadata = {
  title: 'BinaryIQ',
  description: 'Surveys, polls, games, and rewards community.',
};

export default async function RootLayout({ children }: { children: ReactNode }): Promise<React.JSX.Element> {
  const locale = await getLocale();
  const messages = await getMessages();
  const dir = RTL_LANGS.has(locale) ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning className={inter.variable}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
        <CookieBanner />
      </body>
    </html>
  );
}

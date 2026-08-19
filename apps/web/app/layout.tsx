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

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: 'Influencer Platform',
  description: 'Surveys, polls, games, and rewards community.',
};

export default function RootLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <html lang="en-IN" suppressHydrationWarning className={inter.variable}>
      <body>
        <Providers>{children}</Providers>
        <CookieBanner />
      </body>
    </html>
  );
}

import { AppShell, type NavItem } from '@influencer/ui';
import { ClipboardList, Gift, User, Star } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { ReactNode } from 'react';

const ChatWidget = dynamic(
  () => import('../../features/support/ChatWidget.js').then((m) => ({ default: m.ChatWidget })),
  { ssr: false },
);

export default async function AppGroupLayout({ children }: { children: ReactNode }): Promise<React.JSX.Element> {
  const t = await getTranslations('nav');

  const NAV: NavItem[] = [
    { label: t('surveys'), href: '/surveys', icon: <ClipboardList className="h-4 w-4" /> },
    { label: t('rewards'), href: '/rewards', icon: <Gift className="h-4 w-4" /> },
    { label: t('profile'), href: '/profile', icon: <User className="h-4 w-4" /> },
    { label: t('points'), href: '/points', icon: <Star className="h-4 w-4" /> },
  ];

  return (
    <AppShell
      nav={NAV}
      header={{ brand: 'Influencers' }}
      renderLink={(item) => (
        <Link
          key={item.href}
          href={item.href}
          className="text-text-secondary hover:bg-surface-alt hover:text-text flex items-center gap-3 rounded-md px-3 py-2 text-sm"
        >
          {item.icon}
          {item.label}
        </Link>
      )}
    >
      {children}
      <ChatWidget />
      <div className="fixed bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-3 bg-surface/80 py-1 text-[10px] text-text-secondary backdrop-blur-sm pointer-events-none">
        <span>SSL Secured</span>
        <span>·</span>
        <span>DPDP 2023 Compliant</span>
        <span>·</span>
        <span>CERT-In Registered</span>
      </div>
    </AppShell>
  );
}

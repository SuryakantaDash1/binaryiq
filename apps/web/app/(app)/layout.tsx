import { AppShell, type NavItem } from '@influencer/ui';
import { Home, Gift, Vote } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/sample', icon: <Home className="h-4 w-4" /> },
  { label: 'Polls', href: '/sample', icon: <Vote className="h-4 w-4" /> },
  { label: 'Rewards', href: '/sample', icon: <Gift className="h-4 w-4" /> },
];

export default function AppGroupLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <AppShell
      nav={NAV}
      header={{ brand: 'Influencer' }}
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
    </AppShell>
  );
}

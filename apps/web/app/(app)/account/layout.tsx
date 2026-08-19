'use client';

import { Heading, Tabs } from '@influencer/ui';
import { useRouter, usePathname } from 'next/navigation';
import { type ReactNode } from 'react';

const TABS = [
  { key: 'profile', label: 'Profile' },
  { key: 'email', label: 'Email' },
  { key: 'password', label: 'Password' },
  { key: 'paypal', label: 'PayPal' },
  { key: 'about-you', label: 'About You' },
  { key: 'notifications', label: 'Notifications' },
];

export default function AccountLayout({ children }: { children: ReactNode }): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const active = pathname.split('/').pop() ?? 'profile';

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Heading level={2} className="mb-6">My Account</Heading>
      <Tabs tabs={TABS} active={active} onChange={(key) => router.push(`/account/${key}`)}>
        {children}
      </Tabs>
    </div>
  );
}

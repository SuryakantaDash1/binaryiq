import type { ReactNode } from 'react';

import { cn } from '../utils/cn.js';

import { Header, type HeaderProps } from './header.js';

export interface NavItem {
  label: string;
  href: string;
  icon?: ReactNode;
}

export interface AppShellProps {
  nav?: NavItem[];
  header?: HeaderProps;
  children: ReactNode;
  renderLink?: (item: NavItem) => ReactNode;
}

/**
 * Authenticated layout: Header + SidebarNav (desktop) / BottomNav (mobile) +
 * content region. See design-system/13 §7 and architecture/06 §10.
 */
export function AppShell({
  nav = [],
  header,
  children,
  renderLink,
}: AppShellProps): React.JSX.Element {
  const linkFor = (item: NavItem): ReactNode =>
    renderLink ? (
      renderLink(item)
    ) : (
      <a
        key={item.href}
        href={item.href}
        className="text-text-secondary hover:bg-surface-alt hover:text-text flex items-center gap-3 rounded-md px-3 py-2 text-sm"
      >
        {item.icon}
        {item.label}
      </a>
    );

  return (
    <div className="bg-bg text-text flex min-h-screen flex-col">
      <Header {...header} />
      <div className="flex flex-1">
        {nav.length > 0 && (
          <nav className="border-border bg-surface hidden w-60 shrink-0 border-r p-3 md:block">
            <div className="flex flex-col gap-1">{nav.map((item) => linkFor(item))}</div>
          </nav>
        )}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
      {nav.length > 0 && (
        <nav
          className={cn(
            'border-border bg-surface sticky bottom-0 z-30 flex items-center justify-around border-t py-2 md:hidden',
          )}
        >
          {nav.map((item) => linkFor(item))}
        </nav>
      )}
    </div>
  );
}

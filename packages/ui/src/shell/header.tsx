import { Bell, UserCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../utils/cn.js';

export interface HeaderProps {
  /** Points balance chip slot (PointsPill wired in Phase 3). */
  pointsSlot?: ReactNode;
  brand?: ReactNode;
  className?: string;
}

export function Header({ pointsSlot, brand, className }: HeaderProps): React.JSX.Element {
  return (
    <header
      className={cn(
        'border-border bg-surface sticky top-0 z-30 flex h-16 items-center justify-between border-b px-4 md:px-6',
        className,
      )}
    >
      <div className="text-primary flex items-center gap-2 font-bold">{brand ?? 'BinaryIQ'}</div>
      <div className="flex items-center gap-4">
        {pointsSlot}
        <button aria-label="Notifications" className="text-text-muted hover:text-text">
          <Bell className="h-5 w-5" />
        </button>
        <button aria-label="Account menu" className="text-text-muted hover:text-text">
          <UserCircle2 className="h-6 w-6" />
        </button>
      </div>
    </header>
  );
}

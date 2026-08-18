import { type ReactNode } from 'react';

import { cn } from './utils/cn.js';

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'primary';
  children: ReactNode;
  className?: string;
}

const VARIANT = {
  default: 'bg-neutral-100 text-neutral-600',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  primary: 'bg-primary/10 text-primary',
};

export function Badge({ variant = 'default', children, className }: BadgeProps): React.JSX.Element {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', VARIANT[variant], className)}>
      {children}
    </span>
  );
}
export type { BadgeProps };

import type { ReactNode } from 'react';

import { cn } from './utils/cn.js';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  className?: string;
}

export function StatCard({ label, value, sub, icon, className }: StatCardProps): React.JSX.Element {
  return (
    <div className={cn('bg-surface border-border rounded-xl border p-5', className)}>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-secondary text-sm font-medium">{label}</span>
        {icon && <span className="text-primary">{icon}</span>}
      </div>
      <p className="text-text text-2xl font-bold">{value}</p>
      {sub && <p className="text-secondary mt-0.5 text-xs">{sub}</p>}
    </div>
  );
}
export type { StatCardProps };

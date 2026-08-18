import { type ReactNode } from 'react';

import { cn } from './utils/cn.js';

interface AlertProps {
  variant?: 'error' | 'success' | 'info' | 'warning';
  children: ReactNode;
  className?: string;
}

const VARIANT = {
  error: 'bg-red-50 border-red-300 text-red-700',
  success: 'bg-green-50 border-green-300 text-green-700',
  info: 'bg-blue-50 border-blue-300 text-blue-700',
  warning: 'bg-yellow-50 border-yellow-300 text-yellow-700',
};

export function Alert({ variant = 'error', children, className }: AlertProps): React.JSX.Element {
  return (
    <div role="alert" className={cn('rounded-md border px-4 py-3 text-sm', VARIANT[variant], className)}>
      {children}
    </div>
  );
}
export type { AlertProps };

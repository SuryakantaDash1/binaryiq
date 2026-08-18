import { cn } from '@influencer/ui';
import type { ReactNode } from 'react';

type Tone = 'neutral' | 'success' | 'danger' | 'info';

const toneMap: Record<Tone, string> = {
  neutral: 'bg-surface-alt text-text-secondary',
  success: 'bg-[color:var(--success-500)]/10 text-success',
  danger: 'bg-[color:var(--danger-500)]/10 text-danger',
  info: 'bg-[color:var(--info-500)]/10 text-info',
};

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        toneMap[tone],
      )}
    >
      {children}
    </span>
  );
}

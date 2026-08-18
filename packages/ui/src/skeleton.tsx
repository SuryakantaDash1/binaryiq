import { cn } from './utils/cn.js';

interface SkeletonProps { className?: string }

export function Skeleton({ className }: SkeletonProps): React.JSX.Element {
  return <div className={cn('animate-pulse rounded-md bg-neutral-200', className)} />;
}
export type { SkeletonProps };

import type { HTMLAttributes } from 'react';

import { cn } from './utils/cn.js';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({ className, interactive, ...props }: CardProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'border-border bg-surface rounded-lg border shadow-sm',
        interactive && 'cursor-pointer transition-shadow hover:shadow-md',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('border-border border-b px-5 py-4', className)} {...props} />;
}

export function CardBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('px-5 py-4', className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('border-border border-t px-5 py-4', className)} {...props} />;
}

import type { ElementType, HTMLAttributes } from 'react';

import { cn } from './utils/cn.js';

type TextColor = 'default' | 'secondary' | 'muted' | 'inverse' | 'primary';

const colorMap: Record<TextColor, string> = {
  default: 'text-text',
  secondary: 'text-text-secondary',
  muted: 'text-text-muted',
  inverse: 'text-text-inverse',
  primary: 'text-primary',
};

export interface TextProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  color?: TextColor;
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  size?: 'xs' | 'sm' | 'base' | 'lg';
}

const weightMap = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
} as const;

const sizeMap = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
} as const;

export function Text({
  as: Tag = 'p',
  color = 'default',
  weight = 'normal',
  size = 'base',
  className,
  ...props
}: TextProps): React.JSX.Element {
  return (
    <Tag className={cn(colorMap[color], weightMap[weight], sizeMap[size], className)} {...props} />
  );
}

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}

const headingSize: Record<NonNullable<HeadingProps['level']>, string> = {
  1: 'text-4xl font-bold tracking-tight',
  2: 'text-3xl font-bold tracking-tight',
  3: 'text-2xl font-semibold',
  4: 'text-xl font-semibold',
  5: 'text-lg font-semibold',
  6: 'text-base font-semibold',
};

export function Heading({ level = 2, className, ...props }: HeadingProps): React.JSX.Element {
  const Tag = `h${level}` as ElementType;
  return <Tag className={cn('text-text', headingSize[level], className)} {...props} />;
}

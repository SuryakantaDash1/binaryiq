'use client';
import { forwardRef, type SelectHTMLAttributes } from 'react';

import { cn } from './utils/cn.js';

interface SelectOption { value: string; label: string }
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  placeholder?: string;
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, placeholder, invalid, className, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid}
      className={cn(
        'border-border bg-surface text-text h-10 w-full rounded-md border px-3 text-sm transition-colors focus:outline-none focus:ring-2',
        invalid ? 'border-red-500 ring-red-200' : 'focus:ring-primary/20 focus:border-primary',
        className,
      )}
      {...rest}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
});
export type { SelectProps };

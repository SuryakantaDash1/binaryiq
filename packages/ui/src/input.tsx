'use client';

import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useState, type InputHTMLAttributes } from 'react';

import { cn } from './utils/cn.js';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

const base =
  'h-10 w-full rounded-md border bg-surface px-3 text-sm text-text placeholder:text-text-muted ' +
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, type = 'text', ...props },
  ref,
) {
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';
  const resolvedType = isPassword && reveal ? 'text' : type;

  const control = (
    <input
      ref={ref}
      type={resolvedType}
      aria-invalid={invalid}
      className={cn(
        base,
        invalid ? 'border-danger' : 'border-border',
        isPassword && 'pr-10',
        className,
      )}
      {...props}
    />
  );

  if (!isPassword) return control;

  return (
    <div className="relative">
      {control}
      <button
        type="button"
        onClick={() => setReveal((v) => !v)}
        aria-label={reveal ? 'Hide password' : 'Show password'}
        className="text-text-muted hover:text-text absolute right-2 top-1/2 -translate-y-1/2"
      >
        {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});

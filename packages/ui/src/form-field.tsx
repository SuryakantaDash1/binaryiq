'use client';

import { useId, type ReactNode } from 'react';

import { cn } from './utils/cn.js';

export interface FormFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  /** Render-prop receives the id to wire to the control for label association. */
  children: (props: { id: string; invalid: boolean }) => ReactNode;
}

/**
 * The reuse backbone for every form control: label + control + hint + error.
 * Every form uses this so a11y and spacing are automatic. See design-system/13 §3.
 */
export function FormField({
  label,
  hint,
  error,
  required,
  className,
  children,
}: FormFieldProps): React.JSX.Element {
  const id = useId();
  const invalid = Boolean(error);
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-text text-sm font-medium">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      {children({ id, invalid })}
      {hint && !error && <p className="text-text-muted text-xs">{hint}</p>}
      {error && (
        <p className="text-danger text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

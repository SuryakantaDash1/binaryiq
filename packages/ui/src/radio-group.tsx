'use client';
import { cn } from './utils/cn.js';

interface RadioOption { value: string; label: string }
interface RadioGroupProps {
  name: string;
  options: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  invalid?: boolean;
  className?: string;
}

export function RadioGroup({ name, options, value, onChange, invalid, className }: RadioGroupProps): React.JSX.Element {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {options.map((o) => (
        <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange?.(o.value)}
            className={cn('accent-primary h-4 w-4', invalid && 'border-red-500')}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}
export type { RadioGroupProps };

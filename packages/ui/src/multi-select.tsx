'use client';
import { cn } from './utils/cn.js';

interface MultiSelectOption { value: string; label: string }
interface MultiSelectProps {
  name: string;
  options: MultiSelectOption[];
  value?: string[];
  onChange?: (value: string[]) => void;
  maxSelections?: number;
  invalid?: boolean;
  className?: string;
}

export function MultiSelect({ name, options, value = [], onChange, maxSelections, invalid, className }: MultiSelectProps): React.JSX.Element {
  const toggle = (v: string) => {
    const next = value.includes(v) ? value.filter((x) => x !== v) : [...value, v];
    if (maxSelections !== undefined && next.length > maxSelections) return;
    onChange?.(next);
  };
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {options.map((o) => (
        <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={name}
            value={o.value}
            checked={value.includes(o.value)}
            onChange={() => toggle(o.value)}
            className={cn('accent-primary h-4 w-4', invalid && 'border-red-500')}
          />
          {o.label}
        </label>
      ))}
      {maxSelections !== undefined && (
        <p className="text-secondary text-xs">{value.length}/{maxSelections} selected</p>
      )}
    </div>
  );
}
export type { MultiSelectProps };

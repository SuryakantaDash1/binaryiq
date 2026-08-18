'use client';

import { useState } from 'react';
import { cn } from './utils/cn.js';

const PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

interface DateRange { from?: string; to?: string }

interface RangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

export function RangeFilter({ value, onChange, className }: RangeFilterProps): React.JSX.Element {
  const [active, setActive] = useState<string | null>(null);

  const applyPreset = (days: number, label: string) => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days);
    setActive(label);
    onChange({
      from: from.toISOString(),
      to: to.toISOString(),
    });
  };

  const clearFilter = () => {
    setActive(null);
    onChange({});
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {PRESETS.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => applyPreset(p.days, p.label)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors',
            active === p.label
              ? 'bg-primary text-on-primary'
              : 'bg-surface border-border text-secondary border hover:text-text',
          )}
        >
          {p.label}
        </button>
      ))}
      <input
        type="date"
        value={value.from ? value.from.split('T')[0] : ''}
        onChange={(e) => { setActive(null); onChange({ ...value, from: e.target.value ? new Date(e.target.value).toISOString() : undefined }); }}
        className="border-border bg-surface text-text rounded-md border px-2 py-1 text-xs"
        aria-label="From date"
      />
      <span className="text-secondary text-xs">to</span>
      <input
        type="date"
        value={value.to ? value.to.split('T')[0] : ''}
        onChange={(e) => { setActive(null); onChange({ ...value, to: e.target.value ? new Date(e.target.value).toISOString() : undefined }); }}
        className="border-border bg-surface text-text rounded-md border px-2 py-1 text-xs"
        aria-label="To date"
      />
      {(value.from ?? value.to) && (
        <button type="button" onClick={clearFilter} className="text-secondary hover:text-text text-xs underline">
          Clear
        </button>
      )}
    </div>
  );
}
export type { RangeFilterProps, DateRange };

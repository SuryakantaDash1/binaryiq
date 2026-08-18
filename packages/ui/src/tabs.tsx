'use client';
import { type ReactNode } from 'react';

import { cn } from './utils/cn.js';

interface Tab { key: string; label: string }

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
  children: ReactNode;
}

export function Tabs({ tabs, active, onChange, children }: TabsProps): React.JSX.Element {
  return (
    <div>
      <div className="border-border mb-6 flex gap-1 overflow-x-auto border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={cn(
              'whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors',
              active === t.key
                ? 'border-primary text-primary -mb-px border-b-2'
                : 'text-secondary hover:text-text',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
export type { TabsProps };

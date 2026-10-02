'use client';

import { ArrowRight, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

export interface ActivityCardProps {
  icon: LucideIcon;
  grad: string;
  eyebrow: string;
  title: string;
  badge: string;
  description: string;
  ctaLabel: string;
  secondary: string;
  href: string | null;
  /** 0-100, real where an API provides it — never fabricated. */
  progress: number;
}

export function ActivityCard({
  icon: Icon,
  grad,
  eyebrow,
  title,
  badge,
  description,
  ctaLabel,
  secondary,
  href,
  progress,
}: ActivityCardProps): React.JSX.Element {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`flex items-center justify-between gap-2 bg-gradient-to-r ${grad} px-5 py-4 text-white`}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
            <Icon className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold">{title}</span>
        </div>
        {badge && (
          <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold text-white">
            {badge}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{eyebrow}</span>
        <p className="mt-1.5 flex-1 text-sm text-gray-600">{description}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          {href ? (
            <Link
              href={href}
              className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${grad} px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 active:scale-95`}
            >
              {ctaLabel} <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="text-sm font-semibold text-gray-300">{ctaLabel}</span>
          )}
          <span className="text-xs text-gray-400">{secondary}</span>
        </div>

        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${grad}`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      </div>
    </div>
  );
}

'use client';

import type { AnnouncementView } from '@binaryiq/types';
import { MessageSquare } from 'lucide-react';

import { gradientFor } from './gradient';
import { safeHttpUrl } from '@/lib/safe-url';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function AnnouncementCard({ item }: { item: AnnouncementView }): React.JSX.Element {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      {/* Banner */}
      <div className="relative flex h-40 items-center justify-center overflow-hidden">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={safeHttpUrl(item.imageUrl)} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradientFor(item.id)} px-4 text-center`}>
            <span className="absolute right-3 top-3 text-[10px] font-bold uppercase tracking-widest text-white/70">
              BinaryIQ
            </span>
            <span className="text-lg font-black uppercase leading-tight tracking-wide text-white drop-shadow">
              {item.bannerHeadline}
            </span>
          </div>
        )}
      </div>
      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold leading-snug text-brand-800">
          {item.emoji} {item.title}
        </h3>
        <div className="mt-3 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-700 to-brand-900 text-[10px] font-bold text-white">
            In
          </span>
          <span className="text-xs text-gray-500">{formatDate(item.publishedAt)}</span>
        </div>
        <p className="mt-3 flex-1 text-sm leading-relaxed text-gray-600">{item.excerpt}</p>
        <div className="mt-4 flex items-center gap-1.5 border-t border-gray-100 pt-3 text-gray-500">
          <MessageSquare className="h-4 w-4" />
          <span className="text-sm">{item.commentsCount}</span>
        </div>
      </div>
    </article>
  );
}

'use client';

import type { ArticleView } from '@influencer/types';
import { ExternalLink, Newspaper } from 'lucide-react';

import { gradientFor } from './gradient';
import { safeHttpUrl } from '@/lib/safe-url';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function IndustryUpdateCard({ article }: { article: ArticleView }): React.JSX.Element {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      {/* Banner */}
      <div className="relative flex h-32 items-center justify-center overflow-hidden">
        {article.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={safeHttpUrl(article.imageUrl)}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }}
          />
        ) : null}
        <div className={`${article.imageUrl ? 'hidden' : ''} flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br ${gradientFor(article.id)} px-4 text-center`}>
          <Newspaper className="h-7 w-7 text-white/70" />
          <span className="text-xs font-bold uppercase tracking-wide text-white/90">{article.sourceName}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
          <span className="font-semibold text-brand-800">{article.sourceName}</span>
          <span>·</span>
          <span>{formatDate(article.publishedAt)}</span>
          {article.sourceCategory && (
            <>
              <span>·</span>
              <span>{article.sourceCategory}</span>
            </>
          )}
        </div>
        <h3 className="line-clamp-2 text-base font-bold leading-snug text-gray-900">{article.title}</h3>
        {article.summary && (
          <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-gray-600">{article.summary}</p>
        )}
        <div className="mt-4 border-t border-gray-100 pt-3">
          <a
            href={safeHttpUrl(article.link)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 self-start text-sm font-semibold text-brand-800 hover:underline"
          >
            Read more <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </article>
  );
}

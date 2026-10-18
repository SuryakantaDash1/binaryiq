'use client';

import type { ArticleView } from '@binaryiq/types';
import { EmptyState, Skeleton } from '@binaryiq/ui';
import { ExternalLink, Rss } from 'lucide-react';
import { useEffect, useState } from 'react';

import { newsApi } from '@/lib/api/news';
import { safeHttpUrl } from '@/lib/safe-url';

const FETCH_PAGE_SIZE = 50;
const ADVANCE_MS = 6000;

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 1) return 'just now';
  return `${hours}h ago`;
}

export function IndustryUpdatesCarousel(): React.JSX.Element {
  const [articles, setArticles] = useState<ArticleView[] | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    newsApi
      .listArticles({ page: 1, pageSize: FETCH_PAGE_SIZE })
      .then((r) => setArticles(r.items.filter((a) => isToday(a.publishedAt))))
      .catch(() => setArticles([]));
  }, []);

  useEffect(() => {
    if (!articles || articles.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % articles.length);
    }, ADVANCE_MS);
    return () => clearInterval(timer);
  }, [articles]);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center justify-between px-5 pt-5">
        <h3 className="text-lg font-bold text-gray-900">Industry updates</h3>
      </div>

      <div className="p-5">
        {articles === null ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : articles.length === 0 ? (
          <EmptyState
            title="No updates today"
            description="Check back later for fresh industry news."
          />
        ) : (
          (() => {
            const article = articles[index]!;
            return (
              <>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-800">
                    <Rss className="h-3 w-3" />
                    {article.sourceCategory ?? 'Industry update'}
                  </span>
                  <span>·</span>
                  <span>{article.sourceName}</span>
                  <span>·</span>
                  <span>{formatRelative(article.publishedAt)}</span>
                </div>

                <h4 className="mt-2 line-clamp-2 text-base font-bold leading-snug text-gray-900">
                  {article.title}
                </h4>
                {article.summary && (
                  <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-gray-600">{article.summary}</p>
                )}

                <a
                  href={safeHttpUrl(article.link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-800 hover:underline"
                >
                  Read more <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </>
            );
          })()
        )}
      </div>
    </div>
  );
}

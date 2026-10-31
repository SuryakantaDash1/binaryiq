'use client';

import type { AnnouncementView, ArticleView } from '@binaryiq/types';
import { EmptyState, Skeleton } from '@binaryiq/ui';
import { useEffect, useState } from 'react';

import { AnnouncementCard } from '@/features/community/AnnouncementCard';
import { CommunityNotificationSettings } from '@/features/community/CommunityNotificationSettings';
import { IndustryUpdateCard } from '@/features/community/IndustryUpdateCard';
import { useSiteImage } from '@/features/site-images/SiteImages';
import { communityApi } from '@/lib/api/community';
import { newsApi } from '@/lib/api/news';

type Tab = 'news' | 'updates' | 'settings';
const TABS: { key: Tab; label: string }[] = [
  { key: 'news', label: 'News' },
  { key: 'updates', label: 'Industry Updates' },
  { key: 'settings', label: 'Settings' },
];

export default function CommunityPage(): React.JSX.Element {
  const heroImg = useSiteImage('community-hero');
  const [tab, setTab] = useState<Tab>('news');

  return (
    <div className="mx-auto max-w-5xl">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl shadow-md">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroImg})` }} />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-brand-950/85 to-brand-800/20" />
        <div className="relative px-8 py-14 md:py-20">
          <h1 className="max-w-sm text-2xl font-black leading-snug text-white md:text-3xl">
            Welcome to your activities centre — our latest news and industry updates.
          </h1>
        </div>
      </div>

      {/* Card + pill tabs */}
      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm md:p-8">
        <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-4">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                tab === t.key ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === 'news' && <NewsTab />}
          {tab === 'updates' && <IndustryUpdatesTab />}
          {tab === 'settings' && <CommunityNotificationSettings />}
        </div>
      </div>
    </div>
  );
}

const NEWS_PAGE_SIZE = 9;

function NewsTab(): React.JSX.Element {
  const [items, setItems] = useState<AnnouncementView[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(null);
    setError(null);
    communityApi
      .listAnnouncements({ page, pageSize: NEWS_PAGE_SIZE })
      .then((r) => {
        setItems(r.items);
        setTotal(r.total);
      })
      .catch(() => setError('Failed to load news'));
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / NEWS_PAGE_SIZE));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-black text-brand-800">Today&apos;s Focus</h2>
        <button
          type="button"
          className="rounded-full border border-brand-700 px-6 py-2 text-sm font-semibold text-brand-800 transition hover:bg-brand-50"
        >
          Subscribe
        </button>
      </div>

      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {items === null && !error ? (
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {Array.from({ length: NEWS_PAGE_SIZE }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-2xl" />
          ))}
        </div>
      ) : items && items.length > 0 ? (
        <>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {items.map((n) => (
              <AnnouncementCard key={n.id} item={n} />
            ))}
          </div>

          {/* Pagination */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * NEWS_PAGE_SIZE + 1}–{Math.min(page * NEWS_PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm font-semibold text-gray-700">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-full bg-brand-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-900 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : (
        !error && <EmptyState title="No news yet" description="Check back soon." />
      )}
    </div>
  );
}

const UPDATES_PAGE_SIZE = 9;

function IndustryUpdatesTab(): React.JSX.Element {
  const [articles, setArticles] = useState<ArticleView[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setArticles(null);
    setError(null);
    newsApi
      .listArticles({ page, pageSize: UPDATES_PAGE_SIZE })
      .then((r) => {
        setArticles(r.items);
        setTotal(r.total);
      })
      .catch(() => setError('Failed to load industry updates'));
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / UPDATES_PAGE_SIZE));

  return (
    <div>
      <h2 className="text-2xl font-black text-brand-800">Industry Updates</h2>
      <p className="mt-2 text-sm text-gray-500">
        Fresh market-research and industry news, pulled automatically from trusted sources.
      </p>

      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {articles === null && !error ? (
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {Array.from({ length: UPDATES_PAGE_SIZE }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : articles && articles.length > 0 ? (
        <>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {articles.map((a) => (
              <IndustryUpdateCard key={a.id} article={a} />
            ))}
          </div>

          {/* Pagination */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * UPDATES_PAGE_SIZE + 1}–{Math.min(page * UPDATES_PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm font-semibold text-gray-700">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-full bg-brand-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-900 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : (
        !error && (
          <EmptyState
            title="No updates yet"
            description="An admin can add RSS sources from the admin console to populate this feed."
          />
        )
      )}
    </div>
  );
}


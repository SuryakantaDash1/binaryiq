'use client';

import type { AnnouncementView, ArticleView } from '@influencer/types';
import { EmptyState, Skeleton } from '@influencer/ui';
import { FolderClosed, MoreVertical, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import { AnnouncementCard } from '@/features/community/AnnouncementCard';
import { CommunityNotificationSettings } from '@/features/community/CommunityNotificationSettings';
import { FORUM_CATEGORIES } from '@/features/community/community-data';
import { IndustryUpdateCard } from '@/features/community/IndustryUpdateCard';
import { communityApi } from '@/lib/api/community';
import { newsApi } from '@/lib/api/news';

const HERO_IMG =
  '/images/community-hero.jpg';

type Tab = 'news' | 'updates' | 'contests' | 'forum' | 'settings';
const TABS: { key: Tab; label: string }[] = [
  { key: 'news', label: 'News' },
  { key: 'updates', label: 'Industry Updates' },
  { key: 'contests', label: 'Contests' },
  { key: 'forum', label: 'Forum' },
  { key: 'settings', label: 'Settings' },
];

export default function CommunityPage(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('news');

  return (
    <div className="mx-auto max-w-5xl">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl shadow-md">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${HERO_IMG})` }} />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-brand-950/85 to-brand-800/20" />
        <div className="relative px-8 py-14 md:py-20">
          <h1 className="max-w-sm text-2xl font-black leading-snug text-white md:text-3xl">
            Welcome to your activities centre, where you will find content, contests and our latest news.
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
          {tab === 'contests' && <ContestsTab />}
          {tab === 'forum' && <ForumTab />}
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

function ContestsTab(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-2xl font-black text-brand-800">Latest Contests</h2>
      <p className="mt-3 text-gray-600">
        Participate in our contests to have some much needed fun, while earning some bonus points!
      </p>
      <EmptyState
        title="There are no contests at the moment"
        description="Please check again at a later date. Thank you for your patience."
      />
    </div>
  );
}

type ForumSub = 'categories' | 'recent' | 'mine';

function ForumTab(): React.JSX.Element {
  const [sub, setSub] = useState<ForumSub>('categories');
  const subs: { key: ForumSub; label: string }[] = [
    { key: 'categories', label: 'Categories' },
    { key: 'recent', label: 'Recent Posts' },
    { key: 'mine', label: 'My Posts' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-black text-brand-800">Community Discussions</h2>
      <p className="mt-3 text-gray-600">Join in to share your thoughts and debate the topics that matter to you!</p>

      {/* Search */}
      <div className="mt-6 flex justify-end">
        <div className="relative w-full max-w-sm">
          <input
            type="search"
            placeholder="Search"
            className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 pr-10 text-sm text-gray-700 outline-none focus:border-brand-700"
          />
          <Search className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="mt-4 flex gap-6 border-b border-gray-200">
        {subs.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSub(s.key)}
            className={`-mb-px border-b-2 pb-3 text-sm font-semibold transition ${
              sub === s.key ? 'border-brand-800 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {sub === 'categories' && (
          <div>
            <p className="mb-3 text-gray-500">Categories</p>
            <div className="flex flex-col gap-3">
              {FORUM_CATEGORIES.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-700 to-brand-900 text-white">
                    <FolderClosed className="h-6 w-6" />
                  </span>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900">{c.title}</p>
                    <p className="text-sm text-gray-600">{c.description}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {c.categories} Categories · {c.threads} Thread
                    </p>
                  </div>
                  <MoreVertical className="h-5 w-5 shrink-0 text-gray-400" />
                </div>
              ))}
            </div>
          </div>
        )}
        {sub === 'recent' && <EmptyState title="There are no recent posts." />}
        {sub === 'mine' && <EmptyState title="You do not have any posts." />}
      </div>
    </div>
  );
}

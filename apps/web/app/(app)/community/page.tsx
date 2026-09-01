'use client';

import { EmptyState } from '@influencer/ui';
import { FolderClosed, MessageSquare, MoreVertical, Search } from 'lucide-react';
import { useState } from 'react';

import { CommunityNotificationSettings } from '@/features/community/CommunityNotificationSettings';
import { NEWS, FORUM_CATEGORIES } from '@/features/community/community-data';

const HERO_IMG =
  'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1600&q=80';

type Tab = 'news' | 'contests' | 'forum' | 'settings';
const TABS: { key: Tab; label: string }[] = [
  { key: 'news', label: 'News' },
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
        <div className="absolute inset-0 bg-gradient-to-r from-black via-teal-900/85 to-teal-800/20" />
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
          {tab === 'contests' && <ContestsTab />}
          {tab === 'forum' && <ForumTab />}
          {tab === 'settings' && <CommunityNotificationSettings />}
        </div>
      </div>
    </div>
  );
}

function NewsTab(): React.JSX.Element {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-black text-teal-800">Today&apos;s Focus</h2>
        <button
          type="button"
          className="rounded-full border border-teal-700 px-6 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-50"
        >
          Subscribe
        </button>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {NEWS.map((n) => (
          <article
            key={n.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            {/* Banner */}
            <div className={`relative flex h-40 items-center justify-center bg-gradient-to-br ${n.grad} px-4 text-center`}>
              <span className="absolute right-3 top-3 text-[10px] font-bold uppercase tracking-widest text-white/70">
                Influencers
              </span>
              <span className="text-lg font-black uppercase leading-tight tracking-wide text-white drop-shadow">
                {n.banner}
              </span>
            </div>
            {/* Body */}
            <div className="flex flex-1 flex-col p-5">
              <h3 className="text-lg font-bold leading-snug text-teal-800">
                {n.emoji} {n.title}
              </h3>
              <div className="mt-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-teal-700 to-teal-900 text-[10px] font-bold text-white">
                  In
                </span>
                <span className="text-xs text-gray-500">{n.date}</span>
              </div>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-gray-600">{n.excerpt}</p>
              <div className="mt-4 flex items-center gap-1.5 border-t border-gray-100 pt-3 text-gray-500">
                <MessageSquare className="h-4 w-4" />
                <span className="text-sm">{n.comments}</span>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Cosmetic pager (mock content — not paginated) */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-gray-500">Showing 1 to {NEWS.length} of {NEWS.length} entries.</p>
        <div className="flex items-center gap-1">
          {['‹', '1', '2', '3', '›'].map((p, i) => (
            <span
              key={i}
              className={`flex h-9 min-w-9 items-center justify-center rounded-md px-3 text-sm font-semibold ${
                p === '1' ? 'bg-teal-800 text-white' : 'text-teal-800'
              }`}
            >
              {p}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ContestsTab(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-2xl font-black text-teal-800">Latest Contests</h2>
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
      <h2 className="text-2xl font-black text-teal-800">Community Discussions</h2>
      <p className="mt-3 text-gray-600">Join in to share your thoughts and debate the topics that matter to you!</p>

      {/* Search */}
      <div className="mt-6 flex justify-end">
        <div className="relative w-full max-w-sm">
          <input
            type="search"
            placeholder="Search"
            className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 pr-10 text-sm text-gray-700 outline-none focus:border-teal-700"
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
              sub === s.key ? 'border-teal-800 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'
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
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-700 to-teal-900 text-white">
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

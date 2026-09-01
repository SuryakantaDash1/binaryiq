'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { accountApi } from '@/lib/api/account';
import { pollsApi } from '@/lib/api/polls';
import { surveysApi } from '@/lib/api/surveys';

const HERO_IMG =
  'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=1600&q=80';

// ─── card icons ──────────────────────────────────────────────────────────────
const ICONS = {
  surveys: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  profile: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  social: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0z M3.6 9h16.8 M3.6 15h16.8 M12 3a15 15 0 010 18 M12 3a15 15 0 000 18',
  polls: 'M11 3.055A9 9 0 1020.945 13H11V3.055z M20.488 9A9 9 0 0011 .512V9h9.488z',
  games: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
  contests: 'M12 15a4 4 0 004-4V5H8v6a4 4 0 004 4zm0 0v3m0 0h4m-4 0H8 M4 5H2v2a3 3 0 003 3 M20 5h2v2a3 3 0 01-3 3',
};

function Icon({ d }: { d: string }): React.JSX.Element {
  return (
    <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      {d.split(' M').map((seg, i) => (
        <path key={i} strokeLinecap="round" strokeLinejoin="round" d={i === 0 ? seg : `M${seg}`} />
      ))}
    </svg>
  );
}

export default function HomePage(): React.JSX.Element {
  const [name, setName] = useState('');
  const [surveyCount, setSurveyCount] = useState(0);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    accountApi.getProfile().then((p) => setName(p.firstName)).catch(() => void 0);
    surveysApi
      .list()
      .then((d) => setSurveyCount((d.priority?.length ?? 0) + (d.quick?.length ?? 0) + (d.premium?.length ?? 0)))
      .catch(() => void 0);
    pollsApi.list().then((d) => setPollCount(Array.isArray(d) ? d.length : 0)).catch(() => void 0);
  }, []);

  const cards = [
    {
      key: 'surveys',
      title: 'Surveys',
      count: `0 of ${surveyCount} attempted`,
      desc: `You have ${surveyCount} survey${surveyCount === 1 ? '' : 's'} available today. Complete them before they get filled!`,
      href: '/surveys',
      grad: 'from-teal-500 to-cyan-600',
      icon: ICONS.surveys,
    },
    {
      key: 'profile',
      title: 'Profile Surveys',
      count: '0 of 14 updated',
      desc: 'Want to qualify for more surveys? Update 14 profile surveys.',
      href: '/profile-surveys',
      grad: 'from-purple-500 to-violet-600',
      icon: ICONS.profile,
    },
    {
      key: 'social',
      title: 'Social Activities',
      count: '',
      desc: 'All caught up with social activities for now. Stay tuned, new activities will be coming up soon!',
      href: null,
      grad: 'from-gray-400 to-gray-500',
      icon: ICONS.social,
    },
    {
      key: 'polls',
      title: 'Polls',
      count: `0 of ${pollCount} voted`,
      desc: `Your opinion matters! ${pollCount} poll${pollCount === 1 ? '' : 's'} are eager for your input.`,
      href: '/polls',
      grad: 'from-sky-500 to-blue-600',
      icon: ICONS.polls,
    },
    {
      key: 'games',
      title: 'Games',
      count: '0 of 1 played',
      desc: 'Calling all gamers! Check out our exciting new games!',
      href: '/games',
      grad: 'from-emerald-500 to-green-600',
      icon: ICONS.games,
    },
    {
      key: 'contests',
      title: 'Contests',
      count: "Let's start",
      desc: 'Join the fun! Explore the latest contest here.',
      href: '/polls',
      grad: 'from-blue-700 to-indigo-800',
      icon: ICONS.contests,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl shadow-md">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${HERO_IMG})` }} />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-teal-900/85 to-teal-800/20" />
        <div className="relative px-8 py-14 md:py-20">
          <h1 className="text-3xl font-black text-white md:text-4xl">
            Hi, {name || 'there'}! <span className="inline-block">👋</span>
          </h1>
          <p className="mt-3 max-w-[240px] text-lg font-medium text-white/90">
            Let&apos;s see what we have for you today!
          </p>
        </div>
      </div>

      {/* Main + sidebar */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Left: activity cards */}
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-black text-gray-900">Let&apos;s earn some points!</h2>
          <p className="mt-1 text-sm text-gray-500">
            {name ? `${name}, let's see what we have in store for you today` : "Let's see what we have in store for you today"}
          </p>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {cards.map((c) => (
              <div key={c.key} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className={`bg-gradient-to-r ${c.grad} px-5 py-4 text-white`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon d={c.icon} />
                      <span className="text-lg font-bold">{c.title}</span>
                    </div>
                    {c.count && <span className="shrink-0 text-xs font-medium text-white/90">{c.count}</span>}
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/30">
                    <div className="h-full w-0 rounded-full bg-white/80" />
                  </div>
                </div>
                <div className="flex min-h-[150px] flex-col p-5">
                  <p className="flex-1 text-sm text-gray-600">{c.desc}</p>
                  {c.href && (
                    <Link href={c.href} className="mt-4 self-start">
                      <button className={`rounded-full bg-gradient-to-r ${c.grad} px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 active:scale-95`}>
                        Participate
                      </button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: About you + notifications */}
        <aside className="space-y-6">
          <div className="overflow-hidden rounded-2xl border-2 border-teal-300 bg-white shadow-sm">
            <div className="flex items-center gap-2 bg-gradient-to-r from-teal-800 to-cyan-600 px-5 py-4 text-white">
              <Icon d={ICONS.profile} />
              <span className="text-lg font-bold">About you</span>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600">
                Let us recommend surveys just for you — complete your About You profile.
              </p>
              <Link href="/profile-surveys">
                <button className="mt-4 w-full rounded-full bg-teal-800 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-900 active:scale-95">
                  Complete Your Profile
                </button>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-black text-gray-900">Let&apos;s socialize!</h3>
            <p className="mt-1 text-sm text-gray-500">Stay tuned for upcoming notifications</p>
            <div className="mt-6 flex justify-center">
              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gray-100 text-gray-300">
                <svg className="h-16 w-16" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

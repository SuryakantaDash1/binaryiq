'use client';

import {
  BarChart3,
  ClipboardList,
  Gamepad2,
  Globe,
  Sparkles,
  Trophy,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { ActivityCard } from '@/features/home/ActivityCard';
import { IndustryUpdatesCarousel } from '@/features/home/IndustryUpdatesCarousel';
import { accountApi } from '@/lib/api/account';
import type { GameListItem } from '@/lib/api/games';
import { gamesApi } from '@/lib/api/games';
import { pollsApi } from '@/lib/api/polls';
import type { CategoryListResult } from '@/lib/api/profile-surveys';
import { profileSurveysApi } from '@/lib/api/profile-surveys';
import type { RewardItem } from '@/lib/api/rewards';
import { rewardsApi } from '@/lib/api/rewards';
import { surveysApi } from '@/lib/api/surveys';

const HERO_IMG =
  '/images/people-hero.jpg';

const PARTNER_IMAGES = [
  '/images/partner-1.jpg',
  '/images/partner-2.jpg',
];

export default function HomePage(): React.JSX.Element {
  const [name, setName] = useState('');
  const [balance, setBalance] = useState(0);
  const [surveyCount, setSurveyCount] = useState(0);
  const [pollCount, setPollCount] = useState(0);
  const [games, setGames] = useState<GameListItem[]>([]);
  const [profileSurveys, setProfileSurveys] = useState<CategoryListResult | null>(null);
  const [rewards, setRewards] = useState<RewardItem[]>([]);

  useEffect(() => {
    accountApi.getProfile().then((p) => setName(p.firstName)).catch(() => void 0);
    accountApi.getBalance().then((b) => setBalance(b.balance)).catch(() => void 0);
    surveysApi
      .list()
      .then((d) => setSurveyCount((d.priority?.length ?? 0) + (d.quick?.length ?? 0) + (d.premium?.length ?? 0)))
      .catch(() => void 0);
    pollsApi.list().then((d) => setPollCount(Array.isArray(d) ? d.length : 0)).catch(() => void 0);
    gamesApi.list().then(setGames).catch(() => void 0);
    profileSurveysApi.list().then(setProfileSurveys).catch(() => void 0);
    rewardsApi.list().then(setRewards).catch(() => void 0);
  }, []);

  const gamesPlayedToday = games.filter((g) => g.playedToday).length;
  const gamesAvailableToday = games.length - gamesPlayedToday;

  const profileCompleted = profileSurveys?.completed ?? 0;
  const profileTotal = profileSurveys?.total ?? 0;
  const profileProgress = profileTotal > 0 ? (profileCompleted / profileTotal) * 100 : 0;

  const nextReward = rewards
    .filter((r) => r.pointsRequired > balance)
    .sort((a, b) => a.pointsRequired - b.pointsRequired)[0];
  const rewardProgress = nextReward ? Math.min(100, (balance / nextReward.pointsRequired) * 100) : 100;

  const cards = [
    {
      key: 'surveys',
      icon: ClipboardList,
      grad: 'from-teal-500 to-cyan-600',
      eyebrow: "Today's pick",
      title: 'Surveys',
      badge: surveyCount > 0 ? `${surveyCount} ready` : '',
      description: 'A few good questions. A little more in your reward jar.',
      ctaLabel: 'Find a survey',
      secondary: '4-8 min each',
      href: '/surveys',
      progress: 0,
    },
    {
      key: 'profile',
      icon: User,
      grad: 'from-purple-500 to-violet-600',
      eyebrow: 'Make it personal',
      title: 'Profile Surveys',
      badge: profileSurveys ? `${profileTotal - profileCompleted} to update` : '',
      description: 'Tell us a bit more and meet surveys that fit you.',
      ctaLabel: 'Update profile',
      secondary: 'Build your match',
      href: '/profile-surveys',
      progress: profileProgress,
    },
    {
      key: 'polls',
      icon: BarChart3,
      grad: 'from-sky-500 to-blue-600',
      eyebrow: 'Quick opinions',
      title: 'Polls',
      badge: pollCount > 0 ? `${pollCount} open` : '',
      description: 'A tiny vote can help shape a very real decision.',
      ctaLabel: 'Cast a vote',
      secondary: 'About 1 min',
      href: '/polls',
      progress: 0,
    },
    {
      key: 'social',
      icon: Globe,
      grad: 'from-gray-400 to-gray-500',
      eyebrow: 'In good company',
      title: 'Social Activities',
      badge: 'More soon',
      description: 'The community is taking a breather. New conversations are on the way.',
      ctaLabel: 'See community',
      secondary: 'Check back soon',
      href: null,
      progress: 0,
    },
    {
      key: 'games',
      icon: Gamepad2,
      grad: 'from-emerald-500 to-green-600',
      eyebrow: 'A playful pause',
      title: 'Games',
      badge: games.length > 0 ? `${gamesAvailableToday} game${gamesAvailableToday === 1 ? '' : 's'} ready` : '',
      description: 'Take five, play a round, and pick up a few points.',
      ctaLabel: 'Play a game',
      secondary: 'Points for play',
      href: '/games',
      progress: games.length > 0 ? (gamesPlayedToday / games.length) * 100 : 0,
    },
    {
      key: 'contests',
      icon: Trophy,
      grad: 'from-orange-500 to-amber-600',
      eyebrow: 'Weekly goodies',
      title: 'Contests',
      badge: 'New this week',
      description: "A little friendly luck never hurt. See what's on the board.",
      ctaLabel: 'View contests',
      secondary: 'Join the fun',
      href: null,
      progress: 0,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl shadow-md">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${HERO_IMG})` }} />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-brand-950/85 to-brand-800/20" />
        <div className="relative px-8 py-14 md:py-20">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white/80">
            <Sparkles className="h-3.5 w-3.5" />
            Your BinaryIQ home
          </span>
          <h1 className="mt-4 text-3xl font-black text-white md:text-4xl">
            Hi, {name || 'there'}<span className="text-brand-300">!</span>
          </h1>
          <p className="mt-3 max-w-sm text-base font-medium text-white/85">
            Your point of view has a way of going places. Pick a little something to do today.
          </p>
          <a href="#activities" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-white hover:underline">
            See what&apos;s waiting →
          </a>
        </div>

        {/* Floating reward journey card */}
        <div className="absolute bottom-5 right-5 hidden w-72 rounded-2xl bg-white/95 p-5 shadow-xl backdrop-blur sm:block">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Your reward journey</span>
            <Sparkles className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-3xl font-black text-gray-900">
            {balance.toLocaleString()} <span className="text-base font-semibold text-gray-400">points earned</span>
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
              style={{ width: `${rewardProgress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {nextReward
              ? `${(nextReward.pointsRequired - balance).toLocaleString()} points to your next reward`
              : 'You qualify for every reward — nice!'}
          </p>
        </div>
      </div>

      {/* Main + sidebar */}
      <div id="activities" className="mt-20 grid gap-6 sm:mt-6 lg:grid-cols-3">
        {/* Left: activity cards */}
        <div className="lg:col-span-2">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-gray-900">Let&apos;s earn some points</h2>
              <p className="mt-1 text-sm text-gray-500">Good questions, quick games, and a say in what comes next.</p>
            </div>
            <Link href="/surveys" className="shrink-0 text-sm font-semibold text-brand-800 hover:underline">
              All activities →
            </Link>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {cards.map(({ key, ...c }) => (
              <ActivityCard key={key} {...c} />
            ))}
          </div>
        </div>

        {/* Right: About you + Industry updates + partner spots */}
        <aside className="space-y-6">
          <div className="overflow-hidden rounded-2xl border-2 border-brand-300 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-brand-800 to-brand-600 px-5 py-4 text-white">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5" />
                <span className="text-lg font-bold">About you</span>
              </div>
              {profileSurveys && (
                <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold">
                  {Math.round(profileProgress)}%
                </span>
              )}
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600">
                Let us recommend surveys just for you — complete your About You profile.
              </p>
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-700 to-brand-900"
                  style={{ width: `${profileProgress}%` }}
                />
              </div>
              {profileSurveys && (
                <p className="mt-2 text-xs text-gray-400">
                  {profileCompleted} of {profileTotal} details complete
                </p>
              )}
              <Link href="/profile-surveys">
                <button className="mt-4 w-full rounded-full bg-brand-800 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-900 active:scale-95">
                  Complete Your Profile
                </button>
              </Link>
            </div>
          </div>

          <IndustryUpdatesCarousel />

          <div className="flex flex-col gap-3">
            {PARTNER_IMAGES.map((src) => (
              <div
                key={src}
                className="aspect-video rounded-2xl bg-cover bg-center opacity-80"
                style={{ backgroundImage: `url(${src})` }}
              />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

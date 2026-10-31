'use client';

import {
  BarChart3,
  ClipboardList,
  Gamepad2,
  MessagesSquare,
  Sparkles,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { POINTS_ENABLED } from '@/features/flags';
import { ActivityCard } from '@/features/home/ActivityCard';
import { IndustryUpdatesCarousel } from '@/features/home/IndustryUpdatesCarousel';
import { useSiteImage } from '@/features/site-images/SiteImages';
import { accountApi } from '@/lib/api/account';
import type { GameListItem } from '@/lib/api/games';
import { gamesApi } from '@/lib/api/games';
import { pollsApi } from '@/lib/api/polls';
import type { CategoryListResult } from '@/lib/api/profile-surveys';
import { profileSurveysApi } from '@/lib/api/profile-surveys';
import type { RewardItem } from '@/lib/api/rewards';
import { rewardsApi } from '@/lib/api/rewards';
import { surveysApi } from '@/lib/api/surveys';

export default function HomePage(): React.JSX.Element {
  const heroImg = useSiteImage('home-hero');
  const [name, setName] = useState('');
  const [balance, setBalance] = useState(0);
  const [surveyCount, setSurveyCount] = useState(0);
  const [pollCount, setPollCount] = useState(0);
  const [games, setGames] = useState<GameListItem[]>([]);
  const [profileSurveys, setProfileSurveys] = useState<CategoryListResult | null>(null);
  const [rewards, setRewards] = useState<RewardItem[]>([]);

  useEffect(() => {
    accountApi.getProfile().then((p) => setName(p.firstName)).catch(() => void 0);
    surveysApi
      .list()
      .then((d) => setSurveyCount((d.priority?.length ?? 0) + (d.quick?.length ?? 0) + (d.premium?.length ?? 0)))
      .catch(() => void 0);
    pollsApi.list().then((d) => setPollCount(Array.isArray(d) ? d.length : 0)).catch(() => void 0);
    profileSurveysApi.list().then(setProfileSurveys).catch(() => void 0);
    if (POINTS_ENABLED) {
      accountApi.getBalance().then((b) => setBalance(b.balance)).catch(() => void 0);
      gamesApi.list().then(setGames).catch(() => void 0);
      rewardsApi.list().then(setRewards).catch(() => void 0);
    }
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
      description: POINTS_ENABLED
        ? 'A few good questions. A little more in your reward jar.'
        : 'A few good questions, picked to match your profile.',
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
      key: 'community',
      icon: MessagesSquare,
      grad: 'from-gray-500 to-gray-700',
      eyebrow: 'In good company',
      title: 'Community',
      badge: '',
      description: 'Our latest news and industry updates, all in one place.',
      ctaLabel: 'See community',
      secondary: 'News & updates',
      href: '/community',
      progress: 0,
    },
    {
      key: 'games',
      pointsOnly: true,
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
  ].filter((c) => POINTS_ENABLED || !('pointsOnly' in c && c.pointsOnly));

  return (
    <div className="mx-auto max-w-7xl">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl shadow-md">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroImg})` }} />
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
        {POINTS_ENABLED && (
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
        )}
      </div>

      {/* Main + sidebar */}
      <div id="activities" className="mt-20 grid gap-6 sm:mt-6 lg:grid-cols-3">
        {/* Left: activity cards */}
        <div className="lg:col-span-2">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-gray-900">
                {POINTS_ENABLED ? <>Let&apos;s earn some points</> : <>What would you like to do?</>}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {POINTS_ENABLED
                  ? 'Good questions, quick games, and a say in what comes next.'
                  : 'Good questions, quick polls, and a say in what comes next.'}
              </p>
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
        </aside>
      </div>
    </div>
  );
}

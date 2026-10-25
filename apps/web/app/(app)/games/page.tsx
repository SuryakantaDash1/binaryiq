'use client';

import { Alert, Skeleton } from '@binaryiq/ui';
import { Coins, Gamepad2, HelpCircle, Lock } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';

import { useSiteImage } from '@/features/site-images/SiteImages';
import { gamesApi, type GameDetail } from '@/lib/api/games';

const SpinWheelIsland = dynamic(
  () => import('@/features/games/SpinWheelIsland').then((m) => m.SpinWheelIsland),
  {
    ssr: false,
    loading: () => <Skeleton className="mx-auto h-[300px] w-[300px] rounded-full" />,
  },
);

type Selected = 'wheel' | 'trivia';

export default function GamesPage(): React.JSX.Element {
  const heroImg = useSiteImage('games-hero');
  const [game, setGame] = useState<GameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selected>('wheel');

  const load = useCallback(() => {
    setLoading(true);
    gamesApi
      .list()
      .then((games) => {
        const spinGame = games.find((g) => g.gameType === 'SPIN_WHEEL');
        if (!spinGame) {
          setError('No games available right now');
          return;
        }
        return gamesApi.get(spinGame.id);
      })
      .then((detail) => {
        if (detail) setGame(detail);
      })
      .catch(() => setError('Failed to load game'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-2xl shadow-md">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroImg})` }} />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-brand-950/85 to-brand-800/10" />
        <div className="relative px-8 py-14 md:py-20">
          <h1 className="max-w-xs text-2xl font-black leading-snug text-white md:text-3xl">
            Take a break and challenge yourself with awesome games
          </h1>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Main game card */}
        <div className="lg:col-span-2">
          {selected === 'wheel' ? (
            <GameCard
              title="Daily Wheel"
              badge="Free game"
            >
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 px-4 py-10">
                <Confetti />
                <p className="mb-6 text-center text-2xl font-black uppercase tracking-wide text-white drop-shadow">
                  Spin the daily wheel!
                </p>
                {error && <Alert variant="error" className="mx-auto mb-6 max-w-md">{error}</Alert>}
                <div className="relative rounded-2xl bg-white/95 px-4 py-8 shadow-inner">
                  {loading ? (
                    <div className="flex flex-col items-center gap-6">
                      <Skeleton className="h-[300px] w-[300px] rounded-full" />
                      <Skeleton className="h-12 w-40" />
                    </div>
                  ) : game ? (
                    <SpinWheelIsland game={game} />
                  ) : null}
                </div>
              </div>
              <p className="mt-3 text-center text-sm text-gray-500">
                One free spin per day — win up to 1,000 points!
              </p>
            </GameCard>
          ) : (
            <GameCard title="Trivia Challenge" badge="Coming soon" badgeMuted>
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 px-6 py-16 text-center">
                <p className="text-4xl font-black uppercase tracking-tight text-brand-800 drop-shadow-sm md:text-5xl">
                  Trivia Challenge
                </p>
                <p className="mt-4 text-lg font-bold text-gray-700">Win up to 3,000 points daily!</p>
                <span className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-800 px-8 py-3 text-sm font-bold uppercase tracking-wide text-white opacity-90">
                  <Lock className="h-4 w-4" /> Coming Soon
                </span>
                <p className="mt-4 text-sm font-medium text-gray-500">Launching soon — stay tuned!</p>
              </div>
            </GameCard>
          )}
        </div>

        {/* More games sidebar */}
        <div>
          <h2 className="text-2xl font-black text-gray-900">More games</h2>
          <div className="mt-5 flex flex-col gap-4">
            {selected !== 'wheel' && (
              <MoreGameCard
                icon={<Gamepad2 className="h-7 w-7 text-white" />}
                title="Daily Wheel"
                label="Free game"
                onClick={() => setSelected('wheel')}
              />
            )}
            {selected !== 'trivia' && (
              <MoreGameCard
                icon={<HelpCircle className="h-7 w-7 text-white" />}
                title="Trivia Challenge"
                label="Coming soon"
                muted
                onClick={() => setSelected('trivia')}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function GameCard({
  title,
  badge,
  badgeMuted = false,
  children,
}: {
  title: string;
  badge: string;
  badgeMuted?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-black text-gray-900">{title}</h2>
        <div className="flex items-center gap-4">
          <span
            className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
              badgeMuted ? 'text-gray-400' : 'text-brand-800'
            }`}
          >
            <Coins className="h-4 w-4" /> {badge}
          </span>
          <span className="rounded-full bg-brand-800 px-6 py-2 text-sm font-semibold text-white">
            Participate
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}

function MoreGameCard({
  icon,
  title,
  label,
  muted = false,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  label: string;
  muted?: boolean;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-gray-100 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-700 to-brand-900">
        {icon}
      </span>
      <span>
        <span className="block font-bold text-gray-900">{title}</span>
        <span className={`text-sm font-medium ${muted ? 'text-gray-400' : 'text-brand-800'}`}>{label}</span>
      </span>
    </button>
  );
}

/** Decorative confetti triangles in the wheel promo corners. */
function Confetti(): React.JSX.Element {
  return (
    <>
      <span className="absolute left-4 top-4 h-0 w-0 border-x-8 border-b-[14px] border-x-transparent border-b-yellow-300 opacity-80" />
      <span className="absolute left-10 top-8 h-0 w-0 border-x-8 border-b-[14px] border-x-transparent border-b-orange-400 opacity-80" />
      <span className="absolute right-6 top-5 h-0 w-0 border-x-8 border-b-[14px] border-x-transparent border-b-cyan-300 opacity-80" />
      <span className="absolute bottom-5 left-6 h-0 w-0 border-x-8 border-b-[14px] border-x-transparent border-b-cyan-300 opacity-80" />
      <span className="absolute bottom-6 right-8 h-0 w-0 border-x-8 border-b-[14px] border-x-transparent border-b-yellow-300 opacity-80" />
    </>
  );
}

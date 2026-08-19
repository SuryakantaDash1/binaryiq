'use client';

import { Alert, Heading, Skeleton, Text } from '@influencer/ui';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';

import { gamesApi, type GameDetail } from '@/lib/api/games';

const SpinWheelIsland = dynamic(
  () => import('@/features/games/SpinWheelIsland').then((m) => m.SpinWheelIsland),
  {
    ssr: false,
    loading: () => <Skeleton className="mx-auto h-[300px] w-[300px] rounded-full" />,
  },
);

export default function GamesPage(): React.JSX.Element {
  const [game, setGame] = useState<GameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    gamesApi.list()
      .then((games) => {
        const spinGame = games.find((g) => g.gameType === 'SPIN_WHEEL');
        if (!spinGame) { setError('No games available right now'); return; }
        return gamesApi.get(spinGame.id);
      })
      .then((detail) => { if (detail) setGame(detail); })
      .catch(() => setError('Failed to load game'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8 text-center">
        <Heading level={2}>Spin the Daily Wheel</Heading>
        <Text color="secondary" size="sm">One free spin per day — win up to 1,000 points!</Text>
      </div>

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      {loading ? (
        <div className="flex flex-col items-center gap-6">
          <Skeleton className="h-[300px] w-[300px] rounded-full" />
          <Skeleton className="h-12 w-40" />
        </div>
      ) : game ? (
        <SpinWheelIsland game={game} />
      ) : null}
    </div>
  );
}

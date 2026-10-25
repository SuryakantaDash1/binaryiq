'use client';

import { PollCard, Skeleton } from '@binaryiq/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { PollResultCard } from '@/features/polls/PollResultCard';
import { SHOWCASE_POLLS } from '@/features/polls/polls-showcase-data';
import { useSiteImage } from '@/features/site-images/SiteImages';
import { pollsApi, type PollSummary } from '@/lib/api/polls';

const PAGE_SIZE = 6;

export default function PollsPage(): React.JSX.Element {
  const heroImg = useSiteImage('polls-hero');
  const [live, setLive] = useState<PollSummary[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const loadLive = useCallback(() => {
    pollsApi
      .list()
      .then(setLive)
      .catch(() => setLive([])) // non-fatal — showcase still renders
      .finally(() => setLiveLoading(false));
  }, []);

  useEffect(() => {
    loadLive();
  }, [loadLive]);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl shadow-md">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroImg})` }} />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-brand-950/85 to-brand-800/20" />
        <div className="relative px-8 py-14 md:py-20">
          <h1 className="text-3xl font-black text-white md:text-4xl">My Sponsored polls</h1>
          <p className="mt-3 max-w-xs text-lg font-medium text-white/90">
            Welcome to your centre of sponsored polls where you can vote and earn points!
          </p>
        </div>
      </div>

      {/* Live polls — real vote-and-earn flow */}
      {liveLoading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : (
        live.length > 0 && (
          <section className="mt-8">
            <h2 className="text-2xl font-black text-brand-800">Vote &amp; earn points</h2>
            <p className="mt-1 text-sm text-gray-500">
              Cast your vote on these live polls to earn points instantly.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {live.map((p) => (
                <Link key={p.id} href={`/polls/${p.id}`} className="block">
                  <PollCard
                    poll={{
                      id: p.id,
                      question: p.question,
                      pollType: p.pollType,
                      sponsorName: p.sponsorName,
                      pointsReward: p.pointsReward,
                      totalVotes: p.totalVotes,
                    }}
                  />
                </Link>
              ))}
            </div>
          </section>
        )
      )}

      {/* Results showcase */}
      <section className="mt-10">
        <h2 className="text-2xl font-black text-brand-800">Poll results</h2>
        <p className="mt-1 text-sm text-gray-500">See how the community voted.</p>
        <div className="mt-6 flex flex-col gap-6">
          {SHOWCASE_POLLS.slice(0, visible).map((poll) => (
            <PollResultCard key={poll.id} poll={poll} />
          ))}
        </div>

        {visible < SHOWCASE_POLLS.length && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="rounded-full bg-brand-800 px-10 py-3 text-sm font-bold tracking-wide text-white transition hover:bg-brand-900"
            >
              See More
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

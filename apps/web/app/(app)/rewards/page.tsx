'use client';

import { Heading, Text, Skeleton, EmptyState } from '@influencer/ui';
import { useState, useEffect, useCallback } from 'react';

import { RewardCard } from '@/features/rewards/RewardCard';
import { rewardsApi, pointsApi, type RewardItem } from '@/lib/api/rewards';

export default function RewardsPage(): React.JSX.Element {
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    Promise.all([rewardsApi.list(), pointsApi.getBalance()])
      .then(([r, b]) => { setRewards(r); setBalance(b.balance); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <Heading level={2}>Rewards Catalogue</Heading>
        <Text color="secondary" size="sm">Your balance: <strong>{balance.toLocaleString()} pts</strong></Text>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : rewards.length === 0 ? (
        <EmptyState title="No rewards available right now" description="Check back soon — new rewards are added regularly." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rewards.map((r) => (
            <RewardCard key={r.id} reward={r} balance={balance} onRedeemed={load} />
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { StatCard, Tabs, DataTable, Badge, EmptyState, Skeleton, RangeFilter, type DateRange } from '@binaryiq/ui';
import { useState, useEffect, useCallback } from 'react';

import { pointsApi, rewardsApi, type PointsTransaction, type Redemption } from '@/lib/api/rewards';

function toInr(points: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(points / 100);
}

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'primary'> = {
  COMPLETED: 'success',
  PENDING: 'warning',
  PROCESSING: 'primary',
  REJECTED: 'default',
  CANCELLED: 'default',
};

export function PointsDashboard(): React.JSX.Element {
  const [balance, setBalance] = useState<{ balance: number; lifetimeEarned: number; lifetimeSpent: number } | null>(null);
  const [tab, setTab] = useState('points');
  const [range, setRange] = useState<DateRange>({});
  const [txns, setTxns] = useState<PointsTransaction[]>([]);
  const [txnCursor, setTxnCursor] = useState<string | null>(null);
  const [txnHasMore, setTxnHasMore] = useState(false);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [redCursor, setRedCursor] = useState<string | null>(null);
  const [redHasMore, setRedHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadBalance = useCallback(() => {
    pointsApi.getBalance().then(setBalance).catch(() => {});
  }, []);

  const loadTxns = useCallback(async (reset: boolean, cursor: string | null, currentRange: DateRange) => {
    setLoading(true);
    try {
      const res = await pointsApi.getTransactions({ from: currentRange.from, to: currentRange.to, cursor: reset ? undefined : (cursor ?? undefined) });
      if (reset) {
        setTxns(res.items);
      } else {
        setTxns((prev) => [...prev, ...res.items]);
      }
      setTxnCursor(res.pagination.nextCursor);
      setTxnHasMore(res.pagination.hasMore);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRedemptions = useCallback(async (reset: boolean, cursor: string | null, currentRange: DateRange) => {
    setLoading(true);
    try {
      const res = await rewardsApi.listRedemptions({ from: currentRange.from, to: currentRange.to, cursor: reset ? undefined : (cursor ?? undefined) });
      if (reset) {
        setRedemptions(res.items);
      } else {
        setRedemptions((prev) => [...prev, ...res.items]);
      }
      setRedCursor(res.pagination.nextCursor);
      setRedHasMore(res.pagination.hasMore);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBalance(); }, [loadBalance]);

  useEffect(() => {
    if (tab === 'points') {
      void loadTxns(true, null, range);
    } else {
      void loadRedemptions(true, null, range);
    }
  }, [tab, range]);

  const txnColumns = [
    { key: 'date', header: 'Date', render: (r: PointsTransaction) => new Date(r.createdAt).toLocaleDateString('en-IN') },
    { key: 'desc', header: 'Description', render: (r: PointsTransaction) => r.description },
    {
      key: 'pts', header: 'Points', className: 'text-right',
      render: (r: PointsTransaction) => (
        <span className={r.direction === 'CREDIT' ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
          {r.direction === 'CREDIT' ? '+' : '−'}{r.points.toLocaleString()}
        </span>
      ),
    },
    { key: 'bal', header: 'Balance', className: 'text-right text-secondary', render: (r: PointsTransaction) => r.balanceAfter.toLocaleString() },
  ];

  const redColumns = [
    { key: 'reward', header: 'Reward', render: (r: Redemption) => r.rewardName },
    { key: 'pts', header: 'Points', render: (r: Redemption) => <span className="text-red-500 font-medium">−{r.pointsSpent.toLocaleString()}</span> },
    { key: 'inr', header: 'Value', render: (r: Redemption) => <span className="text-secondary">{toInr(r.pointsSpent)}</span> },
    { key: 'status', header: 'Status', render: (r: Redemption) => <Badge variant={STATUS_VARIANT[r.status] ?? 'default'}>{r.status}</Badge> },
    { key: 'date', header: 'Date', render: (r: Redemption) => new Date(r.createdAt).toLocaleDateString('en-IN') },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {balance ? (
          <>
            <StatCard label="Current Balance" value={`${balance.balance.toLocaleString()} pts`} sub={toInr(balance.balance)} />
            <StatCard label="Lifetime Earned" value={`${balance.lifetimeEarned.toLocaleString()} pts`} sub={toInr(balance.lifetimeEarned)} />
            <StatCard label="Lifetime Spent" value={`${balance.lifetimeSpent.toLocaleString()} pts`} sub={toInr(balance.lifetimeSpent)} />
          </>
        ) : (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        )}
      </div>

      {/* Tabs + filter */}
      <Tabs
        tabs={[{ key: 'points', label: 'Points History' }, { key: 'rewards', label: 'Rewards History' }]}
        active={tab}
        onChange={setTab}
      >
        <RangeFilter value={range} onChange={(r) => setRange(r)} className="mb-4" />

        {tab === 'points' && (
          loading && txns.length === 0 ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : txns.length === 0 ? (
            <EmptyState title="No points activity yet" description="Complete surveys, vote on polls, or spin the wheel to earn points." />
          ) : (
            <>
              <DataTable columns={txnColumns} rows={txns} keyExtractor={(r) => r.id} />
              {txnHasMore && (
                <button onClick={() => void loadTxns(false, txnCursor, range)} className="text-primary mt-3 w-full text-center text-sm hover:underline">
                  Load more
                </button>
              )}
            </>
          )
        )}

        {tab === 'rewards' && (
          loading && redemptions.length === 0 ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : redemptions.length === 0 ? (
            <EmptyState title="No redemptions yet" description="Browse the rewards catalogue and redeem your points." />
          ) : (
            <>
              <DataTable columns={redColumns} rows={redemptions} keyExtractor={(r) => r.id} />
              {redHasMore && (
                <button onClick={() => void loadRedemptions(false, redCursor, range)} className="text-primary mt-3 w-full text-center text-sm hover:underline">
                  Load more
                </button>
              )}
            </>
          )
        )}
      </Tabs>
    </div>
  );
}

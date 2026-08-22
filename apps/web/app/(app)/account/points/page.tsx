'use client';

import { useEffect, useState } from 'react';

import { accountApi } from '@/lib/api/account';
import { apiFetch } from '@/lib/api/client';

interface Txn {
  id: string;
  direction: 'CREDIT' | 'DEBIT';
  action: string;
  points: number;
  description: string;
  createdAt?: string;
}

const ACTION_LABEL: Record<string, string> = {
  REGISTRATION_BONUS: 'Registration',
  PROFILE_SURVEY: 'Profile survey',
  SURVEY_COMPLETION: 'Survey completion',
  POLL_VOTE: 'Poll vote',
  GAME_SPIN: 'Game',
  REDEMPTION: 'Reward redemption',
  ADJUSTMENT: 'Adjustment',
  REFERRAL: 'Referral',
};

export default function PointsPage(): React.JSX.Element {
  const [balance, setBalance] = useState<number | null>(null);
  const [earned, setEarned] = useState(0);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [tab, setTab] = useState<'points' | 'rewards'>('points');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    accountApi
      .getBalance()
      .then((b) => {
        setBalance(b.balance);
        setEarned(b.lifetimeEarned);
      })
      .catch(() => void 0);
    apiFetch<{ items: Txn[] }>('/points/transactions?limit=50')
      .then((r) => setTxns(r.items ?? []))
      .catch(() => void 0)
      .finally(() => setLoading(false));
  }, []);

  const spent = Math.max(0, earned - (balance ?? 0));
  const rewardTxns = txns.filter((t) => t.direction === 'DEBIT');
  const rows = tab === 'points' ? txns : rewardTxns;

  return (
    <div>
      {/* Balance summary */}
      <div className="flex flex-wrap gap-8">
        <Stat icon="🪙" label="Current balance" value={balance ?? 0} />
        <Stat icon="＋" label="Earned" value={earned} sign="text-green-600" />
        <Stat icon="－" label="Spent" value={spent} sign="text-red-500" />
      </div>

      {/* Sub-tabs */}
      <div className="mt-8 flex gap-6 border-b border-gray-100">
        <button
          type="button"
          onClick={() => setTab('points')}
          className={`-mb-px border-b-2 pb-2 text-sm font-semibold transition ${
            tab === 'points' ? 'border-pink-600 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Points History
        </button>
        <button
          type="button"
          onClick={() => setTab('rewards')}
          className={`-mb-px border-b-2 pb-2 text-sm font-semibold transition ${
            tab === 'rewards' ? 'border-pink-600 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Rewards History
        </button>
      </div>

      {/* Table */}
      <div className="mt-5 overflow-hidden rounded-xl border border-gray-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-5 py-3 font-bold">Date</th>
              <th className="px-5 py-3 font-bold">Description</th>
              <th className="px-5 py-3 text-right font-bold">Points</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="px-5 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={3} className="px-5 py-8 text-center text-gray-400">No history yet.</td></tr>
            ) : (
              rows.map((t) => (
                <tr key={t.id} className="border-t border-gray-100">
                  <td className="px-5 py-3 text-gray-700">
                    {t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td className="px-5 py-3 text-gray-700">
                    {t.description || ACTION_LABEL[t.action] || t.action}
                  </td>
                  <td className={`px-5 py-3 text-right font-semibold ${t.direction === 'CREDIT' ? 'text-green-600' : 'text-red-500'}`}>
                    {t.direction === 'CREDIT' ? '+' : '−'}
                    {t.points} points
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, sign }: { icon: string; label: string; value: number; sign?: string }): React.JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-pink-100 text-lg text-pink-600">{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`text-lg font-bold ${sign ?? 'text-gray-900'}`}>{value.toLocaleString()} points</p>
      </div>
    </div>
  );
}

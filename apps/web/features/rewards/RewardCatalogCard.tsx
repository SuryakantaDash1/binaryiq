'use client';

import { Alert, Button, Modal } from '@binaryiq/ui';
import { useState } from 'react';

import { ApiError } from '@/lib/api/client';
import { rewardsApi, type RewardItem } from '@/lib/api/rewards';
import { safeHttpUrl } from '@/lib/safe-url';

interface RewardCatalogCardProps {
  reward: RewardItem;
  balance: number;
  onRedeemed: () => void;
}

/** Brand accent colours for the fallback name-tile (when there's no logo / it fails to load). */
function tileFor(reward: RewardItem): string {
  const n = reward.name.toLowerCase();
  if (n.includes('nykaa')) return 'from-pink-500 to-rose-600';
  if (n.includes('croma')) return 'from-teal-500 to-teal-700';
  if (n.includes('makemytrip')) return 'from-sky-500 to-blue-600';
  if (n.includes('jio')) return 'from-blue-600 to-indigo-700';
  if (reward.rewardType === 'CHARITY') return 'from-emerald-500 to-brand-600';
  if (reward.rewardType === 'PAYPAL') return 'from-sky-500 to-indigo-600';
  return 'from-brand-600 to-brand-800';
}

export function RewardCatalogCard({ reward, balance, onRedeemed }: RewardCatalogCardProps): React.JSX.Element {
  const [imgFailed, setImgFailed] = useState(false);
  const [info, setInfo] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canAfford = balance >= reward.pointsRequired;

  async function handleRedeem(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      await rewardsApi.redeem(reward.id);
      setConfirm(false);
      setInfo(false);
      onRedeemed();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Redemption failed');
    } finally {
      setLoading(false);
    }
  }

  const showLogo = reward.imageUrl && !imgFailed;

  return (
    <>
      <div className="flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <h3 className="mb-4 text-lg font-bold leading-snug text-brand-900 line-clamp-2">{reward.name}</h3>

        {/* Thumbnail */}
        <div className="mb-4 flex h-36 items-center justify-center overflow-hidden rounded-xl bg-gray-50 ring-1 ring-gray-100">
          {showLogo ? (
            <img
              src={safeHttpUrl(reward.imageUrl)}
              alt={reward.name}
              className="h-16 w-auto object-contain"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div
              className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${tileFor(reward)} px-4 text-center`}
            >
              <span className="text-lg font-black uppercase tracking-wide text-white drop-shadow">
                {(reward.name.split(/[|—-]/)[0] ?? reward.name).trim()}
              </span>
            </div>
          )}
        </div>

        <p className="flex-1 text-sm leading-relaxed text-gray-600 line-clamp-2">{reward.description}</p>

        <button
          type="button"
          onClick={() => { setError(null); setInfo(true); }}
          className="mt-3 self-start text-sm font-medium text-brand-800 hover:underline"
        >
          More information
        </button>

        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
          <span className="font-bold text-brand-800">{reward.pointsRequired.toLocaleString()} points</span>
          {canAfford ? (
            <button
              type="button"
              onClick={() => { setError(null); setConfirm(true); }}
              className="rounded-full bg-brand-800 px-5 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-900"
            >
              Redeem
            </button>
          ) : (
            <span className="text-sm font-medium text-gray-400">Not enough points</span>
          )}
        </div>
      </div>

      {/* More information modal */}
      <Modal open={info} onOpenChange={setInfo} title={reward.name}>
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-gray-600">{reward.description}</p>
          <p className="font-bold text-brand-800">{reward.pointsRequired.toLocaleString()} points</p>
          {error && <Alert variant="error">{error}</Alert>}
          {canAfford ? (
            <Button loading={loading} onClick={() => void handleRedeem()} fullWidth>
              Redeem now
            </Button>
          ) : (
            <p className="text-sm font-medium text-gray-400">
              You need {(reward.pointsRequired - balance).toLocaleString()} more points to redeem this.
            </p>
          )}
        </div>
      </Modal>

      {/* Confirm modal */}
      <Modal
        open={confirm}
        onOpenChange={(o) => { if (!o) { setConfirm(false); setError(null); } }}
        title="Confirm Redemption"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-700">
            Redeem <strong>{reward.pointsRequired.toLocaleString()} points</strong> for{' '}
            <strong>{reward.name}</strong>? This cannot be undone.
          </p>
          {error && <Alert variant="error">{error}</Alert>}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setConfirm(false); setError(null); }} fullWidth>
              Keep points
            </Button>
            <Button loading={loading} onClick={() => void handleRedeem()} fullWidth>
              Redeem now
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

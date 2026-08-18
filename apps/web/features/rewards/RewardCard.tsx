'use client';

import { Card, CardBody, Text, Button, Alert, Modal } from '@influencer/ui';
import { useState } from 'react';

import { ApiError } from '@/lib/api/client';
import { rewardsApi, type RewardItem } from '@/lib/api/rewards';

function toInr(points: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(points / 100);
}

interface RewardCardProps {
  reward: RewardItem;
  balance: number;
  onRedeemed: () => void;
}

export function RewardCard({ reward, balance, onRedeemed }: RewardCardProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canAfford = balance >= reward.pointsRequired;

  const handleRedeem = async () => {
    setLoading(true);
    setError(null);
    try {
      await rewardsApi.redeem(reward.id);
      setOpen(false);
      onRedeemed();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Redemption failed');
    } finally {
      setLoading(false);
    }
  };

  const TYPE_LABEL: Record<string, string> = {
    CHARITY: '❤️ Charity',
    PAYPAL: '💳 PayPal payout',
    VOUCHER: '🎟 Voucher',
    MERCHANDISE: '📦 Merchandise',
  };

  return (
    <>
      <Card>
        <CardBody>
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex-1">
              <Text className="font-semibold">{reward.name}</Text>
              <Text color="secondary" size="sm">{TYPE_LABEL[reward.rewardType] ?? reward.rewardType}</Text>
            </div>
          </div>
          <Text color="secondary" size="sm" className="mb-4">{reward.description}</Text>
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-primary font-bold">{reward.pointsRequired.toLocaleString()} pts</Text>
              <Text color="muted" size="sm">{toInr(reward.pointsRequired)}</Text>
            </div>
            <Button
              size="sm"
              variant={canAfford ? 'primary' : 'outline'}
              disabled={!canAfford}
              onClick={() => setOpen(true)}
            >
              {canAfford ? 'Redeem' : `Need ${(reward.pointsRequired - balance).toLocaleString()} more`}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Modal
        open={open}
        onOpenChange={(isOpen) => { if (!isOpen) { setOpen(false); setError(null); } }}
        title="Confirm Redemption"
      >
        <div className="flex flex-col gap-4">
          <Text>
            Redeem <strong>{reward.pointsRequired.toLocaleString()} points</strong> ({toInr(reward.pointsRequired)}) for{' '}
            <strong>{reward.name}</strong>? This cannot be undone.
          </Text>
          {error && <Alert variant="error">{error}</Alert>}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setOpen(false); setError(null); }} fullWidth>
              Keep points
            </Button>
            <Button loading={loading} onClick={handleRedeem} fullWidth>
              Redeem now
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

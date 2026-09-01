'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { updatePaypalSchema, type UpdatePaypalInput } from '@influencer/types';
import { Alert, Button, EmptyState, FormField, Input, Skeleton } from '@influencer/ui';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { RewardCatalogCard } from '@/features/rewards/RewardCatalogCard';
import { accountApi } from '@/lib/api/account';
import { ApiError } from '@/lib/api/client';
import { pointsApi, rewardsApi, type RewardItem } from '@/lib/api/rewards';

const HERO_IMG =
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=80';

export default function RewardsPage(): React.JSX.Element {
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([rewardsApi.list(), pointsApi.getBalance()])
      .then(([r, b]) => {
        setRewards(r);
        setBalance(b.balance);
      })
      .catch(() => void 0)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl shadow-md">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${HERO_IMG})` }} />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-teal-900/85 to-teal-800/20" />
        <div className="relative px-8 py-14 md:py-20">
          <h1 className="max-w-md text-2xl font-black leading-snug text-white md:text-3xl">
            Check out the available rewards below. Don&apos;t forget, the more you participate, the more you can earn!
          </h1>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm md:p-8">
        {/* Balance line */}
        <p className="text-right text-lg text-gray-700">
          Your current account balance is:{' '}
          <span className="font-bold text-teal-800">🪙 {balance.toLocaleString()} points</span>.
        </p>

        {/* PayPal notice */}
        <p className="mt-4 border-t border-gray-100 pt-4 font-bold text-teal-900">
          Kindly add your email address to your PayPal account to ensure your PayPal payments are not blocked.
        </p>

        {/* Catalogue grid */}
        {loading ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : rewards.length === 0 ? (
          <EmptyState title="No rewards available right now" description="Check back soon — new rewards are added regularly." />
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {rewards.map((r) => (
              <RewardCatalogCard key={r.id} reward={r} balance={balance} onRedeemed={load} />
            ))}
          </div>
        )}

        {/* PayPal email form */}
        <div className="mt-10 border-t border-gray-100 pt-8">
          <PaypalForm />
        </div>
      </div>
    </div>
  );
}

function PaypalForm(): React.JSX.Element {
  const [current, setCurrent] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<UpdatePaypalInput>({ resolver: zodResolver(updatePaypalSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setSuccess(false);
    try {
      const res = await accountApi.updatePaypal(values);
      setCurrent(res.paypalEmail);
      setSuccess(true);
      reset(values);
    } catch (err) {
      setError('paypalEmail', { message: err instanceof ApiError ? err.message : 'Update failed' });
    }
  });

  return (
    <form onSubmit={onSubmit} className="max-w-md" noValidate>
      <label className="mb-2 block text-xl font-bold text-teal-900">PayPal email address</label>
      {success && <Alert variant="success" className="mb-3">PayPal account linked successfully.</Alert>}
      {current && <Alert variant="info" className="mb-3">Current: <strong>{current}</strong></Alert>}
      <FormField label="" error={errors.paypalEmail?.message}>
        {({ id, invalid }) => <Input id={id} type="email" invalid={invalid} {...register('paypalEmail')} />}
      </FormField>
      <Button type="submit" loading={isSubmitting} className="mt-4">
        Save
      </Button>
    </form>
  );
}

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema, type ResetPasswordInput } from '@binaryiq/types';
import { Text } from '@binaryiq/ui';
import { LinkIcon, Lock, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useForm } from 'react-hook-form';

import { AuthInput, Field, PasswordStrength } from '@/features/auth/fields';
import { BTN_PRIMARY } from '@/features/landing/styles';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

function ResetInner(): React.JSX.Element {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await authApi.resetPassword({ ...values, token });
      router.push('/login');
    } catch (err) {
      setError('newPassword', {
        message: err instanceof ApiError ? err.message : 'Reset failed',
      });
    }
  });

  if (!token) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <IconBadge icon={LinkIcon} />
        <h1 className="text-2xl font-black tracking-tight text-ink">Invalid link</h1>
        <p className="text-sm text-gray-500">This password reset link is missing its token.</p>
        <Link href="/forgot-password" className={`${BTN_PRIMARY} mt-3 w-full`}>
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center text-center">
        <IconBadge icon={ShieldCheck} />
        <h1 className="mt-4 text-2xl font-black tracking-tight text-ink">Choose a new password</h1>
        <p className="mt-1.5 text-sm text-gray-500">Make it something you haven&apos;t used here before.</p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="New password" htmlFor="reset-password" error={errors.newPassword?.message} required>
          <AuthInput
            id="reset-password"
            type="password"
            icon={Lock}
            autoComplete="new-password"
            invalid={!!errors.newPassword}
            {...register('newPassword')}
          />
          <PasswordStrength password={watch('newPassword') ?? ''} />
        </Field>
        <button type="submit" disabled={isSubmitting} className={`${BTN_PRIMARY} w-full`}>
          {isSubmitting ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  );
}

function IconBadge({ icon: Icon }: { icon: typeof Lock }): React.JSX.Element {
  return (
    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
      <Icon className="h-7 w-7" />
    </span>
  );
}

export default function ResetPasswordPage(): React.JSX.Element {
  return (
    <Suspense fallback={<Text color="secondary">Loading…</Text>}>
      <ResetInner />
    </Suspense>
  );
}

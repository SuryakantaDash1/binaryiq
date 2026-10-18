'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema, type ResetPasswordInput } from '@binaryiq/types';
import { Button, FormField, Heading, Input, Text } from '@binaryiq/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useForm } from 'react-hook-form';

import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

function ResetInner(): React.JSX.Element {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const {
    register,
    handleSubmit,
    setError,
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
      <div className="flex flex-col gap-3 text-center">
        <Heading level={3}>Invalid link</Heading>
        <Text color="secondary">This password reset link is missing its token.</Text>
        <Link href="/forgot-password" className="text-primary text-sm">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Heading level={3}>Choose a new password</Heading>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormField label="New password" error={errors.newPassword?.message} required>
          {({ id, invalid }) => (
            <Input id={id} type="password" invalid={invalid} {...register('newPassword')} />
          )}
        </FormField>
        <Button type="submit" loading={isSubmitting} fullWidth>
          Update password
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage(): React.JSX.Element {
  return (
    <Suspense fallback={<Text color="secondary">Loading…</Text>}>
      <ResetInner />
    </Suspense>
  );
}

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@binaryiq/types';
import { Button, FormField, Heading, Input, Text } from '@binaryiq/ui';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { authApi } from '@/lib/api/auth';

export default function ForgotPasswordPage(): React.JSX.Element {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    await authApi.forgotPassword(values).catch(() => undefined);
    setSent(true); // always succeed — don't leak whether the email exists
  });

  if (sent) {
    return (
      <div className="flex flex-col gap-3 text-center">
        <Heading level={3}>Check your email</Heading>
        <Text color="secondary">
          If an account exists for that address, we&apos;ve sent a reset link.
        </Text>
        <Link href="/login" className="text-primary text-sm">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Heading level={3}>Reset your password</Heading>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormField label="Email" error={errors.email?.message} required>
          {({ id, invalid }) => (
            <Input id={id} type="email" invalid={invalid} {...register('email')} />
          )}
        </FormField>
        <Button type="submit" loading={isSubmitting} fullWidth>
          Send reset link
        </Button>
      </form>
      <Link href="/login" className="text-primary text-sm">
        Back to sign in
      </Link>
    </div>
  );
}

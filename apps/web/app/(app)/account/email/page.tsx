'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { changeEmailSchema, type ChangeEmailInput } from '@influencer/types';
import { FormField, Input, Button, Alert, Text } from '@influencer/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { accountApi } from '@/lib/api/account';
import { ApiError } from '@/lib/api/client';

export default function EmailTab(): React.JSX.Element {
  const [sent, setSent] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } =
    useForm<ChangeEmailInput>({ resolver: zodResolver(changeEmailSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await accountApi.requestEmailChange(values);
      setSent(res.email);
    } catch (err) {
      setError('email', { message: err instanceof ApiError ? err.message : 'Request failed' });
    }
  });

  if (sent) {
    return (
      <Alert variant="info">
        A confirmation link has been sent to <strong>{sent}</strong>. Your email will change after you click the link.
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Text color="secondary" size="sm">
        Enter your new email address. We will send a confirmation link — your email will only change after you verify it.
      </Text>
      <FormField label="New email address" error={errors.email?.message} required>
        {({ id, invalid }) => <Input id={id} type="email" invalid={invalid} {...register('email')} />}
      </FormField>
      <Button type="submit" loading={isSubmitting} fullWidth>
        Send confirmation link
      </Button>
    </form>
  );
}

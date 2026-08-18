'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { updatePaypalSchema, type UpdatePaypalInput } from '@influencer/types';
import { FormField, Input, Button, Alert, Text } from '@influencer/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { accountApi } from '@/lib/api/account';
import { ApiError } from '@/lib/api/client';

export default function PaypalTab(): React.JSX.Element {
  const [current, setCurrent] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError, reset } =
    useForm<UpdatePaypalInput>({ resolver: zodResolver(updatePaypalSchema) });

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
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {success && <Alert variant="success">PayPal account linked successfully.</Alert>}
      {current && (
        <Alert variant="info">Current: <strong>{current}</strong></Alert>
      )}
      <Alert variant="warning">
        To receive payments, please add <strong>payments@influencerplatform.app</strong> to your PayPal account as a trusted sender.
      </Alert>
      <Text color="secondary" size="sm">
        Enter the PayPal email address where you want to receive reward payouts.
      </Text>
      <FormField label="PayPal email" error={errors.paypalEmail?.message} required>
        {({ id, invalid }) => <Input id={id} type="email" invalid={invalid} {...register('paypalEmail')} />}
      </FormField>
      <Button type="submit" loading={isSubmitting} fullWidth>
        Save PayPal email
      </Button>
    </form>
  );
}

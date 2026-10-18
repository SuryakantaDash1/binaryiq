'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema, type ChangePasswordInput } from '@binaryiq/types';
import { FormField, Input, Button, Alert } from '@binaryiq/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { accountApi } from '@/lib/api/account';
import { ApiError } from '@/lib/api/client';

export default function PasswordTab(): React.JSX.Element {
  const [success, setSuccess] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError, reset } =
    useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setSuccess(false);
    try {
      await accountApi.changePassword(values);
      setSuccess(true);
      reset();
    } catch (err) {
      setError('currentPassword', { message: err instanceof ApiError ? err.message : 'Failed to update password' });
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {success && <Alert variant="success">Password changed successfully.</Alert>}
      <FormField label="Current password" error={errors.currentPassword?.message} required>
        {({ id, invalid }) => <Input id={id} type="password" invalid={invalid} {...register('currentPassword')} />}
      </FormField>
      <FormField label="New password" error={errors.newPassword?.message} required>
        {({ id, invalid }) => <Input id={id} type="password" invalid={invalid} {...register('newPassword')} />}
      </FormField>
      <FormField label="Confirm new password" error={errors.confirmPassword?.message} required>
        {({ id, invalid }) => <Input id={id} type="password" invalid={invalid} {...register('confirmPassword')} />}
      </FormField>
      <Button type="submit" loading={isSubmitting} fullWidth>
        Update password
      </Button>
    </form>
  );
}

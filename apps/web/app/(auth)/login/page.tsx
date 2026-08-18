'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@influencer/types';
import { Button, FormField, Heading, Input, Text } from '@influencer/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';

import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

export default function LoginPage(): React.JSX.Element {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const rootError = errors.root?.message;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await authApi.login(values);
      router.push('/sample');
    } catch (err) {
      setError('root', {
        message: err instanceof ApiError ? err.message : 'Sign in failed',
      });
    }
  });

  return (
    <div className="flex flex-col gap-5">
      <Heading level={3}>Welcome back</Heading>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormField label="Email" error={errors.email?.message} required>
          {({ id, invalid }) => (
            <Input id={id} type="email" invalid={invalid} {...register('email')} />
          )}
        </FormField>
        <FormField label="Password" error={errors.password?.message} required>
          {({ id, invalid }) => (
            <Input id={id} type="password" invalid={invalid} {...register('password')} />
          )}
        </FormField>
        {rootError && (
          <Text color="default" size="sm" className="text-danger">
            {rootError}
          </Text>
        )}
        <Button type="submit" loading={isSubmitting} fullWidth>
          Sign in
        </Button>
      </form>
      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="text-primary">
          Forgot password?
        </Link>
        <Link href="/register" className="text-primary">
          Create account
        </Link>
      </div>
    </div>
  );
}

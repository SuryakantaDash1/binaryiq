'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@binaryiq/types';
import { AlertCircle, ArrowRight, Lock, Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';

import { AuthInput, EmailTypoHint, Field, OrDivider } from '@/features/auth/fields';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/features/landing/styles';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

export default function LoginPage(): React.JSX.Element {
  const t = useTranslations('auth');
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const rootError = errors.root?.message;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await authApi.login(values);
      router.push(safeNextPath(new URLSearchParams(window.location.search).get('next')));
    } catch (err) {
      setError('root', {
        message: err instanceof ApiError ? err.message : 'Sign in failed',
      });
    }
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">{t('welcomeBack')}</h1>
        <p className="mt-1.5 text-sm text-gray-500">{t('signInSubtitle')}</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label={t('email')} htmlFor="login-email" error={errors.email?.message} required>
          <AuthInput
            id="login-email"
            type="email"
            icon={Mail}
            autoComplete="email"
            placeholder={t('emailPlaceholder')}
            invalid={!!errors.email}
            {...register('email')}
          />
          <EmailTypoHint email={watch('email') ?? ''} onAccept={(v) => setValue('email', v, { shouldValidate: true })} />
        </Field>

        <Field label={t('password')} htmlFor="login-password" error={errors.password?.message} required>
          <AuthInput
            id="login-password"
            type="password"
            icon={Lock}
            autoComplete="current-password"
            invalid={!!errors.password}
            {...register('password')}
          />
        </Field>

        <Link href="/forgot-password" className="-mt-1 self-end text-sm font-medium text-brand-700 hover:text-brand-900">
          {t('forgotPassword')}
        </Link>

        {rootError && (
          <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700 ring-1 ring-red-100" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {rootError}
          </p>
        )}

        <button type="submit" disabled={isSubmitting} className={`${BTN_PRIMARY} w-full`}>
          {isSubmitting ? t('pleaseWait') : t('signIn')}
          {!isSubmitting && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>

      <OrDivider />
      <Link href="/register" className={`${BTN_SECONDARY} w-full`}>
        {t('createAccountLink')}
      </Link>
    </div>
  );
}

/** Only same-site app paths — `?next=` must never become an open redirect. */
function safeNextPath(next: string | null): string {
  return next && /^\/(?![/\\])/.test(next) ? next : '/home';
}

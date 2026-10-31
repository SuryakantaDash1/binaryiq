'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@binaryiq/types';
import { ArrowLeft, KeyRound, Mail, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { AuthInput, EmailTypoHint, Field } from '@/features/auth/fields';
import { BTN_PRIMARY } from '@/features/landing/styles';
import { authApi } from '@/lib/api/auth';

export default function ForgotPasswordPage(): React.JSX.Element {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    await authApi.forgotPassword(values).catch(() => undefined);
    setSent(true); // always succeed — don't leak whether the email exists
  });

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 text-center motion-safe:animate-fade-up">
        <IconBadge icon={MailCheck} />
        <h1 className="text-2xl font-black tracking-tight text-ink">Check your email</h1>
        <p className="text-sm text-gray-500">If an account exists for that address, we&apos;ve sent a reset link.</p>
        <BackToSignIn />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center text-center">
        <IconBadge icon={KeyRound} />
        <h1 className="mt-4 text-2xl font-black tracking-tight text-ink">Reset your password</h1>
        <p className="mt-1.5 text-sm text-gray-500">Enter your email and we&apos;ll send you a reset link.</p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="Email" htmlFor="forgot-email" error={errors.email?.message} required>
          <AuthInput id="forgot-email" type="email" icon={Mail} autoComplete="email" invalid={!!errors.email} {...register('email')} />
          <EmailTypoHint email={watch('email') ?? ''} onAccept={(v) => setValue('email', v, { shouldValidate: true })} />
        </Field>
        <button type="submit" disabled={isSubmitting} className={`${BTN_PRIMARY} w-full`}>
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <BackToSignIn />
    </div>
  );
}

function IconBadge({ icon: Icon }: { icon: typeof Mail }): React.JSX.Element {
  return (
    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
      <Icon className="h-7 w-7" />
    </span>
  );
}

function BackToSignIn(): React.JSX.Element {
  return (
    <Link href="/login" className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-900">
      <ArrowLeft className="h-4 w-4" />
      Back to sign in
    </Link>
  );
}

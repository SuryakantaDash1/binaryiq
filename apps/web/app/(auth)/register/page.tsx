'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  registerStep1Schema,
  registerStep2Schema,
  type RegisterStep1Input,
  type RegisterStep2Input,
} from '@influencer/types';
import { Button, FormField, Heading, Input, Text } from '@influencer/ui';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';

import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

type Step = 1 | 2 | 'done';

export default function RegisterPage(): React.JSX.Element {
  const t = useTranslations('auth');
  const [step, setStep] = useState<Step>(1);
  const [draftId, setDraftId] = useState<string>('');
  const [sentTo, setSentTo] = useState<string>('');

  if (step === 'done') {
    return (
      <div className="flex flex-col gap-3 text-center">
        <Heading level={3}>{t('checkInbox')}</Heading>
        <Text color="secondary">{t('sentTo', { email: sentTo })}</Text>
        <Text color="muted" size="sm">
          {t('clickConfirm')}
        </Text>
        <Link href="/login" className="text-primary mt-2 text-sm">
          {t('backToSignIn')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Heading level={3}>{t('createAccount')}</Heading>
        <Text color="muted" size="sm">
          {t('stepOf', { step, total: 2 })}
        </Text>
      </div>
      {step === 1 ? (
        <Step1Form
          onNext={(id) => {
            setDraftId(id);
            setStep(2);
          }}
        />
      ) : (
        <Step2Form
          draftId={draftId}
          onDone={(email) => {
            setSentTo(email);
            setStep('done');
          }}
        />
      )}
      <Text color="muted" size="sm">
        {t('alreadyHaveAccount')}{' '}
        <Link href="/login" className="text-primary">
          {t('signIn')}
        </Link>
      </Text>
    </div>
  );
}

function Step1Form({ onNext }: { onNext: (draftId: string) => void }): React.JSX.Element {
  const t = useTranslations('auth');
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterStep1Input>({ resolver: zodResolver(registerStep1Schema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const { draftId } = await authApi.registerStep1(values);
      onNext(draftId);
    } catch (err) {
      applyApiError(err, setError);
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormField label={t('country')} error={errors.country?.message} required>
        {({ id, invalid }) => (
          <select
            id={id}
            aria-invalid={invalid}
            className="border-border bg-surface h-10 w-full rounded-md border px-3 text-sm"
            {...register('country')}
          >
            <option value="">{t('selectCountry')}</option>
            <option value="IN">India</option>
            <option value="US">United States</option>
            <option value="GB">United Kingdom</option>
            <option value="AU">Australia</option>
            <option value="CA">Canada</option>
            <option value="SG">Singapore</option>
            <option value="AE">United Arab Emirates</option>
            <option value="NZ">New Zealand</option>
            <option value="ZA">South Africa</option>
            <option value="NG">Nigeria</option>
            <option value="PK">Pakistan</option>
            <option value="BD">Bangladesh</option>
            <option value="LK">Sri Lanka</option>
            <option value="NP">Nepal</option>
            <option value="MY">Malaysia</option>
            <option value="PH">Philippines</option>
            <option value="ID">Indonesia</option>
            <option value="DE">Germany</option>
            <option value="FR">France</option>
            <option value="NL">Netherlands</option>
            <option value="BE">Belgium</option>
            <option value="SA">Saudi Arabia</option>
            <option value="EG">Egypt</option>
            <option value="MA">Morocco</option>
          </select>
        )}
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t('firstName')} error={errors.firstName?.message} required>
          {({ id, invalid }) => <Input id={id} invalid={invalid} {...register('firstName')} />}
        </FormField>
        <FormField label={t('surname')} error={errors.surname?.message} required>
          {({ id, invalid }) => <Input id={id} invalid={invalid} {...register('surname')} />}
        </FormField>
      </div>
      <FormField label={t('dateOfBirth')} hint="YYYY-MM-DD" error={errors.dob?.message} required>
        {({ id, invalid }) => <Input id={id} type="date" invalid={invalid} {...register('dob')} />}
      </FormField>
      <FormField label={t('gender')} error={errors.gender?.message} required>
        {({ id, invalid }) => (
          <select
            id={id}
            aria-invalid={invalid}
            className="border-border bg-surface h-10 w-full rounded-md border px-3 text-sm"
            {...register('gender')}
          >
            <option value="">{t('selectGender')}</option>
            <option value="MALE">{t('male')}</option>
            <option value="FEMALE">{t('female')}</option>
            <option value="OTHER">{t('other')}</option>
            <option value="PREFER_NOT_TO_SAY">{t('preferNotToSay')}</option>
          </select>
        )}
      </FormField>
      <Button type="submit" loading={isSubmitting} fullWidth>
        {t('continue')}
      </Button>
    </form>
  );
}

function Step2Form({
  draftId,
  onDone,
}: {
  draftId: string;
  onDone: (email: string) => void;
}): React.JSX.Element {
  const t = useTranslations('auth');
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterStep2Input>({
    resolver: zodResolver(registerStep2Schema),
    defaultValues: { draftId },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await authApi.registerStep2({ ...values, draftId });
      onDone(res.email);
    } catch (err) {
      applyApiError(err, setError);
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormField label={t('email')} error={errors.email?.message} required>
        {({ id, invalid }) => (
          <Input id={id} type="email" invalid={invalid} {...register('email')} />
        )}
      </FormField>
      <FormField label={t('password')} error={errors.password?.message} required>
        {({ id, invalid }) => (
          <Input id={id} type="password" invalid={invalid} {...register('password')} />
        )}
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t('username')} error={errors.username?.message} required>
          {({ id, invalid }) => <Input id={id} invalid={invalid} {...register('username')} />}
        </FormField>
        <FormField label={t('pinCode')} error={errors.pinCode?.message} required>
          {({ id, invalid }) => <Input id={id} invalid={invalid} {...register('pinCode')} />}
        </FormField>
      </div>
      <FormField label={t('mobile')} error={errors.mobile?.message}>
        {({ id, invalid }) => <Input id={id} invalid={invalid} {...register('mobile')} />}
      </FormField>
      <Button type="submit" loading={isSubmitting} fullWidth>
        {t('register')}
      </Button>
    </form>
  );
}

function applyApiError(
  err: unknown,
  setError: (name: never, e: { message: string }) => void,
): void {
  if (err instanceof ApiError && err.details?.length) {
    for (const d of err.details) setError(d.field as never, { message: d.issue });
    return;
  }
  const message = err instanceof ApiError ? err.message : 'Something went wrong';
  setError('root' as never, { message });
}

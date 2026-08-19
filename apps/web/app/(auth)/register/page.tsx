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

import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

type Step = 1 | 2 | 'done';

export default function RegisterPage(): React.JSX.Element {
  const [step, setStep] = useState<Step>(1);
  const [draftId, setDraftId] = useState<string>('');
  const [sentTo, setSentTo] = useState<string>('');

  if (step === 'done') {
    return (
      <div className="flex flex-col gap-3 text-center">
        <Heading level={3}>Check your inbox</Heading>
        <Text color="secondary">We have sent you an activation email on {sentTo}.</Text>
        <Text color="muted" size="sm">
          Click “Confirm your registration” in that email to claim your 500 welcome points.
        </Text>
        <Link href="/login" className="text-primary mt-2 text-sm">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Heading level={3}>Create your account</Heading>
        <Text color="muted" size="sm">
          Step {step} of 2
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
        Already have an account?{' '}
        <Link href="/login" className="text-primary">
          Sign in
        </Link>
      </Text>
    </div>
  );
}

function Step1Form({ onNext }: { onNext: (draftId: string) => void }): React.JSX.Element {
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
      <FormField label="Country" error={errors.country?.message} required>
        {({ id, invalid }) => (
          <select
            id={id}
            aria-invalid={invalid}
            className="border-border bg-surface h-10 w-full rounded-md border px-3 text-sm"
            {...register('country')}
          >
            <option value="">Select country…</option>
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
          </select>
        )}
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="First name" error={errors.firstName?.message} required>
          {({ id, invalid }) => <Input id={id} invalid={invalid} {...register('firstName')} />}
        </FormField>
        <FormField label="Surname" error={errors.surname?.message} required>
          {({ id, invalid }) => <Input id={id} invalid={invalid} {...register('surname')} />}
        </FormField>
      </div>
      <FormField label="Date of birth" hint="YYYY-MM-DD" error={errors.dob?.message} required>
        {({ id, invalid }) => <Input id={id} type="date" invalid={invalid} {...register('dob')} />}
      </FormField>
      <FormField label="Gender" error={errors.gender?.message} required>
        {({ id, invalid }) => (
          <select
            id={id}
            aria-invalid={invalid}
            className="border-border bg-surface h-10 w-full rounded-md border px-3 text-sm"
            {...register('gender')}
          >
            <option value="">Select…</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
            <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
          </select>
        )}
      </FormField>
      <Button type="submit" loading={isSubmitting} fullWidth>
        Continue
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
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Username" error={errors.username?.message} required>
          {({ id, invalid }) => <Input id={id} invalid={invalid} {...register('username')} />}
        </FormField>
        <FormField label="PIN / postal code" error={errors.pinCode?.message} required>
          {({ id, invalid }) => <Input id={id} invalid={invalid} {...register('pinCode')} />}
        </FormField>
      </div>
      <FormField label="Mobile (optional)" error={errors.mobile?.message}>
        {({ id, invalid }) => <Input id={id} invalid={invalid} {...register('mobile')} />}
      </FormField>
      <Button type="submit" loading={isSubmitting} fullWidth>
        Register
      </Button>
    </form>
  );
}

/** Map API VALIDATION_ERROR details back onto form fields; else a root error. */
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

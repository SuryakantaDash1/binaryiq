'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  registerStep1Schema,
  registerStep2Schema,
  type RegisterStep1Input,
  type RegisterStep2Input,
} from '@binaryiq/types';
import { Heading, Text } from '@binaryiq/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';

import { authApi } from '@/lib/api/auth';
import { ApiError, apiFetch } from '@/lib/api/client';
import { useAuthPanel } from '@/features/auth/AuthPanel.js';

type Step = 1 | 2 | 'done';

const INPUT =
  'h-12 w-full rounded-lg border border-gray-300 px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300';
const PINK_BTN =
  'rounded-full bg-brand-800 px-9 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-brand-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60';
const BLUE_BTN =
  'rounded-full bg-blue-500 px-9 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-blue-600 active:scale-95';

const COUNTRIES = [
  ['IN', 'India'], ['US', 'United States'], ['GB', 'United Kingdom'], ['AU', 'Australia'],
  ['CA', 'Canada'], ['SG', 'Singapore'], ['AE', 'United Arab Emirates'], ['NZ', 'New Zealand'],
  ['ZA', 'South Africa'], ['NG', 'Nigeria'], ['PK', 'Pakistan'], ['BD', 'Bangladesh'],
  ['LK', 'Sri Lanka'], ['NP', 'Nepal'], ['MY', 'Malaysia'], ['PH', 'Philippines'],
  ['ID', 'Indonesia'], ['DE', 'Germany'], ['FR', 'France'], ['NL', 'Netherlands'],
];

const GENDERS = [
  { value: 'MALE', symbol: '♂', color: 'text-blue-500', labelKey: 'male' },
  { value: 'FEMALE', symbol: '♀', color: 'text-rose-500', labelKey: 'female' },
  { value: 'OTHER', symbol: '⚧', color: 'text-purple-500', labelKey: 'other' },
  { value: 'PREFER_NOT_TO_SAY', symbol: '?', color: 'text-gray-400', labelKey: 'preferNotToSay' },
] as const;

export default function RegisterPage(): React.JSX.Element {
  const t = useTranslations('auth');
  const [step, setStep] = useState<Step>(1);
  const [draftId, setDraftId] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [emailSent, setEmailSent] = useState(true);
  const [banners, setBanners] = useState<string[]>([]);
  const [step1Data, setStep1Data] = useState<Partial<RegisterStep1Input>>({});
  const { setVariant } = useAuthPanel();

  // Reset the right-panel headline when leaving the page.
  useEffect(() => () => setVariant('default'), [setVariant]);

  if (step === 'done') {
    return (
      <div className="flex flex-col gap-3 text-center">
        <Heading level={3}>{emailSent ? t('checkInbox') : t('accountReady')}</Heading>
        <Text color="secondary">{emailSent ? t('sentTo', { email: sentTo }) : t('emailNotSent')}</Text>
        <Text color="muted" size="sm">
          {emailSent ? t('clickConfirm') : t('signInNow')}
        </Text>
        <Link href="/login" className="text-primary mt-2 text-sm">
          {t('backToSignIn')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Step label + progress bar */}
      {step === 2 && <Heading level={3}>{t('accountStep')}</Heading>}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-900 transition-all duration-300"
          style={{ width: step === 1 ? '50%' : '100%' }}
        />
      </div>

      <div>
        <Heading level={3}>{t('joinBonus')}</Heading>
        <Text color="muted" size="sm">
          {t('stepOf', { step, total: 2 })}
        </Text>
      </div>

      {/* Error banners */}
      {banners.map((b, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
        >
          <span className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white">!</span>
            Error: {b}
          </span>
          <button
            type="button"
            onClick={() => setBanners((bs) => bs.filter((_, j) => j !== i))}
            className="text-red-400 hover:text-red-600"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}

      {step === 1 ? (
        <Step1Form
          defaults={step1Data}
          onBanners={setBanners}
          onNext={(id, values) => {
            setBanners([]);
            setStep1Data(values);
            setDraftId(id);
            setStep(2);
          }}
        />
      ) : (
        <Step2Form
          draftId={draftId}
          onBack={() => setStep(1)}
          onBanners={setBanners}
          onDone={(email, sent) => {
            setSentTo(email);
            setEmailSent(sent);
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

/* ── Step 1 ─────────────────────────────────────────────────────────────── */
function Step1Form({
  onNext,
  onBanners,
  defaults,
}: {
  onNext: (draftId: string, values: RegisterStep1Input) => void;
  onBanners: (msgs: string[]) => void;
  defaults: Partial<RegisterStep1Input>;
}): React.JSX.Element {
  const t = useTranslations('auth');
  const { setVariant } = useAuthPanel();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterStep1Input>({
    resolver: zodResolver(registerStep1Schema),
    defaultValues: defaults,
  });

  const gender = watch('gender');
  const slow = useSlowHint(isSubmitting);

  // Restore the right-panel headline when returning to step 1 with a gender set.
  useEffect(() => {
    if (defaults.gender === 'MALE') setVariant('male');
    else if (defaults.gender === 'FEMALE') setVariant('female');
  }, []);

  function isAtLeast18(dob: string): boolean {
    const birth = new Date(dob);
    if (Number.isNaN(birth.getTime())) return false;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age >= 18;
  }

  function pickGender(g: RegisterStep1Input['gender']): void {
    setValue('gender', g, { shouldValidate: true });
    setVariant(g === 'MALE' ? 'male' : g === 'FEMALE' ? 'female' : 'default');
  }

  const onSubmit = handleSubmit(async (values) => {
    onBanners([]);
    if (!isAtLeast18(values.dob)) {
      setError('dob', { message: t('ageError') });
      return;
    }
    try {
      const { draftId } = await authApi.registerStep1(values);
      onNext(draftId, values);
    } catch (err) {
      applyApiError(err, setError);
      onBanners(buildBanners(t('registrationFailed'), t('somethingWrong'), err));
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Field label={t('country')} required error={errors.country?.message}>
        <select className={INPUT} {...register('country')}>
          <option value="">{t('selectCountry')}</option>
          {COUNTRIES.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('firstName')} required error={errors.firstName?.message}>
          <input className={INPUT} placeholder={t('firstName')} {...register('firstName')} />
        </Field>
        <Field label={t('surname')} required error={errors.surname?.message}>
          <input className={INPUT} placeholder={t('surname')} {...register('surname')} />
        </Field>
      </div>

      <Field label={t('dateOfBirth')} required error={errors.dob?.message}>
        <input type="date" className={INPUT} {...register('dob')} />
      </Field>

      <Field label={t('gender')} required error={errors.gender?.message}>
        <input type="hidden" {...register('gender')} />
        <div className="grid grid-cols-4 gap-2">
          {GENDERS.map((g) => (
            <GenderCard
              key={g.value}
              active={gender === g.value}
              onClick={() => pickGender(g.value)}
              symbol={g.symbol}
              color={g.color}
              label={t(g.labelKey)}
            />
          ))}
        </div>
      </Field>

      <button type="submit" disabled={isSubmitting} className={`${PINK_BTN} self-start`}>
        {isSubmitting ? t('pleaseWait') : t('next')}
      </button>
      {slow && <p className="-mt-2 text-sm text-gray-500">{t('wakingServer')}</p>}
    </form>
  );
}

/* ── Step 2 ─────────────────────────────────────────────────────────────── */
function Step2Form({
  draftId,
  onBack,
  onDone,
  onBanners,
}: {
  draftId: string;
  onBack: () => void;
  onDone: (email: string, emailSent: boolean) => void;
  onBanners: (msgs: string[]) => void;
}): React.JSX.Element {
  const t = useTranslations('auth');
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterStep2Input>({
    resolver: zodResolver(registerStep2Schema),
    defaultValues: { draftId, smsOptIn: false },
  });

  const [showPw, setShowPw] = useState(false);
  const slow = useSlowHint(isSubmitting);
  const [pinDisplay, setPinDisplay] = useState('');
  const [pinOptions, setPinOptions] = useState<Array<{ pin: string; name: string }>>([]);
  const [pinOpen, setPinOpen] = useState(false);

  // The 6-digit PIN typed so far (used for the API lookup + submitted value).
  const pinDigits = pinDisplay.replace(/\D/g, '').slice(0, 6);

  // Register pinCode so RHF validates/submits it while we control the input.
  useEffect(() => {
    register('pinCode');
  }, [register]);

  // Suggest a friendly unique username on mount (editable).
  useEffect(() => {
    setValue('username', genUsername());
  }, [setValue]);

  // Look up Indian post offices for a 6-digit PIN code (proxied through our API).
  useEffect(() => {
    if (pinDigits.length !== 6) {
      setPinOptions([]);
      setPinOpen(false);
      return;
    }
    let cancelled = false;
    apiFetch<Array<{ name: string }>>(`/geo/pincode/${pinDigits}`, { anonymous: true })
      .then((offices) => {
        if (cancelled) return;
        setPinOptions(offices.slice(0, 12).map((o) => ({ pin: pinDigits, name: o.name })));
        setPinOpen(offices.length > 0);
      })
      .catch(() => void 0);
    return () => {
      cancelled = true;
    };
  }, [pinDigits]);

  function onPinChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const v = e.target.value;
    setPinDisplay(v);
    setValue('pinCode', v.replace(/\D/g, '').slice(0, 6), { shouldValidate: false });
  }

  function selectArea(pin: string, name: string): void {
    setPinDisplay(`${pin}, ${name}`);
    setValue('pinCode', pin, { shouldValidate: true });
    setPinOpen(false);
  }

  const onSubmit = handleSubmit(async (values) => {
    onBanners([]);
    try {
      const res = await authApi.registerStep2({ ...values, draftId });
      await new Promise((r) => setTimeout(r, 1200)); // brief "getting ready" moment
      onDone(res.email, res.emailSent);
    } catch (err) {
      applyApiError(err, setError);
      onBanners(buildBanners(t('registrationFailed'), t('somethingWrong'), err));
    }
  });

  if (isSubmitting) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16">
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="h-3.5 w-3.5 animate-bounce rounded-full bg-blue-600"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        <p className="text-lg font-medium text-gray-700">{t('gettingReady')}</p>
        {slow && <p className="text-sm text-gray-500">{t('wakingServer')}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Field label={t('emailLabel')} required error={errors.email?.message}>
        <input type="email" autoComplete="email" className={INPUT} placeholder={t('emailPlaceholder')} {...register('email')} />
      </Field>

      <Field label={t('password')} required error={errors.password?.message}>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            autoComplete="new-password"
            className={`${INPUT} pr-11`}
            placeholder={t('passwordHint')}
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label={showPw ? 'Hide password' : 'Show password'}
          >
            {showPw ? (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
      </Field>

      <Field label={t('pinLabel')} required error={errors.pinCode?.message}>
        <div className="relative">
          <input
            className={INPUT}
            placeholder={t('pinHint')}
            autoComplete="off"
            value={pinDisplay}
            onChange={onPinChange}
            onFocus={() => pinOptions.length > 0 && setPinOpen(true)}
          />
          {pinOpen && pinOptions.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              {pinOptions.map((o, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => selectArea(o.pin, o.name)}
                    className="block w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {o.pin}, {o.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Field>

      <Field label={t('username')} required error={errors.username?.message}>
        <input className={INPUT} placeholder={t('usernamePlaceholder')} {...register('username')} />
      </Field>

      <Field label={t('mobileLabel')} error={errors.mobile?.message}>
        <div className="flex h-12 items-center rounded-lg border border-gray-300 focus-within:border-brand-400 focus-within:ring-1 focus-within:ring-brand-300">
          <span className="pl-4 pr-2 text-sm font-semibold text-gray-700">+91</span>
          <input
            className="h-full flex-1 rounded-r-lg bg-transparent pr-4 text-sm placeholder:text-gray-400 focus:outline-none"
            placeholder={t('mobilePlaceholder')}
            {...register('mobile', {
              setValueAs: (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined),
            })}
          />
        </div>
      </Field>

      {/* Consents are separate and unticked: DPDP needs a clear, affirmative action for each. */}
      <div>
        <label className="flex items-start gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            {...register('acceptTerms')}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-brand-800 focus:ring-brand-400"
          />
          <span>
            {t('agreePrefix')}{' '}
            <Link href="/terms" target="_blank" className="text-primary underline">
              {t('termsAndConditions')}
            </Link>{' '}
            {t('and')}{' '}
            <Link href="/privacy" target="_blank" className="text-primary underline">
              {t('privacyPolicy')}
            </Link>{' '}
            {t('agreeSuffix')}
            <span className="text-brand-800"> *</span>
          </span>
        </label>
        {errors.acceptTerms && <p className="mt-1 text-xs text-red-600">{errors.acceptTerms.message}</p>}
      </div>

      <label className="flex items-start gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          {...register('smsOptIn')}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-brand-800 focus:ring-brand-400"
        />
        {t('smsConsent')}
      </label>

      <div className="flex gap-3">
        <button type="button" onClick={onBack} className={BLUE_BTN}>
          {t('previous')}
        </button>
        <button type="submit" disabled={isSubmitting} className={PINK_BTN}>
          {t('register')}
        </button>
      </div>
    </form>
  );
}

/* ── Small building blocks ──────────────────────────────────────────────── */
/**
 * True once a request has been pending for a few seconds. The API sleeps when
 * idle on the free hosting tier and the first request can take ~50 s to wake
 * it, so tell people it's working rather than leave them clicking again.
 */
function useSlowHint(pending: boolean): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!pending) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(timer);
  }, [pending]);
  return slow;
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-blue-500">
        {label}
        {required && <span className="text-brand-800"> *</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function GenderCard({
  active,
  onClick,
  symbol,
  color,
  label,
}: {
  active: boolean;
  onClick: () => void;
  symbol: string;
  color: string;
  label: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-1 py-3 text-center transition ${
        active ? 'border-brand-500 bg-brand-50 shadow-sm' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <span className={`text-2xl leading-none ${color}`}>{symbol}</span>
      <span className="text-[11px] font-medium leading-tight text-gray-700">{label}</span>
    </button>
  );
}

/** Map API VALIDATION_ERROR details back onto form fields. */
function applyApiError(
  err: unknown,
  setError: (name: never, e: { message: string }) => void,
): void {
  if (err instanceof ApiError && err.details?.length) {
    for (const d of err.details) setError(d.field as never, { message: d.issue });
  }
}

/** Build the top-of-form error banners from any thrown error. */
function buildBanners(failedMsg: string, networkMsg: string, err: unknown): string[] {
  if (err instanceof ApiError) {
    const msgs = [failedMsg];
    if (err.details?.length) {
      for (const d of err.details) msgs.push(d.issue);
    } else if (err.message) {
      msgs.push(err.message);
    }
    return msgs;
  }
  // Network / connection error (e.g. API not running)
  return [networkMsg];
}

const NAME_WORDS = [
  'tomato', 'cool', 'white', 'blue', 'swift', 'happy', 'lunar', 'sunny', 'clever', 'mango',
  'ocean', 'tiger', 'maple', 'brave', 'quick', 'lucky', 'jolly', 'noble', 'amber', 'coral',
];

/** Generate a friendly unique-ish username like "tomato33cool5". */
function genUsername(): string {
  const w = () => NAME_WORDS[Math.floor(Math.random() * NAME_WORDS.length)];
  const n = () => Math.floor(Math.random() * 90) + 1;
  return `${w()}${n()}${w()}${Math.floor(Math.random() * 10)}`;
}

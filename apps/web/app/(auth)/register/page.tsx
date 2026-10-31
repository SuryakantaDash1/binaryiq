'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  registerStep1Schema,
  registerStep2Schema,
  type RegisterStep1Input,
  type RegisterStep2Input,
} from '@binaryiq/types';
import { Heading, Text } from '@binaryiq/ui';
import { AlertCircle, AtSign, Check, Loader2, Lock, Mail, MapPin, MailCheck, User, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';

import { AuthInput, EmailTypoHint, Field, OrDivider, PasswordStrength } from '@/features/auth/fields';
import { BTN_PRIMARY, BTN_SECONDARY, FIELD as INPUT } from '@/features/landing/styles';
import { authApi } from '@/lib/api/auth';
import { ApiError, apiFetch } from '@/lib/api/client';

type Step = 1 | 2 | 'done';

const COUNTRIES = [
  ['IN', 'India'], ['US', 'United States'], ['GB', 'United Kingdom'], ['AU', 'Australia'],
  ['CA', 'Canada'], ['SG', 'Singapore'], ['AE', 'United Arab Emirates'], ['NZ', 'New Zealand'],
  ['ZA', 'South Africa'], ['NG', 'Nigeria'], ['PK', 'Pakistan'], ['BD', 'Bangladesh'],
  ['LK', 'Sri Lanka'], ['NP', 'Nepal'], ['MY', 'Malaysia'], ['PH', 'Philippines'],
  ['ID', 'Indonesia'], ['DE', 'Germany'], ['FR', 'France'], ['NL', 'Netherlands'],
];

const GENDERS = [
  { value: 'MALE', symbol: '♂', labelKey: 'male' },
  { value: 'FEMALE', symbol: '♀', labelKey: 'female' },
  { value: 'OTHER', symbol: '⚧', labelKey: 'other' },
  { value: 'PREFER_NOT_TO_SAY', symbol: '?', labelKey: 'preferNotToSay' },
] as const;

export default function RegisterPage(): React.JSX.Element {
  const t = useTranslations('auth');
  const [step, setStep] = useState<Step>(1);
  const [draftId, setDraftId] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [emailSent, setEmailSent] = useState(true);
  const [banners, setBanners] = useState<string[]>([]);
  const [step1Data, setStep1Data] = useState<Partial<RegisterStep1Input>>({});

  if (step === 'done') return <RegistrationDone email={sentTo} emailSent={emailSent} />;

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">{t('createAccount')}</h1>
        <p className="mt-1.5 text-sm text-gray-500">{t('joinBonus')}</p>
      </div>

      <Stepper step={step} labels={[t('stepAboutYou'), t('accountStep')]} ariaLabel={t('stepOf', { step, total: 2 })} />

      {/* One error box: a headline plus what to fix */}
      {banners.length > 0 && (
        <div role="alert" className="flex items-start gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">{banners[0]}</p>
            {banners.length > 1 && (
              <ul className="mt-1 space-y-0.5">
                {banners.slice(1).map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
          </div>
          <button type="button" onClick={() => setBanners([])} className="text-red-400 hover:text-red-600" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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

      <OrDivider />
      <Text color="muted" size="sm" className="-mt-2 text-center">
        {t('alreadyHaveAccount')}{' '}
        <Link href="/login" className="font-semibold text-brand-700 hover:text-brand-900">
          {t('signIn')}
        </Link>
      </Text>
    </div>
  );
}

/* ── Done ───────────────────────────────────────────────────────────────── */
const RESEND_COOLDOWN_S = 30;

/**
 * After sign-up. If the activation email went out we say so; if it didn't, we simply
 * offer to send it — no talk of failures. Resending is rate-limited by the API and
 * has a short cooldown here.
 */
function RegistrationDone({ email, emailSent }: { email: string; emailSent: boolean }): React.JSX.Element {
  const t = useTranslations('auth');
  const [sent, setSent] = useState(emailSent);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(emailSent ? RESEND_COOLDOWN_S : 0);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function send(): Promise<void> {
    setSending(true);
    setNote(null);
    try {
      await authApi.resendVerification({ email });
      setSent(true);
      setNote(t('resendDone'));
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : t('somethingWrong'));
    } finally {
      setSending(false);
      setCooldown(RESEND_COOLDOWN_S);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center motion-safe:animate-fade-up">
      <span className="mb-2 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-900 text-white shadow-lg shadow-brand-700/25">
        <MailCheck className="h-8 w-8" />
      </span>
      <Heading level={3}>{sent ? t('checkInbox') : t('accountReady')}</Heading>
      <Text color="secondary">{sent ? t('sentTo', { email }) : t('verifyToFinish', { email })}</Text>
      {sent && (
        <Text color="muted" size="sm">
          {t('clickConfirm')}
        </Text>
      )}

      {sent ? (
        <>
          <Link href="/login" className={`${BTN_PRIMARY} mt-4 w-full`}>
            {t('backToSignIn')}
          </Link>
          <p className="text-sm text-gray-500">
            {t('resendPrompt')}{' '}
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || cooldown > 0}
              className="font-semibold text-brand-700 hover:text-brand-900 disabled:cursor-not-allowed disabled:text-gray-400"
            >
              {cooldown > 0 ? t('resendIn', { seconds: cooldown }) : t('resendLink')}
            </button>
          </p>
        </>
      ) : (
        <>
          <button type="button" onClick={() => void send()} disabled={sending} className={`${BTN_PRIMARY} mt-4 w-full`}>
            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('sendActivation')}
          </button>
          <Link href="/login" className={`${BTN_SECONDARY} w-full`}>
            {t('backToSignIn')}
          </Link>
        </>
      )}
      {note && (
        <p className="text-xs text-gray-500" role="status">
          {note}
        </p>
      )}
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
  }

  const onSubmit = handleSubmit(
    async (values) => {
      onBanners([]);
      if (!isAtLeast18(values.dob)) {
        setError('dob', { message: t('ageError') });
        revealFirstError();
        return;
      }
      try {
        const { draftId } = await authApi.registerStep1(values);
        onNext(draftId, values);
      } catch (err) {
        applyApiError(err, setError);
        onBanners(buildBanners(t('registrationFailed'), t('somethingWrong'), err));
        revealFirstError();
      }
    },
    () => revealFirstError(),
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Field label={t('country')} required error={errors.country?.message}>
        <select className={INPUT} aria-invalid={!!errors.country} {...register('country')}>
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
          <AuthInput icon={User} autoComplete="given-name" placeholder={t('firstName')} invalid={!!errors.firstName} {...register('firstName')} />
        </Field>
        <Field label={t('surname')} required error={errors.surname?.message}>
          <AuthInput autoComplete="family-name" placeholder={t('surname')} invalid={!!errors.surname} {...register('surname')} />
        </Field>
      </div>

      <Field label={t('dateOfBirth')} required error={errors.dob?.message}>
        <input type="date" className={INPUT} aria-invalid={!!errors.dob} {...register('dob')} />
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
              label={t(g.labelKey)}
            />
          ))}
        </div>
      </Field>

      <button type="submit" disabled={isSubmitting} className={`${BTN_PRIMARY} w-full`}>
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
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterStep2Input>({
    resolver: zodResolver(registerStep2Schema),
    defaultValues: { draftId, smsOptIn: false },
  });

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

  // Registration can't be submitted until the Terms box is ticked (the API enforces it too).
  const acceptedTerms = watch('acceptTerms') === true;
  // Only after a successful registration do we swap the form for the "getting ready" screen —
  // on any error the form stays put with everything the person typed.
  const [finishing, setFinishing] = useState(false);

  const onSubmit = handleSubmit(
    async (values) => {
      onBanners([]);
      try {
        const res = await authApi.registerStep2({ ...values, draftId });
        setFinishing(true);
        await new Promise((r) => setTimeout(r, 1200)); // brief "getting ready" moment
        onDone(res.email, res.emailSent);
      } catch (err) {
        applyApiError(err, setError);
        onBanners(buildBanners(t('registrationFailed'), t('somethingWrong'), err));
        revealFirstError();
      }
    },
    () => revealFirstError(),
  );

  if (finishing) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16">
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="h-3.5 w-3.5 animate-bounce rounded-full bg-brand-600"
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
        <AuthInput
          type="email"
          icon={Mail}
          autoComplete="email"
          placeholder={t('emailPlaceholder')}
          invalid={!!errors.email}
          {...register('email')}
        />
        <EmailTypoHint email={watch('email') ?? ''} onAccept={(v) => setValue('email', v, { shouldValidate: true })} />
      </Field>

      <Field label={t('password')} required error={errors.password?.message}>
        <AuthInput
          type="password"
          icon={Lock}
          autoComplete="new-password"
          placeholder={t('passwordHint')}
          invalid={!!errors.password}
          {...register('password')}
        />
        <PasswordStrength password={watch('password') ?? ''} />
      </Field>

      <Field label={t('pinLabel')} required error={errors.pinCode?.message}>
        <div className="relative">
          <AuthInput
            icon={MapPin}
            invalid={!!errors.pinCode}
            placeholder={t('pinHint')}
            autoComplete="off"
            value={pinDisplay}
            onChange={onPinChange}
            onFocus={() => pinOptions.length > 0 && setPinOpen(true)}
          />
          {pinOpen && pinOptions.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-gray-100 bg-white py-1 shadow-xl">
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
        <AuthInput
          icon={AtSign}
          autoComplete="username"
          placeholder={t('usernamePlaceholder')}
          invalid={!!errors.username}
          {...register('username')}
        />
      </Field>

      <Field label={t('mobileLabel')} error={errors.mobile?.message}>
        <div className="flex h-12 items-center rounded-xl border border-gray-200 bg-white transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10">
          <span className="pl-4 pr-2 text-sm font-semibold text-gray-700">+91</span>
          <input
            className="h-full flex-1 rounded-r-xl bg-transparent pr-4 text-sm placeholder:text-gray-400 focus:outline-none"
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
            aria-invalid={!!errors.acceptTerms}
            {...register('acceptTerms')}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 accent-brand-700"
          />
          <span>
            {t('agreePrefix')}{' '}
            <Link href="/terms" target="_blank" className="font-medium text-brand-700 underline decoration-brand-300 underline-offset-2">
              {t('termsAndConditions')}
            </Link>{' '}
            {t('and')}{' '}
            <Link href="/privacy" target="_blank" className="font-medium text-brand-700 underline decoration-brand-300 underline-offset-2">
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
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 accent-brand-700"
        />
        {t('smsConsent')}
      </label>

      <div className="flex gap-3">
        <button type="button" onClick={onBack} disabled={isSubmitting} className={`${BTN_SECONDARY} disabled:opacity-50`}>
          {t('previous')}
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !acceptedTerms}
          aria-describedby={acceptedTerms ? undefined : 'terms-hint'}
          className={`${BTN_PRIMARY} flex-1`}
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSubmitting ? t('pleaseWait') : t('register')}
        </button>
      </div>
      {!acceptedTerms && (
        <p id="terms-hint" className="-mt-2 text-center text-xs text-gray-500">
          {t('acceptToContinue')}
        </p>
      )}
      {slow && <p className="-mt-2 text-center text-sm text-gray-500">{t('wakingServer')}</p>}
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

/** Two-step progress indicator: "About you" → "Your account". */
function Stepper({
  step,
  labels,
  ariaLabel,
}: {
  step: 1 | 2;
  labels: [string, string];
  ariaLabel: string;
}): React.JSX.Element {
  return (
    <ol className="flex items-center gap-3" aria-label={ariaLabel}>
      {labels.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const current = step === n;
        return (
          <li key={label} className={`flex items-center gap-3 ${n === 1 ? 'flex-1' : ''}`}>
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition ${
                current || done
                  ? 'bg-gradient-to-br from-brand-600 to-brand-900 text-white shadow-md shadow-brand-700/25'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {done ? <Check className="h-4 w-4" strokeWidth={3} /> : n}
            </span>
            <span className={`whitespace-nowrap text-sm font-semibold ${current ? 'text-ink' : 'text-gray-400'}`}>
              {label}
            </span>
            {n === 1 && <span className={`h-px flex-1 ${done ? 'bg-brand-300' : 'bg-gray-200'}`} />}
          </li>
        );
      })}
    </ol>
  );
}

function GenderCard({
  active,
  onClick,
  symbol,
  label,
}: {
  active: boolean;
  onClick: () => void;
  symbol: string;
  label: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 py-3 text-center transition ${
        active ? 'border-brand-500 bg-brand-50 ring-4 ring-brand-500/10' : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <span className={`text-2xl leading-none ${active ? 'text-brand-700' : 'text-gray-400'}`}>{symbol}</span>
      <span className="text-[11px] font-medium leading-tight text-gray-700">{label}</span>
    </button>
  );
}

/** After a failed submit, bring the first problem (error banner or invalid field) into view. */
function revealFirstError(): void {
  requestAnimationFrame(() => {
    const target = document.querySelector<HTMLElement>('[role="alert"], [aria-invalid="true"]');
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (target instanceof HTMLInputElement) target.focus({ preventScroll: true });
  });
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

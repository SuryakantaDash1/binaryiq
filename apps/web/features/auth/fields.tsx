'use client';

import { Check, Eye, EyeOff, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { forwardRef, useState, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';

import { FIELD, LABEL } from '@/features/landing/styles';

/* ── Field: label + required star + error ─────────────────────────────── */
export function Field({
  label,
  required,
  error,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <div>
      <label htmlFor={htmlFor} className={LABEL}>
        {label}
        {required && <span className="text-brand-600"> *</span>}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/* ── AuthInput: leading icon, password reveal, Caps Lock warning ─────────── */
export interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: LucideIcon;
  invalid?: boolean;
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(function AuthInput(
  { icon: Icon, invalid, type = 'text', className = '', onKeyDown, onKeyUp, onBlur, ...props },
  ref,
) {
  const t = useTranslations('auth');
  const isPassword = type === 'password';
  const [reveal, setReveal] = useState(false);
  const [capsOn, setCapsOn] = useState(false);

  function trackCaps(e: KeyboardEvent<HTMLInputElement>): void {
    if (isPassword) setCapsOn(e.getModifierState('CapsLock'));
  }

  return (
    <div>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />}
        <input
          ref={ref}
          type={isPassword && reveal ? 'text' : type}
          aria-invalid={invalid}
          className={`${FIELD} ${Icon ? 'pl-11' : ''} ${isPassword ? 'pr-11' : ''} ${
            invalid ? 'border-red-300 focus:border-red-400 focus:ring-red-500/10' : ''
          } ${className}`}
          onKeyDown={(e) => {
            trackCaps(e);
            onKeyDown?.(e);
          }}
          onKeyUp={(e) => {
            trackCaps(e);
            onKeyUp?.(e);
          }}
          onBlur={(e) => {
            setCapsOn(false);
            onBlur?.(e);
          }}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            {reveal ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
          </button>
        )}
      </div>
      {isPassword && capsOn && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-600" role="status">
          <span className="rounded border border-amber-300 px-1 text-[10px] leading-4">⇪</span>
          {t('capsLock')}
        </p>
      )}
    </div>
  );
});

/* ── PasswordStrength: mirrors passwordSchema in @binaryiq/types (auth.ts) ── */
const RULES = [
  { key: 'ruleLength', test: (p: string) => p.length >= 8 },
  { key: 'ruleLower', test: (p: string) => /[a-z]/.test(p) },
  { key: 'ruleUpper', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'ruleNumber', test: (p: string) => /[0-9]/.test(p) },
] as const;

const LEVELS = [
  { key: 'strengthWeak', bar: 'bg-red-500', text: 'text-red-600' },
  { key: 'strengthFair', bar: 'bg-amber-500', text: 'text-amber-600' },
  { key: 'strengthGood', bar: 'bg-lime-500', text: 'text-lime-700' },
  { key: 'strengthStrong', bar: 'bg-emerald-500', text: 'text-emerald-600' },
] as const;

export function PasswordStrength({ password }: { password: string }): React.JSX.Element | null {
  const t = useTranslations('auth');
  if (!password) return null;
  const passed = RULES.filter((r) => r.test(password)).length;
  const level = LEVELS[Math.max(0, passed - 1)]!;

  return (
    <div className="mt-2.5" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-4 gap-1.5">
          {RULES.map((r, i) => (
            <span key={r.key} className={`h-1.5 rounded-full transition-colors ${i < passed ? level.bar : 'bg-gray-200'}`} />
          ))}
        </div>
        <span className={`text-xs font-semibold ${level.text}`}>{t(level.key)}</span>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
        {RULES.map((r) => {
          const ok = r.test(password);
          return (
            <li key={r.key} className={`flex items-center gap-1.5 text-xs ${ok ? 'text-emerald-600' : 'text-gray-400'}`}>
              <span
                className={`flex h-3.5 w-3.5 items-center justify-center rounded-full ${ok ? 'bg-emerald-500 text-white' : 'border border-gray-300'}`}
              >
                {ok && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </span>
              {t(r.key)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── Email typo hint ─────────────────────────────────────────────────────── */
const COMMON_DOMAINS = [
  'gmail.com', 'yahoo.com', 'yahoo.co.in', 'outlook.com', 'hotmail.com', 'icloud.com', 'rediffmail.com', 'live.com',
];

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length]!;
}

/** "name@gmial.com" → "name@gmail.com"; null when the domain looks fine or isn't close to a common one. */
export function suggestEmail(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 1) return null;
  const domain = email.slice(at + 1).toLowerCase();
  if (domain.length < 4 || COMMON_DOMAINS.includes(domain)) return null;
  let best: { domain: string; d: number } | null = null;
  for (const candidate of COMMON_DOMAINS) {
    const d = editDistance(domain, candidate);
    if (d > 0 && d <= 2 && (!best || d < best.d)) best = { domain: candidate, d };
  }
  return best ? `${email.slice(0, at)}@${best.domain}` : null;
}

export function EmailTypoHint({ email, onAccept }: { email: string; onAccept: (fixed: string) => void }): React.JSX.Element | null {
  const t = useTranslations('auth');
  const suggestion = suggestEmail(email.trim());
  if (!suggestion) return null;
  return (
    <p className="mt-1.5 text-xs text-gray-500">
      {t('didYouMean')}{' '}
      <button
        type="button"
        onClick={() => onAccept(suggestion)}
        className="font-semibold text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-900"
      >
        {suggestion}
      </button>
      ?
    </p>
  );
}

/* ── "or" divider ────────────────────────────────────────────────────────── */
export function OrDivider(): React.JSX.Element {
  const t = useTranslations('auth');
  return (
    <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-gray-400">
      <span className="h-px flex-1 bg-gray-200" />
      {t('orDivider')}
      <span className="h-px flex-1 bg-gray-200" />
    </div>
  );
}

'use client';

import type { AdminLoginChallenge } from '@influencer/types';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { adminApi } from '@/lib/api/admin';
import { ApiError } from '@/lib/api/client';

const inputClass =
  'mt-1 h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary';

export default function AdminLoginPage(): React.JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<AdminLoginChallenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onPassword(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      setChallenge(await adminApi.login(email.trim(), password));
      setPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function onCode(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!challenge) return;
    setError(null);
    setLoading(true);
    try {
      await adminApi.verifyTotp(challenge.challengeToken, code);
      router.replace('/admin');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed. Please try again.');
      setCode('');
      setLoading(false);
    }
  }

  function startOver(): void {
    setChallenge(null);
    setCode('');
    setError(null);
  }

  const errorBox = error && (
    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
  );

  if (challenge) {
    const enrolling = challenge.status === 'enrollment_required';
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <form onSubmit={onCode} className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-sm">
          <h1 className="text-xl font-bold text-text">{enrolling ? 'Set up two-factor sign-in' : 'Two-factor sign-in'}</h1>
          <p className="mt-1 text-sm text-secondary">
            {enrolling
              ? 'Scan this QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…), then enter the 6-digit code it shows.'
              : 'Enter the 6-digit code from your authenticator app.'}
          </p>

          {challenge.status === 'enrollment_required' && (
            <div className="mt-5 flex flex-col items-center gap-3">
              <img src={challenge.qrDataUrl} alt="Authenticator QR code" width={192} height={192} className="rounded-lg border border-border" />
              <div className="w-full text-center">
                <p className="text-xs text-secondary">Can&apos;t scan? Enter this key manually:</p>
                <code className="mt-1 block select-all break-all rounded-md bg-background px-2 py-1.5 text-xs font-semibold tracking-wider text-text">
                  {challenge.secret}
                </code>
              </div>
            </div>
          )}

          {errorBox}

          <label className="mt-5 block text-sm font-medium text-text" htmlFor="admin-code">Authentication code</label>
          <input
            id="admin-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
            autoFocus
            className={`${inputClass} text-center text-lg tracking-[0.4em]`}
          />

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="mt-6 h-11 w-full rounded-full bg-primary text-sm font-semibold text-on-primary transition hover:bg-primary-hover disabled:opacity-60"
          >
            {loading ? 'Verifying…' : enrolling ? 'Verify and finish setup' : 'Verify'}
          </button>
          <button type="button" onClick={startOver} className="mt-3 w-full text-center text-sm text-secondary hover:text-text">
            Start over
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={onPassword} className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <h1 className="text-xl font-bold text-text">Admin sign in</h1>
        <p className="mt-1 text-sm text-secondary">Superadmin console access</p>

        {errorBox}

        <label className="mt-5 block text-sm font-medium text-text" htmlFor="admin-email">Email</label>
        <input
          id="admin-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={inputClass}
        />

        <label className="mt-4 block text-sm font-medium text-text" htmlFor="admin-password">Password</label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className={inputClass}
        />

        <button
          type="submit"
          disabled={loading}
          className="mt-6 h-11 w-full rounded-full bg-primary text-sm font-semibold text-on-primary transition hover:bg-primary-hover disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}

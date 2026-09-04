'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { adminApi, setAdminToken } from '@/lib/api/admin';
import { ApiError } from '@/lib/api/client';

export default function AdminLoginPage(): React.JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session = await adminApi.login(email.trim(), password);
      setAdminToken(session.accessToken);
      router.replace('/admin');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <h1 className="text-xl font-bold text-text">Admin sign in</h1>
        <p className="mt-1 text-sm text-secondary">Superadmin console access</p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <label className="mt-5 block text-sm font-medium text-text" htmlFor="admin-email">Email</label>
        <input
          id="admin-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1 h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary"
        />

        <label className="mt-4 block text-sm font-medium text-text" htmlFor="admin-password">Password</label>
        <input
          id="admin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mt-1 h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary"
        />

        <button
          type="submit"
          disabled={loading}
          className="mt-6 h-11 w-full rounded-full bg-primary text-sm font-semibold text-on-primary transition hover:bg-primary-hover disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

'use client';

import type { AdminUserRow } from '@binaryiq/types';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { adminApi } from '@/lib/api/admin';

export default function AdminUsersPage(): React.JSX.Element {
  const params = useSearchParams();
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [verified, setVerified] = useState(params.get('verified') ?? '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .listUsers({ q: q || undefined, status: status || undefined, verified: verified || undefined, page, pageSize })
      .then((r) => {
        setRows(r.items);
        setTotal(r.pagination.total);
      })
      .catch(() => setError('Failed to load users.'))
      .finally(() => setLoading(false));
  }, [q, status, verified, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(u: AdminUserRow): Promise<void> {
    const next = !u.isActive;
    setRows((prev) => prev.map((r) => (r.id === u.id ? { ...r, isActive: next } : r))); // optimistic
    try {
      await adminApi.setUserActive(u.id, next);
    } catch {
      setRows((prev) => prev.map((r) => (r.id === u.id ? { ...r, isActive: u.isActive } : r))); // revert
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-black text-text md:hidden">Users</h1>
        <p className="text-sm text-secondary">{total.toLocaleString()} total</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => { setPage(1); setQ(e.target.value); }}
          placeholder="Search email or username…"
          className="h-10 w-64 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary"
        />
        <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
        </select>
        <select value={verified} onChange={(e) => { setPage(1); setVerified(e.target.value); }} className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text">
          <option value="">All</option>
          <option value="true">Verified</option>
          <option value="false">Unverified</option>
        </select>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Username</th>
              <th className="px-4 py-3 font-medium">Verified</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Points</th>
              <th className="px-4 py-3 font-medium">Last login</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td colSpan={8} className="px-4 py-3"><div className="h-5 animate-pulse rounded bg-surface-alt" /></td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-secondary">No users found.</td></tr>
            ) : (
              rows.map((u) => (
                <tr key={u.id} className="border-b border-border hover:bg-background">
                  <td className="px-4 py-3 text-text">{u.email}</td>
                  <td className="px-4 py-3 text-secondary">@{u.username}</td>
                  <td className="px-4 py-3">
                    <span className={u.isVerified ? 'text-green-600' : 'text-secondary'}>{u.isVerified ? 'Yes' : 'No'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.isActive ? 'Active' : 'Blocked'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text">{u.balance.toLocaleString()}</td>
                  <td className="px-4 py-3 text-secondary">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-secondary">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void toggleActive(u)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        u.isActive ? 'border-red-300 text-red-600 hover:bg-red-50' : 'border-green-300 text-green-700 hover:bg-green-50'
                      }`}
                    >
                      {u.isActive ? 'Block' : 'Unblock'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-secondary">Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-border px-3 py-1.5 text-text disabled:opacity-40">Previous</button>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-border px-3 py-1.5 text-text disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}

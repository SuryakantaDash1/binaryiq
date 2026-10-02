'use client';

import type { FeedSourceView } from '@influencer/types';
import { useCallback, useEffect, useState } from 'react';

import { adminApi } from '@/lib/api/admin';
import { ApiError } from '@/lib/api/client';

export default function AdminNewsSourcesPage(): React.JSX.Element {
  const [rows, setRows] = useState<FeedSourceView[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollingId, setPollingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .listNewsSources({ pageSize: 50 })
      .then((r) => {
        setRows(r.items);
        setTotal(r.total);
      })
      .catch(() => setError('Failed to load feed sources.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(s: FeedSourceView): Promise<void> {
    const next = !s.isActive;
    setRows((prev) => prev.map((r) => (r.id === s.id ? { ...r, isActive: next } : r)));
    try {
      await adminApi.updateNewsSource(s.id, { isActive: next });
    } catch {
      setRows((prev) => prev.map((r) => (r.id === s.id ? { ...r, isActive: s.isActive } : r)));
    }
  }

  async function pollNow(id: string): Promise<void> {
    setPollingId(id);
    try {
      const updated = await adminApi.pollNewsSourceNow(id);
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch {
      /* lastError will already be reflected on the next load() if the poll itself failed */
    } finally {
      setPollingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-black text-text md:hidden">News Sources</h1>
        <p className="text-sm text-secondary">
          {total.toLocaleString()} source{total === 1 ? '' : 's'} · polled hourly · powers the Community
          page&apos;s &quot;Industry Updates&quot; section
        </p>
      </div>

      <AddSourceForm onAdded={load} />

      {error && <p className="text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-border text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Feed URL</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last polled</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td colSpan={6} className="px-4 py-3"><div className="h-5 animate-pulse rounded bg-surface-alt" /></td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-secondary">No feed sources yet — add one above.</td></tr>
            ) : (
              rows.map((s) => (
                <tr key={s.id} className="border-b border-border hover:bg-background">
                  <td className="px-4 py-3 text-text">{s.name}</td>
                  <td className="max-w-[260px] truncate px-4 py-3 text-secondary" title={s.feedUrl}>{s.feedUrl}</td>
                  <td className="px-4 py-3 text-secondary">{s.category ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void toggleActive(s)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        s.isActive ? 'border-green-300 text-green-700 hover:bg-green-50' : 'border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {s.isActive ? 'Active' : 'Inactive'}
                    </button>
                    {s.lastError && (
                      <p className="mt-1 max-w-[180px] truncate text-xs text-red-600" title={s.lastError}>
                        {s.lastError}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-secondary">
                    {s.lastPolledAt ? new Date(s.lastPolledAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void pollNow(s.id)}
                      disabled={pollingId === s.id}
                      className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text transition hover:bg-background disabled:opacity-50"
                    >
                      {pollingId === s.id ? 'Polling…' : 'Poll now'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddSourceForm({ onAdded }: { onAdded: () => void }): React.JSX.Element {
  const [name, setName] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [category, setCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await adminApi.createNewsSource({ name, feedUrl, category: category || undefined, isActive: true });
      setName('');
      setFeedUrl('');
      setCategory('');
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add source.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex min-w-[160px] flex-1 flex-col gap-1">
        <label className="text-xs font-medium text-secondary" htmlFor="src-name">Name</label>
        <input
          id="src-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. GreenBook Blog"
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary"
        />
      </div>
      <div className="flex min-w-[240px] flex-[2] flex-col gap-1">
        <label className="text-xs font-medium text-secondary" htmlFor="src-url">Feed URL</label>
        <input
          id="src-url"
          type="url"
          value={feedUrl}
          onChange={(e) => setFeedUrl(e.target.value)}
          required
          placeholder="https://example.com/feed/"
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary"
        />
      </div>
      <div className="flex min-w-[140px] flex-col gap-1">
        <label className="text-xs font-medium text-secondary" htmlFor="src-category">Category (optional)</label>
        <input
          id="src-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Market Research"
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-on-primary transition hover:bg-primary-hover disabled:opacity-60"
      >
        {submitting ? 'Adding…' : 'Add source'}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}

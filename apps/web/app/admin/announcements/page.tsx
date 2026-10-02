'use client';

import type { AdminAnnouncementView, CreateAnnouncementInput } from '@influencer/types';
import { useCallback, useEffect, useState } from 'react';

import { adminApi } from '@/lib/api/admin';
import { ApiError } from '@/lib/api/client';

type FormState = {
  title: string;
  excerpt: string;
  bannerHeadline: string;
  emoji: string;
  imageUrl: string;
  commentsCount: string;
};

const EMPTY_FORM: FormState = { title: '', excerpt: '', bannerHeadline: '', emoji: '', imageUrl: '', commentsCount: '0' };

function toInput(form: FormState): CreateAnnouncementInput {
  return {
    title: form.title,
    excerpt: form.excerpt,
    bannerHeadline: form.bannerHeadline,
    emoji: form.emoji,
    imageUrl: form.imageUrl || undefined,
    commentsCount: Number(form.commentsCount) || 0,
    isActive: true,
    sortOrder: 0,
  };
}

export default function AdminAnnouncementsPage(): React.JSX.Element {
  const [rows, setRows] = useState<AdminAnnouncementView[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .listAnnouncements({ pageSize: 50 })
      .then((r) => {
        setRows(r.items);
        setTotal(r.total);
      })
      .catch(() => setError('Failed to load announcements.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(a: AdminAnnouncementView): Promise<void> {
    const next = !a.isActive;
    setRows((prev) => prev.map((r) => (r.id === a.id ? { ...r, isActive: next } : r)));
    try {
      await adminApi.updateAnnouncement(a.id, { isActive: next });
    } catch {
      setRows((prev) => prev.map((r) => (r.id === a.id ? { ...r, isActive: a.isActive } : r)));
    }
  }

  async function remove(id: string): Promise<void> {
    const prev = rows;
    setRows((r) => r.filter((row) => row.id !== id));
    try {
      await adminApi.deleteAnnouncement(id);
      setTotal((t) => t - 1);
    } catch {
      setRows(prev);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-black text-text md:hidden">Announcements</h1>
        <p className="text-sm text-secondary">
          {total.toLocaleString()} post{total === 1 ? '' : 's'} · powers the Community page&apos;s &quot;News&quot;
          tab
        </p>
      </div>

      <AnnouncementForm onSaved={load} />

      {error && <p className="text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-b border-border text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">Banner</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Comments</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Published</th>
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
              <tr><td colSpan={6} className="px-4 py-10 text-center text-secondary">No announcements yet — add one above.</td></tr>
            ) : (
              rows.map((a) =>
                editingId === a.id ? (
                  <tr key={a.id} className="border-b border-border">
                    <td colSpan={6} className="px-4 py-3">
                      <AnnouncementForm
                        announcement={a}
                        onSaved={() => { setEditingId(null); load(); }}
                        onCancel={() => setEditingId(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={a.id} className="border-b border-border hover:bg-background">
                    <td className="px-4 py-3 text-text">{a.emoji} {a.bannerHeadline}</td>
                    <td className="max-w-[260px] truncate px-4 py-3 text-text" title={a.title}>{a.title}</td>
                    <td className="px-4 py-3 text-secondary">{a.commentsCount}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void toggleActive(a)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          a.isActive ? 'border-green-300 text-green-700 hover:bg-green-50' : 'border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {a.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-secondary">{new Date(a.publishedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(a.id)}
                          className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text transition hover:bg-background"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(a.id)}
                          className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AnnouncementForm({
  announcement,
  onSaved,
  onCancel,
}: {
  announcement?: AdminAnnouncementView;
  onSaved: () => void;
  onCancel?: () => void;
}): React.JSX.Element {
  const isEdit = !!announcement;
  const [form, setForm] = useState<FormState>(
    announcement
      ? {
          title: announcement.title,
          excerpt: announcement.excerpt,
          bannerHeadline: announcement.bannerHeadline,
          emoji: announcement.emoji,
          imageUrl: announcement.imageUrl ?? '',
          commentsCount: String(announcement.commentsCount),
        }
      : EMPTY_FORM,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isEdit) {
        await adminApi.updateAnnouncement(announcement.id, toInput(form));
      } else {
        await adminApi.createAnnouncement(toInput(form));
        setForm(EMPTY_FORM);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save announcement.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex min-w-[90px] flex-col gap-1">
        <label className="text-xs font-medium text-secondary" htmlFor="ann-emoji">Emoji</label>
        <input
          id="ann-emoji"
          value={form.emoji}
          onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
          required
          placeholder="🏆"
          className="h-10 w-20 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary"
        />
      </div>
      <div className="flex min-w-[200px] flex-1 flex-col gap-1">
        <label className="text-xs font-medium text-secondary" htmlFor="ann-banner">Banner headline</label>
        <input
          id="ann-banner"
          value={form.bannerHeadline}
          onChange={(e) => setForm((f) => ({ ...f, bannerHeadline: e.target.value }))}
          required
          placeholder="WIN 15,000 POINTS"
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary"
        />
      </div>
      <div className="flex min-w-[220px] flex-[2] flex-col gap-1">
        <label className="text-xs font-medium text-secondary" htmlFor="ann-title">Title</label>
        <input
          id="ann-title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          required
          placeholder="Win points in our festive lucky draw"
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary"
        />
      </div>
      <div className="flex min-w-[260px] flex-[3] flex-col gap-1">
        <label className="text-xs font-medium text-secondary" htmlFor="ann-excerpt">Excerpt</label>
        <input
          id="ann-excerpt"
          value={form.excerpt}
          onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
          required
          placeholder="Short description shown on the card"
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary"
        />
      </div>
      <div className="flex min-w-[200px] flex-col gap-1">
        <label className="text-xs font-medium text-secondary" htmlFor="ann-image">Image URL (optional)</label>
        <input
          id="ann-image"
          type="url"
          value={form.imageUrl}
          onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
          placeholder="https://…"
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary"
        />
      </div>
      <div className="flex min-w-[100px] flex-col gap-1">
        <label className="text-xs font-medium text-secondary" htmlFor="ann-comments">Comments</label>
        <input
          id="ann-comments"
          type="number"
          min={0}
          value={form.commentsCount}
          onChange={(e) => setForm((f) => ({ ...f, commentsCount: e.target.value }))}
          className="h-10 w-24 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-on-primary transition hover:bg-primary-hover disabled:opacity-60"
        >
          {submitting ? 'Saving…' : isEdit ? 'Save' : 'Add announcement'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-full border border-border px-4 text-sm font-medium text-text transition hover:bg-background"
          >
            Cancel
          </button>
        )}
      </div>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}

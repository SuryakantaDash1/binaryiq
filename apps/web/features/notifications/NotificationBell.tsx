'use client';

import { EmptyState } from '@binaryiq/ui';
import { useState, useEffect, useCallback } from 'react';


import { notificationsApi, type NotificationDTO } from '@/lib/api/notifications';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell(): React.JSX.Element {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const fetchCount = useCallback(() => {
    notificationsApi.unreadCount().then((r) => setCount(r.count)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  const openBell = useCallback(async () => {
    setOpen((prev) => !prev);
    if (!open) {
      setLoadingItems(true);
      notificationsApi.list({ limit: 10, unread: false })
        .then((res) => setItems(res.items))
        .catch(() => void 0)
        .finally(() => setLoadingItems(false));
    }
  }, [open]);

  const handleMarkRead = useCallback((id: string) => {
    notificationsApi.markRead(id)
      .then(() => {
        setItems((prev) => prev.map((n) => n.id === id ? { ...n, readAt: new Date().toISOString(), status: 'READ' } : n));
        setCount((c) => Math.max(0, c - 1));
      })
      .catch(() => void 0);
  }, []);

  const handleMarkAll = useCallback(() => {
    notificationsApi.markAllRead()
      .then(() => {
        setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString(), status: 'READ' })));
        setCount(0);
      })
      .catch(() => void 0);
  }, []);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openBell}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-brand-700 transition hover:border-brand-300 hover:bg-brand-100 hover:text-brand-900 focus:outline-none"
        aria-label={`Notifications${count > 0 ? `, ${count} unread` : ''}`}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-border bg-surface shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="font-semibold text-text text-sm">Notifications</span>
              {count > 0 && (
                <button type="button" onClick={handleMarkAll} className="text-primary text-xs hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {loadingItems ? (
                <div className="py-8 text-center text-secondary text-sm">Loading…</div>
              ) : items.length === 0 ? (
                <div className="py-6 px-4">
                  <EmptyState title="You're all caught up" description="No new notifications" />
                </div>
              ) : (
                <ul>
                  {items.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => { if (!n.readAt) handleMarkRead(n.id); }}
                        className="w-full px-4 py-3 text-left hover:bg-surface-hover transition-colors flex items-start gap-2"
                      >
                        {!n.readAt && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />}
                        {n.readAt && <span className="mt-1.5 h-2 w-2 flex-shrink-0" />}
                        <div className="min-w-0 flex-1">
                          {n.title && <p className="text-text text-sm font-medium truncate">{n.title}</p>}
                          <p className="text-secondary text-xs leading-snug">{n.message}</p>
                          <p className="text-secondary text-xs mt-0.5">{timeAgo(n.createdAt)}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

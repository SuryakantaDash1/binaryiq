'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, type Column, Skeleton, EmptyState, Heading, Text } from '@binaryiq/ui';
import { dataRightsApi } from '@/lib/api/data-rights.js';

type AuditRow = {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  ipAddress: string | null;
  createdAt: string;
};

const PAGE_SIZE = 50;

const ACTOR_TYPE_OPTIONS = [
  { value: '', label: 'All actor types' },
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
  { value: 'system', label: 'System' },
];

export default function AdminAuditLogsPage(): React.JSX.Element {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actorType, setActorType] = useState('');
  const [action, setAction] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    dataRightsApi
      .adminGetAuditLogs({
        actorType: actorType || undefined,
        action: action || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      .then((res) => {
        setRows(res.items);
        setTotal(res.total);
      })
      .catch(() => void 0)
      .finally(() => setLoading(false));
  }, [actorType, action, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset to page 1 whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [actorType, action]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: Column<AuditRow>[] = [
    {
      key: 'actorType',
      header: 'Actor',
      render: (r) => <span className="text-xs">{r.actorType}</span>,
    },
    {
      key: 'actorId',
      header: 'Actor ID',
      render: (r) => (
        <span className="block max-w-[120px] truncate font-mono text-xs">
          {r.actorId?.slice(0, 8) ?? '—'}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (r) => <span className="text-xs font-medium">{r.action}</span>,
    },
    {
      key: 'targetType',
      header: 'Target',
      render: (r) => <span className="text-xs">{r.targetType ?? '—'}</span>,
    },
    {
      key: 'ipAddress',
      header: 'IP',
      render: (r) => <span className="text-xs text-text-secondary">{r.ipAddress ?? '—'}</span>,
    },
    {
      key: 'createdAt',
      header: 'When',
      render: (r) => (
        <span className="text-xs text-text-secondary">
          {new Date(r.createdAt).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Heading level={3}>Audit Logs</Heading>
          {!loading && (
            <Text color="secondary" size="sm">
              {total.toLocaleString()} entr{total === 1 ? 'y' : 'ies'} found
            </Text>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={actorType}
          onChange={(e) => setActorType(e.target.value)}
          className="h-10 w-44 rounded-md border border-border bg-surface px-3 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {ACTOR_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Filter by action…"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="w-56 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {loading && rows.length === 0 ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="No audit logs" description="No matching log entries found." />
      ) : (
        <>
          <DataTable columns={columns} rows={rows} keyExtractor={(r) => r.id} />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-text-secondary">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text transition hover:bg-background disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm font-semibold text-text">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary transition hover:bg-primary-hover disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

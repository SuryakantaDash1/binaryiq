'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, type Column, Skeleton, EmptyState, Heading, Button } from '@influencer/ui';
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

const ACTOR_TYPE_OPTIONS = [
  { value: '', label: 'All actor types' },
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
  { value: 'system', label: 'System' },
];

export default function AdminAuditLogsPage(): React.JSX.Element {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actorType, setActorType] = useState('');
  const [action, setAction] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(
    (nextCursor?: string | null) => {
      setLoading(true);
      dataRightsApi
        .adminGetAuditLogs({
          actorType: actorType || undefined,
          action: action || undefined,
          limit: 50,
          cursor: nextCursor ?? undefined,
        })
        .then((res) => {
          setRows(nextCursor ? (prev) => [...prev, ...res.data] : res.data);
          setHasMore(res.meta.pagination.hasMore);
          setCursor(res.meta.pagination.nextCursor);
        })
        .catch(() => void 0)
        .finally(() => setLoading(false));
    },
    [actorType, action],
  );

  useEffect(() => {
    load(null);
  }, [load]);

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
        <Heading level={3}>Audit Logs</Heading>
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
          {hasMore && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={() => load(cursor)} disabled={loading}>
                {loading ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, type Column, Badge, Skeleton, EmptyState, Heading, Button } from '@binaryiq/ui';
import { dataRightsApi, type ConsentLogDTO } from '@/lib/api/data-rights.js';

const CONSENT_TYPE_OPTIONS = [
  { value: '', label: 'All consent types' },
  { value: 'TERMS', label: 'Terms of Service' },
  { value: 'PRIVACY', label: 'Privacy Policy' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'COOKIES', label: 'Cookies' },
];

export default function AdminConsentsPage(): React.JSX.Element {
  const [rows, setRows] = useState<ConsentLogDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [consentType, setConsentType] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(
    (nextCursor?: string | null) => {
      setLoading(true);
      dataRightsApi
        .adminGetConsents({
          userId: userId || undefined,
          consentType: consentType || undefined,
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
    [userId, consentType],
  );

  useEffect(() => {
    load(null);
  }, [load]);

  const columns: Column<ConsentLogDTO>[] = [
    {
      key: 'consentType',
      header: 'Consent Type',
      render: (r) => <span className="text-xs font-medium">{r.consentType}</span>,
    },
    {
      key: 'consentVersion',
      header: 'Version',
      render: (r) => <span className="text-xs">{r.consentVersion}</span>,
    },
    {
      key: 'granted',
      header: 'Granted',
      render: (r) => (
        <Badge variant={r.granted ? 'success' : 'warning'}>
          {r.granted ? 'Yes' : 'No'}
        </Badge>
      ),
    },
    {
      key: 'ipAddress',
      header: 'IP Address',
      render: (r) => (
        <span className="text-xs text-text-secondary">{r.ipAddress ?? '—'}</span>
      ),
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
        <Heading level={3}>Consent Records</Heading>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Filter by user ID…"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="w-56 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <select
          value={consentType}
          onChange={(e) => setConsentType(e.target.value)}
          className="h-10 w-52 rounded-md border border-border bg-surface px-3 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {CONSENT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {loading && rows.length === 0 ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="No consent records" description="No matching consent records found." />
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

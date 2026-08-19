'use client';

import { Badge, DataTable, type Column, Heading, Select, Skeleton, Text } from '@influencer/ui';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';


import {
  supportApi,
  type AdminTicketRow,
  type TicketStatus,
} from '@/lib/api/support.js';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

const ISSUE_TYPE_OPTIONS = [
  { value: '', label: 'All issue types' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'SURVEY', label: 'Survey' },
  { value: 'SURVEY_PAYMENT', label: 'Survey Payment' },
  { value: 'REWARDS', label: 'Rewards' },
  { value: 'UNSUBSCRIBE', label: 'Unsubscribe' },
  { value: 'OTHER', label: 'Other' },
];

function statusVariant(status: TicketStatus): 'default' | 'success' | 'warning' | 'primary' {
  switch (status) {
    case 'OPEN':
      return 'primary';
    case 'PENDING':
      return 'warning';
    case 'RESOLVED':
      return 'success';
    case 'CLOSED':
      return 'default';
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminSupportPage(): React.JSX.Element {
  const router = useRouter();
  const [tickets, setTickets] = useState<AdminTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [issueTypeFilter, setIssueTypeFilter] = useState('');
  const [total, setTotal] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    supportApi
      .adminListTickets({
        status: statusFilter || undefined,
        issueType: issueTypeFilter || undefined,
        page: 1,
        pageSize: 20,
      })
      .then((r) => {
        setTickets(r.items);
        setTotal(r.pagination.total);
      })
      .catch(() => setError('Failed to load tickets.'))
      .finally(() => setLoading(false));
  }, [statusFilter, issueTypeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Build columns with row-level navigate via a button in the subject cell
  const columns: Column<AdminTicketRow>[] = [
    {
      key: 'userEmail',
      header: 'User',
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-text">{row.userEmail}</p>
          <p className="text-xs text-text/60">{row.username}</p>
        </div>
      ),
    },
    {
      key: 'issueType',
      header: 'Issue Type',
      render: (row) => <Badge variant="default">{row.issueType}</Badge>,
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (row) => (
        <button
          type="button"
          onClick={() => router.push(`/admin/support/${row.id}`)}
          className="text-sm text-primary hover:underline text-left"
        >
          {row.subject ?? '(no subject)'}
        </button>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
      ),
    },
    {
      key: 'messageCount',
      header: 'Msgs',
      render: (row) => <span className="text-sm text-text">{row.messageCount}</span>,
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (row) => (
        <span className="text-xs text-text/60">{formatDate(row.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button
          type="button"
          onClick={() => router.push(`/admin/support/${row.id}`)}
          className="text-xs text-primary hover:underline"
        >
          View
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Heading level={2}>Support Tickets</Heading>
          {!loading && (
            <Text color="secondary" size="sm">
              {total} ticket{total !== 1 ? 's' : ''} found
            </Text>
          )}
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="w-44">
            <Select
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            />
          </div>
          <div className="w-52">
            <Select
              options={ISSUE_TYPE_OPTIONS}
              value={issueTypeFilter}
              onChange={(e) => setIssueTypeFilter(e.target.value)}
              aria-label="Filter by issue type"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <p className="text-text font-medium">No tickets found</p>
          <p className="text-sm text-text/60 mt-1">Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <DataTable
            columns={columns}
            rows={tickets}
            keyExtractor={(r) => r.id}
          />
        </div>
      )}
    </div>
  );
}

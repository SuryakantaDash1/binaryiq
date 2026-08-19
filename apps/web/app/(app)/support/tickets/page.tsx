'use client';

import { Badge, EmptyState, Heading, Skeleton, Text } from '@influencer/ui';
import { useEffect, useState } from 'react';

import { supportApi, type TicketStatus, type TicketSummary } from '@/lib/api/support.js';

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

function statusLabel(status: TicketStatus): string {
  switch (status) {
    case 'OPEN':
      return 'Open';
    case 'PENDING':
      return 'Pending';
    case 'RESOLVED':
      return 'Resolved';
    case 'CLOSED':
      return 'Closed';
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function SupportTicketsPage(): React.JSX.Element {
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supportApi
      .listMyTickets({ limit: 50 })
      .then((r) => setTickets(r.items))
      .catch(() => setError('Failed to load your tickets. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <Heading level={2}>My Support Tickets</Heading>
        <Text color="secondary" size="sm">
          View and track all your support requests.
        </Text>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState
          title="No support tickets yet"
          description="Use the Luna chat widget to raise a ticket whenever you need help."
        />
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="rounded-xl border border-border bg-surface p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-text truncate">
                    {ticket.subject ?? ticket.issueType}
                  </p>
                  <p className="text-xs text-text/60 mt-0.5">
                    {ticket.issueType} &middot; {ticket.messageCount} message
                    {ticket.messageCount !== 1 ? 's' : ''} &middot; Updated{' '}
                    {formatDate(ticket.updatedAt)}
                  </p>
                </div>
                <Badge variant={statusVariant(ticket.status)}>
                  {statusLabel(ticket.status)}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

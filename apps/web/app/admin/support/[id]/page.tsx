'use client';

import { Badge, Button, Heading, Select, Skeleton, Text } from '@influencer/ui';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';


import { ApiError } from '@/lib/api/client.js';
import {
  supportApi,
  type AdminTicketDetail,
  type TicketMessage,
  type TicketStatus,
} from '@/lib/api/support.js';

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function MessageBubble({ msg, username }: { msg: TicketMessage; username: string }): React.JSX.Element {
  const isUser = msg.senderType === 'user';
  const isAdmin = msg.senderType === 'admin';
  const isBot = msg.senderType === 'bot';

  let bubbleCls = 'bg-neutral-100 text-neutral-800'; // bot
  let alignCls = 'justify-start';
  let labelCls = 'text-neutral-500';
  let label = 'Bot';

  if (isUser) {
    bubbleCls = 'bg-blue-100 text-blue-900';
    alignCls = 'justify-end';
    labelCls = 'text-blue-500 text-right';
    label = username;
  } else if (isAdmin) {
    bubbleCls = 'bg-green-100 text-green-900';
    alignCls = 'justify-start';
    labelCls = 'text-green-600';
    label = 'Admin';
  } else if (isBot) {
    label = 'Byte (bot)';
  }

  return (
    <div className={`flex flex-col gap-0.5 ${isUser ? 'items-end' : 'items-start'}`}>
      <span className={`text-xs font-medium ${labelCls}`}>{label}</span>
      <div className={`flex ${alignCls}`}>
        <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${bubbleCls}`}>
          {msg.message}
        </div>
      </div>
      <span className="text-xs text-text/40">{formatDateTime(msg.createdAt)}</span>
    </div>
  );
}

export default function AdminTicketDetailPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [ticket, setTicket] = useState<AdminTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status update
  const [statusValue, setStatusValue] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Reply
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const threadBottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    supportApi
      .adminGetTicket(id)
      .then((t) => {
        setTicket(t);
        setStatusValue(t.status);
      })
      .catch(() => setError('Failed to load ticket.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Scroll to bottom of thread when messages change
  useEffect(() => {
    threadBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages.length]);

  async function handleStatusChange(newStatus: string) {
    if (!ticket || newStatus === ticket.status) return;
    setStatusSaving(true);
    setStatusError(null);
    try {
      const updated = await supportApi.adminUpdateTicket(id, { status: newStatus });
      setTicket((prev) => (prev ? { ...prev, status: updated.status } : prev));
      setStatusValue(updated.status);
    } catch (err) {
      setStatusError(err instanceof ApiError ? err.message : 'Failed to update status.');
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleReply() {
    if (!replyText.trim()) return;
    setReplying(true);
    setReplyError(null);
    try {
      const msg = await supportApi.adminAddMessage(id, replyText.trim());
      setTicket((prev) =>
        prev
          ? {
              ...prev,
              messages: [...prev.messages, msg],
              messageCount: prev.messageCount + 1,
              updatedAt: msg.createdAt,
            }
          : prev,
      );
      setReplyText('');
    } catch (err) {
      setReplyError(err instanceof ApiError ? err.message : 'Failed to send reply.');
    } finally {
      setReplying(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
          {error ?? 'Ticket not found.'}
        </div>
        <button
          type="button"
          onClick={() => router.push('/admin/support')}
          className="text-sm text-primary hover:underline"
        >
          Back to tickets
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-text/60">
        <button
          type="button"
          onClick={() => router.push('/admin/support')}
          className="hover:text-text transition-colors"
        >
          Support Tickets
        </button>
        <span>/</span>
        <span className="text-text font-medium">{ticket.id}</span>
      </div>

      {/* Ticket info card */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Heading level={3}>{ticket.subject ?? ticket.issueType}</Heading>
            <Text color="secondary" size="sm" className="mt-1">
              {ticket.userEmail} &middot; @{ticket.username}
            </Text>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="default">{ticket.issueType}</Badge>
            <Badge variant={statusVariant(ticket.status as TicketStatus)}>
              {ticket.status}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-text/60 text-xs font-medium uppercase tracking-wide">Created</p>
            <p className="text-text mt-0.5">{formatDateTime(ticket.createdAt)}</p>
          </div>
          <div>
            <p className="text-text/60 text-xs font-medium uppercase tracking-wide">Updated</p>
            <p className="text-text mt-0.5">{formatDateTime(ticket.updatedAt)}</p>
          </div>
          <div>
            <p className="text-text/60 text-xs font-medium uppercase tracking-wide">Messages</p>
            <p className="text-text mt-0.5">{ticket.messageCount}</p>
          </div>
        </div>

        {/* Status update */}
        <div className="border-t border-border pt-4">
          <p className="text-xs font-medium text-text/60 uppercase tracking-wide mb-2">
            Update Status
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-48">
              <Select
                options={STATUS_OPTIONS}
                value={statusValue}
                onChange={(e) => setStatusValue(e.target.value)}
                disabled={statusSaving}
                aria-label="Ticket status"
              />
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void handleStatusChange(statusValue)}
              disabled={statusSaving || statusValue === ticket.status}
              loading={statusSaving}
            >
              Save
            </Button>
          </div>
          {statusError && (
            <p className="text-xs text-red-600 mt-1">{statusError}</p>
          )}
        </div>
      </div>

      {/* Message thread */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <p className="font-medium text-sm text-text">Message Thread</p>
        </div>
        <div className="p-5 space-y-4">
          {ticket.messages.length === 0 ? (
            <p className="text-sm text-text/60 text-center py-6">No messages yet.</p>
          ) : (
            ticket.messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} username={`@${ticket.username}`} />
            ))
          )}
          <div ref={threadBottomRef} />
        </div>

        {/* Reply form */}
        <div className="border-t border-border p-4 space-y-3">
          <p className="text-xs font-medium text-text/60 uppercase tracking-wide">Admin Reply</p>
          {replyError && (
            <p className="text-xs text-red-600">{replyError}</p>
          )}
          <textarea
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text/40 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            rows={3}
            placeholder="Type your reply…"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            maxLength={4000}
            disabled={replying}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => void handleReply()}
              disabled={!replyText.trim() || replying}
              loading={replying}
            >
              {replying ? 'Sending…' : 'Send Reply'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

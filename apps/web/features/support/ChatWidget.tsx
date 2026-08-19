'use client';

import { Button, Skeleton } from '@influencer/ui';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';

import { ApiError } from '@/lib/api/client.js';
import {
  supportApi,
  type ChatbotFlow,
  type FlowNode,
  type TicketSummary,
  type TranscriptLine,
} from '@/lib/api/support.js';

type EscalationStep = null | 'prompt' | 'compose' | 'resolved' | 'done';

export function ChatWidget(): React.JSX.Element {
  const [panelOpen, setPanelOpen] = useState(false);
  const [flows, setFlows] = useState<ChatbotFlow[]>([]);
  const [view, setView] = useState<'topics' | 'chat' | 'tickets'>('topics');
  const [currentTopic, setCurrentTopic] = useState<ChatbotFlow | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [escalationStep, setEscalationStep] = useState<EscalationStep>(null);
  const [escalationMessage, setEscalationMessage] = useState('');
  const [ticketCreated, setTicketCreated] = useState<{ id: string; subject: string | null } | null>(null);
  const [escalating, setEscalating] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [myTickets, setMyTickets] = useState<TicketSummary[] | null>(null);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  // Load flows once on mount
  useEffect(() => {
    supportApi.listFlows().then(setFlows).catch(() => void 0);
  }, []);

  function resetChat() {
    setView('topics');
    setCurrentTopic(null);
    setCurrentNodeId(null);
    setTranscript([]);
    setEscalationStep(null);
    setEscalationMessage('');
    setTicketCreated(null);
    setTicketError(null);
  }

  const openPanel = useCallback(() => {
    setPanelOpen(true);
    resetChat();
  }, []);

  function selectTopic(flow: ChatbotFlow) {
    const entryNode = flow.nodes[flow.entryNodeId];
    setCurrentTopic(flow);
    setCurrentNodeId(flow.entryNodeId);
    setTranscript([{ senderType: 'bot', message: entryNode?.message ?? '' }]);
    setView('chat');
    setEscalationStep(null);
    setTicketCreated(null);
    setTicketError(null);
  }

  function handleOption(option: { label: string; next: string }) {
    if (!currentTopic || !currentNodeId) return;
    const nextNode: FlowNode | undefined = currentTopic.nodes[option.next];
    if (!nextNode) return;

    const newTranscript: TranscriptLine[] = [
      ...transcript,
      { senderType: 'user', message: option.label },
      { senderType: 'bot', message: nextNode.message },
    ];
    setTranscript(newTranscript);
    setCurrentNodeId(option.next);

    // Leaf node detection: resolution, escalate, suppressEscalation, or navigate action
    if (nextNode.suppressEscalation || nextNode.action) {
      // No escalation prompt for navigate/suppressed nodes
      setEscalationStep(null);
    } else if (nextNode.resolution || nextNode.escalate) {
      setEscalationStep('prompt');
    }
  }

  async function handleEscalate() {
    if (!currentTopic || !escalationMessage.trim()) return;
    setEscalating(true);
    setTicketError(null);
    try {
      const ticket = await supportApi.createTicket({
        topic: currentTopic.topic,
        subject: currentTopic.title,
        transcript,
        message: escalationMessage.trim(),
      });
      setTicketCreated({ id: ticket.id, subject: ticket.subject });
      setEscalationStep('done');
    } catch (err) {
      setTicketError(err instanceof ApiError ? err.message : 'Failed to raise ticket. Please try again.');
    } finally {
      setEscalating(false);
    }
  }

  function loadMyTickets() {
    setView('tickets');
    setTicketsLoading(true);
    supportApi
      .listMyTickets({ limit: 20 })
      .then((r) => setMyTickets(r.items))
      .catch(() => setMyTickets([]))
      .finally(() => setTicketsLoading(false));
  }

  const currentNode: FlowNode | null =
    currentTopic && currentNodeId ? (currentTopic.nodes[currentNodeId] ?? null) : null;

  // Determine whether to show option buttons
  // Show options only when there are options, no escalation step set, and no ticket yet
  const showOptions =
    currentNode?.options &&
    currentNode.options.length > 0 &&
    escalationStep === null &&
    escalationStep !== 'done';

  if (!panelOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          type="button"
          onClick={openPanel}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 text-2xl"
          aria-label="Open Luna support chat"
        >
          💬
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col" style={{ width: 360 }}>
      {/* Chat panel */}
      <div
        className="rounded-2xl border border-border bg-surface shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: 520 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-primary px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">💬</span>
            <span className="font-semibold text-white text-sm">Luna</span>
          </div>
          <div className="flex items-center gap-2">
            {view !== 'topics' && (
              <button
                type="button"
                onClick={resetChat}
                className="text-white/80 hover:text-white text-xs"
              >
                Back
              </button>
            )}
            {view === 'topics' && (
              <button
                type="button"
                onClick={loadMyTickets}
                className="text-white/80 hover:text-white text-xs"
              >
                My tickets
              </button>
            )}
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="ml-2 text-white/80 hover:text-white text-lg leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3" aria-live="polite">
          {/* ── Topics view ── */}
          {view === 'topics' && (
            <>
              <p className="text-sm text-text">Hi! I am Luna 👋 How can I help you today?</p>
              {flows.length === 0 ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-9" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {flows.map((f) => (
                    <button
                      key={f.topic}
                      type="button"
                      onClick={() => selectTopic(f)}
                      className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-left text-sm text-text hover:border-primary hover:text-primary transition-colors"
                    >
                      {f.icon && <span className="mr-2">{f.icon}</span>}
                      {f.title}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Chat view ── */}
          {view === 'chat' && (
            <>
              {/* Transcript bubbles */}
              {transcript.map((line, i) => (
                <div
                  key={i}
                  className={`flex ${line.senderType === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      line.senderType === 'user'
                        ? 'bg-primary text-white'
                        : 'bg-surface-alt text-text'
                    }`}
                  >
                    {line.message}
                  </div>
                </div>
              ))}

              {/* Option buttons — visible when there are options and no escalation/done state */}
              {showOptions && (
                <div className="space-y-2 pt-1">
                  {currentNode!.options!.map((opt) => (
                    <button
                      key={opt.next}
                      type="button"
                      onClick={() => handleOption(opt)}
                      className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-left text-sm text-text hover:border-primary hover:text-primary transition-colors"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Navigate action node — show link button, no escalation */}
              {currentNode?.action?.type === 'navigate' && escalationStep !== 'done' && (
                <div className="pt-1">
                  <Link
                    href={currentNode.action.href}
                    className="block w-full rounded-lg border border-primary bg-primary/10 px-3 py-2 text-left text-sm text-primary hover:bg-primary/20 transition-colors"
                  >
                    Go to account settings →
                  </Link>
                </div>
              )}

              {/* ── Escalation: prompt step ── */}
              {escalationStep === 'prompt' && (
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEscalationStep('resolved')}
                    className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-left text-sm text-text hover:border-primary hover:text-primary transition-colors"
                  >
                    You have answered my query, thank you
                  </button>
                  <button
                    type="button"
                    onClick={() => setEscalationStep('compose')}
                    className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-left text-sm text-text hover:border-primary hover:text-primary transition-colors"
                  >
                    I did not get a response. Let us raise a support ticket.
                  </button>
                </div>
              )}

              {/* ── Escalation: compose step ── */}
              {escalationStep === 'compose' && (
                <div className="space-y-2 pt-2">
                  {ticketError && (
                    <p className="text-xs text-red-600">{ticketError}</p>
                  )}
                  <textarea
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text/40 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                    rows={3}
                    placeholder="Describe your issue…"
                    value={escalationMessage}
                    onChange={(e) => setEscalationMessage(e.target.value)}
                    maxLength={4000}
                  />
                  <Button
                    size="sm"
                    fullWidth
                    onClick={() => void handleEscalate()}
                    disabled={!escalationMessage.trim() || escalating}
                    loading={escalating}
                  >
                    {escalating ? 'Raising ticket…' : 'Raise support ticket'}
                  </Button>
                </div>
              )}

              {/* ── Escalation: resolved step ── */}
              {escalationStep === 'resolved' && (
                <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 text-center">
                  <p>Happy to help! You are welcome 😊</p>
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={resetChat}
                      className="text-xs text-primary hover:underline"
                    >
                      Back to topics
                    </button>
                  </div>
                </div>
              )}

              {/* ── Escalation: done (ticket created) ── */}
              {escalationStep === 'done' && ticketCreated && (
                <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                  <p className="font-medium">Ticket raised</p>
                  <p className="text-xs mt-1">
                    We will get back to you soon. Ticket ID: {ticketCreated.id.slice(0, 8)}…
                  </p>
                  <div className="mt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={loadMyTickets}
                      className="text-xs text-primary hover:underline"
                    >
                      View my tickets
                    </button>
                    <button
                      type="button"
                      onClick={resetChat}
                      className="text-xs text-text/60 hover:underline"
                    >
                      Back to topics
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── My Tickets view ── */}
          {view === 'tickets' && (
            <>
              <p className="text-sm font-medium text-text">Your support tickets</p>
              {ticketsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : !myTickets || myTickets.length === 0 ? (
                <p className="text-sm text-text/60 text-center py-4">No tickets yet.</p>
              ) : (
                <div className="space-y-2">
                  {myTickets.map((t) => (
                    <div key={t.id} className="rounded-lg border border-border bg-surface-alt p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-text truncate">
                          {t.subject ?? t.issueType}
                        </p>
                        <StatusBadge status={t.status} />
                      </div>
                      <p className="text-xs text-text/60 mt-1">
                        {t.messageCount} message{t.messageCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Floating toggle button (visible below the panel) */}
      <div className="flex justify-end mt-2">
        <button
          type="button"
          onClick={() => setPanelOpen(false)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 focus:outline-none text-2xl"
          aria-label="Close Luna support chat"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }): React.JSX.Element {
  const map: Record<string, { label: string; cls: string }> = {
    OPEN: { label: 'Open', cls: 'bg-blue-100 text-blue-700' },
    PENDING: { label: 'Pending', cls: 'bg-yellow-100 text-yellow-700' },
    RESOLVED: { label: 'Resolved', cls: 'bg-green-100 text-green-700' },
    CLOSED: { label: 'Closed', cls: 'bg-neutral-100 text-neutral-500' },
  };
  const m = map[status] ?? { label: status, cls: 'bg-neutral-100 text-neutral-500' };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${m.cls}`}
    >
      {m.label}
    </span>
  );
}

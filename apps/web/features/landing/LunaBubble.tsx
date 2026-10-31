'use client';

import { Skeleton } from '@binaryiq/ui';
import { ArrowRight, Brain, ChevronDown, ChevronLeft, ChevronRight, SendHorizontal, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { POINTS_ENABLED } from '@/features/flags';
import { ApiError } from '@/lib/api/client.js';
import { supportApi } from '@/lib/api/support.js';

import { LUNA_FLOWS } from './luna-flows.js';

type Line = { from: 'bot' | 'user'; text: string; time?: string };
type Option = { label: string; next: string };
type Stage = 'greeting' | 'topics' | 'options' | 'escalation' | 'compose' | 'ticketDone' | 'done';

/** Minimal shape shared by the local LUNA_FLOWS and the backend's ChatbotFlow — lets
 *  the same conversation engine walk either source without caring which one it is. */
interface ChatFlowNode {
  id: string;
  message: string;
  options?: Option[];
  resolution?: boolean;
  escalate?: boolean;
  suppressEscalation?: boolean;
  action?: { type: 'navigate'; href: string };
}
interface ChatFlow {
  topic: string;
  issueType: string;
  title: string;
  entryNodeId: string;
  nodes: Record<string, ChatFlowNode>;
}

/** Help topics about points and payouts, hidden while reward points are switched off. */
const POINTS_TOPICS = new Set(['SURVEY_PAYMENT', 'REWARDS']);
function visibleFlows<T extends { topic: string }>(all: T[]): T[] {
  return POINTS_ENABLED ? all : all.filter((f) => !POINTS_TOPICS.has(f.topic));
}

const TEASER_KEY = 'byte-teaser-seen';

function nowTime(): string {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * The "Byte" chat bubble — the single chat widget used across the whole site.
 * On public pages it runs a self-contained Q&A flow (no backend) and escalates
 * to the contact form. When `authenticated`, it instead loads the real chatbot
 * flows from the backend and "raise a ticket" actually creates a SupportTicket.
 */
export function LunaBubble({
  authenticated = false,
  showTeaser = true,
}: {
  authenticated?: boolean;
  /** The intro bubble; off on pages where it would cover a form. */
  showTeaser?: boolean;
}): React.JSX.Element {
  const t = useTranslations('chat');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [stage, setStage] = useState<Stage>('greeting');
  const [transcript, setTranscript] = useState<Line[]>([]);
  const [flow, setFlow] = useState<ChatFlow | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [flows, setFlows] = useState<ChatFlow[]>(authenticated ? [] : visibleFlows(LUNA_FLOWS));
  const [flowsLoading, setFlowsLoading] = useState(authenticated);
  const [ticketMessage, setTicketMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authenticated) return;
    supportApi
      .listFlows()
      .then((all) => setFlows(visibleFlows(all)))
      .catch(() => void 0)
      .finally(() => setFlowsLoading(false));
  }, [authenticated]);

  const canSend = message.trim().length > 0;

  // Introduce Byte by name once per browser session, shortly after the page settles.
  const [teaser, setTeaser] = useState(false);
  useEffect(() => {
    if (!showTeaser) return;
    try {
      if (sessionStorage.getItem(TEASER_KEY) === '1') return;
    } catch {
      /* storage blocked — still show it */
    }
    const show = setTimeout(() => setTeaser(true), 1500);
    const hide = setTimeout(dismissTeaser, 12000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, []);

  function dismissTeaser(): void {
    setTeaser(false);
    try {
      sessionStorage.setItem(TEASER_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  function openChat(): void {
    dismissTeaser();
    setOpen(true);
  }

  function scrollToBottom(): void {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  }

  function startQA(): void {
    setStage('topics');
    setFlow(null);
    setOptions([]);
    setTranscript([{ from: 'bot', text: t('qaGreeting'), time: nowTime() }]);
    scrollToBottom();
  }

  function pickTopic(f: ChatFlow): void {
    const root = f.nodes[f.entryNodeId];
    if (!root) return;
    setFlow(f);
    setTranscript((prev) => [
      ...prev,
      { from: 'user', text: f.title, time: nowTime() },
      { from: 'bot', text: root.message, time: nowTime() },
    ]);
    setOptions(root.options ?? []);
    setStage('options');
    scrollToBottom();
  }

  function pickOption(opt: Option): void {
    if (!flow) return;
    const node = flow.nodes[opt.next];
    if (!node) return;
    setTranscript((prev) => [
      ...prev,
      { from: 'user', text: opt.label, time: nowTime() },
      { from: 'bot', text: node.message, time: nowTime() },
    ]);
    if (node.options && node.options.length > 0) {
      setOptions(node.options);
      setStage('options');
    } else {
      setOptions([]);
      setStage('escalation');
    }
    scrollToBottom();
  }

  function resolveThanks(): void {
    setTranscript((prev) => [...prev, { from: 'bot', text: t('thankYouMsg'), time: nowTime() }]);
    setStage('done');
    scrollToBottom();
  }

  function raiseTicket(): void {
    if (authenticated) {
      setTicketMessage('');
      setSubmitError(null);
      setStage('compose');
      scrollToBottom();
      return;
    }
    const issue = flow?.issueType ?? 'OTHER';
    router.push(`/contact?issue=${issue}`);
  }

  async function submitTicket(): Promise<void> {
    if (!flow || !ticketMessage.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const ticket = await supportApi.createTicket({
        topic: flow.topic,
        subject: flow.title,
        transcript: transcript.slice(-50).map((l) => ({ senderType: l.from, message: l.text })),
        message: ticketMessage.trim(),
      });
      setTranscript((prev) => [
        ...prev,
        {
          from: 'bot',
          text: `Ticket raised — we'll get back to you soon. Ticket ID: ${ticket.id.slice(0, 8)}…`,
          time: nowTime(),
        },
      ]);
      setStage('ticketDone');
      scrollToBottom();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Failed to raise ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleSend(): void {
    if (!canSend) return;
    if (stage === 'greeting') startQA();
    setMessage('');
    inputRef.current?.focus();
  }

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <div
          role="dialog"
          aria-label="Byte"
          className="flex h-[520px] max-h-[calc(100vh-6.5rem)] w-[360px] max-w-[calc(100vw-2rem)] origin-bottom-right flex-col overflow-hidden rounded-[26px] bg-white shadow-2xl shadow-brand-950/25 ring-1 ring-black/5 motion-safe:animate-pop-in"
        >
          {/* Header — who you're talking to */}
          <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-brand-600 via-brand-800 to-brand-950 px-5 py-4 text-white">
            <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex items-center gap-3">
              <ByteAvatar size="md" online />
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold leading-tight">Byte</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/70">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {t('assistantRole')} · {t('online')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('closeChat')}
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white"
              >
                <ChevronDown className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-gray-50/80 px-4 py-4">
            {stage === 'greeting' ? (
              /* Welcome */
              <div className="flex flex-col items-center px-3 pt-6 text-center motion-safe:animate-fade-up">
                <ByteAvatar size="lg" tone="brand" />
                <p className="mt-4 text-lg font-black text-ink">
                  {t('hello')}{' '}
                  <span className="inline-block origin-[70%_70%] motion-safe:animate-wave">👋</span>
                </p>
                <p className="text-sm font-semibold text-gray-800">{t('howCanWeHelp')}</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{t('lunaIntro')}</p>
                <button
                  type="button"
                  onClick={startQA}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-brand-900 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-700/25 transition hover:brightness-110 active:scale-[0.98]"
                >
                  {t('askQuestion')}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                {transcript.map((line, i) =>
                  line.from === 'bot' ? (
                    <div key={i} className="flex items-end gap-2 motion-safe:animate-fade-up">
                      <ByteAvatar size="sm" />
                      <div className="max-w-[80%]">
                        <div className="whitespace-pre-line rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm leading-relaxed text-gray-700 shadow-sm ring-1 ring-black/5">
                          {line.text}
                        </div>
                        {line.time && <p className="mt-1 pl-1 text-[10px] text-gray-400">Byte · {line.time}</p>}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="flex flex-col items-end motion-safe:animate-fade-up">
                      <div className="max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-brand-600 to-brand-900 px-3.5 py-2.5 text-sm leading-relaxed text-white shadow-sm">
                        {line.text}
                      </div>
                      {line.time && <p className="mt-1 pr-1 text-[10px] text-gray-400">{line.time}</p>}
                    </div>
                  ),
                )}

                {/* Topic buttons */}
                {stage === 'topics' && (
                  <div className="space-y-2 pl-9 pt-1">
                    {flowsLoading && flows.length === 0 ? (
                      <>
                        <Skeleton className="h-10 rounded-xl" />
                        <Skeleton className="h-10 rounded-xl" />
                        <Skeleton className="h-10 rounded-xl" />
                      </>
                    ) : (
                      flows.map((f) => (
                        <button key={f.topic} type="button" onClick={() => pickTopic(f)} className={CHOICE}>
                          {f.title}
                          <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Node option buttons */}
                {stage === 'options' && (
                  <div className="space-y-2 pl-9 pt-1">
                    {options.map((o) => (
                      <button key={o.next} type="button" onClick={() => pickOption(o)} className={CHOICE}>
                        {o.label}
                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Escalation buttons */}
                {stage === 'escalation' && (
                  <div className="space-y-2 pl-9 pt-1">
                    <button type="button" onClick={resolveThanks} className={CHOICE}>
                      {t('resolvedOption')}
                    </button>
                    <button type="button" onClick={raiseTicket} className={CHOICE}>
                      {t('escalateOption')}
                    </button>
                  </div>
                )}

                {/* Compose a ticket (authenticated only) */}
                {stage === 'compose' && (
                  <div className="space-y-2 pl-9 pt-1">
                    {submitError && <p className="text-xs text-red-600">{submitError}</p>}
                    <textarea
                      value={ticketMessage}
                      onChange={(e) => setTicketMessage(e.target.value)}
                      rows={3}
                      maxLength={4000}
                      placeholder="Describe your issue…"
                      className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
                    />
                    <button
                      type="button"
                      onClick={() => void submitTicket()}
                      disabled={!ticketMessage.trim() || submitting}
                      className="w-full rounded-full bg-gradient-to-r from-brand-600 to-brand-900 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting ? 'Raising ticket…' : 'Raise support ticket'}
                    </button>
                  </div>
                )}

                {/* Done — restart */}
                {(stage === 'done' || stage === 'ticketDone') && (
                  <div className="pl-9 pt-1">
                    <button
                      type="button"
                      onClick={startQA}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      {t('backToTopics')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Message input */}
          <div className="shrink-0 border-t border-gray-100 bg-white p-3">
            <div className="flex items-center gap-2 rounded-full bg-gray-100 py-1.5 pl-4 pr-1.5 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-500/25">
              <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSend();
                }}
                placeholder={t('writeMessage')}
                className="min-w-0 flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                aria-label={t('askQuestion')}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
                  canSend
                    ? 'bg-gradient-to-br from-brand-600 to-brand-900 text-white shadow-md active:scale-90'
                    : 'cursor-not-allowed bg-gray-200 text-gray-400'
                }`}
              >
                <SendHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Intro teaser — introduces Byte by name before the first click (once per session) */}
      {!open && teaser && (
        <div className="relative max-w-[260px] origin-bottom-right motion-safe:animate-pop-in">
          <button
            type="button"
            onClick={openChat}
            className="flex items-start gap-3 rounded-2xl rounded-br-md bg-white p-3.5 pr-8 text-left shadow-xl shadow-brand-950/15 ring-1 ring-black/5 transition hover:-translate-y-0.5"
          >
            <ByteAvatar size="sm" tone="brand" />
            <span className="leading-snug">
              <span className="block text-sm font-bold text-ink">
                {t('teaserTitle')}{' '}
                <span className="inline-block origin-[70%_70%] motion-safe:animate-wave">👋</span>
              </span>
              <span className="mt-0.5 block text-xs text-gray-500">{t('teaserText')}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={dismissTeaser}
            aria-label={t('dismiss')}
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Floating toggle */}
      <button
        type="button"
        onClick={open ? () => setOpen(false) : openChat}
        aria-label={open ? t('closeChat') : t('openChat')}
        className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-900 text-white shadow-lg shadow-brand-700/35 transition hover:scale-105 active:scale-95"
      >
        {!open && (
          <>
            <span className="absolute inset-0 rounded-full bg-brand-500/30 motion-safe:animate-ping" style={{ animationDuration: '2.5s' }} />
            <span className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-white" />
            {!teaser && (
              <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                {t('chatWithByte')}
              </span>
            )}
          </>
        )}
        <span className="relative">
          {open ? <ChevronDown className="h-6 w-6" /> : <Brain className="h-7 w-7 motion-safe:group-hover:animate-wave" />}
        </span>
      </button>
    </div>
  );
}

const CHOICE =
  'flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-left text-sm font-medium text-gray-800 shadow-sm transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-800 active:scale-[0.98]';

/** Byte's avatar: white disc with the brand brain (on gradients) or a gradient disc (on light surfaces). */
function ByteAvatar({
  size,
  tone = 'light',
  online = false,
}: {
  size: 'sm' | 'md' | 'lg';
  tone?: 'light' | 'brand';
  online?: boolean;
}): React.JSX.Element {
  const box = { sm: 'h-7 w-7', md: 'h-10 w-10', lg: 'h-16 w-16' }[size];
  const icon = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-8 w-8' }[size];
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center rounded-full ${box} ${
        tone === 'brand'
          ? 'bg-gradient-to-br from-brand-500 to-brand-900 text-white shadow-lg shadow-brand-700/25'
          : 'bg-white text-brand-700 shadow-sm ring-1 ring-black/5'
      }`}
    >
      <Brain className={icon} />
      {online && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-brand-800" />}
    </span>
  );
}

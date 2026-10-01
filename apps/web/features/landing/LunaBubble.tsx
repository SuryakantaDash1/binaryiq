'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { LUNA_FLOWS, type LunaFlow } from './luna-flows.js';

type Line = { from: 'bot' | 'user'; text: string; time?: string };
type Option = { label: string; next: string };
type Stage = 'greeting' | 'topics' | 'options' | 'escalation' | 'done';

function nowTime(): string {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Self-contained "Luna" chat for the public landing page — a full Q&A flow that
 * needs no backend. Topics → answers → escalate to the contact form.
 */
export function LunaBubble(): React.JSX.Element {
  const t = useTranslations('chat');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [stage, setStage] = useState<Stage>('greeting');
  const [transcript, setTranscript] = useState<Line[]>([]);
  const [flow, setFlow] = useState<LunaFlow | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const bubbleShape = { borderRadius: '50% 50% 50% 14%' };
  const canSend = message.trim().length > 0;

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

  function pickTopic(f: LunaFlow): void {
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
    const issue = flow?.issueType ?? 'OTHER';
    router.push(`/contact?issue=${issue}`);
  }

  function handleSend(): void {
    if (!canSend) return;
    if (stage === 'greeting') startQA();
    setMessage('');
    inputRef.current?.focus();
  }

  return (
    <div
      style={{ position: 'fixed', right: '24px', bottom: '24px', zIndex: 60 }}
      className="flex flex-col items-end gap-3"
    >
      {open && (
        <div className="flex h-[560px] max-h-[calc(100vh-7rem)] w-[380px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5">
          {/* Gradient header */}
          <div className="shrink-0 bg-gradient-to-r from-brand-700 via-brand-800 to-brand-900 px-6 pb-14 pt-6 text-white">
            <p className="text-xl font-medium">
              {t('hello')} <span className="inline-block">👋</span>
            </p>
            <p className="mt-1 text-2xl font-bold leading-snug">{t('howCanWeHelp')}</p>
          </div>

          {stage === 'greeting' ? (
            /* Intro card — greeting state */
            <div className="relative z-10 -mt-10 shrink-0 px-5">
              <div className="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-black/5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-amber-300 text-xl">
                    😊
                  </div>
                  <p className="text-sm leading-relaxed text-gray-700">{t('lunaIntro')}</p>
                </div>
                <button
                  type="button"
                  onClick={startQA}
                  className="mt-4 w-full rounded-full bg-brand-800 py-3 text-sm font-semibold text-white transition hover:bg-brand-900 active:scale-95"
                >
                  {t('askQuestion')}
                </button>
              </div>
            </div>
          ) : (
            /* Conversation view */
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-4 py-4">
              {transcript.map((line, i) =>
                line.from === 'bot' ? (
                  <div key={i} className="flex items-end gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-amber-300 text-base">
                      😊
                    </div>
                    <div className="max-w-[78%]">
                      <div className="whitespace-pre-line rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm text-gray-700 shadow-sm ring-1 ring-black/5">
                        {line.text}
                      </div>
                      {line.time && <p className="mt-0.5 pl-1 text-[10px] text-gray-400">{line.time}</p>}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex flex-col items-end">
                    <div className="max-w-[78%] rounded-2xl rounded-br-sm bg-brand-800 px-3 py-2 text-sm text-white shadow-sm">
                      {line.text}
                    </div>
                    {line.time && <p className="mt-0.5 pr-1 text-[10px] text-gray-400">{line.time}</p>}
                  </div>
                ),
              )}

              {/* Topic buttons */}
              {stage === 'topics' && (
                <div className="space-y-2 pt-1">
                  {LUNA_FLOWS.map((f) => (
                    <button
                      key={f.topic}
                      type="button"
                      onClick={() => pickTopic(f)}
                      className="w-full rounded-full border border-brand-600 bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 transition hover:bg-brand-50 active:scale-95"
                    >
                      {f.title}
                    </button>
                  ))}
                </div>
              )}

              {/* Node option buttons */}
              {stage === 'options' && (
                <div className="space-y-2 pt-1">
                  {options.map((o) => (
                    <button
                      key={o.next}
                      type="button"
                      onClick={() => pickOption(o)}
                      className="w-full rounded-full border border-brand-600 bg-white px-4 py-2.5 text-left text-sm font-medium text-brand-800 transition hover:bg-brand-50 active:scale-95"
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Escalation buttons */}
              {stage === 'escalation' && (
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={resolveThanks}
                    className="w-full rounded-full border border-brand-600 bg-white px-4 py-2.5 text-sm font-medium text-brand-800 transition hover:bg-brand-50 active:scale-95"
                  >
                    {t('resolvedOption')}
                  </button>
                  <button
                    type="button"
                    onClick={raiseTicket}
                    className="w-full rounded-full border border-brand-600 bg-white px-4 py-2.5 text-sm font-medium text-brand-800 transition hover:bg-brand-50 active:scale-95"
                  >
                    {t('escalateOption')}
                  </button>
                </div>
              )}

              {/* Done — restart */}
              {stage === 'done' && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={startQA}
                    className="text-xs font-medium text-brand-800 hover:underline"
                  >
                    ← {t('backToTopics')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Message input */}
          <div className="flex shrink-0 items-center gap-2 border-t border-gray-100 bg-white px-5 py-3">
            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              placeholder={t('writeMessage')}
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              aria-label={t('askQuestion')}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${
                canSend
                  ? 'bg-brand-800 text-white shadow-md hover:bg-brand-900 active:scale-90'
                  : 'cursor-not-allowed bg-gray-100 text-gray-300'
              }`}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating toggle button */}
      {open ? (
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t('closeChat')}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-800 text-white shadow-xl transition hover:scale-105 hover:bg-brand-900 active:scale-95"
        >
          <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('openChat')}
          style={bubbleShape}
          className="relative flex h-[84px] w-[84px] items-center justify-center bg-gradient-to-br from-brand-700 to-brand-900 shadow-xl transition hover:scale-105 active:scale-95"
        >
          <span style={bubbleShape} className="absolute inset-0 animate-ping bg-brand-500/20" />
          <span className="relative flex h-[58px] w-[58px] items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-amber-200 text-[38px] leading-none shadow-inner">
            😊
          </span>
        </button>
      )}
    </div>
  );
}

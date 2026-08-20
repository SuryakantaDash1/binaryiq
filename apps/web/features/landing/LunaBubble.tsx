'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Self-contained "Luna" chat bubble for the public landing page.
 * Needs no backend — a floating avatar that opens a greeting + "Ask a question".
 * Pinned bottom-right.
 */
export function LunaBubble(): React.JSX.Element {
  const t = useTranslations('chat');
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Speech-bubble shape: rounded on 3 corners, tail on the bottom-left.
  const bubbleShape = { borderRadius: '50% 50% 50% 14%' };
  const canSend = message.trim().length > 0;

  function handleSend(): void {
    if (!canSend) return;
    // Landing chat is decorative — echo the message into the field being cleared.
    setMessage('');
    inputRef.current?.focus();
  }

  return (
    <div
      style={{ position: 'fixed', right: '24px', bottom: '24px', zIndex: 60 }}
      className="flex flex-col items-end gap-3"
    >
      {/* Panel — opens upward, anchored bottom-right */}
      {open && (
        <div className="flex h-[560px] max-h-[calc(100vh-7rem)] w-[380px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5">
          {/* Gradient header (blue → purple → pink) */}
          <div className="shrink-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 px-6 pb-14 pt-6 text-white">
            <p className="text-xl font-medium">
              {t('hello')} <span className="inline-block">👋</span>
            </p>
            <p className="mt-1 text-2xl font-bold leading-snug">{t('howCanWeHelp')}</p>
          </div>

          {/* Intro card — overlaps the header, OUTSIDE the scroll area so it never clips */}
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
                onClick={() => inputRef.current?.focus()}
                className="mt-4 w-full rounded-full bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-95"
              >
                {t('askQuestion')}
              </button>
            </div>
          </div>

          {/* Conversation space (scrollable) */}
          <div className="flex-1 overflow-y-auto bg-gray-50" />

          {/* Message input, pinned to the bottom */}
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
                  ? 'bg-pink-600 text-white shadow-md hover:bg-pink-700 active:scale-90'
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
        // When open: solid blue circle with a down-chevron (minimize)
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t('closeChat')}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl transition hover:scale-105 hover:bg-blue-700 active:scale-95"
        >
          <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      ) : (
        // When closed: royal-blue speech bubble with a big smiling face
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('openChat')}
          style={bubbleShape}
          className="relative flex h-[84px] w-[84px] items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 shadow-xl transition hover:scale-105 active:scale-95"
        >
          <span style={bubbleShape} className="absolute inset-0 animate-ping bg-blue-500/20" />
          <span className="relative flex h-[58px] w-[58px] items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-amber-200 text-[38px] leading-none shadow-inner">
            😊
          </span>
        </button>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Self-contained "Luna" chat bubble for the public landing page.
 * Needs no backend — a floating avatar that opens a greeting + "Ask a question",
 * mirroring a typical marketing support widget. Pinned bottom-right.
 */
export function LunaBubble(): React.JSX.Element {
  const t = useTranslations('chat');
  const [open, setOpen] = useState(false);

  // Speech-bubble shape: rounded on 3 corners, small tail on the bottom-left.
  const bubbleShape = { borderRadius: '50% 50% 50% 14%' };

  return (
    <div
      style={{ position: 'fixed', right: '24px', bottom: '24px', zIndex: 60 }}
      className="flex flex-col items-end gap-3"
    >
      {/* Panel — opens upward, anchored bottom-right */}
      {open && (
        <div className="w-[380px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5">
          {/* Gradient header */}
          <div className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 px-6 pb-20 pt-6 text-white">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('closeChat')}
              className="absolute right-4 top-4 text-white/80 transition hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <p className="text-xl font-medium">
              {t('hello')} <span className="inline-block">👋</span>
            </p>
            <p className="mt-1 text-2xl font-bold leading-snug">{t('howCanWeHelp')}</p>
          </div>

          {/* Intro card overlapping the header */}
          <div className="-mt-14 px-5 pb-5">
            <div className="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-black/5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-orange-300 text-xl">
                  😌
                </div>
                <p className="text-sm leading-relaxed text-gray-700">{t('lunaIntro')}</p>
              </div>
              <button
                type="button"
                className="mt-5 w-full rounded-full bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-95"
              >
                {t('askQuestion')}
              </button>
            </div>
          </div>

          {/* Message input (decorative) */}
          <div className="flex items-center gap-2 border-t border-gray-100 px-5 py-3">
            <input
              type="text"
              placeholder={t('writeMessage')}
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
            />
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition hover:bg-blue-100"
              aria-label={t('askQuestion')}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating avatar button — large, speech-bubble shaped */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t('closeChat') : t('openChat')}
        style={bubbleShape}
        className="relative flex h-20 w-20 items-center justify-center bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 shadow-xl transition hover:scale-105 active:scale-95"
      >
        {/* Soft pulsing ring */}
        {!open && (
          <span
            style={bubbleShape}
            className="absolute inset-0 animate-ping bg-blue-500/30"
          />
        )}
        {open ? (
          <svg className="relative h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        ) : (
          <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-orange-200 text-3xl shadow-inner">
            😌
          </span>
        )}
      </button>
    </div>
  );
}

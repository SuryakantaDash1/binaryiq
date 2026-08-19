'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Self-contained "Luna" chat bubble for the public landing page.
 * Unlike the in-app ChatWidget it needs no backend — it mirrors the Toluna
 * marketing chat: a floating avatar that opens a greeting + "Ask a question".
 */
export function LunaBubble(): React.JSX.Element {
  const t = useTranslations('chat');
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {/* Panel */}
      {open && (
        <div className="w-[340px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
          {/* Gradient header */}
          <div className="relative bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 px-5 pb-16 pt-5 text-white">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('closeChat')}
              className="absolute right-3 top-3 text-white/80 hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <p className="text-lg font-medium">
              {t('hello')} <span className="inline-block">👋</span>
            </p>
            <p className="mt-1 text-xl font-bold leading-snug">{t('howCanWeHelp')}</p>
          </div>

          {/* Intro card overlapping header */}
          <div className="-mt-12 px-4 pb-4">
            <div className="rounded-xl bg-white p-4 shadow-lg ring-1 ring-black/5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-orange-400 text-lg">
                  😌
                </div>
                <p className="text-sm leading-relaxed text-gray-700">{t('lunaIntro')}</p>
              </div>
              <button
                type="button"
                className="mt-4 w-full rounded-full bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-95"
              >
                {t('askQuestion')}
              </button>
            </div>
          </div>

          {/* Message input (decorative) */}
          <div className="flex items-center gap-2 border-t border-gray-100 px-4 py-3">
            <input
              type="text"
              placeholder={t('writeMessage')}
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
            />
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:text-blue-600"
              aria-label={t('askQuestion')}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating avatar button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t('closeChat') : t('openChat')}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 text-2xl text-white shadow-xl transition hover:scale-105 active:scale-95"
      >
        {open ? (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        ) : (
          <span>😊</span>
        )}
      </button>
    </div>
  );
}

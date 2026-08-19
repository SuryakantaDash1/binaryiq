'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { LunaBubble } from '@/features/landing/LunaBubble.js';

// ─── Language list ────────────────────────────────────────────────────────────
const LANGUAGES = [
  { code: 'en-IN', label: 'english (india)' },
  { code: 'en-GB', label: 'english (united kingdom)' },
  { code: 'en-US', label: 'english (united states)' },
  { code: 'en-AU', label: 'english (australia)' },
  { code: 'en-CA', label: 'english (canada)' },
  { code: 'en-AE', label: 'english (united arab emirates)' },
  { code: 'en-IE', label: 'english (ireland)' },
  { code: 'en-EG', label: 'english (egypt)' },
  { code: 'en-SG', label: 'english (singapore)' },
  { code: 'en-MY', label: 'english (malaysia)' },
  { code: 'en-PH', label: 'english (philippines)' },
  { code: 'en-ZA', label: 'english (south africa)' },
  { code: 'en-PK', label: 'english (pakistan)' },
  { code: 'hi-IN', label: 'हिन्दी (भारत)' },
  { code: 'ar-AE', label: 'العربية (الإمارات العربية المتحدة)' },
  { code: 'ar-EG', label: 'العربية (مصر)' },
  { code: 'ar-MA', label: 'العربية (المغرب)' },
  { code: 'ar-SA', label: 'العربية (المملكة العربية السعودية)' },
  { code: 'de-DE', label: 'deutsch (deutschland)' },
  { code: 'de-AT', label: 'deutsch (österreich)' },
  { code: 'de-CH', label: 'deutsch (schweiz)' },
  { code: 'fr-FR', label: 'français (france)' },
  { code: 'fr-BE', label: 'français (belgique)' },
  { code: 'fr-CA', label: 'français (canada)' },
  { code: 'es-ES', label: 'español (españa)' },
  { code: 'es-MX', label: 'español (méxico)' },
  { code: 'pt-BR', label: 'português (brasil)' },
  { code: 'pt-PT', label: 'português (portugal)' },
  { code: 'it-IT', label: 'italiano (italia)' },
  { code: 'nl-NL', label: 'nederlands (nederland)' },
  { code: 'nl-BE', label: 'nederlands (belgië)' },
  { code: 'pl-PL', label: 'polski (polska)' },
  { code: 'ru-RU', label: 'русский (россия)' },
  { code: 'tr-TR', label: 'türkçe (türkiye)' },
  { code: 'zh-CN', label: '简体中文 (中国)' },
  { code: 'zh-TW', label: '繁體中文 (台灣)' },
  { code: 'ja-JP', label: '日本語 (日本)' },
  { code: 'ko-KR', label: '한국어 (한국)' },
  { code: 'id-ID', label: 'bahasa indonesia' },
  { code: 'ms-MY', label: 'bahasa malaysia' },
  { code: 'da-DK', label: 'dansk' },
  { code: 'sv-SE', label: 'svenska' },
  { code: 'cs-CZ', label: 'čeština' },
  { code: 'el-GR', label: 'ελληνικά' },
];

const BRAND_LOGOS = [
  { name: 'amazon.in', color: '#232F3E' },
  { name: 'Nykaa', color: '#E80071' },
  { name: 'Swiggy', color: '#FC8019' },
];

const REVIEWS = [
  { name: 'Priya M.', title: 'Genuinely rewarding', text: 'Great platform to earn rewards by sharing opinions!', rating: 5 },
  { name: 'Rahul S.', title: 'Fast payouts', text: 'Easy to use and rewards are credited fast.', rating: 5 },
  { name: 'Anita K.', title: 'Plenty of surveys', text: 'Love the variety of surveys available every day.', rating: 5 },
];

// Map full locale codes to base language codes (must match i18n/request.ts)
const LOCALE_TO_LANG: Record<string, string> = {
  'en-IN': 'en', 'en-GB': 'en', 'en-US': 'en', 'en-AU': 'en', 'en-CA': 'en',
  'en-AE': 'en', 'en-IE': 'en', 'en-EG': 'en', 'en-SG': 'en', 'en-MY': 'en',
  'en-PH': 'en', 'en-ZA': 'en', 'en-PK': 'en',
  'hi-IN': 'hi',
  'ar-AE': 'ar', 'ar-EG': 'ar', 'ar-MA': 'ar', 'ar-SA': 'ar',
  'de-DE': 'de', 'de-AT': 'de', 'de-CH': 'de',
  'fr-FR': 'fr', 'fr-BE': 'fr', 'fr-CA': 'fr',
  'es-ES': 'es', 'es-MX': 'es',
  'pt-BR': 'pt', 'pt-PT': 'pt',
  'it-IT': 'it',
  'nl-NL': 'nl', 'nl-BE': 'nl',
  'pl-PL': 'pl',
  'ru-RU': 'ru',
  'tr-TR': 'tr',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  'ja-JP': 'ja',
  'ko-KR': 'ko',
  'id-ID': 'id',
  'ms-MY': 'ms',
  'da-DK': 'da',
  'sv-SE': 'sv',
  'cs-CZ': 'cs',
  'el-GR': 'el',
};

function getStoredLocale(): string {
  if (typeof document === 'undefined') return 'en-IN';
  const m = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
  return m?.[1] ?? 'en-IN';
}

const FOOTER_KEYS = ['aboutUs', 'cookies', 'contact', 'faqs', 'terms', 'privacy'] as const;

export default function LandingPage(): React.JSX.Element {
  const t = useTranslations('landing');
  const tf = useTranslations('footer');
  const [lang, setLang] = useState('en-IN');
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const [reviewIndex, setReviewIndex] = useState(0);

  // Cycling hero phrases (big word + subtitle), built from translation keys
  const PHRASES = [
    { big: t('share'), small: t('yourVoice') },
    { big: t('influence'), small: t('title') },
    { big: t('inspire'), small: t('change') },
    { big: t('get'), small: t('rewarded') },
  ];

  // Sync dropdown with stored cookie on mount
  useEffect(() => {
    setLang(getStoredLocale());
  }, []);

  // Cycle hero phrase every 3 s with a fade
  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setPhraseIndex((i) => (i + 1) % PHRASES.length);
        setFade(true);
      }, 400);
    }, 3000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cycle review every 4 s
  useEffect(() => {
    const interval = setInterval(() => {
      setReviewIndex((i) => (i + 1) % REVIEWS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  function handleLangChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    const fullLocale = e.target.value;
    if (!fullLocale) return;
    setLang(fullLocale);
    document.cookie = `NEXT_LOCALE=${fullLocale}; path=/; max-age=31536000; SameSite=Lax`;
    window.location.reload();
  }

  function stepReview(dir: number): void {
    setReviewIndex((i) => (i + dir + REVIEWS.length) % REVIEWS.length);
  }

  const review = REVIEWS[reviewIndex]!;
  const phrase = PHRASES[phraseIndex]!;

  return (
    <div className="flex min-h-screen">
      {/* ── Left Panel (50%) ───────────────────────────────────────── */}
      <div className="relative flex w-full flex-col justify-between overflow-y-auto bg-white px-8 py-8 md:w-1/2 lg:px-14">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 text-white">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="leading-tight">
            <p className="text-base font-bold text-gray-900">Influencers</p>
            <p className="text-[10px] text-gray-500">by toluna</p>
          </div>
        </div>

        {/* Hero text */}
        <div className="mt-8">
          <p className="text-2xl font-semibold text-gray-800">{t('tagline')}</p>
          <h1 className="text-5xl font-black leading-tight text-gray-900">{t('title')}</h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-gray-600">
            {t('description')}
          </p>

          {/* CTA buttons */}
          <div className="mt-7 flex gap-3">
            <Link href="/register">
              <button className="rounded-full bg-pink-600 px-8 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-pink-700 active:scale-95">
                {t('register')}
              </button>
            </Link>
            <Link href="/login">
              <button className="rounded-full border-2 border-blue-500 px-8 py-3 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 active:scale-95">
                {t('signIn')}
              </button>
            </Link>
          </div>

          {/* Brand logos */}
          <div className="mt-9 flex items-center gap-8">
            {BRAND_LOGOS.map((b) => (
              <span key={b.name} className="text-lg font-bold tracking-tight" style={{ color: b.color }}>
                {b.name}
              </span>
            ))}
          </div>

          {/* Divider */}
          <div className="my-5 border-t border-gray-100" />

          {/* Trustpilot-style rating + review carousel */}
          <div className="flex items-start gap-5">
            <div className="shrink-0">
              <p className="text-lg font-bold text-gray-900">{t('great')}</p>
              <TrustStars score={4.5} />
              <p className="mt-1 text-[11px] text-gray-500">{t('basedOnReviews', { count: '2,46,968' })}</p>
              <TrustpilotWordmark />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <VerifiedBadge />
                <span className="text-[11px] font-semibold text-gray-700">{review.name}</span>
              </div>
              <p className="mt-1 text-sm font-bold text-gray-900">{review.title}</p>
              <p className="text-xs text-gray-600">{review.text}</p>
            </div>

            <div className="flex shrink-0 flex-col justify-center gap-2">
              <button
                onClick={() => stepReview(-1)}
                aria-label="Previous review"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:bg-gray-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => stepReview(1)}
                aria-label="Next review"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:bg-gray-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] text-gray-400">{t('showingReviews')}</p>
        </div>

        {/* Language selector — pinned to bottom */}
        <div className="mt-8">
          <select
            value={lang}
            onChange={handleLangChange}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 shadow-sm focus:border-pink-400 focus:outline-none focus:ring-1 focus:ring-pink-300"
          >
            <option value="">{t('pleaseSelect')}</option>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Right Panel (50%) — animated "video" ───────────────────── */}
      <div className="relative hidden w-1/2 overflow-hidden md:flex">
        {/* Cross-fading gradient "scenes" simulate a looping video */}
        <div className="video-scene scene-1 absolute inset-0" />
        <div className="video-scene scene-2 absolute inset-0" />
        <div className="video-scene scene-3 absolute inset-0" />

        {/* Grain overlay */}
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'1\'/%3E%3C/svg%3E")',
          }}
        />

        {/* Person silhouette */}
        <div className="absolute inset-0 flex items-end justify-end pr-10 opacity-20">
          <svg viewBox="0 0 200 400" fill="white" className="h-[85%] w-auto">
            <ellipse cx="110" cy="90" rx="52" ry="60" />
            <path d="M25 400 Q35 230 110 210 Q185 230 195 400Z" />
          </svg>
        </div>

        {/* Moving light blobs */}
        <div className="animate-blob absolute left-1/4 top-1/4 h-64 w-64 rounded-full bg-purple-400 opacity-30 mix-blend-screen blur-3xl" />
        <div className="animate-blob animation-delay-2000 absolute bottom-1/3 right-1/4 h-72 w-72 rounded-full bg-pink-400 opacity-25 mix-blend-screen blur-3xl" />
        <div className="animate-blob animation-delay-4000 absolute left-1/3 top-2/3 h-56 w-56 rounded-full bg-blue-300 opacity-20 mix-blend-screen blur-3xl" />

        {/* Cycling hero phrase */}
        <div
          className="absolute left-14 top-1/2 z-10 -translate-y-1/2 transition-opacity duration-400"
          style={{ opacity: fade ? 1 : 0 }}
        >
          <p className="text-7xl font-black uppercase leading-none tracking-tight text-white drop-shadow-lg">
            {phrase.big}
          </p>
          <p className="mt-2 text-5xl font-semibold text-white/90 drop-shadow">{phrase.small}</p>
        </div>

        {/* Bottom: store badges + footer links */}
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/50 to-transparent px-10 pb-6 pt-16">
          <div className="flex items-center gap-3">
            <AppStoreBadge />
            <GooglePlayBadge />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-white/85">
            {FOOTER_KEYS.map((k) => (
              <span key={k} className="cursor-pointer hover:text-white hover:underline">
                {tf(k)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Luna chat bubble — floats over everything, works with no backend */}
      <LunaBubble />

      {/* Global styles for animations */}
      <style jsx global>{`
        .video-scene {
          background-size: 300% 300%;
          animation: sceneFade 18s ease-in-out infinite, gradientShift 10s ease infinite;
        }
        .scene-1 {
          background-image: linear-gradient(135deg, #1e3a8a 0%, #6d28d9 50%, #db2777 100%);
          animation-delay: 0s, 0s;
        }
        .scene-2 {
          background-image: linear-gradient(135deg, #4c1d95 0%, #7c3aed 50%, #ec4899 100%);
          animation-delay: -6s, -3s;
        }
        .scene-3 {
          background-image: linear-gradient(135deg, #312e81 0%, #9333ea 45%, #f43f5e 100%);
          animation-delay: -12s, -6s;
        }
        @keyframes sceneFade {
          0%, 22% { opacity: 1; }
          33%, 89% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
        .duration-400 { transition-duration: 400ms; }
      `}</style>
    </div>
  );
}

/** Trustpilot-style green square stars, filled by score (0–5, halves supported). */
function TrustStars({ score }: { score: number }): React.JSX.Element {
  return (
    <div className="mt-1 flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, score - (i - 1)));
        return (
          <div key={i} className="relative h-6 w-6 overflow-hidden rounded-sm bg-gray-200">
            <div
              className="absolute inset-y-0 left-0 bg-[#00b67a]"
              style={{ width: `${fill * 100}%` }}
            />
            <svg className="absolute inset-0 m-auto h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
        );
      })}
    </div>
  );
}

function TrustpilotWordmark(): React.JSX.Element {
  return (
    <div className="mt-1.5 flex items-center gap-1">
      <svg className="h-3.5 w-3.5 text-[#00b67a]" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      <span className="text-xs font-bold text-gray-700">Trustpilot</span>
    </div>
  );
}

function VerifiedBadge(): React.JSX.Element {
  return (
    <div className="flex items-center gap-1 rounded bg-[#00b67a] px-1.5 py-0.5">
      <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
      <span className="text-[9px] font-bold text-white">Verified</span>
    </div>
  );
}

function AppStoreBadge(): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-black px-3 py-1.5 text-white">
      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.9-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.89 2.65 3.24 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.29-1.27 3.15-2.53.99-1.45 1.4-2.85 1.42-2.92-.03-.01-2.73-1.05-2.76-4.16zM14.53 4.4c.72-.87 1.2-2.08 1.07-3.28-1.03.04-2.28.69-3.02 1.55-.66.77-1.24 2-1.08 3.18 1.15.09 2.33-.58 3.03-1.45z" />
      </svg>
      <div className="leading-none">
        <p className="text-[8px]">Download on the</p>
        <p className="text-sm font-semibold">App Store</p>
      </div>
    </div>
  );
}

function GooglePlayBadge(): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-black px-3 py-1.5 text-white">
      <svg className="h-6 w-6" viewBox="0 0 24 24">
        <path fill="#00d2ff" d="M3.6 2.4c-.3.3-.5.8-.5 1.4v16.4c0 .6.2 1.1.5 1.4l.1.1L12 13.1v-.2L3.7 2.3l-.1.1z" />
        <path fill="#ffce00" d="M15.5 15.9 12 12.9v-.2l3.5-3 .1.1 4.1 2.3c1.2.7 1.2 1.8 0 2.5l-4.2 2.3z" />
        <path fill="#00f076" d="M15.6 15.8 12 12.8 3.6 21.2c.4.4 1 .5 1.8.1l10.2-5.5z" />
        <path fill="#ff3a44" d="M15.6 9.9 5.4 4.3c-.8-.4-1.4-.4-1.8.1L12 12.8l3.6-2.9z" />
      </svg>
      <div className="leading-none">
        <p className="text-[8px]">GET IT ON</p>
        <p className="text-sm font-semibold">Google Play</p>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

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
  { name: 'amazon.in', color: '#FF9900' },
  { name: 'Nykaa', color: '#FC2779' },
  { name: 'Swiggy', color: '#FC8019' },
];

const REVIEWS = [
  { name: 'Priya M.', text: 'Great platform to earn rewards by sharing opinions!', rating: 5 },
  { name: 'Rahul S.', text: 'Easy to use and rewards are credited fast.', rating: 4 },
  { name: 'Anita K.', text: 'Love the variety of surveys available every day.', rating: 5 },
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

export default function LandingPage(): React.JSX.Element {
  const t = useTranslations('landing');
  const [lang, setLang] = useState('en-IN');
  const [wordIndex, setWordIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const [reviewIndex, setReviewIndex] = useState(0);

  const CYCLE_WORDS = [t('inspire'), t('influence'), t('impact'), t('innovate')];

  // Sync dropdown with stored cookie on mount
  useEffect(() => {
    setLang(getStoredLocale());
  }, []);

  // Cycle hero word every 2.5 s
  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setWordIndex((i) => (i + 1) % CYCLE_WORDS.length);
        setFade(true);
      }, 300);
    }, 2500);
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
    const baseLang = LOCALE_TO_LANG[fullLocale] ?? 'en';
    // Store full locale so dropdown shows correct selection after reload
    document.cookie = `NEXT_LOCALE=${fullLocale}; path=/; max-age=31536000; SameSite=Lax`;
    // Reload so server picks up new locale and serves correct messages
    window.location.reload();
  }

  const review = REVIEWS[reviewIndex]!;

  return (
    <div className="flex min-h-screen">
      {/* ── Left Panel ─────────────────────────────────────────────── */}
      <div className="relative flex w-full flex-col justify-between overflow-y-auto bg-white px-8 py-8 md:w-[42%] lg:px-12">
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
        <div className="mt-10">
          <p className="text-2xl font-semibold text-gray-800">{t('tagline')}</p>
          <h1 className="text-5xl font-black leading-tight text-gray-900">{t('title')}</h1>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-gray-600">
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
          <div className="mt-10 flex items-center gap-6">
            {BRAND_LOGOS.map((b) => (
              <span key={b.name} className="text-sm font-bold" style={{ color: b.color }}>
                {b.name}
              </span>
            ))}
          </div>

          {/* Divider */}
          <div className="my-5 border-t border-gray-100" />

          {/* Trustpilot-style rating */}
          <div className="flex items-center gap-4">
            <div>
              <p className="text-base font-bold text-gray-900">{t('great')}</p>
              <StarRating rating={review.rating} />
            </div>
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-1.5">
                <VerifiedBadge />
                <span className="text-[10px] text-gray-500">{review.name}</span>
              </div>
              <p className="text-xs text-gray-600 transition-all duration-500">
                {review.text}
              </p>
            </div>
          </div>
        </div>

        {/* Language selector — pinned to bottom */}
        <div className="mt-10">
          <select
            value={lang}
            onChange={handleLangChange}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-pink-400 focus:outline-none focus:ring-1 focus:ring-pink-300"
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

      {/* ── Right Panel — animated "video" ─────────────────────────── */}
      <div className="relative hidden flex-1 overflow-hidden md:flex">
        {/* Animated gradient background */}
        <div className="animate-gradient-shift absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-800 to-pink-700" />

        {/* Noise texture overlay */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'1\'/%3E%3C/svg%3E")',
          }}
        />

        {/* Silhouette shape */}
        <div className="absolute inset-0 flex items-center justify-end pr-16 opacity-25">
          <svg viewBox="0 0 200 400" fill="white" className="h-4/5 w-auto">
            <ellipse cx="100" cy="80" rx="55" ry="65" />
            <path d="M20 400 Q30 220 100 200 Q170 220 180 400Z" />
          </svg>
        </div>

        {/* Moving light blobs */}
        <div className="animate-blob absolute left-1/4 top-1/4 h-64 w-64 rounded-full bg-purple-500 opacity-30 mix-blend-screen blur-3xl" />
        <div className="animate-blob animation-delay-2000 absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-pink-500 opacity-25 mix-blend-screen blur-3xl" />
        <div className="animate-blob animation-delay-4000 absolute left-1/3 top-2/3 h-56 w-56 rounded-full bg-blue-400 opacity-20 mix-blend-screen blur-3xl" />

        {/* Text overlay */}
        <div className="relative z-10 flex flex-col justify-center px-16">
          <p
            className="text-7xl font-black uppercase tracking-tight text-white transition-opacity duration-300"
            style={{ opacity: fade ? 1 : 0 }}
          >
            {CYCLE_WORDS[wordIndex]}
          </p>
          <p className="mt-1 text-4xl font-semibold text-white/80">{t('change')}</p>
          <p className="mt-4 text-7xl font-black uppercase tracking-tight text-white">{t('get')}</p>
          <p className="mt-1 text-5xl font-bold text-white/90">{t('rewarded')}</p>
        </div>

        {/* Bottom strip — stats */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-around bg-black/30 px-8 py-4 backdrop-blur-sm">
          <Stat value="10M+" label={t('members')} />
          <div className="h-8 w-px bg-white/20" />
          <Stat value="50K+" label={t('surveysMonthly')} />
          <div className="h-8 w-px bg-white/20" />
          <Stat value="₹500" label={t('welcomeBonus')} />
        </div>
      </div>

      {/* Global styles for animations */}
      <style jsx global>{`
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient-shift {
          background-size: 300% 300%;
          animation: gradient-shift 8s ease infinite;
        }
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}</style>
    </div>
  );
}

function StarRating({ rating }: { rating: number }): React.JSX.Element {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} className={`h-4 w-4 ${s <= rating ? 'text-green-500' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function VerifiedBadge(): React.JSX.Element {
  return (
    <div className="flex items-center gap-1 rounded bg-green-600 px-1.5 py-0.5">
      <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
      <span className="text-[9px] font-bold text-white">Verified</span>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }): React.JSX.Element {
  return (
    <div className="text-center">
      <p className="text-xl font-black text-white">{value}</p>
      <p className="text-xs text-white/70">{label}</p>
    </div>
  );
}

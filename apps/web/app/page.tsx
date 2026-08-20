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

// Real lifestyle/community photos (Unsplash CDN) that cross-fade like a video.
// If offline, the panel's base gradient shows instead — no broken images.
const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1400&q=80',
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

const FOOTER_LINKS = [
  { key: 'aboutUs', href: '/about' },
  { key: 'cookies', href: '/cookies' },
  { key: 'contact', href: '/contact' },
  { key: 'faqs', href: '/faqs' },
  { key: 'terms', href: '/terms' },
  { key: 'privacy', href: '/privacy' },
] as const;

export default function LandingPage(): React.JSX.Element {
  const t = useTranslations('landing');
  const tf = useTranslations('footer');
  const [lang, setLang] = useState('en-IN');
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [fade, setFade] = useState(true);

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

  function handleLangChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    const fullLocale = e.target.value;
    if (!fullLocale) return;
    setLang(fullLocale);
    document.cookie = `NEXT_LOCALE=${fullLocale}; path=/; max-age=31536000; SameSite=Lax`;
    window.location.reload();
  }

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
            <p className="text-[10px] text-gray-500">surveys &amp; rewards</p>
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
          <div className="my-6 border-t border-gray-100" />

          {/* Why join — clean benefit checklist */}
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
              {t('benefitsTitle')}
            </p>
            <ul className="space-y-2.5">
              {[t('benefit1'), t('benefit2'), t('benefit3')].map((b, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pink-100 text-pink-600">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span className="text-sm text-gray-700">{b}</span>
                </li>
              ))}
            </ul>
          </div>
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

      {/* ── Right Panel (50%) — cross-fading real photos ───────────── */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-indigo-900 to-purple-800 md:flex">
        {/* Real lifestyle photos cross-fade to feel like a looping video */}
        <div className="photo-scene ps-1 absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${HERO_IMAGES[0]})` }} />
        <div className="photo-scene ps-2 absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${HERO_IMAGES[1]})` }} />
        <div className="photo-scene ps-3 absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${HERO_IMAGES[2]})` }} />

        {/* Brand tint overlay (blue → purple → pink) over the photos */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-800/75 via-purple-700/65 to-pink-600/70" />

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
            {FOOTER_LINKS.map((l) => (
              <Link key={l.key} href={l.href} className="hover:text-white hover:underline">
                {tf(l.key)}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Luna chat bubble — floats over everything, works with no backend */}
      <LunaBubble />

      {/* Global styles for animations */}
      <style jsx global>{`
        .photo-scene {
          opacity: 0;
          animation: sceneFade 21s ease-in-out infinite;
          transform: scale(1.05);
        }
        .ps-1 { animation-delay: 0s; }
        .ps-2 { animation-delay: -7s; }
        .ps-3 { animation-delay: -14s; }
        @keyframes sceneFade {
          0% { opacity: 0; transform: scale(1.05); }
          5%, 28% { opacity: 1; transform: scale(1.12); }
          38%, 95% { opacity: 0; }
          100% { opacity: 0; }
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

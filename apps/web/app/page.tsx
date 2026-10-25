'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { LunaBubble } from '@/features/landing/LunaBubble.js';
import { useSiteImage } from '@/features/site-images/SiteImages';

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

// Benefits shown as interactive cards (icon + translated line)
const BENEFITS = [
  { key: 'benefit1', icon: '🎁' },
  { key: 'benefit2', icon: '🎯' },
  { key: 'benefit3', icon: '💳' },
] as const;

// "How it works" quick steps
const STEPS = ['step1', 'step2', 'step3'] as const;

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
  // Admin-managed photos (Site Images) that cross-fade like a looping video.
  const heroImages = [useSiteImage('landing-1'), useSiteImage('landing-2'), useSiteImage('landing-3')];
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
        <div className="flex items-center">
          <Image src="/BinaryIQ_logo.svg" alt="BinaryIQ" width={1600} height={420} priority className="h-9 w-auto" />
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
              <button className="rounded-full bg-brand-800 px-8 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-brand-900 active:scale-95">
                {t('register')}
              </button>
            </Link>
            <Link href="/login">
              <button className="rounded-full border-2 border-blue-500 px-8 py-3 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 active:scale-95">
                {t('signIn')}
              </button>
            </Link>
          </div>

          {/* Divider */}
          <div className="mt-8 border-t border-gray-100" />

          {/* Why join — interactive benefit cards */}
          <div className="mt-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
              {t('benefitsTitle')}
            </p>
            <div className="space-y-2.5">
              {BENEFITS.map((b) => (
                <div
                  key={b.key}
                  className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xl transition-transform duration-200 group-hover:scale-110">
                    {b.icon}
                  </div>
                  <p className="text-sm font-medium text-gray-700">{t(b.key)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* How it works — 3 quick steps */}
          <div className="mt-7">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
              {t('howItWorks')}
            </p>
            <div className="flex items-start justify-between gap-2">
              {STEPS.map((s, i) => (
                <div key={s} className="group flex flex-1 flex-col items-center text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-900 text-sm font-bold text-white shadow-sm transition-transform duration-200 group-hover:scale-110">
                    {i + 1}
                  </div>
                  <p className="mt-2 text-xs font-medium leading-tight text-gray-600">{t(s)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Language selector — pinned to bottom */}
        <div className="mt-8">
          <select
            value={lang}
            onChange={handleLangChange}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
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
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-ink to-brand-950 md:flex">
        {/* Real lifestyle photos cross-fade to feel like a looping video */}
        <div className="photo-scene ps-1 absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroImages[0]})` }} />
        <div className="photo-scene ps-2 absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroImages[1]})` }} />
        <div className="photo-scene ps-3 absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroImages[2]})` }} />

        {/* Neutral scrim so the photos show naturally — just enough for text contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/15 to-black/5" />

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

      {/* Byte chat bubble — floats over everything, works with no backend */}
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

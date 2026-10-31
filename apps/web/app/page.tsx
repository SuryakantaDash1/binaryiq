'use client';

import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  PieChart,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
  Tv,
  UserPlus,
  Vote,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { LanguageSelect } from '@/features/landing/LanguageSelect';
import { LunaBubble } from '@/features/landing/LunaBubble.js';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/features/landing/styles';
import { useSiteImage } from '@/features/site-images/SiteImages';

const STEPS: { key: 'step1' | 'step2' | 'step3'; icon: LucideIcon }[] = [
  { key: 'step1', icon: UserPlus },
  { key: 'step2', icon: ClipboardList },
  { key: 'step3', icon: BarChart3 },
];

const FEATURES: { key: 'feature1' | 'feature2' | 'feature3' | 'feature4'; icon: LucideIcon }[] = [
  { key: 'feature1', icon: Target },
  { key: 'feature2', icon: Zap },
  { key: 'feature3', icon: PieChart },
  { key: 'feature4', icon: ShieldCheck },
];

const FOOTER_LINKS = [
  { key: 'aboutUs', href: '/about' },
  { key: 'faqs', href: '/faqs' },
  { key: 'contact', href: '/contact' },
  { key: 'terms', href: '/terms' },
  { key: 'privacy', href: '/privacy' },
  { key: 'cookies', href: '/cookies' },
] as const;

export default function LandingPage(): React.JSX.Element {
  const t = useTranslations('landing');
  const tf = useTranslations('footer');

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-ink">
      <SiteHeader />

      <main>
        <Hero />

        {/* How it works */}
        <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <h2 className="text-center text-3xl font-black tracking-tight sm:text-4xl">{t('howItWorks')}</h2>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {STEPS.map(({ key, icon: Icon }, i) => (
              <div key={key} className="relative rounded-3xl border border-gray-100 bg-gray-50/60 p-7">
                <span className="absolute right-6 top-5 bg-gradient-to-br from-brand-400 to-brand-900 bg-clip-text text-5xl font-black text-transparent opacity-25">
                  0{i + 1}
                </span>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-700 shadow-sm ring-1 ring-gray-100">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-lg font-bold">{t(key)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{t(`${key}Desc`)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="bg-gray-50/70 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-black tracking-tight sm:text-4xl">{t('featuresTitle')}</h2>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ key, icon: Icon }) => (
                <div
                  key={key}
                  className="group rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100 transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-900 text-white shadow-md shadow-brand-700/20">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 font-bold">{t(key)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{t(`${key}Desc`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <CommunityPhotos />

        {/* Closing call to action */}
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="relative overflow-hidden rounded-[2rem] bg-ink px-6 py-14 text-center sm:px-12">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-brand-600/40 blur-3xl" />
            <div className="relative">
              <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{t('ctaTitle')}</h2>
              <p className="mx-auto mt-3 max-w-xl text-white/70">{t('ctaSubtitle')}</p>
              <Link href="/register" className={`${BTN_PRIMARY} mt-8 px-8`}>
                {t('getStarted')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-100">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3">
            <Image src="/BinaryIQ_logo.svg" alt="BinaryIQ" width={1600} height={420} className="h-7 w-auto self-start" />
            <p className="text-xs text-gray-400">{t('rights', { year: new Date().getFullYear() })}</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500">
            {FOOTER_LINKS.map((l) => (
              <Link key={l.key} href={l.href} className="transition hover:text-ink">
                {tf(l.key)}
              </Link>
            ))}
          </nav>
          <LanguageSelect label={t('language')} />
        </div>
      </footer>

      <LunaBubble />
    </div>
  );
}

function SiteHeader(): React.JSX.Element {
  const t = useTranslations('landing');
  return (
    <header className="sticky top-0 z-40 border-b border-gray-100/80 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center">
          <Image src="/BinaryIQ_logo.svg" alt="BinaryIQ" width={1600} height={420} priority className="h-8 w-auto" />
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <a href="#how-it-works" className="hidden text-sm font-medium text-gray-600 transition hover:text-ink md:block">
            {t('navHowItWorks')}
          </a>
          <LanguageSelect label={t('language')} className="hidden lg:inline-flex" />
          <Link href="/login" className="rounded-full px-4 py-2 text-sm font-semibold text-ink transition hover:bg-gray-100">
            {t('signIn')}
          </Link>
          <Link href="/register" className={`${BTN_PRIMARY} px-4 py-2 sm:px-5`}>
            {t('getStarted')}
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero(): React.JSX.Element {
  const t = useTranslations('landing');
  return (
    <section className="relative px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
      {/* Soft brand glow behind the headline */}
      <div className="pointer-events-none absolute inset-x-0 -top-10 -z-0 flex justify-center">
        <div className="h-[28rem] w-[28rem] rounded-full bg-brand-400/25 blur-3xl sm:w-[44rem]" />
        <div className="-ml-40 mt-20 h-80 w-80 rounded-full bg-brand-900/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white/80 px-4 py-1.5 text-xs font-semibold text-brand-800 shadow-sm">
          <Sparkles className="h-3.5 w-3.5" />
          {t('heroBadge')}
        </span>
        <h1 className="mt-6 text-5xl font-black leading-[1.05] tracking-tight sm:text-7xl">
          {t('heroTitle')}{' '}
          <span className="bg-gradient-to-r from-brand-500 via-brand-700 to-brand-900 bg-clip-text text-transparent">
            {t('heroTitleAccent')}
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-gray-600">{t('heroSubtitle')}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/register" className={`${BTN_PRIMARY} px-8`}>
            {t('getStarted')}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/login" className={`${BTN_SECONDARY} px-8`}>
            {t('signIn')}
          </Link>
        </div>
      </div>

      <ProductPreview />
    </section>
  );
}

/** Illustrative snapshot of the member dashboard — decorative, not live data. */
function ProductPreview(): React.JSX.Element {
  const t = useTranslations('landing');
  const items: { title: string; minutes: number; icon: LucideIcon }[] = [
    { title: t('previewItem1'), minutes: 5, icon: ShoppingBag },
    { title: t('previewItem2'), minutes: 8, icon: Tv },
    { title: t('previewItem3'), minutes: 1, icon: Vote },
  ];
  const poll = [
    { label: t('previewPollA'), pct: 46 },
    { label: t('previewPollB'), pct: 31 },
    { label: t('previewPollC'), pct: 23 },
  ];

  return (
    <div className="relative mx-auto mt-16 max-w-4xl" aria-hidden>
      <div className="grid gap-4 rounded-[2rem] border border-gray-100 bg-white/90 p-4 shadow-2xl shadow-brand-950/10 backdrop-blur sm:p-6 md:grid-cols-[1fr_1.35fr]">
        {/* Live poll */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink via-brand-950 to-brand-800 p-6 text-white">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-500/30 blur-2xl" />
          <p className="relative inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/60">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            {t('previewPollLabel')}
          </p>
          <p className="relative mt-3 text-lg font-bold leading-snug">{t('previewPollQuestion')}</p>
          <ul className="relative mt-5 flex flex-col gap-2.5">
            {poll.map((o, i) => (
              <li key={o.label} className="relative overflow-hidden rounded-xl bg-white/10">
                <div
                  className={`absolute inset-y-0 left-0 rounded-xl ${i === 0 ? 'bg-gradient-to-r from-brand-500 to-brand-400' : 'bg-white/15'}`}
                  style={{ width: `${o.pct}%` }}
                />
                <div className="relative flex justify-between px-3 py-2 text-sm">
                  <span className="font-medium">{o.label}</span>
                  <span className="font-bold tabular-nums">{o.pct}%</span>
                </div>
              </li>
            ))}
          </ul>
          <p className="relative mt-4 text-xs text-white/50">{t('previewVotes', { count: '2,418' })}</p>
        </div>

        {/* Matched surveys */}
        <div className="rounded-3xl bg-gray-50 p-5">
          <p className="text-sm font-semibold text-gray-500">{t('previewMatched')}</p>
          <ul className="mt-3 flex flex-col gap-2.5">
            {items.map(({ title, minutes, icon: Icon }) => (
              <li key={title} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-semibold">{title}</p>
                  <p className="text-xs text-gray-500">{t('previewMinutes', { count: minutes })}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-gray-300" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** Admin-managed photos (Site Images: landing-1..3) in a bento grid. */
function CommunityPhotos(): React.JSX.Element {
  const t = useTranslations('landing');
  const photos = [useSiteImage('landing-1'), useSiteImage('landing-2'), useSiteImage('landing-3')];

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="max-w-2xl">
        <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{t('communityTitle')}</h2>
        <p className="mt-3 text-gray-600">{t('communitySubtitle')}</p>
      </div>
      <div className="mt-10 grid h-[34rem] grid-cols-2 grid-rows-2 gap-4 md:grid-cols-3">
        <div
          className="col-span-2 row-span-1 rounded-3xl bg-gray-100 bg-cover bg-center md:col-span-1 md:row-span-2"
          style={{ backgroundImage: `url(${photos[0]})` }}
        />
        <div
          className="rounded-3xl bg-gray-100 bg-cover bg-center md:col-span-2"
          style={{ backgroundImage: `url(${photos[1]})` }}
        />
        <div
          className="rounded-3xl bg-gray-100 bg-cover bg-center md:col-span-2"
          style={{ backgroundImage: `url(${photos[2]})` }}
        />
      </div>
    </section>
  );
}

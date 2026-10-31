'use client';

import { CheckCircle2, Lock, ShieldCheck, Target, Zap, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

const POLL: { key: 'previewPollA' | 'previewPollB' | 'previewPollC'; pct: number }[] = [
  { key: 'previewPollA', pct: 46 },
  { key: 'previewPollB', pct: 31 },
  { key: 'previewPollC', pct: 23 },
];

const CHIPS: { key: 'feature1' | 'feature2' | 'feature4'; icon: LucideIcon }[] = [
  { key: 'feature1', icon: Target },
  { key: 'feature2', icon: Zap },
  { key: 'feature4', icon: ShieldCheck },
];

/**
 * Left half of the auth card on desktop: headline, an illustrative live poll whose bars
 * replay every few seconds, a "survey matched" toast and benefit chips. Decorative only.
 */
export function AuthShowcase(): React.JSX.Element {
  const t = useTranslations('authShowcase');
  const tl = useTranslations('landing');
  const ta = useTranslations('auth');
  // Bumping the key remounts the bars so their grow animation replays.
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setCycle((c) => c + 1), 6000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-ink via-brand-950 to-brand-800 p-10 text-white lg:flex" aria-hidden>
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl" />
      <div className="absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-brand-400/20 blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{ backgroundImage: 'radial-gradient(white 1px, transparent 1px)', backgroundSize: '22px 22px' }}
      />

      <div className="relative motion-safe:animate-fade-up">
        <h2 className="text-[2rem] font-black leading-tight tracking-tight">{t('title')}</h2>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">{t('subtitle')}</p>
      </div>

      {/* Live poll + floating toast */}
      <div className="relative my-10">
        <div className="rounded-3xl border border-white/10 bg-white/[0.07] p-5 shadow-2xl backdrop-blur-md motion-safe:animate-float">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            {tl('previewPollLabel')}
          </p>
          <p className="mt-2.5 font-bold leading-snug">{tl('previewPollQuestion')}</p>
          <ul key={cycle} className="mt-4 flex flex-col gap-2">
            {POLL.map((o, i) => (
              <li key={o.key} className="relative overflow-hidden rounded-xl bg-white/10">
                <div
                  className={`absolute inset-y-0 left-0 origin-left rounded-xl motion-safe:animate-bar-grow ${
                    i === 0 ? 'bg-gradient-to-r from-brand-500 to-brand-400' : 'bg-white/15'
                  }`}
                  style={{ width: `${o.pct}%`, animationDelay: `${i * 120}ms` }}
                />
                <div className="relative flex justify-between px-3 py-2 text-sm">
                  <span className="font-medium">{tl(o.key)}</span>
                  <span className="font-bold tabular-nums">{o.pct}%</span>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-white/45">{tl('previewVotes', { count: '2,418' })}</p>
        </div>

        <div className="absolute -bottom-6 -right-3 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-ink shadow-xl motion-safe:animate-toast-in">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold">{t('toastTitle')}</p>
            <p className="text-xs text-gray-500">{t('toastMeta')}</p>
          </div>
        </div>
      </div>

      <div className="relative">
        <ul className="flex flex-wrap gap-2">
          {CHIPS.map(({ key, icon: Icon }, i) => (
            <li
              key={key}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur motion-safe:animate-fade-up"
              style={{ animationDelay: `${200 + i * 100}ms` }}
            >
              <Icon className="h-3.5 w-3.5 text-brand-300" />
              {tl(key)}
            </li>
          ))}
        </ul>
        <p className="mt-6 flex items-center gap-1.5 text-xs text-white/50">
          <Lock className="h-3.5 w-3.5" />
          {ta('secureNote')}
        </p>
      </div>
    </div>
  );
}

'use client';

import { Check, HelpCircle } from 'lucide-react';

import type { ShowcasePoll } from './polls-showcase-data';

/** Rotating soft palette for the option bars (bar tint + % pill), matching the reference look. */
const PALETTE: { bar: string; pill: string }[] = [
  { bar: 'bg-violet-100', pill: 'bg-violet-100 text-violet-700' },
  { bar: 'bg-emerald-100', pill: 'bg-emerald-100 text-emerald-700' },
  { bar: 'bg-sky-100', pill: 'bg-sky-100 text-sky-700' },
  { bar: 'bg-amber-100', pill: 'bg-amber-100 text-amber-700' },
  { bar: 'bg-orange-100', pill: 'bg-orange-100 text-orange-700' },
  { bar: 'bg-rose-100', pill: 'bg-rose-100 text-rose-700' },
  { bar: 'bg-pink-100', pill: 'bg-pink-100 text-pink-700' },
  { bar: 'bg-cyan-100', pill: 'bg-cyan-100 text-cyan-700' },
  { bar: 'bg-teal-100', pill: 'bg-teal-100 text-teal-700' },
  { bar: 'bg-slate-100', pill: 'bg-slate-200 text-slate-700' },
];

export function PollResultCard({ poll }: { poll: ShowcasePoll }): React.JSX.Element {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
      {/* Voted header */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-6 py-4">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-800 text-white">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
        <span className="text-sm text-gray-500">
          {poll.totalVotes.toLocaleString()} users have already voted
        </span>
      </div>

      {/* Infographics row */}
      <div className="grid grid-cols-2 divide-gray-100 border-b border-gray-100 bg-gray-50/60 md:grid-cols-4 md:divide-x">
        <div className="p-5">
          <p className="text-lg font-black text-gray-900">Infographics</p>
          <button type="button" className="text-sm font-medium text-teal-800 hover:underline">
            Click to show more options
          </button>
        </div>
        <div className="flex flex-col items-center justify-center p-5">
          <p className="text-2xl font-bold text-teal-700">
            <span className="align-middle">♀</span> {poll.femalePct}%
          </p>
          <p className="text-sm text-gray-600">{poll.femaleCount.toLocaleString()} female</p>
        </div>
        <div className="flex flex-col items-center justify-center p-5">
          <p className="text-2xl font-bold text-teal-700">
            <span className="align-middle">♂</span> {poll.malePct}%
          </p>
          <p className="text-sm text-gray-600">{poll.maleCount.toLocaleString()} male</p>
        </div>
        <div className="flex flex-col items-center justify-center p-5">
          <p className="text-3xl font-bold text-teal-700">{poll.totalVotes.toLocaleString()}</p>
          <p className="text-sm text-gray-600">People voted</p>
        </div>
      </div>

      {/* Question + bars */}
      <div className="p-6">
        <div className="mb-6 flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-teal-800 text-white">
            <HelpCircle className="h-6 w-6" />
          </span>
          <h3 className="text-lg font-bold leading-snug text-teal-900 md:text-xl">{poll.question}</h3>
        </div>

        <div className="flex flex-col gap-3">
          {poll.options.map((o, i) => {
            const c = PALETTE[i % PALETTE.length];
            return (
              <div key={o.label} className="flex items-center gap-3">
                {/* Bar with label + votes overlaid */}
                <div className="relative h-12 flex-1 overflow-hidden rounded-lg bg-gray-50 ring-1 ring-gray-100">
                  <div
                    className={`absolute inset-y-0 left-0 ${c.bar}`}
                    style={{ width: `${Math.max(o.percent, 3)}%` }}
                  />
                  <div className="relative flex h-full items-center justify-between gap-3 px-4">
                    <span className="line-clamp-2 text-sm text-gray-700">{o.label}</span>
                    <span className="shrink-0 text-sm font-semibold text-gray-700">
                      {o.votes.toLocaleString()} Votes
                    </span>
                  </div>
                </div>
                {/* % pill */}
                <span
                  className={`flex h-12 w-16 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${c.pill}`}
                >
                  {o.percent}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

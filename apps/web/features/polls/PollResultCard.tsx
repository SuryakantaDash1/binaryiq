'use client';

import { Check } from 'lucide-react';

import type { VotedPollResult } from '@/lib/api/polls';

/** Live results for a poll the member voted on; their own choice is highlighted. */
export function PollResultCard({ poll }: { poll: VotedPollResult }): React.JSX.Element {
  const chosen = new Set(poll.userOptionIds);
  const top = Math.max(0, ...poll.options.map((o) => o.voteCount));

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
      <div className="border-b border-gray-100 px-6 py-4">
        {poll.sponsorName && (
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{poll.sponsorName}</p>
        )}
        <h3 className="mt-0.5 text-base font-bold text-gray-900">{poll.question}</h3>
        <p className="mt-1 text-xs text-gray-500">
          {poll.totalVotes.toLocaleString()} vote{poll.totalVotes === 1 ? '' : 's'} · you voted{' '}
          {new Date(poll.votedAt).toLocaleDateString()}
        </p>
      </div>

      <ul className="flex flex-col gap-2.5 px-6 py-5">
        {poll.options.map((o) => {
          const mine = chosen.has(o.id);
          const leading = o.voteCount > 0 && o.voteCount === top;
          return (
            <li key={o.id} className="relative overflow-hidden rounded-xl bg-gray-50">
              <div
                className={`absolute inset-y-0 left-0 rounded-xl transition-all duration-500 ${
                  mine ? 'bg-brand-100' : leading ? 'bg-gray-200/80' : 'bg-gray-100'
                }`}
                style={{ width: `${o.percentage}%` }}
              />
              <div className="relative flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className={`flex items-center gap-2 ${mine ? 'font-semibold text-brand-900' : 'text-gray-700'}`}>
                  {mine && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-700 text-white">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                  )}
                  {o.optionText}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-gray-900">{o.percentage}%</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

'use client';

import { Alert, Button, PollResultBars } from '@binaryiq/ui';
import { useEffect, useState } from 'react';


import { POINTS_ENABLED } from '@/features/flags';
import { ApiError } from '@/lib/api/client';
import { pollsApi, type PollDetail, type PollResult } from '@/lib/api/polls';

interface VotePanelProps {
  poll: PollDetail;
}

export function VotePanel({ poll }: VotePanelProps): React.JSX.Element {
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<PollResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyVoted, setAlreadyVoted] = useState(poll.hasVoted);

  const isClosed = !poll.isActive || (poll.expiresAt ? new Date(poll.expiresAt) < new Date() : false);

  useEffect(() => {
    if (poll.hasVoted || isClosed) {
      pollsApi.results(poll.id).then(setResult).catch(() => {});
    }
  }, [poll.id, poll.hasVoted, isClosed]);

  const handleVote = async () => {
    if (selected.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await pollsApi.vote(poll.id, selected);
      setResult(res);
      setAlreadyVoted(true);
    } catch (err) {
      if (err instanceof ApiError && err.message === 'already_voted') {
        setAlreadyVoted(true);
        pollsApi.results(poll.id).then(setResult).catch(() => {});
      } else {
        setError(err instanceof ApiError ? err.message : 'Vote failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        {alreadyVoted && !isClosed && (
          <Alert variant="info">You&apos;ve already voted on this poll.</Alert>
        )}
        {isClosed && (
          <Alert variant="info">This poll has closed &mdash; here&apos;s how people voted.</Alert>
        )}
        {POINTS_ENABLED && result.pointsAwarded > 0 && !poll.hasVoted && (
          <div className="bg-primary/10 border-primary rounded-lg border p-3 text-center">
            <span className="text-primary font-bold">+{result.pointsAwarded} pts earned!</span>
          </div>
        )}
        <PollResultBars
          options={result.options}
          userOptionIds={result.userOptionIds}
          totalVotes={result.totalVotes}
        />
      </div>
    );
  }

  if (isClosed) {
    return <Alert variant="warning">This poll has closed.</Alert>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-secondary text-sm">
        {poll.pollType === 'SINGLE_CHOICE' ? 'Choose one option' : 'Choose one or more options'}
      </p>

      {poll.pollType === 'SINGLE_CHOICE' ? (
        <div className="flex flex-col gap-2">
          {poll.options.map((opt) => (
            <label key={opt.id} className="border-border hover:border-primary flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors">
              <input
                type="radio"
                name="poll-option"
                value={opt.id}
                checked={selected[0] === opt.id}
                onChange={() => setSelected([opt.id])}
                className="accent-primary"
              />
              <span className="text-text">{opt.optionText}</span>
            </label>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {poll.options.map((opt) => (
            <label key={opt.id} className="border-border hover:border-primary flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors">
              <input
                type="checkbox"
                value={opt.id}
                checked={selected.includes(opt.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelected((prev) => [...prev, opt.id]);
                  } else {
                    setSelected((prev) => prev.filter((id) => id !== opt.id));
                  }
                }}
                className="accent-primary"
              />
              <span className="text-text">{opt.optionText}</span>
            </label>
          ))}
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      <Button
        fullWidth
        loading={loading}
        disabled={selected.length === 0}
        onClick={handleVote}
      >
        {POINTS_ENABLED ? `Vote (${poll.pointsReward} Points)` : 'Vote'}
      </Button>
    </div>
  );
}

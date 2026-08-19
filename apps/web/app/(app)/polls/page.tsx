'use client';


import { Alert, EmptyState, Heading, PollCard, Skeleton, Text } from '@influencer/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { pollsApi, type PollSummary } from '@/lib/api/polls';

export default function PollsPage(): React.JSX.Element {
  const [polls, setPolls] = useState<PollSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    pollsApi.list()
      .then(setPolls)
      .catch(() => setError('Failed to load polls'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <Heading level={2}>Polls</Heading>
        <Text color="secondary" size="sm">Vote and earn +15 pts per poll.</Text>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : polls.length === 0 ? (
        <EmptyState
          title="No polls right now"
          description="Check back soon — new polls are added regularly."
          action={
            <Link href="/">
              <button type="button" className="text-primary hover:underline text-sm">Back to dashboard</button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {polls.map((p) => (
            <Link key={p.id} href={`/polls/${p.id}`} className="block">
              <PollCard poll={p} className="hover:border-primary transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

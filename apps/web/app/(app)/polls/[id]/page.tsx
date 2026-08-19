'use client';


import { Alert, Badge, Heading, Skeleton, Text } from '@influencer/ui';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { VotePanel } from '@/features/polls/VotePanel';
import { pollsApi, type PollDetail } from '@/lib/api/polls';

export default function PollDetailPage(): React.JSX.Element {
  const params = useParams();
  const id = params.id as string;
  const [poll, setPoll] = useState<PollDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pollsApi.get(id)
      .then(setPoll)
      .catch(() => setError('Poll not found'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Skeleton className="mb-4 h-8 w-2/3" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (error || !poll) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Alert variant="error">{error ?? 'Poll not found'}</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="mb-4 flex items-center gap-3">
        <Badge variant="primary">{poll.pollType === 'SINGLE_CHOICE' ? 'Single choice' : 'Multi choice'}</Badge>
        {poll.sponsorName && <Text color="secondary" size="sm">by {poll.sponsorName}</Text>}
      </div>
      <Heading level={2} className="mb-6">{poll.question}</Heading>
      <VotePanel poll={poll} />
    </div>
  );
}

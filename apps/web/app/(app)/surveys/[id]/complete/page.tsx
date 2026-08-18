'use client';

import { Heading, Text, Button, Alert } from '@influencer/ui';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

import { surveysApi } from '@/lib/api/surveys';

export default function SurveyCompletePage(): React.JSX.Element {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;

  const [status, setStatus] = useState<'loading' | 'completed' | 'disqualified' | 'error'>('loading');
  const [pointsAwarded, setPointsAwarded] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const outcome = (searchParams.get('status') as 'disqualified' | null) ?? 'completed';
    surveysApi
      .complete(id, outcome)
      .then((res) => {
        setPointsAwarded(res.pointsAwarded);
        setStatus(res.status);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Something went wrong';
        setErrorMsg(msg);
        setStatus('error');
      });
  }, [id, searchParams]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <Text>Processing your response…</Text>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center">
        <Alert variant="error" className="mb-6">
          {errorMsg}
        </Alert>
        <Button variant="outline" onClick={() => router.push('/surveys')}>
          Back to surveys
        </Button>
      </div>
    );
  }

  if (status === 'disqualified') {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center">
        <Heading level={3} className="mb-3">
          You didn&apos;t qualify this time
        </Heading>
        <Text color="secondary" className="mb-6">
          No worries — there are plenty of other surveys waiting for you!
        </Text>
        <Button onClick={() => router.push('/surveys')}>Browse more surveys</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16 text-center">
      <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <span className="text-4xl font-bold text-primary">&#10003;</span>
      </div>
      <Heading level={3} className="mb-2">
        Survey Complete!
      </Heading>
      <p className="mb-6 text-3xl font-bold text-primary">+{pointsAwarded.toLocaleString()} pts</p>
      <Text color="secondary" className="mb-8">
        Points have been added to your balance.
      </Text>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => router.push('/rewards/history')} fullWidth>
          View balance
        </Button>
        <Button onClick={() => router.push('/surveys')} fullWidth>
          More surveys
        </Button>
      </div>
    </div>
  );
}

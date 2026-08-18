'use client';

import { Button, Heading, Text } from '@influencer/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

function VerifyInner(): React.JSX.Element {
  const params = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [points, setPoints] = useState(0);

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('Missing verification token.');
      return;
    }
    authApi
      .verifyEmail(token)
      .then((res) => {
        setPoints(res.pointsAwarded);
        setState('ok');
      })
      .catch((err: unknown) => {
        setState('error');
        setMessage(err instanceof ApiError ? err.message : 'Verification failed.');
      });
  }, [token]);

  if (state === 'loading') return <Text color="secondary">Verifying your email…</Text>;

  if (state === 'error') {
    return (
      <div className="flex flex-col gap-3 text-center">
        <Heading level={3}>Verification failed</Heading>
        <Text color="secondary">{message}</Text>
        <Link href="/login" className="text-primary text-sm">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 text-center">
      <Heading level={3}>You&apos;re all set! 🎉</Heading>
      <Text color="secondary">
        Your email is verified
        {points > 0 ? ` and ${points} welcome points are in your account` : ''}.
      </Text>
      <Link href="/login">
        <Button fullWidth>Continue to sign in</Button>
      </Link>
    </div>
  );
}

export default function VerifyPage(): React.JSX.Element {
  return (
    <Suspense fallback={<Text color="secondary">Loading…</Text>}>
      <VerifyInner />
    </Suspense>
  );
}

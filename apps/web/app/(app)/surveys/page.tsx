'use client';

import { Tabs, SurveyCard, EmptyState, Skeleton, Button, Alert, Heading, Text } from '@binaryiq/ui';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';

import { POINTS_ENABLED } from '@/features/flags';
import { surveysApi, type MatchedSurveys } from '@/lib/api/surveys';

export default function SurveysPage(): React.JSX.Element {
  const [data, setData] = useState<MatchedSurveys | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('priority');

  const load = useCallback(() => {
    setLoading(true);
    surveysApi
      .list()
      .then(setData)
      .catch(() => setError('Failed to load surveys'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tabGroups = [
    { key: 'priority', label: 'Priority', surveys: data?.priority ?? [] },
    { key: 'quick', label: 'Quick', surveys: data?.quick ?? [] },
    { key: 'premium', label: 'Premium', surveys: data?.premium ?? [] },
  ];

  // tabGroups always has 3 entries; tab initialises to 'priority' which always matches
   
  const current = (tabGroups.find((t) => t.key === tab) ?? tabGroups[0])!;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <Heading level={2}>Surveys</Heading>
        <Text color="secondary" size="sm">
          {POINTS_ENABLED ? 'Complete surveys to earn points.' : 'Surveys picked to match your profile.'}
        </Text>
      </div>

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      <Tabs
        tabs={tabGroups.map((t) => ({
          key: t.key,
          label: `${t.label}${data ? ` (${t.surveys.length})` : ''}`,
        }))}
        active={tab}
        onChange={setTab}
      >
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : current.surveys.length === 0 ? (
          <EmptyState
            title="No surveys available right now"
            description={
              POINTS_ENABLED
                ? 'Complete your profile to unlock more surveys and earn more points.'
                : 'Complete your profile to unlock more surveys.'
            }
            action={
              <Link href="/account/about-you">
                <Button variant="outline">Complete profile</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {current.surveys.map((s) => (
              <Link key={s.id} href={`/surveys/${s.id}`} className="block">
                <SurveyCard survey={s} showPoints={POINTS_ENABLED} className="hover:border-primary transition-colors" />
              </Link>
            ))}
          </div>
        )}
      </Tabs>
    </div>
  );
}

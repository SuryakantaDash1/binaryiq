'use client';

import { Heading, Text, Badge, Card, CardBody } from '@binaryiq/ui';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

import { POINTS_ENABLED } from '@/features/flags';
import { SurveyForm } from '@/features/profile-surveys/SurveyForm';
import { profileSurveysApi } from '@/lib/api/profile-surveys';
import type { CategoryDetail } from '@/lib/api/profile-surveys';

export default function CategoryPage(): React.JSX.Element {
  const { key } = useParams<{ key: string }>();
  const router = useRouter();
  const [data, setData] = useState<CategoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);

  useEffect(() => {
    profileSurveysApi.get(key)
      .then(setData)
      .catch(() => setError('Category not found'))
      .finally(() => setLoading(false));
  }, [key]);

  const handleSubmit = useCallback(async (answers: Record<string, unknown>) => {
    const result = await profileSurveysApi.submit(key, answers);
    setPointsEarned(result.pointsAwarded);
    setSubmitted(true);
  }, [key]);

  if (loading) return <div className="text-secondary p-8 text-center">Loading…</div>;
  if (error) return <div className="text-red-600 p-8 text-center">{error}</div>;
  if (!data) return <></>;

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Heading level={2}>{POINTS_ENABLED ? `🎉 +${pointsEarned} points!` : '🎉 Thanks!'}</Heading>
        <Text color="secondary" className="mt-2">You completed the {data.name} survey.</Text>
        <button
          className="text-primary mt-6 text-sm underline"
          onClick={() => router.push('/profile-surveys')}
        >
          Back to all categories
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <button
        className="text-secondary mb-4 text-sm"
        onClick={() => router.push('/profile-surveys')}
      >
        ← Back
      </button>
      <Card>
        <CardBody>
          <div className="mb-6 flex items-center gap-3">
            <Heading level={3}>{data.name}</Heading>
            {data.completed && <Badge variant="success">Completed</Badge>}
            {POINTS_ENABLED && <Badge variant="primary">{data.pointsValue} pts</Badge>}
          </div>
          <SurveyForm
            schema={data.schema}
            defaults={data.responses as Record<string, unknown> | undefined}
            onSubmit={handleSubmit}
            readOnly={data.completed}
          />
        </CardBody>
      </Card>
    </div>
  );
}

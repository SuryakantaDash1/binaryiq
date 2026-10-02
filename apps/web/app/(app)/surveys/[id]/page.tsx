'use client';

import { Heading, Text, Button, Alert, Badge, Skeleton, Card, CardBody } from '@influencer/ui';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

import { ApiError } from '@/lib/api/client';
import { surveysApi, type SurveyDetail, type StartResult } from '@/lib/api/surveys';
import { safeHttpUrl } from '@/lib/safe-url';

const TYPE_BADGE: Record<string, { variant: 'primary' | 'default' | 'success' | 'warning'; label: string }> = {
  PRIORITY: { variant: 'primary', label: 'Priority' },
  QUICK: { variant: 'success', label: 'Quick' },
  PREMIUM: { variant: 'warning', label: 'Premium' },
};

export default function SurveyDetailPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    surveysApi
      .get(id)
      .then(setSurvey)
      .catch(() => setError('Survey not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleStart = async () => {
    if (!survey) return;
    setStarting(true);
    setError(null);
    try {
      const result: StartResult = await surveysApi.start(id);
      const externalUrl = result.mode === 'external' ? safeHttpUrl(result.externalUrl) : undefined;
      if (externalUrl) {
        window.location.assign(externalUrl);
      } else if (result.mode === 'external') {
        setError('This survey link is invalid. Please contact support.');
        setStarting(false);
      } else {
        router.push(`/surveys/${id}/complete?returnToken=${result.returnToken}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start survey');
      setStarting(false);
    }
  };

  const badge =
    survey ? (TYPE_BADGE[survey.type] ?? { variant: 'default' as const, label: survey.type }) : null;

  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Skeleton className="mb-4 h-8 w-2/3" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Alert variant="error">{error ?? 'Survey not found'}</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="mb-2 flex items-center gap-3">
        <Badge variant={badge!.variant}>{badge!.label}</Badge>
        {survey.expiresAt && (
          <Text color="secondary" size="sm">
            Expires {new Date(survey.expiresAt).toLocaleDateString('en-IN')}
          </Text>
        )}
      </div>
      <Heading level={2} className="mb-4">
        {survey.title}
      </Heading>
      {survey.description && (
        <Text color="secondary" className="mb-6">
          {survey.description}
        </Text>
      )}

      <Card className="mb-6">
        <CardBody>
          <div className="flex justify-around text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{survey.pointsValue.toLocaleString()}</p>
              <p className="text-xs text-text-secondary">points</p>
            </div>
            {survey.estimatedMins && (
              <div>
                <p className="text-2xl font-bold text-text">{survey.estimatedMins}</p>
                <p className="text-xs text-text-secondary">minutes</p>
              </div>
            )}
            <div>
              <p className="text-2xl font-bold text-text">{survey.isExternal ? 'External' : 'In-app'}</p>
              <p className="text-xs text-text-secondary">format</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      <Button fullWidth loading={starting} onClick={handleStart}>
        Start Survey — Earn {survey.pointsValue.toLocaleString()} pts
      </Button>
    </div>
  );
}

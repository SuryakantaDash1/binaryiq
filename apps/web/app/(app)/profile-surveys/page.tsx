'use client';

import { Card, CardBody, Heading, Text, Badge, Button, ProgressRing } from '@influencer/ui';
import Link from 'next/link';
import { useState, useEffect } from 'react';

import { profileSurveysApi } from '@/lib/api/profile-surveys';
import type { CategoryListResult } from '@/lib/api/profile-surveys';

export default function ProfileSurveysPage(): React.JSX.Element {
  const [data, setData] = useState<CategoryListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    profileSurveysApi.list()
      .then(setData)
      .catch(() => setError('Failed to load categories'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-secondary p-8 text-center">Loading…</div>;
  if (error) return <div className="text-red-600 p-8 text-center">{error}</div>;
  if (!data) return <></>;

  const pct = data.total > 0 ? data.completed / data.total : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 flex items-center gap-6">
        <ProgressRing value={pct} size={80} label={`${data.completed}/${data.total}`} />
        <div>
          <Heading level={2}>Profile Surveys</Heading>
          <Text color="secondary" size="sm">
            Complete categories to earn points and unlock better survey matches.
          </Text>
          <Text color="secondary" size="sm">
            {data.points.earned} pts earned · {data.points.remaining} remaining
          </Text>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {data.categories.map((cat) => (
          <Card key={cat.id}>
            <CardBody>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <Text className="font-semibold">{cat.name}</Text>
                    {cat.completed && <Badge variant="success">Done</Badge>}
                  </div>
                  <Text color="secondary" size="sm">{cat.pointsValue} pts</Text>
                </div>
                <Link href={`/profile-surveys/${cat.key}`}>
                  <Button size="sm" variant={cat.completed ? 'outline' : 'primary'}>
                    {cat.completed ? 'View' : 'Start'}
                  </Button>
                </Link>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}

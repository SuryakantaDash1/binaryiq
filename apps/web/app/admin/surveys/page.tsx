'use client';

import { ResourceList } from '@/features/admin/ResourceList';
import { adminApi } from '@/lib/api/admin';

export default function AdminSurveysPage(): React.JSX.Element {
  return <ResourceList title="Surveys" description="All surveys" load={() => adminApi.listSurveys()} />;
}

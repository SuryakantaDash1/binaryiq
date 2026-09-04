'use client';

import { ResourceList } from '@/features/admin/ResourceList';
import { adminApi } from '@/lib/api/admin';

export default function AdminPollsPage(): React.JSX.Element {
  return <ResourceList title="Polls" description="All sponsored polls" load={() => adminApi.listPolls()} />;
}

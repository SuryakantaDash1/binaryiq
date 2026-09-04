'use client';

import { ResourceList } from '@/features/admin/ResourceList';
import { adminApi } from '@/lib/api/admin';

export default function AdminRewardsPage(): React.JSX.Element {
  return <ResourceList title="Rewards" description="Rewards catalogue" load={() => adminApi.listRewards()} />;
}

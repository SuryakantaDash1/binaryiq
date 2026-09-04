'use client';

import { ResourceList } from '@/features/admin/ResourceList';
import { adminApi } from '@/lib/api/admin';

export default function AdminGamesPage(): React.JSX.Element {
  return <ResourceList title="Games" description="All games" load={() => adminApi.listGames()} />;
}

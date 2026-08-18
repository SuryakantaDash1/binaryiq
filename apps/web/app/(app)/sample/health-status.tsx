'use client';

import type { HealthReady } from '@influencer/types';
import { useQuery } from '@tanstack/react-query';

import { Badge } from '@/components/badge';
import { apiFetch, ApiError } from '@/lib/api/client';

/** Proves the typed API client ⇄ envelope wiring end-to-end (Phase 0 acceptance #7). */
export function HealthStatus(): React.JSX.Element {
  const { data, error, isLoading } = useQuery<HealthReady, ApiError>({
    queryKey: ['health-ready'],
    queryFn: () => apiFetch<HealthReady>('/health/ready'),
    retry: false,
  });

  if (isLoading) return <span className="text-text-muted text-sm">Checking API…</span>;
  if (error) {
    return <Badge tone="danger">API unreachable ({error.code})</Badge>;
  }
  return (
    <div className="flex items-center gap-2">
      <Badge tone={data?.status === 'ok' ? 'success' : 'danger'}>API {data?.status}</Badge>
      <span className="text-text-muted text-sm">
        postgres: {data?.dependencies.postgres} · redis: {data?.dependencies.redis}
      </span>
    </div>
  );
}

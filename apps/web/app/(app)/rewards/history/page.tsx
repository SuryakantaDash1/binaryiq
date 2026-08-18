import { Heading } from '@influencer/ui';

import { PointsDashboard } from '@/features/rewards/PointsDashboard';

export default function PointsHistoryPage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Heading level={2} className="mb-6">Points & Rewards History</Heading>
      <PointsDashboard />
    </div>
  );
}

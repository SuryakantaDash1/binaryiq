import { Badge } from './badge.js';
import { Card, CardBody } from './card.js';
import { Text } from './text.js';
import { cn } from './utils/cn.js';

interface PollCardData {
  id: string;
  question: string;
  pollType: 'SINGLE_CHOICE' | 'MULTI_CHOICE';
  sponsorName: string | null;
  pointsReward: number;
  totalVotes: number;
}

interface PollCardProps {
  poll: PollCardData;
  className?: string;
}

export function PollCard({ poll, className }: PollCardProps): React.JSX.Element {
  return (
    <Card className={cn('cursor-pointer', className)}>
      <CardBody>
        <div className="mb-2 flex items-start justify-between gap-2">
          <Text className="font-semibold leading-snug">{poll.question}</Text>
          <Badge variant="primary">{poll.pollType === 'SINGLE_CHOICE' ? 'Single' : 'Multi'}</Badge>
        </div>
        {poll.sponsorName && (
          <Text color="secondary" size="sm" className="mb-2">Sponsored by {poll.sponsorName}</Text>
        )}
        <div className="text-secondary flex items-center justify-between text-sm">
          <span>{poll.totalVotes.toLocaleString()} voted</span>
          <span className="text-primary font-semibold">+{poll.pointsReward} pts</span>
        </div>
      </CardBody>
    </Card>
  );
}
export type { PollCardProps, PollCardData };

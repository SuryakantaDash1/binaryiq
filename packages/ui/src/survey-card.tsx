import type { ReactNode } from 'react';

import { Badge } from './badge.js';
import { Card, CardBody } from './card.js';
import { Text } from './text.js';

export interface SurveyCardData {
  id: string;
  title: string;
  type: 'PRIORITY' | 'QUICK' | 'PREMIUM';
  pointsValue: number;
  estimatedMins: number | null;
  isExternal: boolean;
}

const TYPE_BADGE: Record<string, { variant: 'primary' | 'default' | 'success' | 'warning'; label: string }> = {
  PRIORITY: { variant: 'primary', label: 'Priority' },
  QUICK: { variant: 'success', label: 'Quick' },
  PREMIUM: { variant: 'warning', label: 'Premium' },
};

export interface SurveyCardProps {
  survey: SurveyCardData;
  action?: ReactNode;
  className?: string;
}

export function SurveyCard({ survey, action, className }: SurveyCardProps): React.JSX.Element {
  const badge = TYPE_BADGE[survey.type] ?? { variant: 'default' as const, label: survey.type };
  return (
    <Card className={className}>
      <CardBody>
        <div className="mb-2 flex items-start justify-between gap-2">
          <Text className="font-semibold leading-snug">{survey.title}</Text>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
        <div className="flex items-center gap-3 text-sm text-text-secondary">
          <span className="font-bold text-primary">{survey.pointsValue.toLocaleString()} pts</span>
          {survey.estimatedMins && <span>~{survey.estimatedMins} min</span>}
          {survey.isExternal && <span className="italic">External</span>}
        </div>
        {action && <div className="mt-4">{action}</div>}
      </CardBody>
    </Card>
  );
}

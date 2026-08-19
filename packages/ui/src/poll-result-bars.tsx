import { cn } from './utils/cn.js';

interface BarOption {
  id: string;
  optionText: string;
  voteCount: number;
  percentage: number;
}

interface PollResultBarsProps {
  options: BarOption[];
  userOptionIds?: string[];
  totalVotes: number;
  className?: string;
}

export function PollResultBars({ options, userOptionIds = [], totalVotes, className }: PollResultBarsProps): React.JSX.Element {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {options.map((opt) => {
        const isSelected = userOptionIds.includes(opt.id);
        return (
          <div key={opt.id}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className={cn('font-medium', isSelected ? 'text-primary' : 'text-text')}>
                {isSelected && <span className="mr-1">&#10003;</span>}
                {opt.optionText}
              </span>
              <span className={cn('font-semibold', isSelected ? 'text-primary' : 'text-secondary')}>
                {opt.percentage.toFixed(1)}%
              </span>
            </div>
            <div className="bg-border h-2 w-full overflow-hidden rounded-full">
              <div
                className={cn('h-full rounded-full transition-all duration-500', isSelected ? 'bg-primary' : 'bg-neutral-400')}
                style={{ width: `${Math.min(opt.percentage, 100)}%` }}
              />
            </div>
            <p className="text-secondary mt-0.5 text-xs">{opt.voteCount.toLocaleString()} votes</p>
          </div>
        );
      })}
      <p className="text-secondary text-xs">{totalVotes.toLocaleString()} total voters</p>
    </div>
  );
}
export type { PollResultBarsProps };

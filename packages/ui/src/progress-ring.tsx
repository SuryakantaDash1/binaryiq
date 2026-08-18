interface ProgressRingProps {
  value: number; // 0–1
  size?: number;
  label?: string;
  className?: string;
}

export function ProgressRing({ value, size = 64, label, className }: ProgressRingProps): React.JSX.Element {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, Math.max(0, value)));
  return (
    <div className={`relative inline-flex items-center justify-center ${className ?? ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={6} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--color-primary)" strokeWidth={6}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      {label && (
        <span className="text-text absolute text-xs font-semibold">{label}</span>
      )}
    </div>
  );
}
export type { ProgressRingProps };

'use client';

import { useEffect, useRef, useState } from 'react';

import { cn } from './utils/cn.js';

interface SpinWheelSegment {
  index: number;
  label: string;
  pointsValue: number;
  color: string;
}

interface SpinWheelProps {
  segments: SpinWheelSegment[];
  targetIndex?: number;
  spinning?: boolean;
  onAnimationEnd?: () => void;
  className?: string;
}

const SIZE = 300;
const CX = SIZE / 2;
const CY = SIZE / 2;
const RADIUS = 130;
const LABEL_RADIUS = 90;

function polarToXY(angleDeg: number, r: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function segmentPath(index: number, total: number): string {
  const sliceDeg = 360 / total;
  const startAngle = index * sliceDeg;
  const endAngle = startAngle + sliceDeg;
  const start = polarToXY(startAngle, RADIUS);
  const end = polarToXY(endAngle, RADIUS);
  const largeArc = sliceDeg > 180 ? 1 : 0;
  return `M ${CX} ${CY} L ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

function labelTransform(index: number, total: number): string {
  const sliceDeg = 360 / total;
  const midAngle = index * sliceDeg + sliceDeg / 2;
  const { x, y } = polarToXY(midAngle, LABEL_RADIUS);
  return `translate(${x}, ${y}) rotate(${midAngle})`;
}

export function SpinWheel({ segments, targetIndex, spinning = false, onAnimationEnd, className }: SpinWheelProps): React.JSX.Element {
  const wheelRef = useRef<SVGGElement>(null);
  const [rotation, setRotation] = useState(0);
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!spinning || targetIndex === undefined) return;
    const SLICE = 360 / segments.length;
    const EXTRA_TURNS = prefersReduced ? 1 : 5;
    const targetAngle = EXTRA_TURNS * 360 + (360 - (targetIndex * SLICE + SLICE / 2));
    setRotation((prev) => prev + targetAngle);
  }, [spinning, targetIndex, segments.length, prefersReduced]);

  const duration = prefersReduced ? 0.4 : 3.5;

  return (
    <div className={cn('relative inline-flex flex-col items-center', className)}>
      <div className="absolute top-0 left-1/2 z-10 -translate-x-1/2 -translate-y-1 text-2xl leading-none text-primary">▼</div>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden="true"
        style={{ overflow: 'visible' }}
      >
        <g
          ref={wheelRef}
          style={{
            transformOrigin: `${CX}px ${CY}px`,
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? `transform ${duration}s cubic-bezier(0.17, 0.67, 0.12, 0.99)` : 'none',
          }}
          onTransitionEnd={onAnimationEnd}
        >
          {segments.map((seg, i) => (
            <g key={seg.index}>
              <path
                d={segmentPath(i, segments.length)}
                fill={seg.color}
                stroke="white"
                strokeWidth={2}
              />
              <text
                transform={labelTransform(i, segments.length)}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={10}
                fontWeight="bold"
                fill="white"
                style={{ pointerEvents: 'none' }}
              >
                {seg.pointsValue > 0 ? `${seg.pointsValue}` : '🍀'}
              </text>
            </g>
          ))}
          <circle cx={CX} cy={CY} r={20} fill="white" stroke="#0d9488" strokeWidth={3} />
        </g>
      </svg>
    </div>
  );
}
export type { SpinWheelProps, SpinWheelSegment };

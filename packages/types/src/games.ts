import { z } from 'zod';

export interface SegmentView {
  index: number;
  label: string;
  pointsValue: number;
  color: string;
}

export interface GameListItem {
  id: string;
  gameName: string;
  gameType: 'SPIN_WHEEL' | 'QUIZ';
  isFree: boolean;
  playedToday: boolean;
  nextSpinAt: string | null;
}

export interface GameDetail {
  id: string;
  gameName: string;
  gameType: 'SPIN_WHEEL' | 'QUIZ';
  isFree: boolean;
  playedToday: boolean;
  segments: SegmentView[];
}

export interface SpinResult {
  playId: string;
  segmentIndex: number;
  segmentId: string;
  pointsWon: number;
  newBalance: number;
  playedAt: string;
}

export interface SpinStatus {
  hasSpunToday: boolean;
  nextSpinAt: string | null;
  lastResult: { segmentIndex: number; pointsWon: number } | null;
}

export interface PlayHistoryItem {
  playId: string;
  gameName: string;
  label: string;
  pointsWon: number;
  playedAt: string;
}

export interface SegmentInput {
  label: string;
  pointsValue: number;
  probability: number;
  color: string;
  sortOrder: number;
}

export const segmentInputSchema = z.object({
  label: z.string().min(1).max(200),
  pointsValue: z.number().int().nonnegative(),
  probability: z.number().positive(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color'),
  sortOrder: z.number().int().nonnegative(),
});

export const createGameSchema = z.object({
  gameName: z.string().min(1).max(200),
  gameType: z.enum(['SPIN_WHEEL', 'QUIZ']),
  isFree: z.boolean().optional(),
  segments: z.array(segmentInputSchema).min(2),
});
export type CreateGameInput = z.infer<typeof createGameSchema>;

export const updateSegmentsSchema = z.object({
  segments: z.array(segmentInputSchema).min(2),
});
export type UpdateSegmentsInput = z.infer<typeof updateSegmentsSchema>;

export const spinInputSchema = z.object({
  gameId: z.string().uuid().optional(),
});
export type SpinInput = z.infer<typeof spinInputSchema>;

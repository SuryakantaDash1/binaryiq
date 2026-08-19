import { apiFetch } from './client.js';

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

export interface GameDetail extends GameListItem {
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

export const gamesApi = {
  list(): Promise<GameListItem[]> { return apiFetch('/games'); },
  get(id: string): Promise<GameDetail> { return apiFetch(`/games/${id}`); },
  spinStatus(): Promise<SpinStatus> { return apiFetch('/games/spin/status'); },
  spin(gameId?: string): Promise<SpinResult> {
    return apiFetch('/games/spin', { method: 'POST', body: gameId ? { gameId } : {} });
  },
};

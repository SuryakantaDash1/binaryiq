import type { VotedPollResult } from '@binaryiq/types';

import { apiFetch } from './client.js';

export type { VotedPollResult };

export interface PollSummary {
  id: string;
  question: string;
  pollType: 'SINGLE_CHOICE' | 'MULTI_CHOICE';
  sponsorName: string | null;
  pointsReward: number;
  totalVotes: number;
  expiresAt: string | null;
}

export interface PollOption {
  id: string;
  optionText: string;
  sortOrder: number;
}

export interface PollDetail extends PollSummary {
  isActive: boolean;
  hasVoted: boolean;
  options: PollOption[];
}

export interface PollResultOption {
  id: string;
  optionText: string;
  voteCount: number;
  percentage: number;
}

export interface PollResult {
  pollId: string;
  totalVotes: number;
  pointsAwarded: number;
  userOptionIds: string[];
  options: PollResultOption[];
}

export interface PollCount {
  unvotedCount: number;
  totalActive: number;
}

export const pollsApi = {
  list(): Promise<PollSummary[]> { return apiFetch('/polls'); },
  count(): Promise<PollCount> { return apiFetch('/polls/count'); },
  get(id: string): Promise<PollDetail> { return apiFetch(`/polls/${id}`); },
  results(id: string): Promise<PollResult> { return apiFetch(`/polls/${id}/results`); },
  /** Polls the member has voted on, newest first, with current results. */
  voted(): Promise<VotedPollResult[]> { return apiFetch('/polls/voted'); },
  vote(id: string, optionIds: string[]): Promise<PollResult> {
    return apiFetch(`/polls/${id}/vote`, { method: 'POST', body: { optionIds } });
  },
};

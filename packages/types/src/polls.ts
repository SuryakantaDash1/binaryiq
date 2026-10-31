import { z } from 'zod';

// ─── Member DTOs ──────────────────────────────────────────────
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

/** A poll the member has voted on, with the live community breakdown. */
export interface VotedPollResult extends PollResult {
  question: string;
  sponsorName: string | null;
  votedAt: string;
}

export interface PollCount {
  unvotedCount: number;
  totalActive: number;
}

// ─── Input schemas (input == output, no transforms, so ZodValidationPipe is happy) ──
export const voteInputSchema = z.object({
  optionIds: z.array(z.string().uuid()).min(1),
});
export type VoteInput = z.infer<typeof voteInputSchema>;

export const createPollOptionSchema = z.object({
  optionText: z.string().min(1).max(500),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const createPollSchema = z.object({
  question: z.string().min(1).max(500),
  pollType: z.enum(['SINGLE_CHOICE', 'MULTI_CHOICE']),
  pointsReward: z.number().int().positive().optional(),
  sponsorName: z.string().max(100).optional(),
  expiresAt: z.string().optional(),
  options: z.array(createPollOptionSchema).min(2),
});
export type CreatePollInput = z.infer<typeof createPollSchema>;

export const updatePollSchema = z.object({
  question: z.string().min(1).max(500).optional(),
  sponsorName: z.string().max(100).optional(),
  expiresAt: z.string().optional(),
  isActive: z.boolean().optional(),
});
export type UpdatePollInput = z.infer<typeof updatePollSchema>;

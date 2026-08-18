import { z } from 'zod';

// ─── Points ───────────────────────────────────────────────────
export interface PointsBalanceView {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  updatedAt: string;
}

export interface PointsTransactionView {
  id: string;
  direction: 'CREDIT' | 'DEBIT';
  action: string;
  points: number;
  balanceAfter: number;
  description: string;
  refType: string | null;
  refId: string | null;
  createdAt: string;
}

export const transactionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  direction: z.enum(['CREDIT', 'DEBIT']).optional(),
  action: z.string().optional(),
});
export type TransactionQuery = z.infer<typeof transactionQuerySchema>;

// ─── Rewards ───────────────────────────────────────────────────
export interface RewardView {
  id: string;
  name: string;
  description: string;
  rewardType: 'CHARITY' | 'PAYPAL' | 'VOUCHER' | 'MERCHANDISE';
  pointsRequired: number;
  imageUrl: string | null;
  stock: number | null;
}

export const createRewardSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  rewardType: z.enum(['CHARITY', 'PAYPAL', 'VOUCHER', 'MERCHANDISE']),
  pointsRequired: z.number().int().positive(),
  imageUrl: z.string().url().optional(),
  stock: z.number().int().nonnegative().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateRewardInput = z.infer<typeof createRewardSchema>;

export const updateRewardSchema = createRewardSchema.partial();
export type UpdateRewardInput = z.infer<typeof updateRewardSchema>;

// ─── Redemptions ───────────────────────────────────────────────
export interface RedemptionView {
  id: string;
  rewardId: string;
  rewardName: string;
  rewardType: string;
  pointsSpent: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  fulfillmentRef: string | null;
  createdAt: string;
}

export const redeemInputSchema = z.object({
  rewardId: z.string().uuid(),
});
export type RedeemInput = z.infer<typeof redeemInputSchema>;

export const updateRedemptionStatusSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED']),
  fulfillmentRef: z.string().optional(),
  notes: z.string().optional(),
});
export type UpdateRedemptionStatusInput = z.infer<typeof updateRedemptionStatusSchema>;

export const redemptionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED']).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});
export type RedemptionQuery = z.infer<typeof redemptionQuerySchema>;

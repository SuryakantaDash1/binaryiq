import { apiFetch } from './client.js';

export interface PointsBalance {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  updatedAt: string;
}

export interface PointsTransaction {
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

export interface TransactionPage {
  items: PointsTransaction[];
  pagination: { nextCursor: string | null; hasMore: boolean; limit: number };
}

export interface RewardItem {
  id: string;
  name: string;
  description: string;
  rewardType: 'CHARITY' | 'PAYPAL' | 'VOUCHER' | 'MERCHANDISE';
  pointsRequired: number;
  imageUrl: string | null;
  stock: number | null;
}

export interface Redemption {
  id: string;
  rewardId: string;
  rewardName: string;
  rewardType: string;
  pointsSpent: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  fulfillmentRef: string | null;
  createdAt: string;
}

export interface RedemptionPage {
  items: Redemption[];
  pagination: { nextCursor: string | null; hasMore: boolean; limit: number };
}

export const pointsApi = {
  getBalance(): Promise<PointsBalance> {
    return apiFetch('/points/balance');
  },
  getTransactions(params?: { cursor?: string; from?: string; to?: string; limit?: number }): Promise<TransactionPage> {
    const q = new URLSearchParams();
    if (params?.cursor) q.set('cursor', params.cursor);
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    if (params?.limit) q.set('limit', String(params.limit));
    return apiFetch(`/points/transactions?${q.toString()}`);
  },
};

export const rewardsApi = {
  list(): Promise<RewardItem[]> {
    return apiFetch('/rewards');
  },
  get(id: string): Promise<RewardItem> {
    return apiFetch(`/rewards/${id}`);
  },
  redeem(rewardId: string): Promise<Redemption> {
    return apiFetch('/redemptions', { method: 'POST', body: { rewardId } });
  },
  listRedemptions(params?: { cursor?: string; from?: string; to?: string }): Promise<RedemptionPage> {
    const q = new URLSearchParams();
    if (params?.cursor) q.set('cursor', params.cursor);
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    return apiFetch(`/redemptions?${q.toString()}`);
  },
};

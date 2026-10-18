import type { CategorySchema } from '@binaryiq/types';

import { apiFetch } from './client.js';

export interface CategorySummary {
  id: string;
  key: string;
  name: string;
  pointsValue: number;
  sortOrder: number;
  completed: boolean;
  completedAt?: string;
}

export interface CategoryListResult {
  categories: CategorySummary[];
  completed: number;
  total: number;
  points: { earned: number; remaining: number; balance: number };
}

export interface CategoryDetail {
  id: string;
  key: string;
  name: string;
  pointsValue: number;
  completed: boolean;
  schema: CategorySchema;
  responses?: Record<string, unknown>;
}

export interface SubmitResult {
  responseId: string;
  pointsAwarded: number;
  balance: number;
}

export const profileSurveysApi = {
  list(): Promise<CategoryListResult> {
    return apiFetch('/profile-surveys');
  },
  get(key: string): Promise<CategoryDetail> {
    return apiFetch(`/profile-surveys/${key}`);
  },
  submit(key: string, answers: Record<string, unknown>): Promise<SubmitResult> {
    return apiFetch(`/profile-surveys/${key}/responses`, { method: 'POST', body: { answers } });
  },
};

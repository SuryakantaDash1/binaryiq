import { z } from 'zod';

import { feedUrlSchema } from './url.js';

// ─── Articles (member-facing) ───────────────────────────────────
export interface ArticleView {
  id: string;
  title: string;
  link: string;
  summary: string | null;
  imageUrl: string | null;
  publishedAt: string;
  sourceName: string;
  sourceCategory: string | null;
}

export const articleQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().optional(),
});
export type ArticleQuery = z.infer<typeof articleQuerySchema>;

export interface ArticlePage {
  items: ArticleView[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Feed sources (admin) ───────────────────────────────────────
export interface FeedSourceView {
  id: string;
  name: string;
  feedUrl: string;
  category: string | null;
  isActive: boolean;
  lastPolledAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export const createFeedSourceSchema = z.object({
  name: z.string().min(1).max(120),
  feedUrl: feedUrlSchema,
  category: z.string().max(60).optional(),
  isActive: z.boolean().default(true),
});
export type CreateFeedSourceInput = z.infer<typeof createFeedSourceSchema>;

export const updateFeedSourceSchema = createFeedSourceSchema.partial();
export type UpdateFeedSourceInput = z.infer<typeof updateFeedSourceSchema>;

export const adminListFeedSourcesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});
export type AdminListFeedSourcesQuery = z.infer<typeof adminListFeedSourcesQuerySchema>;

export interface FeedSourcePage {
  items: FeedSourceView[];
  total: number;
  page: number;
  pageSize: number;
}

import { z } from 'zod';

// ─── Announcements (member-facing "News" tab) ────────────────────
export interface AnnouncementView {
  id: string;
  title: string;
  excerpt: string;
  bannerHeadline: string;
  emoji: string;
  imageUrl: string | null;
  commentsCount: number;
  publishedAt: string;
}

export const announcementQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type AnnouncementQuery = z.infer<typeof announcementQuerySchema>;

export interface AnnouncementPage {
  items: AnnouncementView[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Announcements (admin) ────────────────────────────────────────
export interface AdminAnnouncementView extends AnnouncementView {
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(160),
  excerpt: z.string().min(1).max(600),
  bannerHeadline: z.string().min(1).max(80),
  emoji: z.string().min(1).max(8),
  imageUrl: z.string().url().optional(),
  commentsCount: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
  publishedAt: z.coerce.date().optional(),
});
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;

export const updateAnnouncementSchema = createAnnouncementSchema.partial();
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;

export const adminListAnnouncementsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});
export type AdminListAnnouncementsQuery = z.infer<typeof adminListAnnouncementsQuerySchema>;

export interface AdminAnnouncementPage {
  items: AdminAnnouncementView[];
  total: number;
  page: number;
  pageSize: number;
}

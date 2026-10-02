import type {
  AnnouncementView,
  AnnouncementPage,
  AnnouncementQuery,
  AdminAnnouncementView,
  AdminAnnouncementPage,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from '@influencer/types';
import { Injectable } from '@nestjs/common';

import { NotFoundException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Member-facing ────────────────────────────────────────────────
  async listAnnouncements(query: AnnouncementQuery): Promise<AnnouncementPage> {
    const where = { isActive: true };
    const [total, rows] = await Promise.all([
      this.prisma.announcement.count({ where }),
      this.prisma.announcement.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(this.toView), total, page: query.page, pageSize: query.pageSize };
  }

  // ─── Admin ──────────────────────────────────────────────────────────
  async adminList(page = 1, pageSize = 20): Promise<AdminAnnouncementPage> {
    const [total, rows] = await Promise.all([
      this.prisma.announcement.count(),
      this.prisma.announcement.findMany({
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: rows.map(this.toAdminView), total, page, pageSize };
  }

  async adminCreate(input: CreateAnnouncementInput): Promise<AdminAnnouncementView> {
    const row = await this.prisma.announcement.create({
      data: {
        title: input.title,
        excerpt: input.excerpt,
        bannerHeadline: input.bannerHeadline,
        emoji: input.emoji,
        imageUrl: input.imageUrl,
        commentsCount: input.commentsCount ?? 0,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
        ...(input.publishedAt ? { publishedAt: input.publishedAt } : {}),
      },
    });
    return this.toAdminView(row);
  }

  async adminUpdate(id: string, input: UpdateAnnouncementInput): Promise<AdminAnnouncementView> {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Announcement not found');
    const row = await this.prisma.announcement.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.excerpt !== undefined ? { excerpt: input.excerpt } : {}),
        ...(input.bannerHeadline !== undefined ? { bannerHeadline: input.bannerHeadline } : {}),
        ...(input.emoji !== undefined ? { emoji: input.emoji } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
        ...(input.commentsCount !== undefined ? { commentsCount: input.commentsCount } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.publishedAt !== undefined ? { publishedAt: input.publishedAt } : {}),
      },
    });
    return this.toAdminView(row);
  }

  async adminDelete(id: string): Promise<{ id: string }> {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Announcement not found');
    await this.prisma.announcement.delete({ where: { id } });
    return { id };
  }

  // ─── Mappers ────────────────────────────────────────────────────────
  private toView = (row: {
    id: string;
    title: string;
    excerpt: string;
    bannerHeadline: string;
    emoji: string;
    imageUrl: string | null;
    commentsCount: number;
    publishedAt: Date;
  }): AnnouncementView => ({
    id: row.id,
    title: row.title,
    excerpt: row.excerpt,
    bannerHeadline: row.bannerHeadline,
    emoji: row.emoji,
    imageUrl: row.imageUrl,
    commentsCount: row.commentsCount,
    publishedAt: row.publishedAt.toISOString(),
  });

  private toAdminView = (
    row: Parameters<CommunityService['toView']>[0] & {
      isActive: boolean;
      sortOrder: number;
      createdAt: Date;
    },
  ): AdminAnnouncementView => ({
    ...this.toView(row),
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  });
}

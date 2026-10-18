import {
  adminAuditLogQuerySchema,
  adminConsentQuerySchema,
  type AdminAuditLogQuery,
  type AdminConsentQuery,
} from '@binaryiq/types';
import { Controller, Get, Query } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('admin')
@Roles('SUPER_ADMIN', 'DPO')
export class AdminDataRightsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('audit-logs')
  async getAuditLogs(
    @Query(new ZodValidationPipe(adminAuditLogQuerySchema)) q: AdminAuditLogQuery,
  ) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 50;

    const where = {
      ...(q.actorType ? { actorType: q.actorType } : {}),
      ...(q.actorId ? { actorId: q.actorId } : {}),
      ...(q.action ? { action: { contains: q.action } } : {}),
      ...(q.targetType ? { targetType: q.targetType } : {}),
      ...(q.targetId ? { targetId: q.targetId } : {}),
      ...(q.from || q.to
        ? {
            createdAt: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lte: new Date(q.to) } : {}),
            },
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        actorType: r.actorType,
        actorId: r.actorId,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        ipAddress: r.ipAddress,
        metadata: r.metadata,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  @Get('consents')
  async getConsents(
    @Query(new ZodValidationPipe(adminConsentQuerySchema)) q: AdminConsentQuery,
  ) {
    const limit = q.limit ?? 50;
    const cursorDate = q.cursor ? new Date(Buffer.from(q.cursor, 'base64url').toString()) : undefined;

    const rows = await this.prisma.consentLog.findMany({
      where: {
        ...(q.userId ? { userId: q.userId } : {}),
        ...(q.consentType ? { consentType: q.consentType as 'TERMS' | 'PRIVACY' | 'MARKETING' | 'COOKIES' } : {}),
        ...(q.from || q.to
          ? {
              createdAt: {
                ...(q.from ? { gte: new Date(q.from) } : {}),
                ...(q.to ? { lte: new Date(q.to) } : {}),
              },
            }
          : {}),
        ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const nextCursor = hasMore
      ? Buffer.from(page[page.length - 1]!.createdAt.toISOString()).toString('base64url')
      : null;

    return {
      data: page.map((r) => ({
        id: r.id,
        userId: r.userId,
        consentType: r.consentType,
        consentVersion: r.consentVersion,
        granted: r.granted,
        ipAddress: r.ipAddress,
        createdAt: r.createdAt.toISOString(),
      })),
      meta: { pagination: { nextCursor, hasMore, limit } },
    };
  }
}

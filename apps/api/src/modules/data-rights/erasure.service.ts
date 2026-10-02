import type { ErasureInput } from '@influencer/types';
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { ERASURE_GRACE_MS } from './erasure.processor';

@Injectable()
export class ErasureService {
  private readonly logger = new Logger(ErasureService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Stage 1: lock the account immediately. Stage 2 (permanent purge of all
   * personal data) runs from the daily erasure sweep once the grace period ends,
   * driven by `deletedAt` in the database — not by a long-lived queued job that a
   * Redis flush could lose.
   */
  async requestErasure(
    userId: string,
    _dto: ErasureInput,
    ip: string | null,
  ): Promise<{ status: string; purgeEligibleAt: string }> {
    const now = new Date();

    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: now, isActive: false },
    });

    // Pending verify/reset/email-change tokens are useless now.
    await this.prisma.authToken.deleteMany({ where: { userId } });

    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        actorId: userId,
        action: 'account.erasure_requested',
        targetType: 'user',
        targetId: userId,
        ipAddress: ip,
      },
    });

    const purgeEligibleAt = new Date(now.getTime() + ERASURE_GRACE_MS);
    this.logger.log(`Erasure requested for user ${userId}; purge eligible at ${purgeEligibleAt.toISOString()}`);
    return { status: 'SOFT_DELETED', purgeEligibleAt: purgeEligibleAt.toISOString() };
  }
}

import type { ErasureInput } from '@influencer/types';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import { PrismaService } from '../../prisma/prisma.service';
import { JOBS, QUEUES, type ErasurePurgeJob } from '../../queue/queue.constants';

const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

@Injectable()
export class ErasureService {
  private readonly logger = new Logger(ErasureService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.ERASURE) private readonly erasureQueue: Queue,
  ) {}

  async requestErasure(
    userId: string,
    _dto: ErasureInput,
    ip: string | null,
  ): Promise<{ status: string; purgeEligibleAt: string }> {
    const now = new Date();

    // Stage 1: Soft delete — set deletedAt, lock account
    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: now, isActive: false },
    });

    // Revoke all sessions (delete auth tokens)
    await this.prisma.authToken.deleteMany({ where: { userId } });

    // Audit log
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

    // Enqueue purge job with grace period delay
    const purgeEligibleAt = new Date(now.getTime() + GRACE_PERIOD_MS);
    await this.erasureQueue.add(
      JOBS.ERASURE_PURGE,
      { userId } as ErasurePurgeJob,
      {
        delay: GRACE_PERIOD_MS,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
      },
    );

    this.logger.log(`Erasure requested for user ${userId}; purge eligible at ${purgeEligibleAt.toISOString()}`);
    return { status: 'SOFT_DELETED', purgeEligibleAt: purgeEligibleAt.toISOString() };
  }
}

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { PrismaService } from '../../prisma/prisma.service';
import { JOBS, QUEUES, type ErasurePurgeJob } from '../../queue/queue.constants';

const ANON_TEXT = '[REDACTED]';

@Processor(QUEUES.ERASURE)
export class ErasureProcessor extends WorkerHost {
  private readonly logger = new Logger(ErasureProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<ErasurePurgeJob>): Promise<void> {
    if (job.name !== JOBS.ERASURE_PURGE) return;
    const { userId } = job.data;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      this.logger.warn(`Erasure purge: user ${userId} not found — skipping`);
      return;
    }
    if (!user.deletedAt) {
      this.logger.warn(`Erasure purge: user ${userId} not soft-deleted — skipping`);
      return;
    }
    // Idempotency: if phoneEnc is already null, purge was already completed
    if (user.phoneEnc === null) {
      this.logger.log(`Erasure purge: user ${userId} already purged — idempotent skip`);
      return;
    }

    await this.doPurge(userId);
  }

  private async doPurge(userId: string): Promise<void> {
    this.logger.log(`Starting PII purge for user ${userId}`);

    // Nullify phoneEnc on users table
    await this.prisma.user.update({
      where: { id: userId },
      data: { phoneEnc: null },
    });

    // Redact dobEnc on profile (dobEnc is NOT NULL in schema, so set to ANON_TEXT)
    await this.prisma.userProfile.updateMany({
      where: { userId },
      data: { dobEnc: ANON_TEXT },
    });

    // Nullify line1Enc on address (nullable field)
    await this.prisma.userAddress.updateMany({
      where: { userId },
      data: { line1Enc: null },
    });

    // Delete push tokens (PII — device identifiers)
    await this.prisma.pushToken.deleteMany({ where: { userId } });

    // Audit log — actorType=system
    await this.prisma.auditLog.create({
      data: {
        actorType: 'system',
        action: 'account.erasure_purged',
        targetType: 'user',
        targetId: userId,
        metadata: { purgedFields: ['phoneEnc', 'dobEnc', 'line1Enc', 'pushTokens'] },
      },
    });

    this.logger.log(`PII purge complete for user ${userId}`);
  }
}

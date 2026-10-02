import { randomBytes } from 'node:crypto';

import { Prisma } from '@influencer/db';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import type { Job } from 'bullmq';

import { PrismaService } from '../../prisma/prisma.service';
import { JOBS, QUEUES, type ErasurePurgeJob } from '../../queue/queue.constants';

export const ERASURE_GRACE_MS = 30 * 24 * 60 * 60 * 1000;
const SWEEP_BATCH = 100;

@Processor(QUEUES.ERASURE)
export class ErasureProcessor extends WorkerHost {
  private readonly logger = new Logger(ErasureProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<ErasurePurgeJob | Record<string, never>>): Promise<void> {
    if (job.name === JOBS.ERASURE_SWEEP) {
      await this.sweep();
      return;
    }
    // Legacy per-user delayed jobs queued before the daily sweep existed.
    if (job.name === JOBS.ERASURE_PURGE) {
      await this.purgeIfDue((job.data as ErasurePurgeJob).userId);
    }
  }

  /** Purge every account whose grace period has ended, then drop stale one-time tokens. */
  private async sweep(): Promise<void> {
    const cutoff = new Date(Date.now() - ERASURE_GRACE_MS);
    const due = await this.prisma.user.findMany({
      where: { deletedAt: { lte: cutoff }, purgedAt: null },
      select: { id: true },
      take: SWEEP_BATCH,
    });
    for (const { id } of due) {
      // One failure must not block the rest; it's retried on the next sweep.
      await this.purge(id).catch((e: unknown) =>
        this.logger.error(`Erasure purge failed for user ${id}: ${(e as Error).message}`),
      );
    }

    const { count } = await this.prisma.authToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] },
    });
    if (due.length || count) this.logger.log(`Erasure sweep: ${due.length} account(s) purged, ${count} stale token(s) removed`);
  }

  private async purgeIfDue(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { deletedAt: true, purgedAt: true } });
    if (!user?.deletedAt || user.purgedAt) return;
    if (user.deletedAt.getTime() > Date.now() - ERASURE_GRACE_MS) return;
    await this.purge(userId);
  }

  /**
   * DPDP s.12 erasure. Deletes all personal data and anonymises the account row.
   * Points ledger, redemptions, votes and survey responses are kept as
   * pseudonymous records (no remaining link to an identifiable person); consent
   * records keep type/version/decision as legal evidence but lose IP/UA.
   */
  async purge(userId: string): Promise<void> {
    const unusablePassword = await bcrypt.hash(randomBytes(32).toString('hex'), 4);
    const compactId = userId.replace(/-/g, '');

    await this.prisma.$transaction(async (tx) => {
      await tx.userProfile.deleteMany({ where: { userId } });
      await tx.userAddress.deleteMany({ where: { userId } });
      await tx.userDemographics.deleteMany({ where: { userId } });
      await tx.paypalAccount.deleteMany({ where: { userId } });
      await tx.profileSurveyResponse.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.notificationPreference.deleteMany({ where: { userId } });
      await tx.pushToken.deleteMany({ where: { userId } });
      await tx.authToken.deleteMany({ where: { userId } });
      await tx.supportTicket.deleteMany({ where: { userId } }); // messages cascade
      await tx.consentLog.updateMany({ where: { userId }, data: { ipAddress: null, userAgent: null } });
      await tx.auditLog.updateMany({
        where: { OR: [{ actorId: userId }, { targetId: userId }] },
        data: { ipAddress: null, userAgent: null, metadata: Prisma.DbNull },
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `deleted-${compactId}@erased.invalid`,
          username: `deleted_${compactId}`,
          passwordHash: unusablePassword,
          phoneEnc: null,
          isActive: false,
          isVerified: false,
          lastLoginAt: null,
          purgedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: { actorType: 'system', action: 'account.erasure_purged', targetType: 'user', targetId: userId },
      });
    });

    this.logger.log(`Erasure purge complete for user ${userId}`);
  }
}

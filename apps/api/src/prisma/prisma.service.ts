import { PrismaClient } from '@influencer/db';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

/**
 * NestJS-managed Prisma client with connection lifecycle hooks.
 * See architecture/03-backend-architecture §9.2.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    // Serverless Postgres (e.g. Neon free tier) auto-suspends when idle; the
    // first connection wakes it but can time out. Retry with backoff so a cold
    // start doesn't crash the whole API on boot.
    const maxAttempts = 15;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.$connect();
        this.logger.log('Prisma connected');
        return;
      } catch (err) {
        if (attempt === maxAttempts) throw err;
        this.logger.warn(
          `Prisma connection attempt ${attempt}/${maxAttempts} failed (database waking up?) — retrying in 3s…`,
        );
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

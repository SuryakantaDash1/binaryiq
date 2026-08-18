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
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

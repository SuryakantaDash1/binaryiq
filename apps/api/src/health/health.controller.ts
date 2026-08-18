import type { HealthReady } from '@influencer/types';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Liveness — process is up. No dependency checks. */
  @Public()
  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** Readiness — Postgres + Redis reachable; 503 if any dependency is down. */
  @Public()
  @Get('ready')
  async ready(): Promise<HealthReady> {
    const [postgres, redis] = await Promise.all([this.checkPostgres(), this.checkRedis()]);
    const result: HealthReady = {
      status: postgres === 'up' && redis === 'up' ? 'ok' : 'error',
      dependencies: { postgres, redis },
    };
    if (result.status === 'error') {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }

  private async checkPostgres(): Promise<'up' | 'down'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<'up' | 'down'> {
    try {
      return (await this.redis.ping()) ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
}

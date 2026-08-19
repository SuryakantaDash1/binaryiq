import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthGuard } from './common/guards/auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { AppConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { AccountModule } from './modules/account/account.module';
import { AuthModule } from './modules/auth/auth.module';
import { GamesModule } from './modules/games/games.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PointsModule } from './modules/points/points.module';
import { PollsModule } from './modules/polls/polls.module';
import { ProfileSurveysModule } from './modules/profile-surveys/profile-surveys.module';
import { RewardsModule } from './modules/rewards/rewards.module';
import { SupportModule } from './modules/support/support.module';
import { SurveysModule } from './modules/surveys/surveys.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    AppConfigModule, PrismaModule, RedisModule,
    QueueModule,
    AuthModule, PointsModule, HealthModule,
    AccountModule, ProfileSurveysModule, RewardsModule, SurveysModule, PollsModule, GamesModule,
    NotificationsModule, SupportModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}

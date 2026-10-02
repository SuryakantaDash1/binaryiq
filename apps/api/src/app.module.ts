import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AuthGuard } from './common/guards/auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { SecurityHeadersMiddleware } from './common/middleware/security-headers.middleware';
import { EncryptionModule } from './common/services/encryption.module';
import { AppConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { AccountModule } from './modules/account/account.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { CommunityModule } from './modules/community/community.module';
import { DataRightsModule } from './modules/data-rights/data-rights.module';
import { GamesModule } from './modules/games/games.module';
import { GeoModule } from './modules/geo/geo.module';
import { NewsModule } from './modules/news/news.module';
import { EmailModule } from './modules/notifications/email.module';
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
    ThrottlerModule.forRoot([{ limit: 100, ttl: 60000 }]),
    AppConfigModule, PrismaModule, RedisModule, EncryptionModule, EmailModule,
    QueueModule,
    AuthModule, PointsModule, HealthModule,
    AccountModule, ProfileSurveysModule, RewardsModule, SurveysModule, PollsModule, GamesModule,
    NotificationsModule, SupportModule, DataRightsModule, AdminModule, NewsModule, CommunityModule, GeoModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware, SecurityHeadersMiddleware).forRoutes('*');
  }
}

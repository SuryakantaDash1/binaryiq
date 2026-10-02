import { Global, Module } from '@nestjs/common';

import { PointsModule } from '../points/points.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

/**
 * Phase 1: full registration/login/verify/reset flows.
 * TokenService is exported globally so the guards can verify tokens.
 */
@Global()
@Module({
  imports: [PointsModule],
  controllers: [AuthController],
  providers: [TokenService, AuthService],
  exports: [TokenService],
})
export class AuthModule {}

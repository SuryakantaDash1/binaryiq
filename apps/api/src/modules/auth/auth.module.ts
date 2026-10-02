import { Global, Module } from '@nestjs/common';

import { PointsModule } from '../points/points.module';

import { AuthStateService } from './auth-state.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

/**
 * Registration/login/verify/reset flows. TokenService and AuthStateService are
 * exported globally so the guards and the admin module can use them.
 */
@Global()
@Module({
  imports: [PointsModule],
  controllers: [AuthController],
  providers: [TokenService, AuthStateService, AuthService],
  exports: [TokenService, AuthStateService],
})
export class AuthModule {}

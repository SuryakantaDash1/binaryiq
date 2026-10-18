import {
  adminLoginSchema,
  adminTotpSchema,
  type AdminLoginChallenge,
  type AdminLoginInput,
  type AdminSession,
  type AdminTotpInput,
} from '@binaryiq/types';
import { Body, Controller, Get, HttpCode, Ip, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UnauthenticatedException } from '../../common/exceptions/domain.exception';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AppConfigService } from '../../config/config.service';

import { AdminAuthService } from './admin-auth.service';

const ADMIN_REFRESH_COOKIE = 'admin_refresh';
const ADMIN_REFRESH_PATH = '/v1/admin/auth';
const MINUTE = 60_000;

@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly config: AppConfigService,
  ) {}

  /** Step 1: password. Returns a challenge for the authenticator-app step. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: MINUTE } })
  @Post('login')
  @HttpCode(200)
  login(
    @Body(new ZodValidationPipe(adminLoginSchema)) body: AdminLoginInput,
    @Ip() ip: string,
  ): Promise<AdminLoginChallenge> {
    return this.auth.login(body.email, body.password, ip);
  }

  /** Step 2: 6-digit authenticator code (also completes first-time enrolment). */
  @Public()
  @Throttle({ default: { limit: 5, ttl: MINUTE } })
  @Post('totp')
  @HttpCode(200)
  async totp(
    @Body(new ZodValidationPipe(adminTotpSchema)) body: AdminTotpInput,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AdminSession> {
    const { session, refreshToken } = await this.auth.verifyTotp(body, ip);
    this.setRefreshCookie(res, refreshToken);
    return session;
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: MINUTE } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AdminSession> {
    const token = (req.cookies as Record<string, string> | undefined)?.[ADMIN_REFRESH_COOKIE];
    if (!token) throw new UnauthenticatedException('No admin session');
    const { session, refreshToken } = await this.auth.refresh(token);
    this.setRefreshCookie(res, refreshToken);
    return session;
  }

  @Post('logout')
  @Roles('SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'DPO')
  @HttpCode(200)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: true }> {
    await this.auth.logout(user.id);
    res.clearCookie(ADMIN_REFRESH_COOKIE, { path: ADMIN_REFRESH_PATH });
    return { success: true };
  }

  @Get('me')
  @Roles('SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'DPO')
  me(@CurrentUser() user: AuthenticatedUser): Promise<AdminSession['admin']> {
    return this.auth.me(user.id);
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(ADMIN_REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') !== 'development',
      sameSite: 'strict',
      path: ADMIN_REFRESH_PATH,
      maxAge: 8 * 60 * 60 * 1000,
    });
  }
}

import {
  registerStep1Schema,
  registerStep2Schema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  type RegisterStep1Input,
  type RegisterStep2Input,
  type LoginInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type AuthSession,
  type RegisterStep1Result,
  type RegisterStep2Result,
  type VerifyEmailResult,
} from '@binaryiq/types';
import { Body, Controller, Get, HttpCode, Ip, Post, Query, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { z } from 'zod';

import { Public } from '../../common/decorators/public.decorator';
import { UnauthenticatedException } from '../../common/exceptions/domain.exception';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AppConfigService } from '../../config/config.service';

import { AuthService } from './auth.service';

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_PATH = '/v1/auth';
const MINUTE = 60_000;
const verifyQuerySchema = z.object({ token: z.string().uuid() });

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: MINUTE } })
  @Post('register/step1')
  registerStep1(
    @Body(new ZodValidationPipe(registerStep1Schema)) body: RegisterStep1Input,
  ): Promise<RegisterStep1Result> {
    return this.auth.registerStep1(body);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: MINUTE } })
  @Post('register/step2')
  registerStep2(
    @Body(new ZodValidationPipe(registerStep2Schema)) body: RegisterStep2Input,
    @Ip() ip: string,
  ): Promise<RegisterStep2Result> {
    return this.auth.registerStep2(body, ip);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: MINUTE } })
  @Get('verify-email')
  verifyEmail(@Query(new ZodValidationPipe(verifyQuerySchema)) q: { token: string }): Promise<VerifyEmailResult> {
    return this.auth.verifyEmail(q.token);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: MINUTE } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ): Promise<AuthSession> {
    const { session, refreshToken } = await this.auth.login(body, ip);
    this.setRefreshCookie(res, refreshToken);
    return session;
  }

  /** Revokes the session server-side (all tokens for this account) and clears the cookie. */
  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ success: true }> {
    await this.auth.logout(this.readRefreshCookie(req));
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_PATH });
    return { success: true };
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 15 * MINUTE } })
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) body: ForgotPasswordInput,
  ): Promise<{ success: true }> {
    await this.auth.forgotPassword(body);
    return { success: true };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 15 * MINUTE } })
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
  ): Promise<{ success: true }> {
    await this.auth.resetPassword(body);
    return { success: true };
  }

  /** Issues a fresh access token and rotates the refresh cookie. */
  @Public()
  @Throttle({ default: { limit: 30, ttl: MINUTE } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthSession> {
    const token = this.readRefreshCookie(req);
    if (!token) throw new UnauthenticatedException('Missing refresh token');
    const { session, refreshToken } = await this.auth.refresh(token);
    this.setRefreshCookie(res, refreshToken);
    return session;
  }

  private readRefreshCookie(req: Request): string | undefined {
    return (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      // Secure everywhere except local development over plain http.
      secure: this.config.get('NODE_ENV') !== 'development',
      sameSite: 'lax',
      path: REFRESH_PATH,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
}

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
} from '@influencer/types';
import { Body, Controller, Get, HttpCode, Post, Query, Req, Res, UsePipes } from '@nestjs/common';
import type { Request, Response } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { UnauthenticatedException } from '../../common/exceptions/domain.exception';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AppConfigService } from '../../config/config.service';

import { AuthService } from './auth.service';

const REFRESH_COOKIE = 'refresh_token';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfigService,
  ) {}

  @Public()
  @Post('register/step1')
  @UsePipes(new ZodValidationPipe(registerStep1Schema))
  registerStep1(@Body() body: RegisterStep1Input): Promise<RegisterStep1Result> {
    return this.auth.registerStep1(body);
  }

  @Public()
  @Post('register/step2')
  @UsePipes(new ZodValidationPipe(registerStep2Schema))
  registerStep2(@Body() body: RegisterStep2Input): Promise<RegisterStep2Result> {
    return this.auth.registerStep2(body);
  }

  @Public()
  @Get('verify-email')
  verifyEmail(@Query('token') token?: string): Promise<VerifyEmailResult> {
    if (!token) throw new UnauthenticatedException('Missing token');
    return this.auth.verifyEmail(token);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(
    @Body() body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    const { session, refreshToken } = await this.auth.login(body);
    this.setRefreshCookie(res, refreshToken);
    return session;
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response): { success: true } {
    res.clearCookie(REFRESH_COOKIE, { path: '/v1/auth' });
    return { success: true };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(forgotPasswordSchema))
  async forgotPassword(@Body() body: ForgotPasswordInput): Promise<{ success: true }> {
    await this.auth.forgotPassword(body);
    return { success: true };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(resetPasswordSchema))
  async resetPassword(@Body() body: ResetPasswordInput): Promise<{ success: true }> {
    await this.auth.resetPassword(body);
    return { success: true };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Req() req: Request): Promise<AuthSession> {
    const token = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    if (!token) throw new UnauthenticatedException('Missing refresh token');
    return this.auth.refresh(token);
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'lax',
      path: '/v1/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
}

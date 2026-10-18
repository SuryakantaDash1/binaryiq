import {
  updateProfileSchema,
  changeEmailSchema,
  changePasswordSchema,
  updatePaypalSchema,
  updateAboutYouSchema,
} from '@binaryiq/types';
import { Body, Controller, Delete, Get, HttpCode, Ip, Post, Put } from '@nestjs/common';
import { z } from 'zod';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

import { AccountService } from './account.service';

const photoSchema = z.object({ url: z.string().url() });
const tokenBodySchema = z.object({ token: z.string().uuid() });

@Controller('account')
export class AccountController {
  constructor(private readonly service: AccountService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getProfile(user.id);
  }

  @Put('profile')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: Parameters<AccountService['updateProfile']>[1],
    @Ip() ip: string,
  ) {
    return this.service.updateProfile(user.id, body, ip);
  }

  @Post('profile/photo')
  updatePhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(photoSchema)) body: { url: string },
  ) {
    return this.service.updatePhoto(user.id, body.url);
  }

  @Delete('profile/photo')
  @HttpCode(200)
  deletePhoto(@CurrentUser() user: AuthenticatedUser) {
    return this.service.deletePhoto(user.id);
  }

  @Put('email')
  requestEmailChange(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(changeEmailSchema)) body: Parameters<AccountService['requestEmailChange']>[1],
  ) {
    return this.service.requestEmailChange(user.id, body);
  }

  @Post('email/verify')
  @HttpCode(200)
  confirmEmailChange(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(tokenBodySchema)) body: { token: string },
    @Ip() ip: string,
  ) {
    return this.service.confirmEmailChange(user.id, body.token, ip);
  }

  @Put('password')
  @HttpCode(200)
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: Parameters<AccountService['changePassword']>[1],
    @Ip() ip: string,
  ) {
    return this.service.changePassword(user.id, body, ip);
  }

  @Put('paypal')
  updatePaypal(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updatePaypalSchema)) body: Parameters<AccountService['updatePaypal']>[1],
    @Ip() ip: string,
  ) {
    return this.service.updatePaypal(user.id, body, ip);
  }

  @Get('about-you')
  getAboutYou(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getAboutYou(user.id);
  }

  @Put('about-you')
  updateAboutYou(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateAboutYouSchema)) body: Parameters<AccountService['updateAboutYou']>[1],
    @Ip() ip: string,
  ) {
    return this.service.updateAboutYou(user.id, body, ip);
  }

  @Get('balance')
  getBalance(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getBalance(user.id);
  }
}

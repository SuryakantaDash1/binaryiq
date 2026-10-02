import { adminLoginSchema, type AdminLoginInput, type AdminSession } from '@influencer/types';
import { Body, Controller, Get, HttpCode, Ip, Post, UsePipes } from '@nestjs/common';

import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

import { AdminService } from './admin.service';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly admin: AdminService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(adminLoginSchema))
  login(@Body() body: AdminLoginInput, @Ip() ip: string): Promise<AdminSession> {
    return this.admin.login(body.email, body.password, ip);
  }

  @Get('me')
  @Roles('SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'DPO')
  me(@CurrentUser() user: AuthenticatedUser): Promise<AdminSession['admin']> {
    return this.admin.me(user.id);
  }
}

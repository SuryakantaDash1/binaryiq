import {
  adminUpdateUserSchema,
  adminUsersQuerySchema,
  type AdminStats,
  type AdminUpdateUserInput,
  type AdminUsersQuery,
  type AdminUsersResult,
} from '@influencer/types';
import { Body, Controller, Get, Param, Put, Query, UsePipes } from '@nestjs/common';

import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

import { AdminService } from './admin.service';

@Controller('admin')
@Roles('SUPER_ADMIN', 'ADMIN')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  stats(): Promise<AdminStats> {
    return this.admin.stats();
  }

  @Get('users')
  @UsePipes(new ZodValidationPipe(adminUsersQuerySchema))
  users(@Query() q: AdminUsersQuery): Promise<AdminUsersResult> {
    return this.admin.listUsers(q);
  }

  @Put('users/:id')
  setUserActive(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminUpdateUserSchema)) body: AdminUpdateUserInput,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ id: string; isActive: boolean }> {
    return this.admin.setUserActive(id, body.isActive, actor.id);
  }
}

import {
  announcementQuerySchema,
  type AnnouncementQuery,
  createAnnouncementSchema,
  type CreateAnnouncementInput,
  updateAnnouncementSchema,
  type UpdateAnnouncementInput,
  adminListAnnouncementsQuerySchema,
  type AdminListAnnouncementsQuery,
} from '@influencer/types';
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

import { CommunityService } from './community.service';

@Controller()
export class CommunityController {
  constructor(private readonly service: CommunityService) {}

  // ─── Member-facing ──────────────────────────────────────────────
  @Get('community/announcements')
  listAnnouncements(@Query(new ZodValidationPipe(announcementQuerySchema)) query: AnnouncementQuery) {
    return this.service.listAnnouncements(query);
  }

  // ─── Admin ────────────────────────────────────────────────────────
  @Get('admin/announcements')
  @Roles('SUPER_ADMIN', 'ADMIN')
  adminList(@Query(new ZodValidationPipe(adminListAnnouncementsQuerySchema)) q: AdminListAnnouncementsQuery) {
    return this.service.adminList(q.page, q.pageSize);
  }

  @Post('admin/announcements')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @HttpCode(201)
  adminCreate(@Body(new ZodValidationPipe(createAnnouncementSchema)) body: CreateAnnouncementInput) {
    return this.service.adminCreate(body);
  }

  @Put('admin/announcements/:id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  adminUpdate(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAnnouncementSchema)) body: UpdateAnnouncementInput,
  ) {
    return this.service.adminUpdate(id, body);
  }

  @Delete('admin/announcements/:id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @HttpCode(200)
  adminDelete(@Param('id') id: string) {
    return this.service.adminDelete(id);
  }
}

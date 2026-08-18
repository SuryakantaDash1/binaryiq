import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  completeSurveyInputSchema,
  type CompleteSurveyInput,
  createSurveySchema,
  type CreateSurveyInput,
  updateSurveySchema,
  type UpdateSurveyInput,
} from '@influencer/types';
import { z } from 'zod';
import { SurveysService } from './surveys.service';

interface AuthUser {
  id: string;
  email: string;
  username: string;
  isVerified: boolean;
  roles: string[];
}

const adminListQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  type: z.enum(['PRIORITY', 'QUICK', 'PREMIUM']).optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

@Controller()
export class SurveysController {
  constructor(private readonly service: SurveysService) {}

  // ─── Member endpoints ─────────────────────────────────────────
  @Get('surveys')
  listSurveys(@CurrentUser() user: AuthUser) {
    return this.service.listForUser(user.id);
  }

  @Get('surveys/:id')
  getSurvey(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getForUser(user.id, id);
  }

  @Post('surveys/:id/start')
  @HttpCode(200)
  startSurvey(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.start(user.id, id);
  }

  @Post('surveys/:id/complete')
  @HttpCode(200)
  completeSurvey(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(completeSurveyInputSchema)) body: CompleteSurveyInput,
  ) {
    const outcome = body.status === 'disqualified' ? 'disqualified' : 'completed';
    return this.service.complete(user.id, id, outcome);
  }

  // ─── Admin endpoints ──────────────────────────────────────────
  @Get('admin/surveys')
  @Roles('SUPER_ADMIN', 'ADMIN')
  adminListSurveys(
    @Query(new ZodValidationPipe(adminListQuery))
    q: { page?: number; pageSize?: number; type?: string; isActive?: 'true' | 'false' },
  ) {
    const isActive = q.isActive !== undefined ? q.isActive === 'true' : undefined;
    return this.service.adminList({ page: q.page, pageSize: q.pageSize, type: q.type, isActive });
  }

  @Post('admin/surveys')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @HttpCode(201)
  adminCreateSurvey(@Body(new ZodValidationPipe(createSurveySchema)) body: CreateSurveyInput) {
    return this.service.adminCreate(body);
  }

  @Put('admin/surveys/:id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  adminUpdateSurvey(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSurveySchema)) body: UpdateSurveyInput,
  ) {
    return this.service.adminUpdate(id, body);
  }
}

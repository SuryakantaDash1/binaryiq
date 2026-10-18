import {
  createPollSchema,
  updatePollSchema,
  voteInputSchema,
  type CreatePollInput,
  type UpdatePollInput,
  type VoteInput,
} from '@binaryiq/types';
import { Body, Controller, Get, HttpCode, Ip, Param, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

import { PollsService } from './polls.service';

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
});

@Controller()
export class PollsController {
  constructor(private readonly service: PollsService) {}

  // ─── Member ───────────────────────────────────────────────────
  @Get('polls')
  list(@CurrentUser() user: AuthUser) {
    return this.service.listActiveUnvoted(user.id);
  }

  @Get('polls/count')
  count(@CurrentUser() user: AuthUser) {
    return this.service.unvotedCount(user.id);
  }

  @Get('polls/:id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getDetail(user.id, id);
  }

  @Get('polls/:id/results')
  results(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getResults(user.id, id);
  }

  @Post('polls/:id/vote')
  @HttpCode(200)
  vote(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(voteInputSchema)) body: VoteInput,
  ) {
    return this.service.vote(user.id, id, body.optionIds);
  }

  // ─── Admin ────────────────────────────────────────────────────
  @Get('admin/polls')
  @Roles('SUPER_ADMIN', 'ADMIN')
  adminList(@Query(new ZodValidationPipe(adminListQuery)) q: { page?: number; pageSize?: number }) {
    return this.service.adminList(q);
  }

  @Get('admin/polls/:id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  adminGet(@Param('id') id: string) {
    return this.service.adminGet(id);
  }

  @Post('admin/polls')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @HttpCode(201)
  adminCreate(@Body(new ZodValidationPipe(createPollSchema)) body: CreatePollInput, @Ip() ip: string) {
    return this.service.create(body, ip);
  }

  @Put('admin/polls/:id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  adminUpdate(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updatePollSchema)) body: UpdatePollInput,
    @Ip() ip: string,
  ) {
    return this.service.update(id, body, user.id, ip);
  }
}

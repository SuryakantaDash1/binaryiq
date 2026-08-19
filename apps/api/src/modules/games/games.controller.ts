import {
  createGameSchema,
  spinInputSchema,
  updateSegmentsSchema,
  type CreateGameInput,
  type SpinInput,
  type UpdateSegmentsInput,
} from '@influencer/types';
import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

import { GamesService } from './games.service';

interface AuthUser { id: string; email: string; username: string; isVerified: boolean; roles: string[] }

const historyQuery = z.object({
  limit: z.coerce.number().int().positive().max(50).optional(),
  cursor: z.string().optional(),
});

const adminListQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

@Controller()
export class GamesController {
  constructor(private readonly service: GamesService) {}

  @Get('games')
  listGames(@CurrentUser() user: AuthUser) {
    return this.service.listGames(user.id);
  }

  @Get('games/spin/status')
  spinStatus(@CurrentUser() user: AuthUser) {
    return this.service.spinStatus(user.id);
  }

  @Get('games/history')
  history(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(historyQuery)) q: { limit?: number; cursor?: string },
  ) {
    return this.service.history(user.id, q);
  }

  @Get('games/:id')
  getGame(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getGame(user.id, id);
  }

  @Post('games/spin')
  @HttpCode(200)
  spin(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(spinInputSchema)) body: SpinInput,
  ) {
    return this.service.spin(user.id, body.gameId);
  }

  @Get('admin/games')
  @Roles('SUPER_ADMIN', 'ADMIN')
  adminList(@Query(new ZodValidationPipe(adminListQuery)) q: { page?: number; pageSize?: number }) {
    return this.service.adminList(q);
  }

  @Post('admin/games')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @HttpCode(201)
  adminCreate(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createGameSchema)) body: CreateGameInput,
  ) {
    return this.service.adminCreate(body, user.id);
  }

  @Put('admin/games/:id/segments')
  @Roles('SUPER_ADMIN', 'ADMIN')
  adminUpdateSegments(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateSegmentsSchema)) body: UpdateSegmentsInput,
  ) {
    return this.service.adminUpdateSegments(id, body, user.id);
  }
}

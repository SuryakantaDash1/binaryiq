import {
  articleQuerySchema,
  type ArticleQuery,
  createFeedSourceSchema,
  type CreateFeedSourceInput,
  updateFeedSourceSchema,
  type UpdateFeedSourceInput,
  adminListFeedSourcesQuerySchema,
  type AdminListFeedSourcesQuery,
} from '@binaryiq/types';
import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

import { NewsService } from './news.service';

@Controller()
export class NewsController {
  constructor(private readonly service: NewsService) {}

  // ─── Member-facing ──────────────────────────────────────────────
  @Get('news/articles')
  listArticles(@Query(new ZodValidationPipe(articleQuerySchema)) query: ArticleQuery) {
    return this.service.listArticles(query);
  }

  // ─── Admin: feed sources ────────────────────────────────────────
  @Get('admin/news/sources')
  @Roles('SUPER_ADMIN', 'ADMIN')
  adminListSources(
    @Query(new ZodValidationPipe(adminListFeedSourcesQuerySchema)) q: AdminListFeedSourcesQuery,
  ) {
    return this.service.adminListSources(q.page, q.pageSize);
  }

  @Post('admin/news/sources')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @HttpCode(201)
  adminCreateSource(@Body(new ZodValidationPipe(createFeedSourceSchema)) body: CreateFeedSourceInput) {
    return this.service.adminCreateSource(body);
  }

  @Put('admin/news/sources/:id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  adminUpdateSource(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateFeedSourceSchema)) body: UpdateFeedSourceInput,
  ) {
    return this.service.adminUpdateSource(id, body);
  }

  @Post('admin/news/sources/:id/poll-now')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @HttpCode(200)
  adminPollSourceNow(@Param('id') id: string) {
    return this.service.adminPollSourceNow(id);
  }
}

import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { z } from 'zod';
import { ProfileSurveysService } from './profile-surveys.service';

const submitAnswersSchema = z.object({ answers: z.record(z.unknown()) });

@Controller('profile-surveys')
export class ProfileSurveysController {
  constructor(private readonly service: ProfileSurveysService) {}

  @Get()
  listCategories(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listCategories(user.id);
  }

  @Get(':key')
  getCategory(@CurrentUser() user: AuthenticatedUser, @Param('key') key: string) {
    return this.service.getCategory(user.id, key);
  }

  @Post(':key/responses')
  @HttpCode(201)
  submitCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body(new ZodValidationPipe(submitAnswersSchema)) body: { answers: Record<string, unknown> },
  ) {
    return this.service.submitCategory(user.id, key, body.answers);
  }
}

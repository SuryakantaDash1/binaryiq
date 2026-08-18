import { Injectable, Logger } from '@nestjs/common';
import {
  ConflictException,
  NotFoundException,
  UnprocessableException,
} from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService } from '../points/points.service';
import type { CompleteSurveyResult } from '@influencer/types';

@Injectable()
export class SurveyCompletionService {
  private readonly logger = new Logger(SurveyCompletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly points: PointsService,
  ) {}

  async complete(
    userId: string,
    surveyId: string,
    outcome: 'completed' | 'disqualified',
  ): Promise<CompleteSurveyResult> {
    return this.prisma.$transaction(async (tx) => {
      const survey = await tx.survey.findUnique({ where: { id: surveyId } });
      if (!survey || !survey.isActive) {
        throw new NotFoundException('Survey not found');
      }
      if (survey.expiresAt && survey.expiresAt < new Date()) {
        throw new UnprocessableException('survey_expired');
      }

      // Idempotency: check existing response
      const existing = await tx.surveyResponse.findUnique({
        where: { userId_surveyId: { userId, surveyId } },
      });
      if (existing?.status === 'completed') {
        throw new ConflictException('already_completed');
      }

      if (outcome === 'disqualified') {
        await tx.surveyResponse.upsert({
          where: { userId_surveyId: { userId, surveyId } },
          create: { userId, surveyId, status: 'disqualified', pointsAwarded: 0 },
          update: { status: 'disqualified', pointsAwarded: 0 },
        });
        return { status: 'disqualified', pointsAwarded: 0, balanceAfter: 0 };
      }

      // Atomic quota guard
      if (survey.quota !== null) {
        const bumped = await tx.survey.updateMany({
          where: { id: surveyId, completedCount: { lt: survey.quota } },
          data: { completedCount: { increment: 1 } },
        });
        if (bumped.count === 0) throw new UnprocessableException('survey_full');
      } else {
        await tx.survey.update({
          where: { id: surveyId },
          data: { completedCount: { increment: 1 } },
        });
      }

      await tx.surveyResponse.upsert({
        where: { userId_surveyId: { userId, surveyId } },
        create: {
          userId,
          surveyId,
          status: 'completed',
          pointsAwarded: survey.pointsValue,
          completedAt: new Date(),
        },
        update: {
          status: 'completed',
          pointsAwarded: survey.pointsValue,
          completedAt: new Date(),
        },
      });

      const txn = await this.points.award(tx, {
        userId,
        action: 'SURVEY_COMPLETION',
        points: survey.pointsValue,
        refType: 'survey',
        refId: surveyId,
        idempotencyKey: `survey:${surveyId}:${userId}`,
        description: `Survey completion: ${survey.title}`,
      });

      this.logger.log(`Survey ${surveyId} completed by ${userId}: +${survey.pointsValue}pts`);
      return { status: 'completed', pointsAwarded: survey.pointsValue, balanceAfter: txn.balanceAfter };
    });
  }
}

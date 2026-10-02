import type { CompleteSurveyResult } from '@influencer/types';
import { Injectable, Logger } from '@nestjs/common';

import {
  ConflictException,
  NotFoundException,
  UnprocessableException,
} from '../../common/exceptions/domain.exception';
import { AppConfigService } from '../../config/config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService } from '../points/points.service';

import { MatchingService } from './matching.service';

/** Floor on how quickly a survey can be finished, to stop instant start→complete scripting. */
const MIN_COMPLETION_MS = 30_000;

@Injectable()
export class SurveyCompletionService {
  private readonly logger = new Logger(SurveyCompletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly points: PointsService,
    private readonly matching: MatchingService,
    private readonly config: AppConfigService,
  ) {}

  async complete(
    userId: string,
    surveyId: string,
    returnToken: string,
    outcome: 'completed' | 'disqualified',
  ): Promise<CompleteSurveyResult> {
    // The token is HMAC-signed at start and bound to this user, survey and response —
    // points can't be claimed for a survey that wasn't started through the API.
    const claims = this.matching.verifyReturnToken(returnToken, this.config.get('SURVEY_CALLBACK_SECRET'));
    if (!claims || claims.userId !== userId || claims.surveyId !== surveyId) {
      throw new UnprocessableException('invalid_return_token');
    }

    return this.prisma.$transaction(async (tx) => {
      const survey = await tx.survey.findUnique({ where: { id: surveyId } });
      if (!survey || !survey.isActive) {
        throw new NotFoundException('Survey not found');
      }
      if (survey.expiresAt && survey.expiresAt < new Date()) {
        throw new UnprocessableException('survey_expired');
      }

      const existing = await tx.surveyResponse.findUnique({
        where: { userId_surveyId: { userId, surveyId } },
      });
      if (existing?.status === 'completed') {
        throw new ConflictException('already_completed');
      }
      // Must match the latest token issued for an in-progress response.
      if (!existing || existing.id !== claims.responseId || existing.status !== 'started' || existing.returnToken !== returnToken) {
        throw new UnprocessableException('invalid_return_token');
      }

      // External surveys take real time to answer; in-app surveys have no questionnaire yet.
      if (outcome === 'completed' && survey.externalUrl) {
        const minMs = Math.max(MIN_COMPLETION_MS, (survey.estimatedMins ?? 0) * 60_000 * 0.25);
        if (Date.now() - claims.issuedAt < minMs) {
          throw new UnprocessableException('completed_too_quickly');
        }
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

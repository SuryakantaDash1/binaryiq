import { Prisma } from '@influencer/db';
import type {
  CreateSurveyInput,
  UpdateSurveyInput,
  SurveyCardDto,
  SurveyDetailDto,
  StartSurveyResult,
} from '@influencer/types';
import { Injectable, Logger } from '@nestjs/common';

import {
  ConflictException,
  NotFoundException,
  UnprocessableException,
} from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';

import { MatchingService } from './matching.service';
import { SurveyCompletionService } from './survey-completion.service';

@Injectable()
export class SurveysService {
  private readonly logger = new Logger(SurveysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: MatchingService,
    private readonly completion: SurveyCompletionService,
  ) {}

  // ─── Member listing ───────────────────────────────────────────
  async listForUser(userId: string) {
    const grouped = await this.matching.match(userId);
    return {
      priority: grouped.priority.map(this.toCardDto),
      quick: grouped.quick.map(this.toCardDto),
      premium: grouped.premium.map(this.toCardDto),
    };
  }

  async getForUser(userId: string, surveyId: string): Promise<SurveyDetailDto> {
    const now = new Date();
    const survey = await this.prisma.survey.findFirst({
      where: {
        id: surveyId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    if (!survey) throw new NotFoundException('Survey not found');
    return this.toDetailDto(survey);
  }

  // ─── Start flow ───────────────────────────────────────────────
  async start(userId: string, surveyId: string): Promise<StartSurveyResult> {
    const now = new Date();
    const survey = await this.prisma.survey.findUnique({ where: { id: surveyId } });
    if (!survey || !survey.isActive) throw new NotFoundException('Survey not found');
    if (survey.expiresAt && survey.expiresAt < now) throw new UnprocessableException('survey_expired');
    if (survey.quota !== null && survey.completedCount >= survey.quota)
      throw new UnprocessableException('survey_full');

    // Check for already-completed response
    const existing = await this.prisma.surveyResponse.findUnique({
      where: { userId_surveyId: { userId, surveyId } },
    });
    if (existing?.status === 'completed') throw new ConflictException('already_completed');

    const secret = process.env['SURVEY_CALLBACK_SECRET'] ?? 'dev-secret';
    let response = existing;
    if (!response || response.status === 'disqualified') {
      response = await this.prisma.surveyResponse.create({
        data: { userId, surveyId, status: 'started', pointsAwarded: 0 },
      });
    }

    const returnToken = this.matching.generateReturnToken(userId, surveyId, response.id, secret);
    // Store returnToken on the response (update only if changed)
    if (response.returnToken !== returnToken) {
      await this.prisma.surveyResponse.update({
        where: { id: response.id },
        data: { returnToken },
      });
    }

    if (survey.externalUrl) {
      const url = `${survey.externalUrl}?returnToken=${returnToken}`;
      return { responseId: response.id, mode: 'external', externalUrl: url, returnToken };
    }
    return { responseId: response.id, mode: 'internal', returnToken };
  }

  // ─── Complete (member or callback) ───────────────────────────
  async complete(userId: string, surveyId: string, outcome: 'completed' | 'disqualified' = 'completed') {
    return this.completion.complete(userId, surveyId, outcome);
  }

  // ─── Admin CRUD ───────────────────────────────────────────────
  async adminList(opts: { page?: number; pageSize?: number; type?: string; isActive?: boolean }) {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 20;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      ...(opts.type ? { type: opts.type } : {}),
      ...(opts.isActive !== undefined ? { isActive: opts.isActive } : {}),
    };
    const [total, surveys] = await Promise.all([
      this.prisma.survey.count({ where }),
      this.prisma.survey.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: surveys.map(this.toDetailDto), total, page, pageSize };
  }

  async adminCreate(input: CreateSurveyInput) {
    const survey = await this.prisma.survey.create({
      data: {
        title: input.title,
        description: input.description,
        type: input.type,
        pointsValue: input.pointsValue,
        estimatedMins: input.estimatedMins,
        quota: input.quota,
        targeting: input.targeting as Prisma.InputJsonValue,
        externalUrl: input.externalUrl,
        isActive: input.isActive ?? true,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      },
    });
    return this.toDetailDto(survey);
  }

  async adminUpdate(id: string, input: UpdateSurveyInput) {
    const existing = await this.prisma.survey.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Survey not found');
    const survey = await this.prisma.survey.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.pointsValue !== undefined ? { pointsValue: input.pointsValue } : {}),
        ...(input.estimatedMins !== undefined ? { estimatedMins: input.estimatedMins } : {}),
        ...(input.quota !== undefined ? { quota: input.quota } : {}),
        ...(input.targeting !== undefined
          ? { targeting: input.targeting as Prisma.InputJsonValue }
          : {}),
        ...(input.externalUrl !== undefined ? { externalUrl: input.externalUrl } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.expiresAt !== undefined ? { expiresAt: new Date(input.expiresAt) } : {}),
      },
    });
    return this.toDetailDto(survey);
  }

  // ─── Private mappers ──────────────────────────────────────────
  private toCardDto = (s: {
    id: string;
    title: string;
    type: string;
    pointsValue: number;
    estimatedMins: number | null;
    externalUrl: string | null;
  }): SurveyCardDto => ({
    id: s.id,
    title: s.title,
    type: s.type as SurveyCardDto['type'],
    pointsValue: s.pointsValue,
    estimatedMins: s.estimatedMins,
    isExternal: !!s.externalUrl,
  });

  private toDetailDto = (s: {
    id: string;
    title: string;
    type: string;
    pointsValue: number;
    estimatedMins: number | null;
    externalUrl: string | null;
    description: string | null;
    expiresAt: Date | null;
  }): SurveyDetailDto => ({
    ...this.toCardDto(s),
    description: s.description,
    expiresAt: s.expiresAt?.toISOString() ?? null,
  });
}

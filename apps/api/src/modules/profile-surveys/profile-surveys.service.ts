import type { Prisma } from '@influencer/db';
import type { CategorySchema } from '@influencer/types';
import { Injectable, Logger } from '@nestjs/common';

import {
  ConflictException,
  NotFoundException,
  UnprocessableException,
  ValidationException,
} from '../../common/exceptions/domain.exception';
import { EncryptionService } from '../../common/services/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService } from '../points/points.service';


function isUniqueViolation(e: unknown): boolean {
  return (e as { code?: string }).code === 'P2002';
}

type PrismaTx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

@Injectable()
export class ProfileSurveysService {
  private readonly logger = new Logger(ProfileSurveysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly points: PointsService,
    private readonly enc: EncryptionService,
  ) {}

  async listCategories(userId: string) {
    const [categories, responses] = await Promise.all([
      this.prisma.profileSurveyCategory.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.profileSurveyResponse.findMany({
        where: { userId },
        select: { categoryId: true, createdAt: true },
      }),
    ]);

    const completedMap = new Map(responses.map((r) => [r.categoryId, r.createdAt]));
    const balance = await this.prisma.pointsBalance.findUnique({ where: { userId } });

    const categorySummaries = categories.map((c) => ({
      id: c.id,
      key: c.key,
      name: c.name,
      pointsValue: c.pointsValue,
      sortOrder: c.sortOrder,
      completed: completedMap.has(c.id),
      completedAt: completedMap.get(c.id)?.toISOString(),
    }));

    const completed = responses.length;
    const totalPoints = 1500; // 13 × 100 + 1 × 200
    const earnedPoints = categorySummaries
      .filter((c) => c.completed)
      .reduce((sum, c) => sum + c.pointsValue, 0);

    return {
      categories: categorySummaries,
      completed,
      total: categories.length,
      points: { earned: earnedPoints, remaining: totalPoints - earnedPoints, balance: balance?.balance ?? 0 },
    };
  }

  async getCategory(userId: string, key: string) {
    const category = await this.prisma.profileSurveyCategory.findUnique({ where: { key } });
    if (!category) throw new NotFoundException(`Category '${key}' not found`);
    if (!category.isActive) throw new UnprocessableException('Category is not active');

    const existing = await this.prisma.profileSurveyResponse.findUnique({
      where: { userId_categoryId: { userId, categoryId: category.id } },
    });

    return {
      id: category.id,
      key: category.key,
      name: category.name,
      pointsValue: category.pointsValue,
      completed: !!existing,
      schema: category.schema as unknown as CategorySchema,
      responses: existing?.responses,
    };
  }

  async submitCategory(userId: string, key: string, answers: Record<string, unknown>) {
    const category = await this.prisma.profileSurveyCategory.findUnique({ where: { key } });
    if (!category) throw new NotFoundException(`Category '${key}' not found`);
    if (!category.isActive) throw new UnprocessableException('Category is not active');

    this.validateAnswers(category.schema as unknown as CategorySchema, answers);

    return this.prisma.$transaction(async (tx) => {
      try {
        const resp = await tx.profileSurveyResponse.create({
          data: {
            userId,
            categoryId: category.id,
            responses: answers as unknown as Prisma.InputJsonValue,
            pointsAwarded: category.pointsValue,
          },
        });

        // Map structured answers onto canonical tables for survey targeting
        await this.mapStructuredAnswers(tx, userId, category.key, answers);

        const balance = await this.points.award(tx, {
          userId,
          action: 'PROFILE_SURVEY',
          points: category.pointsValue,
          refType: 'profile_survey_category',
          refId: category.id,
          idempotencyKey: `profile_survey:${userId}:${category.id}`,
          description: `Profile survey: ${category.name}`,
        });

        return {
          responseId: resp.id,
          pointsAwarded: category.pointsValue,
          balance: balance.balanceAfter,
        };
      } catch (e) {
        if (isUniqueViolation(e)) throw new ConflictException('already_completed');
        throw e;
      }
    });
  }

  private validateAnswers(schema: CategorySchema, answers: Record<string, unknown>): void {
    const errors: Array<{ field: string; issue: string }> = [];
    for (const q of schema.questions) {
      const val = answers[q.key];
      if (q.required && (val === undefined || val === null || val === '')) {
        errors.push({ field: q.key, issue: `${q.label} is required` });
      }
      if (q.type === 'number' && val !== undefined) {
        const n = Number(val);
        if (isNaN(n)) errors.push({ field: q.key, issue: `${q.label} must be a number` });
        else if (q.min !== undefined && n < q.min) errors.push({ field: q.key, issue: `${q.label} must be at least ${q.min}` });
        else if (q.max !== undefined && n > q.max) errors.push({ field: q.key, issue: `${q.label} must be at most ${q.max}` });
      }
      if (q.type === 'multiselect' && Array.isArray(val) && q.maxSelections !== undefined) {
        if ((val as unknown[]).length > q.maxSelections) {
          errors.push({ field: q.key, issue: `${q.label}: max ${q.maxSelections} selections` });
        }
      }
    }
    if (errors.length > 0) {
      throw new ValidationException('Answers do not satisfy category schema', errors);
    }
  }

  private async mapStructuredAnswers(
    tx: PrismaTx,
    userId: string,
    key: string,
    answers: Record<string, unknown>,
  ): Promise<void> {
    if (key === 'about_you') {
      await tx.userAddress.upsert({
        where: { userId },
        create: {
          userId,
          city: answers['city'] as string | undefined,
          pinCode: answers['pin_code'] as string | undefined,
          areaType: (answers['area_type'] as 'URBAN' | 'RURAL' | 'SUBURBAN' | undefined),
          line1Enc: answers['address_line1'] ? this.enc.encrypt(answers['address_line1'] as string) : undefined,
        },
        update: {
          city: (answers['city'] as string | undefined) ?? undefined,
          pinCode: (answers['pin_code'] as string | undefined) ?? undefined,
          areaType: (answers['area_type'] as 'URBAN' | 'RURAL' | 'SUBURBAN' | undefined) ?? undefined,
          ...(answers['address_line1'] ? { line1Enc: this.enc.encrypt(answers['address_line1'] as string) } : {}),
        },
      });
      await tx.userDemographics.upsert({
        where: { userId },
        create: {
          userId,
          educationLevel: answers['education_level'] as string | undefined,
          employmentType: answers['employment_type'] as string | undefined,
          householdSize: answers['household_size'] ? Number(answers['household_size']) : undefined,
        },
        update: {
          educationLevel: (answers['education_level'] as string | undefined) ?? undefined,
          employmentType: (answers['employment_type'] as string | undefined) ?? undefined,
          householdSize: answers['household_size'] ? Number(answers['household_size']) : undefined,
        },
      });
    } else if (key === 'home_and_family') {
      await tx.userDemographics.upsert({
        where: { userId },
        create: {
          userId,
          householdSize: answers['household_size'] ? Number(answers['household_size']) : undefined,
          childrenCount: answers['children_count'] ? Number(answers['children_count']) : undefined,
        },
        update: {
          householdSize: answers['household_size'] ? Number(answers['household_size']) : undefined,
          childrenCount: answers['children_count'] ? Number(answers['children_count']) : undefined,
        },
      });
    } else if (key === 'finance') {
      await tx.userDemographics.upsert({
        where: { userId },
        create: {
          userId,
          incomeBracket: answers['income_bracket'] ? this.enc.encrypt(answers['income_bracket'] as string) : undefined,
          chiefWageEarner: answers['chief_wage_earner'] as boolean | undefined,
          assets: answers['assets'] as object | undefined,
        },
        update: {
          incomeBracket: answers['income_bracket'] ? this.enc.encrypt(answers['income_bracket'] as string) : undefined,
          chiefWageEarner: (answers['chief_wage_earner'] as boolean | undefined) ?? undefined,
          assets: (answers['assets'] as object | undefined) ?? undefined,
        },
      });
    }
  }
}

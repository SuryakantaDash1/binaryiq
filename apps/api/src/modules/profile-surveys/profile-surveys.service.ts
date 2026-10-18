import type { CategorySchema } from '@binaryiq/types';
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
      responses: existing ? this.enc.decryptJson<Record<string, unknown>>(existing.responsesEnc) : undefined,
    };
  }

  async submitCategory(userId: string, key: string, rawAnswers: Record<string, unknown>) {
    const category = await this.prisma.profileSurveyCategory.findUnique({ where: { key } });
    if (!category) throw new NotFoundException(`Category '${key}' not found`);
    if (!category.isActive) throw new UnprocessableException('Category is not active');

    const answers = this.validateAnswers(category.schema as unknown as CategorySchema, rawAnswers);

    return this.prisma.$transaction(async (tx) => {
      try {
        const resp = await tx.profileSurveyResponse.create({
          data: {
            userId,
            categoryId: category.id,
            // Raw answers include health, pregnancy, gender identity and income — always encrypted.
            responsesEnc: this.enc.encryptJson(answers),
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

  /**
   * Strict validation against the category schema. Unknown keys are rejected and
   * every value must match its question type/options — nothing arbitrary is stored.
   * Returns the sanitised answer object.
   */
  private validateAnswers(schema: CategorySchema, answers: Record<string, unknown>): Record<string, unknown> {
    const errors: Array<{ field: string; issue: string }> = [];
    const known = new Map(schema.questions.map((q) => [q.key, q]));
    for (const key of Object.keys(answers)) {
      if (!known.has(key)) errors.push({ field: key, issue: 'Unknown question' });
    }

    const clean: Record<string, unknown> = {};
    for (const q of schema.questions) {
      const val = answers[q.key];
      const empty = val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0);
      if (empty) {
        if (q.required) errors.push({ field: q.key, issue: `${q.label} is required` });
        continue;
      }
      const allowed = q.options ? new Set(q.options.map((o) => o.value)) : null;

      switch (q.type) {
        case 'number': {
          const n = Number(val);
          if (typeof val === 'boolean' || Number.isNaN(n)) errors.push({ field: q.key, issue: `${q.label} must be a number` });
          else if (q.min !== undefined && n < q.min) errors.push({ field: q.key, issue: `${q.label} must be at least ${q.min}` });
          else if (q.max !== undefined && n > q.max) errors.push({ field: q.key, issue: `${q.label} must be at most ${q.max}` });
          else clean[q.key] = n;
          break;
        }
        case 'select':
        case 'radio':
          if (typeof val !== 'string' || (allowed && !allowed.has(val))) {
            errors.push({ field: q.key, issue: `${q.label} has an invalid option` });
          } else clean[q.key] = val;
          break;
        case 'multiselect':
          if (!Array.isArray(val) || val.some((v) => typeof v !== 'string' || (allowed && !allowed.has(v)))) {
            errors.push({ field: q.key, issue: `${q.label} has an invalid option` });
          } else if (q.maxSelections !== undefined && val.length > q.maxSelections) {
            errors.push({ field: q.key, issue: `${q.label}: max ${q.maxSelections} selections` });
          } else clean[q.key] = val;
          break;
        case 'checkbox':
          if (typeof val !== 'boolean') errors.push({ field: q.key, issue: `${q.label} must be true or false` });
          else clean[q.key] = val;
          break;
        case 'date':
          if (typeof val !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
            errors.push({ field: q.key, issue: `${q.label} must be a date` });
          } else clean[q.key] = val;
          break;
        case 'text':
        default:
          if (typeof val !== 'string' || val.length > 300) {
            errors.push({ field: q.key, issue: `${q.label} must be text of at most 300 characters` });
          } else clean[q.key] = val.trim();
      }
    }
    if (errors.length > 0) {
      throw new ValidationException('Answers do not satisfy category schema', errors);
    }
    return clean;
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
      const incomeBracketEnc = answers['income_bracket'] ? this.enc.encrypt(answers['income_bracket'] as string) : undefined;
      // Seeded answers are 'yes'/'no' strings; the column is a boolean.
      const cwe = answers['chief_wage_earner'];
      const chiefWageEarner = cwe === undefined ? undefined : cwe === true || cwe === 'yes';
      const assetsEnc = answers['assets'] !== undefined ? this.enc.encryptJson(answers['assets']) : undefined;
      await tx.userDemographics.upsert({
        where: { userId },
        create: { userId, incomeBracketEnc, chiefWageEarner, assetsEnc },
        update: { incomeBracketEnc, chiefWageEarner, assetsEnc },
      });
    }
  }
}

import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { type SurveyType, Prisma } from '@influencer/db';
import type { TargetingCriteria } from '@influencer/types';
import { EncryptionService } from '../../common/services/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';

interface ProfileSnapshot {
  gender: string | null;
  ageYears: number | null;
  city: string | null;
  pinCode: string | null;
  areaType: string | null;
  educationLevel: string | null;
  employmentType: string | null;
  incomeBracket: string | null;
  profileCategoryCount: number;
  interests: string[];
}

type SurveyRow = {
  id: string;
  title: string;
  type: SurveyType;
  pointsValue: number;
  estimatedMins: number | null;
  targeting: Prisma.JsonValue | null;
  externalUrl: string | null;
  quota: number | null;
  completedCount: number;
};

@Injectable()
export class MatchingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async match(userId: string): Promise<{ priority: SurveyRow[]; quick: SurveyRow[]; premium: SurveyRow[] }> {
    const [snapshot, candidates] = await Promise.all([
      this.loadSnapshot(userId),
      this.loadCandidates(userId),
    ]);

    const genericOnly = snapshot.profileCategoryCount === 0;

    const eligible = candidates.filter((s) => {
      const t = s.targeting as TargetingCriteria | null;
      const isGeneric = !t || Object.keys(t).length === 0;
      if (genericOnly && !isGeneric) return false;
      return this.evaluateTargeting(snapshot, t ?? {});
    });

    const scored = eligible.map((s) => ({
      ...s,
      score: this.score(s, s.targeting as TargetingCriteria | null),
    }));
    scored.sort((a, b) => b.score - a.score);

    return {
      priority: scored.filter((s) => s.type === 'PRIORITY').map(({ score: _, ...s }) => s),
      quick: scored.filter((s) => s.type === 'QUICK').map(({ score: _, ...s }) => s),
      premium: scored.filter((s) => s.type === 'PREMIUM').map(({ score: _, ...s }) => s),
    };
  }

  private async loadSnapshot(userId: string): Promise<ProfileSnapshot> {
    const [profile, address, demographics, categoryCount] = await Promise.all([
      this.prisma.userProfile.findUnique({ where: { userId } }),
      this.prisma.userAddress.findUnique({ where: { userId } }),
      this.prisma.userDemographics.findUnique({ where: { userId } }),
      this.prisma.profileSurveyResponse.count({ where: { userId } }),
    ]);

    let ageYears: number | null = null;
    if (profile?.dobEnc) {
      try {
        const dob = new Date(this.encryption.decrypt(profile.dobEnc));
        const ageDiff = Date.now() - dob.getTime();
        ageYears = Math.floor(ageDiff / (1000 * 60 * 60 * 24 * 365.25));
      } catch {
        // encryption not configured in dev — ignore
      }
    }

    return {
      gender: profile?.gender ?? null,
      ageYears,
      city: address?.city ?? null,
      pinCode: address?.pinCode ?? null,
      areaType: address?.areaType ?? null,
      educationLevel: demographics?.educationLevel ?? null,
      employmentType: demographics?.employmentType ?? null,
      incomeBracket: demographics?.incomeBracket ?? null,
      profileCategoryCount: categoryCount,
      interests: [], // loaded from profile survey responses in a future iteration
    };
  }

  private async loadCandidates(userId: string): Promise<SurveyRow[]> {
    const now = new Date();
    // Left anti-join on survey_responses: exclude surveys the user already has a response for
    const responded = await this.prisma.surveyResponse.findMany({
      where: { userId },
      select: { surveyId: true },
    });
    const respondedIds = responded.map((r) => r.surveyId);

    return this.prisma.survey.findMany({
      where: {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        ...(respondedIds.length > 0 ? { id: { notIn: respondedIds } } : {}),
      },
      select: {
        id: true, title: true, type: true, pointsValue: true, estimatedMins: true,
        targeting: true, externalUrl: true, quota: true, completedCount: true,
      },
    });
  }

  private evaluateTargeting(snap: ProfileSnapshot, t: TargetingCriteria): boolean {
    if (t.age !== undefined) {
      if (snap.ageYears === null) return false;
      if (t.age.min !== undefined && snap.ageYears < t.age.min) return false;
      if (t.age.max !== undefined && snap.ageYears > t.age.max) return false;
    }
    if (t.gender?.length) {
      if (!snap.gender || !t.gender.includes(snap.gender)) return false;
    }
    if (t.education?.length) {
      if (!snap.educationLevel || !t.education.includes(snap.educationLevel)) return false;
    }
    if (t.employment?.length) {
      if (!snap.employmentType || !t.employment.includes(snap.employmentType)) return false;
    }
    if (t.income?.length) {
      if (!snap.incomeBracket || !t.income.includes(snap.incomeBracket)) return false;
    }
    if (t.region) {
      const r = t.region;
      if (r.cities?.length && (!snap.city || !r.cities.includes(snap.city))) return false;
      if (r.pinCodes?.length && (!snap.pinCode || !r.pinCodes.includes(snap.pinCode))) return false;
      if (r.areaType?.length && (!snap.areaType || !r.areaType.includes(snap.areaType))) return false;
    }
    if (t.interests?.length) {
      if (!t.interests.some((i) => snap.interests.includes(i))) return false;
    }
    return true;
  }

  private score(s: SurveyRow, t: TargetingCriteria | null): number {
    let sc = s.pointsValue / 100; // higher points → higher score
    if (t && Object.keys(t).length > 0) {
      sc += Object.keys(t).length * 5; // more specific → ranked higher
    }
    return sc;
  }

  // Generate signed return token for external surveys
  generateReturnToken(userId: string, surveyId: string, responseId: string, secret: string): string {
    const payload = `${userId}:${surveyId}:${responseId}:${Date.now()}`;
    const sig = createHmac('sha256', secret).update(payload).digest('hex');
    return Buffer.from(`${payload}:${sig}`).toString('base64url');
  }

  verifyReturnToken(token: string, secret: string): { userId: string; surveyId: string; responseId: string } | null {
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const parts = decoded.split(':');
      if (parts.length < 5) return null;
      const userId = parts[0];
      const surveyId = parts[1];
      const responseId = parts[2];
      const sig = parts[4];
      if (!userId || !surveyId || !responseId || !sig) return null;
      const payload = parts.slice(0, 4).join(':');
      const expected = createHmac('sha256', secret).update(payload).digest('hex');
      if (sig !== expected) return null;
      return { userId, surveyId, responseId };
    } catch {
      return null;
    }
  }
}

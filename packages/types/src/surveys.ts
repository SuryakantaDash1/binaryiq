import { z } from 'zod';

// ─── Survey card / detail DTOs ────────────────────────────────
export interface SurveyCardDto {
  id: string;
  title: string;
  type: 'PRIORITY' | 'QUICK' | 'PREMIUM';
  pointsValue: number;
  estimatedMins: number | null;
  isExternal: boolean;
}

export interface SurveyDetailDto extends SurveyCardDto {
  description: string | null;
  expiresAt: string | null;
}

export interface MatchedSurveysDto {
  priority: SurveyCardDto[];
  quick: SurveyCardDto[];
  premium: SurveyCardDto[];
}

export interface StartSurveyResult {
  responseId: string;
  mode: 'external' | 'internal';
  externalUrl?: string;
  returnToken: string;
}

export interface CompleteSurveyResult {
  status: 'completed' | 'disqualified';
  pointsAwarded: number;
  balanceAfter: number;
}

// ─── Input schemas (input == output type so ZodValidationPipe is happy) ──
export const completeSurveyInputSchema = z.object({
  /** Signed token issued by POST /surveys/:id/start — proves this user actually started it. */
  returnToken: z.string().min(16).max(1024),
  responseId: z.string().uuid().optional(),
  // Provider callback fields (optional)
  status: z.enum(['completed', 'disqualified']).optional(),
  providerRef: z.string().optional(),
  signature: z.string().optional(),
  timestamp: z.string().optional(),
});
export type CompleteSurveyInput = z.infer<typeof completeSurveyInputSchema>;

export const createSurveySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  type: z.enum(['PRIORITY', 'QUICK', 'PREMIUM']),
  pointsValue: z.number().int().positive(),
  estimatedMins: z.number().int().positive().optional(),
  quota: z.number().int().positive().optional(),
  targeting: z.record(z.unknown()).optional(),
  externalUrl: z.string().url().optional(),
  expiresAt: z.string().optional(),
  isActive: z.boolean().optional(),
});
export type CreateSurveyInput = z.infer<typeof createSurveySchema>;

export const updateSurveySchema = createSurveySchema.partial();
export type UpdateSurveyInput = z.infer<typeof updateSurveySchema>;

// ─── Targeting schema ─────────────────────────────────────────
export interface TargetingCriteria {
  age?: { min?: number; max?: number };
  gender?: string[];
  education?: string[];
  employment?: string[];
  income?: string[];
  region?: { pinCodes?: string[]; cities?: string[]; areaType?: string[] };
  interests?: string[];
}

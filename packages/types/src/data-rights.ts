import { z } from 'zod';

export type ConsentType = 'TERMS' | 'PRIVACY' | 'MARKETING' | 'COOKIES';

export interface ConsentLogDTO {
  id: string;
  consentType: ConsentType;
  consentVersion: string;
  granted: boolean;
  ipAddress: string | null;
  createdAt: string;
}

export interface ConsentCurrentState {
  current: Partial<Record<ConsentType, boolean>>;
  history: ConsentLogDTO[];
}

export const consentInputSchema = z.object({
  consentType: z.enum(['TERMS', 'PRIVACY', 'MARKETING', 'COOKIES']),
  consentVersion: z.string().min(1).max(50),
  granted: z.boolean(),
});

export const erasureInputSchema = z.object({
  confirm: z.literal('DELETE'),
});

export const adminAuditLogQuerySchema = z.object({
  actorType: z.string().optional(),
  actorId: z.string().uuid().optional(),
  action: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const adminConsentQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  consentType: z.enum(['TERMS', 'PRIVACY', 'MARKETING', 'COOKIES']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

export type ConsentInput = z.infer<typeof consentInputSchema>;
export type ErasureInput = z.infer<typeof erasureInputSchema>;
export type AdminAuditLogQuery = z.infer<typeof adminAuditLogQuerySchema>;
export type AdminConsentQuery = z.infer<typeof adminConsentQuerySchema>;

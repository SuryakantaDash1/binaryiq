import { z } from 'zod';

// ─── Admin auth ───
export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

/**
 * Result of the password step. Admins always complete a second step with an
 * authenticator-app code; first-time admins enrol by scanning the QR code.
 */
export type AdminLoginChallenge =
  | { status: 'totp_required'; challengeToken: string }
  | {
      status: 'enrollment_required';
      challengeToken: string;
      /** otpauth:// URI encoded in the QR code. */
      otpauthUrl: string;
      qrDataUrl: string;
      /** Same secret as the QR code, for manual entry. */
      secret: string;
    };

export const adminTotpSchema = z.object({
  challengeToken: z.string().min(1).max(2000),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app'),
});
export type AdminTotpInput = z.infer<typeof adminTotpSchema>;

export type AdminRoleType = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'DPO';

export interface AdminProfile {
  id: string;
  email: string;
  name: string;
  role: AdminRoleType;
}

export interface AdminSession {
  accessToken: string;
  admin: AdminProfile;
}

// ─── Users listing ───
export const adminUsersQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(['active', 'blocked']).optional(),
  verified: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;

export const adminUpdateUserSchema = z.object({
  isActive: z.boolean(),
});
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;

export interface AdminUserRow {
  id: string;
  email: string;
  username: string;
  isVerified: boolean;
  isActive: boolean;
  balance: number;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminUsersResult {
  items: AdminUserRow[];
  pagination: { total: number; page: number; pageSize: number };
}

// ─── Dashboard stats ───
export interface AdminStats {
  users: {
    total: number;
    active30d: number;
    active7d: number;
    verified: number;
    blocked: number;
    newToday: number;
    new7d: number;
    new30d: number;
  };
  points: { issued: number; spent: number; outstanding: number };
  engagement: {
    redemptionsTotal: number;
    redemptionsPending: number;
    surveyResponses: number;
    pollVotes: number;
    gamePlays: number;
    profileSurveyResponses: number;
    openTickets: number;
  };
  redemptionsByStatus: Array<{ status: string; count: number }>;
  genderSplit: Array<{ gender: string; count: number }>;
  topCountries: Array<{ country: string; count: number }>;
  signupsByDay: Array<{ date: string; count: number }>;
  recentSignups: Array<{ id: string; email: string; username: string; createdAt: string; isVerified: boolean }>;
  recentActivity: Array<{ id: string; actorType: string; action: string; targetType: string | null; createdAt: string }>;
}

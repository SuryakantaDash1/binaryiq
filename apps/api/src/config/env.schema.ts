import { z } from 'zod';

/**
 * Boot-time env validation. The process refuses to start on a missing or
 * malformed var (fail fast). See architecture/03-backend-architecture §5.
 *
 * Phase 0 note: JWT keys are optional so the skeleton boots without a keypair;
 * Phase 1 (auth flows) makes them required. TokenService throws clearly if
 * asked to sign/verify while keys are absent.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  REDIS_URL: z.string().url(),

  JWT_PRIVATE_KEY: z.string().min(1).optional(),
  JWT_PUBLIC_KEY: z.string().min(1).optional(),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  ENCRYPTION_KEY: z.string().length(64).optional(),
  POINTS_PER_INR: z.coerce.number().default(100),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  REGISTRATION_BONUS_POINTS: z.coerce.number().default(500),

  SEED_SUPERADMIN_EMAIL: z.string().email().optional(),
  SEED_SUPERADMIN_PASSWORD: z.string().min(12).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

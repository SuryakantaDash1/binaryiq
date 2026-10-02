import { z } from 'zod';

/**
 * Boot-time env validation. The process refuses to start on a missing or
 * malformed var (fail fast). See architecture/03-backend-architecture §5.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    PORT: z.coerce.number().default(4000),

    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url().optional(),
    REDIS_URL: z.string().url(),

    JWT_PRIVATE_KEY: z.string().min(1),
    JWT_PUBLIC_KEY: z.string().min(1),
    JWT_ACCESS_TTL: z.string().default('15m'),
    JWT_REFRESH_TTL: z.string().default('30d'),
    ADMIN_ACCESS_TTL: z.string().default('15m'),
    ADMIN_SESSION_TTL: z.string().default('8h'),

    ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i, 'must be 64 hex characters (openssl rand -hex 32)'),
    SURVEY_CALLBACK_SECRET: z.string().min(32),

    POINTS_PER_INR: z.coerce.number().default(100),
    WEB_URL: z.string().url().default('http://localhost:3000'),
    REGISTRATION_BONUS_POINTS: z.coerce.number().default(500),

    // Comma-separated browser origins allowed to call the API with credentials.
    // Defaults to WEB_URL.
    CORS_ORIGINS: z.string().optional(),
    // Number of reverse-proxy hops in front of the API (0 = direct). Needed so
    // req.ip, rate limiting and audit/consent IPs see the real client.
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),

    // Testing only: instantly verify accounts on registration. Rejected in production.
    AUTO_VERIFY_EMAIL: z.enum(['true', 'false']).default('false'),

    SENDGRID_API_KEY: z.string().optional(),
    SENDGRID_FROM_EMAIL: z.string().email().optional(),
    SENDGRID_WEBHOOK_VERIFICATION_KEY: z.string().optional(),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    PAYPAL_CLIENT_ID: z.string().optional(),
    PAYPAL_CLIENT_SECRET: z.string().optional(),
    PAYPAL_WEBHOOK_ID: z.string().optional(),
    PAYPAL_API_BASE: z.string().url().default('https://api-m.sandbox.paypal.com'),
    FCM_WEBHOOK_SECRET: z.string().min(32).optional(),

    SEED_SUPERADMIN_EMAIL: z.string().email().optional(),
    SEED_SUPERADMIN_PASSWORD: z.string().min(12).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    if (env.AUTO_VERIFY_EMAIL === 'true') {
      ctx.addIssue({ code: 'custom', path: ['AUTO_VERIFY_EMAIL'], message: 'must be false in production' });
    }
    if (/localhost|127\.0\.0\.1/.test(env.WEB_URL)) {
      ctx.addIssue({ code: 'custom', path: ['WEB_URL'], message: 'must not point at localhost in production' });
    }
    if (!env.SENDGRID_API_KEY || !env.SENDGRID_FROM_EMAIL) {
      ctx.addIssue({
        code: 'custom',
        path: ['SENDGRID_API_KEY'],
        message: 'SENDGRID_API_KEY and SENDGRID_FROM_EMAIL are required in production (no console email)',
      });
    }
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

import { z } from 'zod';

/** Response DTO for GET /v1/health/ready. */
export const healthReadySchema = z.object({
  status: z.enum(['ok', 'error']),
  dependencies: z.object({
    postgres: z.enum(['up', 'down']),
    redis: z.enum(['up', 'down']),
  }),
});

export type HealthReady = z.infer<typeof healthReadySchema>;

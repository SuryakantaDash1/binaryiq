import { PrismaClient } from '@prisma/client';

/**
 * Shared Prisma client. In dev, reuse a single instance across HMR reloads to
 * avoid exhausting connections. The NestJS `PrismaService` wraps this for
 * lifecycle management (see apps/api/src/prisma).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export { PrismaClient };
export * from '@prisma/client';

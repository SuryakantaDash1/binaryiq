/**
 * Clears an admin's authenticator-app enrolment (lost phone), signs them out
 * everywhere and unlocks the account. They re-enrol with a new QR code on their
 * next login. Run by an operator with database access:
 *
 *   packages/db/node_modules/.bin/tsx apps/api/src/scripts/admin-reset-2fa.ts admin@example.com
 */
import { PrismaClient } from '@influencer/db';

const email = process.argv[2]?.toLowerCase();
if (!email) {
  console.error('Usage: admin-reset-2fa.ts <admin-email>');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const admin = await prisma.admin.findUnique({ where: { email: email! } });
  if (!admin) throw new Error('No admin with that email');
  await prisma.admin.update({
    where: { id: admin.id },
    data: {
      totpSecretEnc: null,
      totpEnabledAt: null,
      failedLogins: 0,
      lockedUntil: null,
      tokenVersion: { increment: 1 },
    },
  });
  await prisma.auditLog.create({
    data: { actorType: 'system', action: 'admin.2fa_reset', targetType: 'admin', targetId: admin.id },
  });
  console.warn('2FA reset. The admin will enrol a new authenticator on next login.');
  console.warn('Note: their cached session state expires within 60 seconds.');
}

main()
  .catch((e: unknown) => {
    console.error((e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());

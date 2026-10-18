/**
 * One-off, idempotent backfill: brings every stored personal-data field up to the
 * current `v1:` AES-256-GCM format.
 *
 *   - plaintext values (e.g. DOB/phone written by the old registration flow) → encrypted
 *   - legacy unprefixed ciphertext → re-encrypted in the `v1:` format
 *   - JSON columns (survey answers, assets) → wrapped in an encrypted { v, ct } envelope
 *   - pending one-time tokens deleted (they become invalid once tokens are hashed)
 *   - plaintext email addresses stripped from old `email.change` audit metadata
 *
 * Prints counts only — never field values.
 *
 * Usage (from repo root, with apps/api/.env loaded into the environment):
 *   packages/db/node_modules/.bin/tsx apps/api/src/scripts/encrypt-backfill.ts [--dry-run]
 */
import { Prisma, PrismaClient } from '@binaryiq/db';

import {
  decryptWithKey,
  encryptJsonWithKey,
  encryptWithKey,
  isCurrentCiphertext,
  isEncryptedJson,
  parseKey,
} from '../common/crypto/encryption.core';

const dryRun = process.argv.includes('--dry-run');
const key = parseKey(process.env['ENCRYPTION_KEY'] ?? '');
const prisma = new PrismaClient();

/** Returns the upgraded ciphertext, or null if the value is already current. */
function upgrade(value: string): string | null {
  if (isCurrentCiphertext(value)) return null;
  let plain: string;
  try {
    plain = decryptWithKey(key, value); // legacy unprefixed ciphertext
  } catch {
    plain = value; // stored in plaintext
  }
  return encryptWithKey(key, plain);
}

const counts: Record<string, number> = {};
function bump(label: string): void {
  counts[label] = (counts[label] ?? 0) + 1;
}

async function main(): Promise<void> {
  // UserProfile.dobEnc
  for (const row of await prisma.userProfile.findMany({ select: { id: true, dobEnc: true } })) {
    const next = upgrade(row.dobEnc);
    if (!next) continue;
    bump('userProfile.dob');
    if (!dryRun) await prisma.userProfile.update({ where: { id: row.id }, data: { dobEnc: next } });
  }

  // User.phoneEnc
  for (const row of await prisma.user.findMany({ where: { phoneEnc: { not: null } }, select: { id: true, phoneEnc: true } })) {
    const next = upgrade(row.phoneEnc!);
    if (!next) continue;
    bump('user.phone');
    if (!dryRun) await prisma.user.update({ where: { id: row.id }, data: { phoneEnc: next } });
  }

  // UserAddress.line1Enc
  for (const row of await prisma.userAddress.findMany({ where: { line1Enc: { not: null } }, select: { id: true, line1Enc: true } })) {
    const next = upgrade(row.line1Enc!);
    if (!next) continue;
    bump('userAddress.line1');
    if (!dryRun) await prisma.userAddress.update({ where: { id: row.id }, data: { line1Enc: next } });
  }

  // UserDemographics.incomeBracketEnc + assetsEnc
  for (const row of await prisma.userDemographics.findMany({ select: { id: true, incomeBracketEnc: true, assetsEnc: true } })) {
    const data: Prisma.UserDemographicsUpdateInput = {};
    if (row.incomeBracketEnc) {
      const next = upgrade(row.incomeBracketEnc);
      if (next) {
        data.incomeBracketEnc = next;
        bump('userDemographics.incomeBracket');
      }
    }
    if (row.assetsEnc !== null && !isEncryptedJson(row.assetsEnc)) {
      data.assetsEnc = encryptJsonWithKey(key, row.assetsEnc);
      bump('userDemographics.assets');
    }
    if (!dryRun && Object.keys(data).length) await prisma.userDemographics.update({ where: { id: row.id }, data });
  }

  // PaypalAccount.paypalEmailEnc
  for (const row of await prisma.paypalAccount.findMany({ select: { id: true, paypalEmailEnc: true } })) {
    const next = upgrade(row.paypalEmailEnc);
    if (!next) continue;
    bump('paypalAccount.email');
    if (!dryRun) await prisma.paypalAccount.update({ where: { id: row.id }, data: { paypalEmailEnc: next } });
  }

  // ProfileSurveyResponse.responsesEnc
  for (const row of await prisma.profileSurveyResponse.findMany({ select: { id: true, responsesEnc: true } })) {
    if (isEncryptedJson(row.responsesEnc)) continue;
    bump('profileSurveyResponse.responses');
    if (!dryRun) {
      await prisma.profileSurveyResponse.update({
        where: { id: row.id },
        data: { responsesEnc: encryptJsonWithKey(key, row.responsesEnc) },
      });
    }
  }

  // One-time tokens: raw values and plaintext payloads — drop them all.
  const tokenCount = await prisma.authToken.count();
  counts['authToken.deleted'] = tokenCount;
  if (!dryRun && tokenCount) await prisma.authToken.deleteMany({});

  // Audit metadata that captured a new email address.
  const emailAudits = await prisma.auditLog.count({ where: { action: 'email.change', NOT: { metadata: { equals: Prisma.DbNull } } } });
  counts['auditLog.emailChangeMetadata'] = emailAudits;
  if (!dryRun && emailAudits) {
    await prisma.auditLog.updateMany({ where: { action: 'email.change' }, data: { metadata: Prisma.DbNull } });
  }

  console.warn(`${dryRun ? '[dry run] would update' : 'Updated'}:`);
  for (const [label, n] of Object.entries(counts)) console.warn(`  ${label}: ${n}`);
}

main()
  .catch((e: unknown) => {
    console.error('Backfill failed:', (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());

import { createHash, randomUUID } from 'node:crypto';

/**
 * Email-verification / password-reset / email-change tokens. Only the SHA-256 is
 * stored, so read access to the database doesn't hand out account-takeover links.
 * (UUIDv4 keeps the format the existing validators expect; 122 bits of entropy.)
 */
export function newOneTimeToken(): { raw: string; hash: string } {
  const raw = randomUUID();
  return { raw, hash: hashOneTimeToken(raw) };
}

export function hashOneTimeToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

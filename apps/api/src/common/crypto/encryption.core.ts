import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Framework-free AES-256-GCM field encryption, shared by EncryptionService and the
 * backfill script. Fail-closed: anything that isn't valid authenticated ciphertext
 * throws — there is no plaintext fallback.
 *
 * Format: `v1:` + base64(iv[12] ‖ tag[16] ‖ ciphertext). The version prefix leaves
 * room for key rotation. Values written before the prefix existed (bare base64 of
 * the same layout) are still accepted on read and rewritten by the backfill.
 */

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
export const CIPHERTEXT_PREFIX = 'v1:';

export class DecryptionError extends Error {
  constructor() {
    super('Field decryption failed');
    this.name = 'DecryptionError';
  }
}

// A type alias (not an interface) so it's assignable to Prisma.InputJsonValue.
export type EncryptedJson = {
  v: 1;
  ct: string;
};

export function parseKey(hex: string): Buffer {
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error('ENCRYPTION_KEY must be 64 hex characters');
  return Buffer.from(hex, 'hex');
}

export function encryptWithKey(key: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return CIPHERTEXT_PREFIX + Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
}

function decryptRaw(key: Buffer, b64: string): string {
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < IV_LEN + TAG_LEN) throw new DecryptionError();
  try {
    const decipher = createDecipheriv(ALGO, key, buf.subarray(0, IV_LEN));
    decipher.setAuthTag(buf.subarray(IV_LEN, IV_LEN + TAG_LEN));
    return Buffer.concat([decipher.update(buf.subarray(IV_LEN + TAG_LEN)), decipher.final()]).toString('utf8');
  } catch {
    throw new DecryptionError();
  }
}

export function decryptWithKey(key: Buffer, value: string): string {
  if (value.startsWith(CIPHERTEXT_PREFIX)) return decryptRaw(key, value.slice(CIPHERTEXT_PREFIX.length));
  // Legacy unprefixed ciphertext — still GCM-authenticated, so a wrong key or
  // plaintext input fails the tag check and throws.
  return decryptRaw(key, value);
}

/** True only for current-format ciphertext. */
export function isCurrentCiphertext(value: string): boolean {
  return value.startsWith(CIPHERTEXT_PREFIX);
}

export function encryptJsonWithKey(key: Buffer, value: unknown): EncryptedJson {
  return { v: 1, ct: encryptWithKey(key, JSON.stringify(value)) };
}

export function isEncryptedJson(value: unknown): value is EncryptedJson {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { v?: unknown }).v === 1 &&
    typeof (value as { ct?: unknown }).ct === 'string'
  );
}

export function decryptJsonWithKey<T = unknown>(key: Buffer, value: unknown): T {
  if (!isEncryptedJson(value)) throw new DecryptionError();
  return JSON.parse(decryptWithKey(key, value.ct)) as T;
}

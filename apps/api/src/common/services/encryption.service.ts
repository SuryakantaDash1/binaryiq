import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '../../config/config.service';

const ALGO = 'aes-256-gcm';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer | null;

  constructor(private readonly config: AppConfigService) {
    const hex = this.config.get('ENCRYPTION_KEY') as string | undefined;
    this.key = hex ? Buffer.from(hex, 'hex') : null;
    if (!this.key) this.logger.warn('ENCRYPTION_KEY not set — PII fields stored as plaintext (dev only)');
  }

  encrypt(plaintext: string): string {
    if (!this.key) return plaintext;
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  decrypt(ciphertext: string): string {
    if (!this.key) return ciphertext;
    try {
      const buf = Buffer.from(ciphertext, 'base64');
      const iv = buf.subarray(0, 12);
      const tag = buf.subarray(12, 28);
      const enc = buf.subarray(28);
      const decipher = createDecipheriv(ALGO, this.key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    } catch {
      // If decryption fails (e.g. plaintext stored in dev), return as-is
      return ciphertext;
    }
  }
}

import { Injectable } from '@nestjs/common';

import { AppConfigService } from '../../config/config.service';
import {
  decryptJsonWithKey,
  decryptWithKey,
  encryptJsonWithKey,
  encryptWithKey,
  parseKey,
  type EncryptedJson,
} from '../crypto/encryption.core';

/**
 * Field-level encryption for personal data. ENCRYPTION_KEY is required at boot
 * (env.schema.ts), and decryption throws on any non-ciphertext input — callers
 * never get plaintext back silently.
 */
@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(config: AppConfigService) {
    this.key = parseKey(config.get('ENCRYPTION_KEY'));
  }

  encrypt(plaintext: string): string {
    return encryptWithKey(this.key, plaintext);
  }

  decrypt(ciphertext: string): string {
    return decryptWithKey(this.key, ciphertext);
  }

  encryptOptional(plaintext: string | null | undefined): string | null {
    return plaintext ? this.encrypt(plaintext) : null;
  }

  decryptOptional(ciphertext: string | null | undefined): string | null {
    return ciphertext ? this.decrypt(ciphertext) : null;
  }

  encryptJson(value: unknown): EncryptedJson {
    return encryptJsonWithKey(this.key, value);
  }

  decryptJson<T = unknown>(value: unknown): T {
    return decryptJsonWithKey<T>(this.key, value);
  }

  decryptJsonOptional<T = unknown>(value: unknown): T | null {
    return value === null || value === undefined ? null : this.decryptJson<T>(value);
  }
}

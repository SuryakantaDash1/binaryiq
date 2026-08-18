import { describe, it, expect } from 'vitest';

import { API_ERROR_CODES } from './envelope.js';
import { healthReadySchema } from './health.js';

describe('healthReadySchema', () => {
  it('accepts a valid ready payload', () => {
    const parsed = healthReadySchema.parse({
      status: 'ok',
      dependencies: { postgres: 'up', redis: 'up' },
    });
    expect(parsed.status).toBe('ok');
  });

  it('rejects an invalid dependency value', () => {
    expect(() =>
      healthReadySchema.parse({ status: 'ok', dependencies: { postgres: 'maybe', redis: 'up' } }),
    ).toThrow();
  });
});

describe('API_ERROR_CODES', () => {
  it('includes the canonical codes', () => {
    expect(API_ERROR_CODES).toContain('VALIDATION_ERROR');
    expect(API_ERROR_CODES).toContain('UNPROCESSABLE');
  });
});

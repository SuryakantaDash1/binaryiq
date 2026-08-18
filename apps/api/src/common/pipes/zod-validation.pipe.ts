import { Injectable, type PipeTransform } from '@nestjs/common';
import { ZodError, type ZodSchema } from 'zod';

import { ValidationException } from '../exceptions/domain.exception';

/**
 * Validates a value against a Zod schema, throwing the canonical VALIDATION_ERROR
 * envelope on failure. Used per-handler via `new ZodValidationPipe(schema)` with
 * DTO schemas from `@influencer/types`. See 05-api-conventions §5.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    try {
      return this.schema.parse(value);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new ValidationException(
          'Request validation failed',
          err.issues.map((i) => ({ field: i.path.join('.') || '(root)', issue: i.message })),
        );
      }
      throw err;
    }
  }
}

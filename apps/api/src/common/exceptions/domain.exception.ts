import type { ApiErrorCode } from '@influencer/types';
import { HttpException, HttpStatus } from '@nestjs/common';

interface DomainErrorDetail {
  field: string;
  issue: string;
}

/**
 * Base domain exception. Carries a canonical API error code + HTTP status so the
 * global exception filter can render the standard error envelope.
 * See architecture/05-api-conventions §4 and 03-backend-architecture §8.
 */
export class DomainException extends HttpException {
  constructor(
    public readonly code: ApiErrorCode,
    status: HttpStatus,
    message: string,
    public readonly details?: DomainErrorDetail[],
  ) {
    super(message, status);
  }
}

export class ValidationException extends DomainException {
  constructor(message = 'Validation failed', details?: DomainErrorDetail[]) {
    super('VALIDATION_ERROR', HttpStatus.BAD_REQUEST, message, details);
  }
}

export class UnauthenticatedException extends DomainException {
  constructor(message = 'Authentication required') {
    super('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED, message);
  }
}

export class ForbiddenException extends DomainException {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', HttpStatus.FORBIDDEN, message);
  }
}

export class NotFoundException extends DomainException {
  constructor(message = 'Not found') {
    super('NOT_FOUND', HttpStatus.NOT_FOUND, message);
  }
}

export class ConflictException extends DomainException {
  constructor(message = 'Conflict') {
    super('CONFLICT', HttpStatus.CONFLICT, message);
  }
}

export class UnprocessableException extends DomainException {
  constructor(message = 'Unprocessable', details?: DomainErrorDetail[]) {
    super('UNPROCESSABLE', HttpStatus.UNPROCESSABLE_ENTITY, message, details);
  }
}

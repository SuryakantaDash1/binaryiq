import type { ApiFailure, ApiErrorCode } from '@influencer/types';
import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { DomainException } from '../exceptions/domain.exception';

/**
 * Renders every thrown error as the canonical error envelope
 * `{ data: null, error: { code, message, details }, meta }`.
 * Internal faults never leak details. See 05-api-conventions §3–4.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  /** `verbose` logs full stacks (local dev). Elsewhere only the error class + Prisma code are
   *  logged, because database error messages can embed the row values being written. */
  constructor(private readonly verbose = false) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { requestId?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ApiErrorCode = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: ApiFailure['error']['details'];

    if (exception instanceof DomainException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = mapStatusToCode(status);
      message = exception.message;
    } else if (this.verbose) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    } else {
      const name = exception instanceof Error ? exception.name : typeof exception;
      const prismaCode = (exception as { code?: unknown } | null)?.code;
      this.logger.error(
        `Unhandled ${name}${typeof prismaCode === 'string' ? ` (${prismaCode})` : ''} on ${req.method} ${req.path} [${req.requestId ?? 'req_unknown'}]`,
      );
    }

    const body: ApiFailure = {
      data: null,
      error: { code, message, ...(details ? { details } : {}) },
      meta: { requestId: req.requestId ?? 'req_unknown', timestamp: new Date().toISOString() },
    };
    res.status(status).json(body);
  }
}

function mapStatusToCode(status: number): ApiErrorCode {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'VALIDATION_ERROR';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHENTICATED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'UNPROCESSABLE';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    default:
      return 'INTERNAL_ERROR';
  }
}

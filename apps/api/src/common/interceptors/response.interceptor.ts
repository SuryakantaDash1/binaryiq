import type { ApiSuccess, ApiMeta } from '@binaryiq/types';
import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { map, type Observable } from 'rxjs';

/**
 * Wraps every successful controller return value in the standard success
 * envelope `{ data, error: null, meta }`. Controllers return plain DTOs.
 * See 05-api-conventions §2.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccess<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccess<T>> {
    const req = context.switchToHttp().getRequest<Request & { requestId?: string }>();
    return next.handle().pipe(
      map((data): ApiSuccess<T> => {
        const meta: ApiMeta = {
          requestId: req.requestId ?? 'req_unknown',
          timestamp: new Date().toISOString(),
        };
        // If a handler already returned an enveloped payload, pass it through.
        if (data && typeof data === 'object' && 'data' in data && 'meta' in data) {
          return data as unknown as ApiSuccess<T>;
        }
        return { data, error: null, meta };
      }),
    );
  }
}

/**
 * The canonical API response envelope. Every API response — success or error —
 * uses this shape. See architecture/05-api-conventions §2.
 */

export interface ApiMetaPagination {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

export interface ApiMeta {
  requestId: string;
  timestamp?: string;
  pagination?: ApiMetaPagination;
}

export interface ApiErrorShape {
  code: ApiErrorCode;
  message: string;
  details?: Array<{ field: string; issue: string }>;
}

export interface ApiSuccess<T> {
  data: T;
  error: null;
  meta: ApiMeta;
}

export interface ApiFailure {
  data: null;
  error: ApiErrorShape;
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/** Canonical, stable error codes clients switch on. See 05-api-conventions §4. */
export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'UNPROCESSABLE',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

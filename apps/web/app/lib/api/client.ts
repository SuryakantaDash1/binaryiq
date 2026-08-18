import type { ApiResponse, ApiErrorCode } from '@influencer/types';

/** Typed error thrown by the API client; callers never see the raw envelope. */
export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number,
    public readonly details?: Array<{ field: string; issue: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  /** Bearer token for authenticated calls (from the session on the server). */
  token?: string;
  /** Request body — plain objects are JSON-stringified automatically. */
  body?: BodyInit | Record<string, unknown> | null;
}

/**
 * Envelope-aware fetch. On success returns `data`; on error throws `ApiError`.
 * See architecture/06-frontend-architecture §3.3.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { token, headers, ...rest } = options;
  const serializedBody =
    rest.body !== undefined && rest.body !== null && typeof rest.body === 'object' && !(rest.body instanceof FormData) && !(rest.body instanceof URLSearchParams) && !(rest.body instanceof ReadableStream) && !(rest.body instanceof ArrayBuffer)
      ? JSON.stringify(rest.body)
      : (rest.body as BodyInit | null | undefined);

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    body: serializedBody,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  let body: ApiResponse<T>;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError('INTERNAL_ERROR', `Malformed response (${res.status})`, res.status);
  }

  if (!res.ok || body.error) {
    const err = body.error;
    throw new ApiError(
      err?.code ?? 'INTERNAL_ERROR',
      err?.message ?? `Request failed (${res.status})`,
      res.status,
      err?.details,
    );
  }

  return body.data;
}

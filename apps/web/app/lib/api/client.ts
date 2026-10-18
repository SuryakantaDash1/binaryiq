import type { ApiResponse, ApiErrorCode } from '@influencer/types';

import { clearToken, getToken, setToken } from './session.js';

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

/**
 * Long enough to ride out a cold start: the API host sleeps when idle and the
 * first request after that can take ~50 s while it wakes.
 */
export const REQUEST_TIMEOUT_MS = 70_000;

let warmedUp = false;
/** Fire-and-forget ping so a sleeping API starts waking while the user fills in a form. */
export function warmUpApi(): void {
  if (warmedUp || typeof window === 'undefined') return;
  warmedUp = true;
  void fetch(`${BASE_URL}/health/live`, { credentials: 'omit' }).catch(() => undefined);
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  /** Bearer token override; falls back to the stored access token. */
  token?: string;
  /** Public endpoint: send no session and never try to refresh one. */
  anonymous?: boolean;
  /** Request body — plain objects are JSON-stringified automatically. */
  body?: BodyInit | Record<string, unknown> | null;
}

/**
 * Envelope-aware fetch. On success returns `data`; on error throws `ApiError`.
 * Auto-attaches the stored access token and, on a 401, tries to refresh it once
 * (via the httpOnly refresh cookie) before giving up.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  return doFetch<T>(path, options, true);
}

async function doFetch<T>(
  path: string,
  options: ApiFetchOptions,
  allowRefresh: boolean,
): Promise<T> {
  const { token, headers, anonymous, ...rest } = options;
  const canRefresh = allowRefresh && !anonymous && !path.startsWith('/auth/');
  // The access token is memory-only: after a reload, mint it from the refresh
  // cookie before the first request so it doesn't go out anonymously.
  if (!token && !getToken() && !knownSignedOut && canRefresh) {
    await tryRefresh();
  }
  const authToken = anonymous ? undefined : (token ?? getToken() ?? undefined);

  const serializedBody =
    rest.body !== undefined && rest.body !== null && typeof rest.body === 'object' && !(rest.body instanceof FormData) && !(rest.body instanceof URLSearchParams) && !(rest.body instanceof ReadableStream) && !(rest.body instanceof ArrayBuffer)
      ? JSON.stringify(rest.body)
      : (rest.body as BodyInit | null | undefined);

  // Guard against a stalled request (server restarting, DB cold start, etc.)
  // hanging the UI forever — surface it as an error after 25s instead.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      body: serializedBody,
      signal: rest.signal ?? controller.signal,
      headers: {
        'content-type': 'application/json',
        ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
        ...headers,
      },
    });
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    throw new ApiError(
      'INTERNAL_ERROR',
      aborted
        ? 'The request timed out. Please try again.'
        : 'Unable to reach the server. Please check your connection and try again.',
      0,
    );
  } finally {
    clearTimeout(timeout);
  }

  // Access token likely expired — refresh once, then retry the request.
  if (res.status === 401 && canRefresh) {
    const refreshed = await tryRefresh();
    if (refreshed) return doFetch<T>(path, options, false);
  }

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

let refreshInFlight: Promise<boolean> | null = null;
/** Set once a refresh fails, so signed-out visitors don't trigger one per request. */
let knownSignedOut = false;

/**
 * Exchange the httpOnly refresh cookie for a fresh access token. Refresh tokens
 * are single-use, so concurrent callers share one request.
 */
export function tryRefresh(): Promise<boolean> {
  refreshInFlight ??= doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function doRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      clearToken();
      knownSignedOut = true;
      return false;
    }
    const body = (await res.json()) as ApiResponse<{ accessToken: string }>;
    const newToken = body.data?.accessToken;
    if (newToken) {
      setToken(newToken);
      knownSignedOut = false;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

import type {
  AdminSession,
  AdminStats,
  AdminUserRow,
  AdminUsersResult,
  ApiResponse,
} from '@influencer/types';

import { ApiError } from './client.js';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';
const ADMIN_TOKEN_KEY = 'influencer_admin_token';

// ─── Isolated admin token store (separate from the member session) ───
export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setAdminToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
  } catch {
    /* storage unavailable */
  }
}
export function clearAdminToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

interface AdminFetchOptions extends Omit<RequestInit, 'body'> {
  body?: Record<string, unknown> | null;
  /** Return the full { data, meta } envelope instead of unwrapping to `data`. */
  raw?: boolean;
}

/**
 * Admin fetch — attaches the admin bearer, no silent member refresh.
 * On 401/403 it clears the admin token and throws (the layout guard redirects to login).
 */
export async function adminFetch<T>(path: string, options: AdminFetchOptions = {}): Promise<T> {
  const { body, headers, raw, ...rest } = options;
  const token = getAdminToken();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      body: body != null ? JSON.stringify(body) : undefined,
      signal: rest.signal ?? controller.signal,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    throw new ApiError('INTERNAL_ERROR', aborted ? 'The request timed out. Please try again.' : 'Unable to reach the server.', 0);
  } finally {
    clearTimeout(timeout);
  }

  if ((res.status === 401 || res.status === 403) && !path.startsWith('/admin/auth/login')) {
    clearAdminToken();
  }

  let envelope: ApiResponse<T>;
  try {
    envelope = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError('INTERNAL_ERROR', `Malformed response (${res.status})`, res.status);
  }

  if (!res.ok || envelope.error) {
    throw new ApiError(
      envelope.error?.code ?? 'INTERNAL_ERROR',
      envelope.error?.message ?? `Request failed (${res.status})`,
      res.status,
      envelope.error?.details,
    );
  }

  return (raw ? (envelope as unknown as T) : envelope.data);
}

export const adminApi = {
  login(email: string, password: string): Promise<AdminSession> {
    return adminFetch('/admin/auth/login', { method: 'POST', body: { email, password } });
  },
  me(): Promise<AdminSession['admin']> {
    return adminFetch('/admin/auth/me');
  },
  getStats(): Promise<AdminStats> {
    return adminFetch('/admin/stats');
  },
  listUsers(params?: { q?: string; status?: string; verified?: string; page?: number; pageSize?: number }): Promise<AdminUsersResult> {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.status) qs.set('status', params.status);
    if (params?.verified) qs.set('verified', params.verified);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const q = qs.toString();
    return adminFetch(`/admin/users${q ? `?${q}` : ''}`);
  },
  setUserActive(id: string, isActive: boolean): Promise<{ id: string; isActive: boolean }> {
    return adminFetch(`/admin/users/${id}`, { method: 'PUT', body: { isActive } });
  },
  // Read-only resource lists (existing admin endpoints), for the linked sections.
  listSurveys(): Promise<unknown[]> {
    return adminFetch('/admin/surveys');
  },
  listPolls(): Promise<unknown[]> {
    return adminFetch('/admin/polls');
  },
  listRewards(): Promise<unknown[]> {
    return adminFetch('/admin/rewards');
  },
  listGames(): Promise<unknown[]> {
    return adminFetch('/admin/games');
  },
};

export type { AdminUserRow };

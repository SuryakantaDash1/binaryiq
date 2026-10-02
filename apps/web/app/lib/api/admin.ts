import type {
  AdminAnnouncementPage,
  AdminAnnouncementView,
  AdminLoginChallenge,
  AdminSession,
  AdminStats,
  AdminUserRow,
  AdminUsersResult,
  ApiResponse,
  CreateAnnouncementInput,
  CreateFeedSourceInput,
  FeedSourcePage,
  FeedSourceView,
  UpdateAnnouncementInput,
  UpdateFeedSourceInput,
} from '@influencer/types';

import { ApiError } from './client.js';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';
const LEGACY_ADMIN_TOKEN_KEY = 'influencer_admin_token';

// ─── Admin session ──────────────────────────────────────────────────
// The short-lived access token lives only in memory, so an XSS bug can't read it
// out of storage. The session itself is an httpOnly, path-scoped refresh cookie
// the API sets after 2FA; reloading the page re-mints the access token from it.
let adminAccessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;

if (typeof window !== 'undefined') {
  try {
    window.localStorage.removeItem(LEGACY_ADMIN_TOKEN_KEY); // tokens used to be kept here
  } catch {
    /* storage unavailable */
  }
}

export function getAdminToken(): string | null {
  return adminAccessToken;
}
export function clearAdminToken(): void {
  adminAccessToken = null;
}

/** Re-mints the admin access token from the refresh cookie. Concurrent callers share one request. */
export function refreshAdminSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch(`${BASE_URL}/admin/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (!res.ok) return false;
      const body = (await res.json()) as ApiResponse<AdminSession>;
      adminAccessToken = body.data?.accessToken ?? null;
      return adminAccessToken !== null;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

interface AdminFetchOptions extends Omit<RequestInit, 'body'> {
  body?: Record<string, unknown> | null;
  /** Return the full { data, meta } envelope instead of unwrapping to `data`. */
  raw?: boolean;
}

/**
 * Admin fetch — attaches the in-memory admin bearer and, on a 401, refreshes
 * once from the cookie and retries. Auth endpoints send credentials so the API
 * can set/read the httpOnly session cookie.
 */
export async function adminFetch<T>(path: string, options: AdminFetchOptions = {}, retried = false): Promise<T> {
  const { body, headers, raw, ...rest } = options;
  const token = adminAccessToken;
  const isAuthPath = path.startsWith('/admin/auth/');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      credentials: isAuthPath ? 'include' : 'omit',
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

  if (res.status === 401 && !retried && !isAuthPath) {
    if (await refreshAdminSession()) return adminFetch<T>(path, options, true);
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
  /** Password step — always followed by an authenticator-app step. */
  login(email: string, password: string): Promise<AdminLoginChallenge> {
    return adminFetch('/admin/auth/login', { method: 'POST', body: { email, password } });
  },
  /** Authenticator-code step; on success the session is live. */
  async verifyTotp(challengeToken: string, code: string): Promise<AdminSession> {
    const session = await adminFetch<AdminSession>('/admin/auth/totp', {
      method: 'POST',
      body: { challengeToken, code },
    });
    adminAccessToken = session.accessToken;
    return session;
  },
  async logout(): Promise<void> {
    try {
      await adminFetch('/admin/auth/logout', { method: 'POST' });
    } finally {
      clearAdminToken();
    }
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
  // News / RSS feed sources
  listNewsSources(params?: { page?: number; pageSize?: number }): Promise<FeedSourcePage> {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const q = qs.toString();
    return adminFetch(`/admin/news/sources${q ? `?${q}` : ''}`);
  },
  createNewsSource(input: CreateFeedSourceInput): Promise<FeedSourceView> {
    return adminFetch('/admin/news/sources', { method: 'POST', body: input });
  },
  updateNewsSource(id: string, input: UpdateFeedSourceInput): Promise<FeedSourceView> {
    return adminFetch(`/admin/news/sources/${id}`, { method: 'PUT', body: input });
  },
  pollNewsSourceNow(id: string): Promise<FeedSourceView> {
    return adminFetch(`/admin/news/sources/${id}/poll-now`, { method: 'POST' });
  },
  // Community announcements (the member-facing "News" tab)
  listAnnouncements(params?: { page?: number; pageSize?: number }): Promise<AdminAnnouncementPage> {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const q = qs.toString();
    return adminFetch(`/admin/announcements${q ? `?${q}` : ''}`);
  },
  createAnnouncement(input: CreateAnnouncementInput): Promise<AdminAnnouncementView> {
    return adminFetch('/admin/announcements', { method: 'POST', body: input });
  },
  updateAnnouncement(id: string, input: UpdateAnnouncementInput): Promise<AdminAnnouncementView> {
    return adminFetch(`/admin/announcements/${id}`, { method: 'PUT', body: input });
  },
  deleteAnnouncement(id: string): Promise<{ id: string }> {
    return adminFetch(`/admin/announcements/${id}`, { method: 'DELETE' });
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

/**
 * Client-side access-token store. The short-lived access token lives only in
 * memory, so an XSS bug can't lift it out of storage; the long-lived refresh
 * token is an httpOnly cookie the browser sends to `/auth/refresh`, which
 * re-mints the access token after a reload.
 */
const LEGACY_KEY = 'influencer_access_token';

let accessToken: string | null = null;

if (typeof window !== 'undefined') {
  try {
    window.localStorage.removeItem(LEGACY_KEY); // tokens used to be kept here
  } catch {
    /* storage unavailable */
  }
}

export function getToken(): string | null {
  return accessToken;
}

export function setToken(token: string): void {
  accessToken = token;
}

export function clearToken(): void {
  accessToken = null;
}

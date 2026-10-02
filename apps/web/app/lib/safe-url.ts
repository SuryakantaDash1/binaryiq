/**
 * Returns the URL only if it is an absolute http(s) URL or a same-site path.
 * Anything else (`javascript:`, `data:`, `vbscript:`, protocol-relative `//host`)
 * becomes undefined. Use for every URL that comes from feeds, admins or members
 * before putting it in an href, src or navigation.
 */
export function safeHttpUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const value = url.trim();
  if (/^\/(?![/\\])/.test(value)) return value;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

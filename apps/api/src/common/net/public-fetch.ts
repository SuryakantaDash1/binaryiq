import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP } from 'node:net';

/**
 * Server-side fetching of URLs that someone else chose (e.g. admin-entered RSS
 * feeds) without letting them reach our private network or cloud metadata
 * (SSRF). Every address is checked at connect time — including after redirects
 * and DNS re-resolution — so DNS rebinding can't slip an internal IP through.
 */

export class UnsafeUrlError extends Error {
  override name = 'UnsafeUrlError';
}
export class FetchFailedError extends Error {
  override name = 'FetchFailedError';
}

const blocked = new BlockList();
// IPv4: "this network", private, CGNAT, loopback, link-local (incl. 169.254.169.254
// metadata), IETF/test/benchmark ranges, multicast, reserved, broadcast.
for (const [net, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) {
  blocked.addSubnet(net, prefix, 'ipv4');
}
// IPv6: unspecified, loopback, discard, NAT64, documentation, unique-local,
// link-local, multicast. (IPv4-mapped addresses are unwrapped and checked as IPv4.)
blocked.addAddress('::', 'ipv6');
blocked.addAddress('::1', 'ipv6');
for (const [net, prefix] of [
  ['100::', 64], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['2001:db8::', 32], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
] as const) {
  blocked.addSubnet(net, prefix, 'ipv6');
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, 'ipv4');
  if (family === 6) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
    if (mapped) return !blocked.check(mapped[1]!, 'ipv4');
    if (/^::ffff:/i.test(address)) return false; // hex-form mapped address
    return !blocked.check(address, 'ipv6');
  }
  return false;
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/** dns.lookup replacement used by the HTTP agent: refuses to connect to non-public IPs. */
function publicOnlyLookup(hostname: string, options: LookupOptions, callback: LookupCallback): void {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, []);
    if (addresses.length === 0 || addresses.some((a) => !isPublicAddress(a.address))) {
      return callback(new UnsafeUrlError('Host resolves to a non-public address'), []);
    }
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0]!.address, addresses[0]!.family);
  });
}

function parseHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new UnsafeUrlError('Only http(s) URLs are allowed');
  if (url.username || url.password) throw new UnsafeUrlError('URLs with credentials are not allowed');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  // IP literals never go through DNS lookup, so check them here.
  if (isIP(host) && !isPublicAddress(host)) throw new UnsafeUrlError('Address is not a public internet host');
  if (/^localhost$|\.localhost$|\.local$|\.internal$/i.test(host)) throw new UnsafeUrlError('Address is not a public internet host');
  return url;
}

/** Validates a URL up front (for admin forms): http(s), resolvable, public addresses only. */
export async function assertPublicHttpUrl(raw: string): Promise<void> {
  const url = parseHttpUrl(raw);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) return;
  await new Promise<void>((resolve, reject) => {
    publicOnlyLookup(host, { all: true }, (err) => (err ? reject(err instanceof UnsafeUrlError ? err : new FetchFailedError('Could not resolve host')) : resolve()));
  });
}

export interface PublicFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  accept?: string;
}

/** GETs a public http(s) URL and returns the body as text, with size/time/redirect limits. */
export async function fetchPublicText(raw: string, opts: PublicFetchOptions = {}): Promise<string> {
  const { timeoutMs = 15_000, maxBytes = 2 * 1024 * 1024, maxRedirects = 3, accept = '*/*' } = opts;
  let url = parseHttpUrl(raw);
  // Total deadline across redirects and body download (socket timeouts alone
  // don't stop a server that drips bytes slowly).
  const deadline = AbortSignal.timeout(timeoutMs);

  for (let hop = 0; ; hop++) {
    const res = await request(url, timeoutMs, accept, deadline);
    const status = res.statusCode ?? 0;
    if (status >= 300 && status < 400 && res.headers.location) {
      res.resume();
      if (hop >= maxRedirects) throw new FetchFailedError('Too many redirects');
      url = parseHttpUrl(new URL(res.headers.location, url).href);
      continue;
    }
    if (status < 200 || status >= 300) {
      res.resume();
      throw new FetchFailedError(`HTTP ${status}`);
    }
    return readCapped(res, maxBytes);
  }
}

function request(url: URL, timeoutMs: number, accept: string, signal: AbortSignal): Promise<http.IncomingMessage> {
  const client = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.get(
      url,
      {
        lookup: publicOnlyLookup as unknown as typeof dnsLookup,
        timeout: timeoutMs,
        signal,
        headers: { accept, 'user-agent': 'BinaryIQ-FeedFetcher/1.0' },
      },
      resolve,
    );
    req.on('timeout', () => req.destroy(new FetchFailedError('Timed out')));
    req.on('error', (err) => reject(err.name === 'AbortError' ? new FetchFailedError('Timed out') : err));
  });
}

function readCapped(res: http.IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    res.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        res.destroy(new FetchFailedError('Response too large'));
        return;
      }
      chunks.push(chunk);
    });
    res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    res.on('error', (err) => reject(err.name === 'AbortError' ? new FetchFailedError('Timed out') : err));
  });
}

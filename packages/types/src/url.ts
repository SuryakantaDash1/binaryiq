import { z } from 'zod';

// Scheme + non-empty host. (This package has no DOM/URL typings, so no `new URL`.)
const HTTPS_URL = /^https:\/\/[^\s/?#\\]+[^\s]*$/i;
const HTTP_URL = /^https?:\/\/[^\s/?#\\]+[^\s]*$/i;
// "/path" but not protocol-relative "//host" or "/\host".
const SITE_PATH = /^\/(?![/\\])\S*$/;

/** An absolute https URL — for anything a browser will load or navigate to. */
export const httpsUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .regex(HTTPS_URL, 'Must be an https:// URL');

/** https URL or a same-site path such as /images/brands/uber.svg. */
export const imageUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => SITE_PATH.test(v) || HTTPS_URL.test(v), 'Must be an https:// URL or a /path');

/** http(s) only — RSS feeds are still commonly served over plain http. */
export const feedUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .regex(HTTP_URL, 'Must be an http(s):// URL');

import { describe, it, expect } from 'vitest';

import { sniffImageType } from './site-images.service';

/** Uploads are identified by their bytes, never by the client-supplied Content-Type. */
describe('sniffImageType', () => {
  it('recognises JPEG, PNG and WebP', () => {
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBe('image/jpeg');
    expect(sniffImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]))).toBe('image/png');
    expect(sniffImageType(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]))).toBe('image/webp');
  });

  it('rejects SVG, HTML and truncated or empty data', () => {
    expect(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffImageType(Buffer.from('<!doctype html><script>alert(1)</script>'))).toBeNull();
    expect(sniffImageType(Buffer.from('RIFF\0\0\0\0WAVE'))).toBeNull();
    expect(sniffImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
  });
});

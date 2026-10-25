import {
  SITE_IMAGE_SLOTS,
  type AdminSiteImageView,
  type SiteImageMap,
  type SiteImageSlot,
} from '@binaryiq/types';
import { Injectable } from '@nestjs/common';

import { ValidationException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';

const KNOWN_SLOTS = new Set<string>(SITE_IMAGE_SLOTS);

/** API path for a slot's image; the version busts browser/CDN caches on every upload. */
function pathFor(slot: string, updatedAt: Date): string {
  return `/site-images/${slot}?v=${updatedAt.getTime()}`;
}

/** Identify the image from its leading bytes — the client's Content-Type is not trusted. SVG is never accepted. */
export function sniffImageType(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

@Injectable()
export class SiteImagesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Public ───────────────────────────────────────────────────────
  async publicMap(): Promise<SiteImageMap> {
    const rows = await this.prisma.siteImage.findMany({ select: { slot: true, updatedAt: true } });
    const map: SiteImageMap = {};
    for (const r of rows) {
      if (KNOWN_SLOTS.has(r.slot)) map[r.slot as SiteImageSlot] = pathFor(r.slot, r.updatedAt);
    }
    return map;
  }

  async get(slot: SiteImageSlot): Promise<{ data: Buffer; contentType: string; version: string } | null> {
    const row = await this.prisma.siteImage.findUnique({ where: { slot } });
    if (!row) return null;
    return { data: Buffer.from(row.data), contentType: row.contentType, version: String(row.updatedAt.getTime()) };
  }

  // ─── Admin ────────────────────────────────────────────────────────
  async adminList(): Promise<AdminSiteImageView[]> {
    const rows = await this.prisma.siteImage.findMany({
      select: { slot: true, contentType: true, byteSize: true, updatedAt: true },
    });
    const bySlot = new Map(rows.map((r) => [r.slot, r]));
    return SITE_IMAGE_SLOTS.map((slot) => {
      const r = bySlot.get(slot);
      return {
        slot,
        path: r ? pathFor(slot, r.updatedAt) : null,
        contentType: r?.contentType ?? null,
        byteSize: r?.byteSize ?? null,
        updatedAt: r ? r.updatedAt.toISOString() : null,
      };
    });
  }

  async upload(slot: SiteImageSlot, data: Buffer, actorId: string, ip: string | null): Promise<AdminSiteImageView> {
    const contentType = sniffImageType(data);
    if (!contentType) throw new ValidationException('Upload a JPEG, PNG or WebP image');

    const row = await this.prisma.siteImage.upsert({
      where: { slot },
      create: { slot, data, contentType, byteSize: data.length, updatedBy: actorId },
      update: { data, contentType, byteSize: data.length, updatedBy: actorId },
      select: { contentType: true, byteSize: true, updatedAt: true },
    });
    await this.audit('site_image.update', slot, actorId, ip);
    return {
      slot,
      path: pathFor(slot, row.updatedAt),
      contentType: row.contentType,
      byteSize: row.byteSize,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** Removes the custom upload so the page falls back to its bundled default. */
  async reset(slot: SiteImageSlot, actorId: string, ip: string | null): Promise<AdminSiteImageView> {
    await this.prisma.siteImage.deleteMany({ where: { slot } });
    await this.audit('site_image.reset', slot, actorId, ip);
    return { slot, path: null, contentType: null, byteSize: null, updatedAt: null };
  }

  private async audit(action: string, slot: string, actorId: string, ip: string | null): Promise<void> {
    // target_id is a UUID column, so the slot name goes in metadata.
    await this.prisma.auditLog
      .create({
        data: { actorType: 'admin', actorId, action, targetType: 'site_image', ipAddress: ip, metadata: { slot } },
      })
      .catch(() => void 0);
  }
}

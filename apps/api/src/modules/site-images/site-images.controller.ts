import {
  SITE_IMAGE_MAX_BYTES,
  siteImageSlotSchema,
  type AdminSiteImageView,
  type SiteImageMap,
  type SiteImageSlot,
} from '@binaryiq/types';
import { Controller, Delete, Get, HttpCode, Ip, Param, Put, Query, Req, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { NotFoundException, ValidationException } from '../../common/exceptions/domain.exception';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

import { SiteImagesService } from './site-images.service';

const slotPipe = new ZodValidationPipe(siteImageSlotSchema);

/**
 * Reads the request body as raw bytes, capped at `maxBytes`. The upload is sent
 * as the image itself (not JSON), which the global 100kb JSON parser ignores.
 */
function readRawBody(req: Request, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (declared > maxBytes) {
      req.resume();
      reject(new ValidationException(`Image must be ${maxBytes / (1024 * 1024)} MB or smaller`));
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    const onData = (chunk: Buffer): void => {
      size += chunk.length;
      if (size > maxBytes) {
        req.off('data', onData);
        req.resume();
        reject(new ValidationException(`Image must be ${maxBytes / (1024 * 1024)} MB or smaller`));
        return;
      }
      chunks.push(chunk);
    };
    req.on('data', onData);
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

@Controller()
export class SiteImagesController {
  constructor(private readonly service: SiteImagesService) {}

  // ─── Public ───────────────────────────────────────────────────────
  /** Which slots have a custom upload — the web app falls back to its defaults for the rest. */
  @Get('site-images')
  @Public()
  @SkipThrottle()
  map(): Promise<SiteImageMap> {
    return this.service.publicMap();
  }

  /** The image bytes. Versioned URLs are immutable, so browsers and CDNs can cache them forever. */
  @Get('site-images/:slot')
  @Public()
  @SkipThrottle()
  async image(
    @Param('slot', slotPipe) slot: SiteImageSlot,
    @Query('v') version: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const img = await this.service.get(slot);
    if (!img) throw new NotFoundException('No custom image for this slot');
    res.setHeader('Content-Type', img.contentType);
    res.setHeader('Content-Length', String(img.data.length));
    res.setHeader('Cache-Control', version === img.version ? 'public, max-age=31536000, immutable' : 'public, max-age=60');
    // The web app is on another site; the default `same-site` policy would block the <img>.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.end(img.data);
  }

  // ─── Admin ────────────────────────────────────────────────────────
  @Get('admin/site-images')
  @Roles('SUPER_ADMIN', 'ADMIN')
  adminList(): Promise<AdminSiteImageView[]> {
    return this.service.adminList();
  }

  @Put('admin/site-images/:slot')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async upload(
    @Param('slot', slotPipe) slot: SiteImageSlot,
    @Req() req: Request,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ): Promise<AdminSiteImageView> {
    const data = await readRawBody(req, SITE_IMAGE_MAX_BYTES);
    return this.service.upload(slot, data, actor.id, ip);
  }

  @Delete('admin/site-images/:slot')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @HttpCode(200)
  reset(
    @Param('slot', slotPipe) slot: SiteImageSlot,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ): Promise<AdminSiteImageView> {
    return this.service.reset(slot, actor.id, ip);
  }
}

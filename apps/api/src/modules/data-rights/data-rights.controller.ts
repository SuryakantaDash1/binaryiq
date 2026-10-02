import type { ConsentInput, ErasureInput } from '@influencer/types';
import { consentInputSchema, erasureInputSchema } from '@influencer/types';
import { Body, Controller, Delete, Get, HttpCode, Ip, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { NotFoundException } from '../../common/exceptions/domain.exception';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

import { ConsentService } from './consent.service';
import { ErasureService } from './erasure.service';
import { ExportService } from './export.service';

@Controller()
export class DataRightsController {
  constructor(
    private readonly consent: ConsentService,
    private readonly export_: ExportService,
    private readonly erasure: ErasureService,
  ) {}

  // POST /consents — grant or withdraw consent (public so unauthenticated users can record cookie consent)
  @Post('consents')
  @Public()
  @HttpCode(201)
  grantConsent(
    @Body(new ZodValidationPipe(consentInputSchema)) body: ConsentInput,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Req() req: Request,
  ) {
    return this.consent.grant(user?.id ?? null, body, req);
  }

  // GET /consents — current state + history (requires auth)
  @Get('consents')
  getConsents(@CurrentUser() user: AuthenticatedUser) {
    return this.consent.getMyConsents(user.id);
  }

  // GET /account/data-export — initiate export
  @Get('account/data-export')
  getDataExport(@CurrentUser() user: AuthenticatedUser, @Req() req: Request, @Ip() ip: string) {
    const protocol = req.protocol;
    const host = req.get('host') ?? 'localhost:4000';
    return this.export_.generateExport(user.id, `${protocol}://${host}`, ip);
  }

  // GET /account/data-export/download/:token — serve bundle (public token, no auth needed)
  @Get('account/data-export/download/:token')
  @Public()
  async downloadExport(@Param('token') token: string) {
    const data = await this.export_.getBundle(token);
    if (!data) throw new NotFoundException('Export token not found or expired');
    return JSON.parse(data) as object;
  }

  // DELETE /account — erasure request
  @Delete('account')
  @HttpCode(200)
  requestErasure(
    @Body(new ZodValidationPipe(erasureInputSchema)) body: ErasureInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.erasure.requestErasure(user.id, body, ip);
  }
}

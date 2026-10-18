import type { ConsentInput, ErasureInput } from '@binaryiq/types';
import { consentInputSchema, erasureInputSchema } from '@binaryiq/types';
import { Body, Controller, Delete, Get, HttpCode, Ip, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

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

  /**
   * Grant or withdraw consent. Public so visitors can record cookie consent;
   * when a member is signed in the record is linked to their account.
   */
  @Post('consents')
  @Public()
  @HttpCode(201)
  grantConsent(
    @Body(new ZodValidationPipe(consentInputSchema)) body: ConsentInput,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Ip() ip: string,
  ) {
    return this.consent.grant(user?.aud === 'member' ? user.id : null, body, ip);
  }

  // GET /consents — current state + history (requires auth)
  @Get('consents')
  getConsents(@CurrentUser() user: AuthenticatedUser) {
    return this.consent.getMyConsents(user.id);
  }

  /** Prepares a one-time, owner-only export of everything we hold (DPDP s.11). */
  @Post('account/data-export')
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  @HttpCode(201)
  requestDataExport(@CurrentUser() user: AuthenticatedUser, @Ip() ip: string) {
    return this.export_.generateExport(user.id, ip);
  }

  /** Downloads the prepared export. Requires the owner's session; works once. */
  @Get('account/data-export/download/:token')
  async downloadExport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('token', new ParseUUIDPipe()) token: string,
  ) {
    const bundle = await this.export_.consumeBundle(user.id, token);
    if (!bundle) throw new NotFoundException('Export not found or already downloaded');
    return bundle;
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

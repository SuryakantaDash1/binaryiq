import {
  redeemInputSchema,
  type RedeemInput,
  redemptionQuerySchema,
  type RedemptionQuery,
  createRewardSchema,
  type CreateRewardInput,
  updateRewardSchema,
  type UpdateRewardInput,
  updateRedemptionStatusSchema,
  type UpdateRedemptionStatusInput,
} from '@binaryiq/types';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Ip,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { WebhookFrom, WebhookSignatureGuard } from '../../common/webhooks/webhook-signature.guard';

import { RewardsService } from './rewards.service';

interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  isAdmin: boolean;
}

const rewardTypeQuery = z.object({
  type: z.enum(['CHARITY', 'PAYPAL', 'VOUCHER', 'MERCHANDISE']).optional(),
});
const adminListQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  type: z.string().optional(),
});

@Controller()
export class RewardsController {
  constructor(private readonly service: RewardsService) {}

  // ─── Member catalogue ────────────────────────────────────────────
  @Get('rewards')
  listRewards(@Query(new ZodValidationPipe(rewardTypeQuery)) q: { type?: string }) {
    return this.service.listRewards(q.type);
  }

  @Get('rewards/:id')
  getReward(@Param('id') id: string) {
    return this.service.getReward(id);
  }

  // ─── Member redemptions ──────────────────────────────────────────
  @Post('redemptions')
  @HttpCode(201)
  redeem(
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(redeemInputSchema)) body: RedeemInput,
    @Ip() ip: string,
  ) {
    return this.service.redeem(user.id, body, idempotencyKey, ip);
  }

  @Get('redemptions')
  listRedemptions(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(redemptionQuerySchema)) query: RedemptionQuery,
  ) {
    return this.service.listRedemptions(user.id, query);
  }

  // ─── Admin rewards CRUD ──────────────────────────────────────────
  @Get('admin/rewards')
  @Roles('SUPER_ADMIN', 'ADMIN')
  adminListRewards(
    @Query(new ZodValidationPipe(adminListQuery))
    q: { page?: number; pageSize?: number; isActive?: 'true' | 'false'; type?: string },
  ) {
    const isActive = q.isActive !== undefined ? q.isActive === 'true' : undefined;
    return this.service.adminListRewards(q.page, q.pageSize, isActive, q.type);
  }

  @Post('admin/rewards')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @HttpCode(201)
  adminCreateReward(@Body(new ZodValidationPipe(createRewardSchema)) body: CreateRewardInput) {
    return this.service.adminCreateReward(body);
  }

  @Put('admin/rewards/:id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  adminUpdateReward(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateRewardSchema)) body: UpdateRewardInput,
  ) {
    return this.service.adminUpdateReward(id, body);
  }

  // ─── Admin redemption status ─────────────────────────────────────
  @Put('admin/redemptions/:id/status')
  @Roles('SUPER_ADMIN', 'ADMIN')
  adminUpdateRedemptionStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateRedemptionStatusSchema)) body: UpdateRedemptionStatusInput,
    @Ip() ip: string,
  ) {
    return this.service.adminUpdateRedemptionStatus(id, body, user.id, ip);
  }

  // ─── PayPal webhook ──────────────────────────────────────────────
  @Post('webhooks/paypal')
  @Public()
  @WebhookFrom('paypal')
  @UseGuards(WebhookSignatureGuard)
  @HttpCode(200)
  paypalWebhook(@Body() body: unknown) {
    return this.service.handlePaypalWebhook(
      body as Parameters<RewardsService['handlePaypalWebhook']>[0],
    );
  }
}

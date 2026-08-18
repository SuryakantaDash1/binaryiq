import { randomUUID } from 'node:crypto';

import { Prisma, type RewardType } from '@influencer/db';
import type {
  CreateRewardInput,
  UpdateRewardInput,
  RedeemInput,
  UpdateRedemptionStatusInput,
  RedemptionQuery,
} from '@influencer/types';
import { Injectable, Logger } from '@nestjs/common';

import {
  NotFoundException,
  UnprocessableException,
} from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService } from '../points/points.service';


@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly points: PointsService,
  ) {}

  // ─── Catalogue ───────────────────────────────────────────────────
  async listRewards(type?: string) {
    const rewards = await this.prisma.reward.findMany({
      where: { isActive: true, ...(type ? { rewardType: type as RewardType } : {}) },
      orderBy: { sortOrder: 'asc' },
    });
    return rewards.map(this.toRewardView);
  }

  async getReward(id: string) {
    const reward = await this.prisma.reward.findUnique({ where: { id } });
    if (!reward || !reward.isActive) throw new NotFoundException('Reward not found');
    return this.toRewardView(reward);
  }

  // ─── Redemption ───────────────────────────────────────────────────
  async redeem(userId: string, input: RedeemInput, idempotencyKey?: string) {
    const reward = await this.prisma.reward.findUnique({ where: { id: input.rewardId } });
    if (!reward || !reward.isActive) throw new NotFoundException('Reward not found');
    if (reward.stock !== null && reward.stock <= 0) throw new UnprocessableException('out_of_stock');

    const iKey = idempotencyKey ?? `redeem:${userId}:${reward.id}:${randomUUID()}`;

    const redemption = await this.prisma.$transaction(async (tx) => {
      await this.points.spend(tx, {
        userId,
        action: 'REDEMPTION',
        points: reward.pointsRequired,
        description: `Redemption: ${reward.name}`,
        refType: 'reward',
        refId: reward.id,
        idempotencyKey: iKey,
      });

      if (reward.stock !== null) {
        await tx.reward.update({ where: { id: reward.id }, data: { stock: { decrement: 1 } } });
      }

      return tx.rewardRedemption.create({
        data: { userId, rewardId: reward.id, pointsSpent: reward.pointsRequired, status: 'PENDING' },
        include: { reward: true },
      });
    });

    // Fulfilment (after commit)
    await this.fulfil(reward, redemption.id).catch((e) =>
      this.logger.error('Fulfilment failed', e),
    );

    await this.auditLog(userId, 'redemption.create', { rewardId: reward.id, points: reward.pointsRequired });

    return this.toRedemptionView({ ...redemption, reward });
  }

  async listRedemptions(userId: string, query: RedemptionQuery) {
    const limit = query.limit ?? 20;
    let cursorDate: Date | undefined;
    if (query.cursor) {
      try {
        cursorDate = new Date(Buffer.from(query.cursor, 'base64').toString('utf8'));
      } catch {
        // invalid cursor, ignore
      }
    }

    const where = {
      userId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to || cursorDate
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
              ...(cursorDate ? { lt: cursorDate } : {}),
            },
          }
        : {}),
    };

    const rows = await this.prisma.rewardRedemption.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: { reward: true },
    });

    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((r) =>
      this.toRedemptionView(r),
    );
    const lastItem = hasMore ? rows[limit - 1] : null;
    const nextCursor = lastItem
      ? Buffer.from(lastItem.createdAt.toISOString()).toString('base64')
      : null;

    return { items, pagination: { nextCursor, hasMore, limit } };
  }

  // ─── Admin ───────────────────────────────────────────────────────
  async adminListRewards(page = 1, pageSize = 20, isActive?: boolean, type?: string) {
    const where = {
      ...(isActive !== undefined ? { isActive } : {}),
      ...(type ? { rewardType: type as RewardType } : {}),
    };
    const [total, rewards] = await Promise.all([
      this.prisma.reward.count({ where }),
      this.prisma.reward.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: rewards.map(this.toRewardView), total, page, pageSize };
  }

  async adminCreateReward(input: CreateRewardInput) {
    const reward = await this.prisma.reward.create({
      data: {
        name: input.name,
        description: input.description,
        rewardType: input.rewardType,
        pointsRequired: input.pointsRequired,
        imageUrl: input.imageUrl,
        stock: input.stock,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
        metadata: input.metadata as Prisma.InputJsonValue,
      },
    });
    return this.toRewardView(reward);
  }

  async adminUpdateReward(id: string, input: UpdateRewardInput) {
    const existing = await this.prisma.reward.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Reward not found');
    const reward = await this.prisma.reward.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.rewardType !== undefined ? { rewardType: input.rewardType } : {}),
        ...(input.pointsRequired !== undefined ? { pointsRequired: input.pointsRequired } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
        ...(input.stock !== undefined ? { stock: input.stock } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata as Prisma.InputJsonValue } : {}),
      },
    });
    return this.toRewardView(reward);
  }

  async adminUpdateRedemptionStatus(
    id: string,
    input: UpdateRedemptionStatusInput,
    adminId: string,
  ) {
    const redemption = await this.prisma.rewardRedemption.findUnique({
      where: { id },
      include: { reward: true },
    });
    if (!redemption) throw new NotFoundException('Redemption not found');

    const validTransitions: Record<string, string[]> = {
      PENDING: ['PROCESSING', 'CANCELLED', 'COMPLETED', 'REJECTED'],
      PROCESSING: ['COMPLETED', 'REJECTED'],
      COMPLETED: [],
      REJECTED: [],
      CANCELLED: [],
    };
    if (!validTransitions[redemption.status]?.includes(input.status)) {
      throw new UnprocessableException(
        `Cannot transition from ${redemption.status} to ${input.status}`,
      );
    }

    const needsRefund =
      (input.status === 'REJECTED' || input.status === 'CANCELLED') &&
      redemption.status !== 'REJECTED' &&
      redemption.status !== 'CANCELLED';

    const updated = await this.prisma.$transaction(async (tx) => {
      if (needsRefund) {
        await this.points.award(tx, {
          userId: redemption.userId,
          action: 'ADJUSTMENT',
          points: redemption.pointsSpent,
          description: `Refund — redemption ${input.status.toLowerCase()} (${id})`,
          refType: 'reward_redemption',
          refId: id,
          idempotencyKey: `refund:${id}`,
        });
      }
      return tx.rewardRedemption.update({
        where: { id },
        data: {
          status: input.status,
          fulfillmentRef: input.fulfillmentRef ?? redemption.fulfillmentRef,
          notes: input.notes ?? redemption.notes,
        },
        include: { reward: true },
      });
    });

    await this.auditLog(adminId, 'redemption.status_change', {
      redemptionId: id,
      from: redemption.status,
      to: input.status,
      refunded: needsRefund,
    });
    return this.toRedemptionView(updated);
  }

  // PayPal webhook handler
  async handlePaypalWebhook(event: {
    event_type: string;
    resource: {
      payout_item_id?: string;
      payout_batch_id?: string;
      transaction_status?: string;
    };
  }) {
    const payoutId = event.resource.payout_item_id ?? event.resource.payout_batch_id;
    if (!payoutId) return { received: true };

    const redemption = await this.prisma.rewardRedemption.findFirst({
      where: { fulfillmentRef: payoutId },
    });
    if (!redemption) {
      this.logger.warn(`Unknown payout id in webhook: ${payoutId}`);
      return { received: true };
    }

    if (redemption.status === 'COMPLETED' || redemption.status === 'REJECTED') {
      return { received: true }; // idempotent
    }

    const succeeded = event.event_type === 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED';
    const failed = [
      'PAYMENT.PAYOUTS-ITEM.FAILED',
      'PAYMENT.PAYOUTS-ITEM.DENIED',
      'PAYMENT.PAYOUTS-ITEM.BLOCKED',
    ].includes(event.event_type);

    if (succeeded) {
      await this.prisma.rewardRedemption.update({
        where: { id: redemption.id },
        data: { status: 'COMPLETED' },
      });
    } else if (failed) {
      await this.prisma.$transaction(async (tx) => {
        await this.points.award(tx, {
          userId: redemption.userId,
          action: 'ADJUSTMENT',
          points: redemption.pointsSpent,
          description: `Refund — PayPal payout failed (${redemption.id})`,
          refType: 'reward_redemption',
          refId: redemption.id,
          idempotencyKey: `refund:${redemption.id}`,
        });
        await tx.rewardRedemption.update({
          where: { id: redemption.id },
          data: { status: 'REJECTED', notes: `PayPal: ${event.event_type}` },
        });
      });
    }

    return { received: true };
  }

  // ─── Private helpers ─────────────────────────────────────────────
  private async fulfil(
    reward: { rewardType: string; id: string; name: string; metadata: unknown },
    redemptionId: string,
  ) {
    if (reward.rewardType === 'CHARITY') {
      // Immediate charity fulfilment — generate a receipt and mark COMPLETED
      const receiptId = `CHARITY-${randomUUID().slice(0, 8).toUpperCase()}`;
      await this.prisma.rewardRedemption.update({
        where: { id: redemptionId },
        data: { status: 'COMPLETED', fulfillmentRef: receiptId },
      });
      this.logger.log(`Charity fulfilled: ${receiptId} for redemption ${redemptionId}`);
    } else if (reward.rewardType === 'PAYPAL') {
      // In production this would enqueue a BullMQ job.
      // In dev/Phase-3 we log the payout intent (PayPal provider wired in Phase 7).
      const payoutId = `PAYOUT-${randomUUID().slice(0, 8).toUpperCase()}`;
      await this.prisma.rewardRedemption.update({
        where: { id: redemptionId },
        data: { status: 'PROCESSING', fulfillmentRef: payoutId },
      });
      this.logger.log(`PayPal payout queued (dev): ${payoutId} for redemption ${redemptionId}`);
    }
  }

  private toRewardView(r: {
    id: string;
    name: string;
    description: string;
    rewardType: string;
    pointsRequired: number;
    imageUrl: string | null;
    stock: number | null;
  }) {
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      rewardType: r.rewardType,
      pointsRequired: r.pointsRequired,
      imageUrl: r.imageUrl,
      stock: r.stock,
    };
  }

  private toRedemptionView(r: {
    id: string;
    rewardId: string;
    reward: { name: string; rewardType: string };
    pointsSpent: number;
    status: string;
    fulfillmentRef: string | null;
    createdAt: Date;
  }) {
    return {
      id: r.id,
      rewardId: r.rewardId,
      rewardName: r.reward.name,
      rewardType: r.reward.rewardType,
      pointsSpent: r.pointsSpent,
      status: r.status,
      fulfillmentRef: r.fulfillmentRef,
      createdAt: r.createdAt.toISOString(),
    };
  }

  private async auditLog(actorId: string, action: string, metadata: object) {
    await this.prisma.auditLog
      .create({
        data: { actorType: 'user', actorId, action, targetType: 'reward', metadata },
      })
      .catch((e) => this.logger.error('Audit log failed', e));
  }
}

import type { NotificationChannel, NotificationType } from '@influencer/db';
import type { NotificationListQuery } from '@influencer/types';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

import { NotFoundException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { JOBS, QUEUES, type SendNotificationJob } from '../../queue/queue.constants';

export type { NotificationChannel, NotificationType };

const ALWAYS_ON = new Set<NotificationType>(['REGISTRATION', 'PASSWORD_RESET']);

interface NotifyPayload {
  title?: string;
  message: string;
  data?: Record<string, string>;
  dedupeKey?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.NOTIFICATIONS) private readonly queue: Queue,
  ) {}

  async send(userId: string, type: NotificationType, payload: NotifyPayload): Promise<void> {
    const channels = await this.resolveEnabledChannels(userId, type);
    if (channels.length === 0) return;

    for (const channel of channels) {
      const notification = await this.prisma.notification.create({
        data: {
          userId,
          channel,
          type,
          title: payload.title,
          message: payload.message,
          status: 'QUEUED',
          metadata: { ...(payload.data ?? {}), ...(payload.dedupeKey ? { dedupeKey: payload.dedupeKey } : {}) },
        },
      });

      await this.queue.add(
        JOBS.SEND_NOTIFICATION,
        { notificationId: notification.id, channel } as SendNotificationJob,
        {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
          ...(payload.dedupeKey ? { jobId: `${payload.dedupeKey}:${channel}` } : {}),
        },
      );
    }
  }

  async list(userId: string, query: NotificationListQuery) {
    const limit = query.limit ?? 20;
    const onlyUnread = query.unread === 'true';
    const cursorDate = query.cursor ? new Date(Buffer.from(query.cursor, 'base64url').toString()) : undefined;

    const items = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(onlyUnread ? { readAt: null } : {}),
        ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = items.length > limit;
    const page = items.slice(0, limit);
    const nextCursor = hasMore ? Buffer.from(page[page.length - 1]!.createdAt.toISOString()).toString('base64url') : null;

    return {
      items: page.map(this.toDTO),
      pagination: { nextCursor, hasMore, limit },
    };
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({ where: { userId, readAt: null } });
    return { count };
  }

  async markRead(userId: string, notificationId: string) {
    const n = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!n || n.userId !== userId) throw new NotFoundException('Notification not found');
    if (n.readAt) return this.toDTO(n);
    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date(), status: 'READ' },
    });
    return this.toDTO(updated);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date(), status: 'READ' },
    });
    return { updated: result.count };
  }

  async applyDeliveryEvent(providerMessageId: string, event: 'delivered' | 'failed'): Promise<void> {
    const n = await this.prisma.notification.findFirst({
      where: { metadata: { path: ['providerMessageId'], equals: providerMessageId } },
    });
    if (!n || n.status !== 'SENT') return;
    await this.prisma.notification.update({
      where: { id: n.id },
      data: { status: event === 'delivered' ? 'DELIVERED' : 'FAILED' },
    });
  }

  private async resolveEnabledChannels(userId: string, type: NotificationType): Promise<NotificationChannel[]> {
    if (ALWAYS_ON.has(type)) return ['EMAIL'];

    const pref = await this.prisma.notificationPreference.upsert({
      where: { userId_type: { userId, type } },
      create: { userId, type },
      update: {},
    });

    const channels: NotificationChannel[] = [];
    if (pref.email) channels.push('EMAIL');
    if (pref.push) {
      const hasToken = await this.prisma.pushToken.count({ where: { userId } });
      if (hasToken > 0) channels.push('PUSH');
    }
    if (pref.sms) channels.push('SMS');
    if (pref.whatsapp) channels.push('WHATSAPP');
    return channels;
  }

  private toDTO(n: { id: string; channel: string; type: string; title: string | null; message: string; status: string; readAt: Date | null; metadata: unknown; createdAt: Date }) {
    return {
      id: n.id,
      channel: n.channel,
      type: n.type,
      title: n.title,
      message: n.message,
      status: n.status,
      readAt: n.readAt?.toISOString() ?? null,
      metadata: (n.metadata as Record<string, unknown>) ?? null,
      createdAt: n.createdAt.toISOString(),
    };
  }
}

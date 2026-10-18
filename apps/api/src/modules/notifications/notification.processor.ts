import type { NotificationChannel } from '@binaryiq/db';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES, type SendNotificationJob } from '../../queue/queue.constants';

import { EmailProvider } from './email.provider';
import { PUSH_PROVIDER, type PushProvider } from './providers/push.provider';
import { SMS_PROVIDER, type SmsProvider } from './providers/sms.provider';
import { WHATSAPP_PROVIDER, type WhatsAppProvider } from './providers/whatsapp.provider';
import { TemplateRegistry } from './template.registry';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

@Processor(QUEUES.NOTIFICATIONS)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: TemplateRegistry,
    private readonly emailProvider: EmailProvider,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
    @Inject(PUSH_PROVIDER) private readonly pushProvider: PushProvider,
    @Inject(WHATSAPP_PROVIDER) private readonly whatsappProvider: WhatsAppProvider,
  ) {
    super();
  }

  async process(job: Job<SendNotificationJob>): Promise<void> {
    const { notificationId, channel } = job.data;
    const n = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: { user: { select: { email: true } } },
    });
    if (!n) return;
    if (n.status !== 'QUEUED') return;

    try {
      const data = (n.metadata as Record<string, string>) ?? {};
      const tpl = this.templates.resolve(n.type, n.channel as NotificationChannel, data);
      let providerMessageId: string;

      switch (channel as NotificationChannel) {
        case 'EMAIL':
          // Body can carry free text (e.g. a support reply) — escape before embedding in HTML.
          await this.emailProvider.send({ to: n.user.email, subject: tpl.subject ?? n.title ?? 'Notification', html: `<p>${escapeHtml(tpl.body)}</p>` });
          providerMessageId = `email-${n.id}`;
          break;
        case 'SMS':
          ({ providerMessageId } = await this.smsProvider.send({ to: 'noop', body: tpl.body }));
          break;
        case 'PUSH': {
          const tokens = await this.prisma.pushToken.findMany({ where: { userId: n.userId }, select: { token: true } });
          ({ providerMessageId } = await this.pushProvider.send({ tokens: tokens.map((t) => t.token), title: tpl.subject ?? n.title ?? 'Notification', body: tpl.body, data }));
          break;
        }
        case 'WHATSAPP':
          ({ providerMessageId } = await this.whatsappProvider.send({ to: 'noop', templateId: tpl.templateId ?? 'default', data }));
          break;
        default:
          providerMessageId = `unknown-${n.id}`;
      }

      await this.prisma.notification.update({
        where: { id: n.id },
        data: { status: 'SENT', sentAt: new Date(), metadata: { ...(n.metadata as object), providerMessageId } },
      });
    } catch (err) {
      this.logger.error(
        `Notification ${notificationId} send failed (attempt ${job.attemptsMade + 1}): ${(err as Error).message}`,
      );
      const lastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      if (lastAttempt) {
        await this.prisma.notification.update({ where: { id: n.id }, data: { status: 'FAILED' } });
      }
      throw err;
    }
  }
}

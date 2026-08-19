import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { QUEUES } from '../../queue/queue.constants';

import { ConsoleEmailProvider, EmailProvider } from './email.provider';
import { NotificationProcessor } from './notification.processor';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PreferencesService } from './preferences.service';
import { PUSH_PROVIDER, NoopPushProvider } from './providers/push.provider';
import { SMS_PROVIDER, NoopSmsProvider } from './providers/sms.provider';
import { WHATSAPP_PROVIDER, NoopWhatsAppProvider } from './providers/whatsapp.provider';
import { PushTokenService } from './push-token.service';
import { TemplateRegistry } from './template.registry';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.NOTIFICATIONS })],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    PreferencesService,
    PushTokenService,
    TemplateRegistry,
    ConsoleEmailProvider,
    NotificationProcessor,
    { provide: SMS_PROVIDER, useClass: NoopSmsProvider },
    { provide: PUSH_PROVIDER, useClass: NoopPushProvider },
    { provide: WHATSAPP_PROVIDER, useClass: NoopWhatsAppProvider },
    { provide: EmailProvider, useClass: ConsoleEmailProvider },
  ],
  exports: [NotificationsService, EmailProvider],
})
export class NotificationsModule {}

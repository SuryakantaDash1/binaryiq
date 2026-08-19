import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';

import { AdminSupportController } from './admin-support.controller';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ChatbotController, SupportController, AdminSupportController],
  providers: [ChatbotService, SupportService],
})
export class SupportModule {}

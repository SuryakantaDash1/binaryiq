import {
  notificationListQuerySchema,
  registerPushTokenSchema,
  updatePreferenceSchema,
  type NotificationListQuery,
  type RegisterPushTokenInput,
  type UpdatePreferenceInput,
} from '@binaryiq/types';
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { WebhookFrom, WebhookSignatureGuard } from '../../common/webhooks/webhook-signature.guard';

import { NotificationsService } from './notifications.service';
import { PreferencesService } from './preferences.service';
import { PushTokenService } from './push-token.service';

interface AuthUser { id: string; email: string; username: string; isVerified: boolean; roles: string[] }

@Controller()
export class NotificationsController {
  constructor(
    private readonly service: NotificationsService,
    private readonly prefs: PreferencesService,
    private readonly pushTokens: PushTokenService,
  ) {}

  @Get('notifications')
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(notificationListQuerySchema)) q: NotificationListQuery,
  ) {
    return this.service.list(user.id, q);
  }

  @Get('notifications/unread-count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.service.unreadCount(user.id);
  }

  @Post('notifications/read-all')
  @HttpCode(200)
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.service.markAllRead(user.id);
  }

  @Post('notifications/:id/read')
  @HttpCode(200)
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.markRead(user.id, id);
  }

  @Get('notification-preferences')
  getPreferences(@CurrentUser() user: AuthUser) {
    return this.prefs.getAll(user.id);
  }

  @Put('notification-preferences')
  updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updatePreferenceSchema)) body: UpdatePreferenceInput,
  ) {
    return this.prefs.update(user.id, body);
  }

  @Post('push-tokens')
  @HttpCode(201)
  registerToken(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(registerPushTokenSchema)) body: RegisterPushTokenInput,
  ) {
    return this.pushTokens.register(user.id, body);
  }

  @Delete('push-tokens/:token')
  @HttpCode(204)
  deregisterToken(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.pushTokens.deregister(user.id, token);
  }

  @Post('webhooks/sendgrid')
  @Public()
  @WebhookFrom('sendgrid')
  @UseGuards(WebhookSignatureGuard)
  @HttpCode(200)
  sendgridWebhook(@Body() body: unknown) {
    const events = Array.isArray(body) ? body as Record<string, unknown>[] : [body as Record<string, unknown>];
    return Promise.all(events.map(async (e) => {
      const msgId = e['sg_message_id'] as string | undefined;
      const status = e['event'] as string | undefined;
      if (!msgId || !status) return;
      if (status === 'delivered') await this.service.applyDeliveryEvent(msgId, 'delivered');
      if (status === 'bounce' || status === 'dropped' || status === 'spamreport') await this.service.applyDeliveryEvent(msgId, 'failed');
    }));
  }

  @Post('webhooks/twilio')
  @Public()
  @WebhookFrom('twilio')
  @UseGuards(WebhookSignatureGuard)
  @HttpCode(200)
  twilioWebhook(@Body() body: Record<string, unknown>) {
    const msgId = body['MessageSid'] as string | undefined;
    const status = body['MessageStatus'] as string | undefined;
    if (!msgId || !status) return;
    if (status === 'delivered') return this.service.applyDeliveryEvent(msgId, 'delivered');
    if (status === 'undelivered' || status === 'failed') return this.service.applyDeliveryEvent(msgId, 'failed');
  }

  @Post('webhooks/fcm')
  @Public()
  @WebhookFrom('fcm')
  @UseGuards(WebhookSignatureGuard)
  @HttpCode(200)
  async fcmWebhook(@Body() body: Record<string, unknown>) {
    const msgId = body['messageId'] as string | undefined;
    const error = body['error'] as string | undefined;
    const token = body['token'] as string | undefined;
    if (msgId) {
      const status = error ? 'failed' : 'delivered';
      await this.service.applyDeliveryEvent(msgId, status);
    }
    if (error && (error === 'NotRegistered' || error === 'InvalidRegistration') && token) {
      await this.pushTokens.pruneDeadTokens([token]);
    }
  }
}

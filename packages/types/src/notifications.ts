import { z } from 'zod';

export type NotificationChannelType = 'EMAIL' | 'PUSH' | 'SMS' | 'WHATSAPP';
export type NotificationTypeEnum = 'REGISTRATION' | 'SURVEY_INVITE' | 'SURVEY_REMINDER' | 'POINTS_UPDATE' | 'GAME_REMINDER' | 'REWARD_UPDATE' | 'PASSWORD_RESET' | 'OFFERS_NEWS';
export type NotificationStatusType = 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'READ';

export interface NotificationDTO {
  id: string;
  channel: NotificationChannelType;
  type: NotificationTypeEnum;
  title: string | null;
  message: string;
  status: NotificationStatusType;
  readAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationPreferenceDTO {
  type: NotificationTypeEnum;
  email: boolean;
  push: boolean;
  sms: boolean;
  whatsapp: boolean;
}

export interface PushTokenDTO {
  id: string;
  token: string;
  platform: string;
}

export const updatePreferenceSchema = z.object({
  type: z.enum(['REGISTRATION', 'SURVEY_INVITE', 'SURVEY_REMINDER', 'POINTS_UPDATE', 'GAME_REMINDER', 'REWARD_UPDATE', 'PASSWORD_RESET', 'OFFERS_NEWS']),
  email: z.boolean().optional(),
  push: z.boolean().optional(),
  sms: z.boolean().optional(),
  whatsapp: z.boolean().optional(),
});
export type UpdatePreferenceInput = z.infer<typeof updatePreferenceSchema>;

export const registerPushTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['web', 'android', 'ios']),
});
export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;

export const notificationListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).optional(),
  cursor: z.string().optional(),
  unread: z.enum(['true', 'false']).optional(),
});
export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;

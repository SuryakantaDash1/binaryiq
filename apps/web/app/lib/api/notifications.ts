import { apiFetch } from './client.js';

export type NotificationChannelType = 'EMAIL' | 'PUSH' | 'SMS' | 'WHATSAPP';
export type NotificationTypeEnum = 'REGISTRATION' | 'SURVEY_INVITE' | 'SURVEY_REMINDER' | 'POINTS_UPDATE' | 'GAME_REMINDER' | 'REWARD_UPDATE' | 'PASSWORD_RESET' | 'OFFERS_NEWS';

export interface NotificationPreferenceDTO {
  type: NotificationTypeEnum;
  email: boolean;
  push: boolean;
  sms: boolean;
  whatsapp: boolean;
}

export interface NotificationDTO {
  id: string;
  channel: NotificationChannelType;
  type: NotificationTypeEnum;
  title: string | null;
  message: string;
  status: string;
  readAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationListResponse {
  items: NotificationDTO[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
  };
}

export const notificationsApi = {
  getPreferences(): Promise<NotificationPreferenceDTO[]> { return apiFetch('/notification-preferences'); },
  updatePreference(body: { type: string; email?: boolean; push?: boolean; sms?: boolean; whatsapp?: boolean }): Promise<NotificationPreferenceDTO> {
    return apiFetch('/notification-preferences', { method: 'PUT', body });
  },
  list(params?: { limit?: number; cursor?: string; unread?: boolean }): Promise<NotificationListResponse> {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.cursor) qs.set('cursor', params.cursor);
    if (params?.unread !== undefined) qs.set('unread', String(params.unread));
    const q = qs.toString();
    return apiFetch(`/notifications${q ? `?${q}` : ''}`);
  },
  unreadCount(): Promise<{ count: number }> { return apiFetch('/notifications/unread-count'); },
  markRead(id: string): Promise<NotificationDTO> {
    return apiFetch(`/notifications/${id}/read`, { method: 'POST' });
  },
  markAllRead(): Promise<{ updated: number }> {
    return apiFetch('/notifications/read-all', { method: 'POST' });
  },
  registerPushToken(body: { token: string; platform: string }): Promise<unknown> {
    return apiFetch('/push-tokens', { method: 'POST', body });
  },
};

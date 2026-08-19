export const QUEUES = {
  NOTIFICATIONS: 'notifications',
} as const;

export const JOBS = {
  SEND_NOTIFICATION: 'send_notification',
} as const;

export interface SendNotificationJob {
  notificationId: string;
  channel: string;
}

export const QUEUES = {
  NOTIFICATIONS: 'notifications',
  ERASURE: 'erasure',
} as const;

export const JOBS = {
  SEND_NOTIFICATION: 'send_notification',
  ERASURE_PURGE: 'erasure_purge',
} as const;

export interface SendNotificationJob {
  notificationId: string;
  channel: string;
}

export interface ErasurePurgeJob {
  userId: string;
}

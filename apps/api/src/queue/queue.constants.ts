export const QUEUES = {
  NOTIFICATIONS: 'notifications',
  ERASURE: 'erasure',
  FEEDS: 'feeds',
} as const;

export const JOBS = {
  SEND_NOTIFICATION: 'send_notification',
  ERASURE_PURGE: 'erasure_purge',
  POLL_FEEDS: 'poll_feeds',
} as const;

export interface SendNotificationJob {
  notificationId: string;
  channel: string;
}

export interface ErasurePurgeJob {
  userId: string;
}

export type PollFeedsJob = Record<string, never>;

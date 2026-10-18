import type { NotificationChannel, NotificationType } from '@binaryiq/db';
import { Injectable } from '@nestjs/common';

export interface TemplateResult {
  subject?: string;
  body: string;
  templateId?: string;
}

@Injectable()
export class TemplateRegistry {
  resolve(type: NotificationType, channel: NotificationChannel, data: Record<string, string> = {}): TemplateResult {
    const url = data.url ?? '';
    const points = data.points ?? '';
    switch (type) {
      case 'REGISTRATION':
        return { subject: 'Confirm your registration', body: `Confirm your email to activate your account and claim 500 welcome points: ${url}` };
      case 'PASSWORD_RESET':
        return { subject: 'Reset your password', body: `Click to reset your password: ${url}` };
      case 'SURVEY_INVITE':
        return { subject: 'New survey available for you', body: `A new survey matching your profile is available — earn up to ${points} pts!` };
      case 'SURVEY_REMINDER':
        return { subject: 'Survey closing soon', body: 'A survey you were invited to is closing soon. Complete it before it expires!' };
      case 'POINTS_UPDATE':
        return { subject: 'Points credited', body: `${points} points have been credited to your account.` };
      case 'GAME_REMINDER':
        return { subject: 'Your daily spin is ready!', body: 'Come back and spin the daily wheel to win up to 1,000 points!' };
      case 'REWARD_UPDATE':
        return { subject: 'Reward status updated', body: data.message ?? 'Your reward redemption status has been updated.' };
      case 'OFFERS_NEWS':
        return { subject: 'News from BinaryIQ', body: data.message ?? "Check out what's new on BinaryIQ!" };
      default:
        return { body: data.message ?? 'You have a new notification.' };
    }
  }
}

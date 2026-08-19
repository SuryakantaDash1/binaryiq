import type { NotificationType } from '@influencer/db';
import type { UpdatePreferenceInput } from '@influencer/types';
import { Injectable } from '@nestjs/common';

import { UnprocessableException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';

const ALWAYS_ON_TYPES: NotificationType[] = ['REGISTRATION', 'PASSWORD_RESET'];
const ALL_TYPES: NotificationType[] = ['REGISTRATION', 'SURVEY_INVITE', 'SURVEY_REMINDER', 'POINTS_UPDATE', 'GAME_REMINDER', 'REWARD_UPDATE', 'PASSWORD_RESET', 'OFFERS_NEWS'];

@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(userId: string) {
    await Promise.all(ALL_TYPES.map((type) =>
      this.prisma.notificationPreference.upsert({
        where: { userId_type: { userId, type } },
        create: { userId, type },
        update: {},
      })
    ));
    const prefs = await this.prisma.notificationPreference.findMany({ where: { userId }, orderBy: { type: 'asc' } });
    return prefs.map((p) => ({ type: p.type, email: p.email, push: p.push, sms: p.sms, whatsapp: p.whatsapp }));
  }

  async update(userId: string, input: UpdatePreferenceInput) {
    const isAlwaysOn = ALWAYS_ON_TYPES.includes(input.type as NotificationType);
    if (isAlwaysOn) {
      if (input.email === false) {
        throw new UnprocessableException('cannot_disable_always_on', [{ field: 'email', issue: 'This notification type cannot be disabled' }]);
      }
    }
    const updated = await this.prisma.notificationPreference.upsert({
      where: { userId_type: { userId, type: input.type as NotificationType } },
      create: {
        userId,
        type: input.type as NotificationType,
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.push !== undefined ? { push: input.push } : {}),
        ...(input.sms !== undefined ? { sms: input.sms } : {}),
        ...(input.whatsapp !== undefined ? { whatsapp: input.whatsapp } : {}),
      },
      update: {
        ...(input.email !== undefined && !isAlwaysOn ? { email: input.email } : {}),
        ...(input.push !== undefined ? { push: input.push } : {}),
        ...(input.sms !== undefined ? { sms: input.sms } : {}),
        ...(input.whatsapp !== undefined ? { whatsapp: input.whatsapp } : {}),
      },
    });
    return { type: updated.type, email: updated.email, push: updated.push, sms: updated.sms, whatsapp: updated.whatsapp };
  }
}

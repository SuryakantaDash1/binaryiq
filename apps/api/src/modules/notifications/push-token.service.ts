import type { RegisterPushTokenInput } from '@binaryiq/types';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PushTokenService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: string, input: RegisterPushTokenInput) {
    const token = await this.prisma.pushToken.upsert({
      where: { token: input.token },
      create: { userId, token: input.token, platform: input.platform },
      update: { userId, platform: input.platform },
    });
    return { id: token.id, token: token.token, platform: token.platform };
  }

  async deregister(userId: string, token: string): Promise<void> {
    await this.prisma.pushToken.deleteMany({ where: { userId, token } });
  }

  async pruneDeadTokens(tokens: string[]): Promise<void> {
    await this.prisma.pushToken.deleteMany({ where: { token: { in: tokens } } });
  }
}

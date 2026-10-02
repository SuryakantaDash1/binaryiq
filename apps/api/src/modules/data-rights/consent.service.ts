import type { ConsentType } from '@influencer/db';
import type { ConsentInput } from '@influencer/types';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ConsentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `ip` comes from req.ip, which honours the configured proxy hop count — unlike
   * reading X-Forwarded-For directly, a client can't spoof it.
   */
  async grant(userId: string | null, dto: ConsentInput, ip: string | null): Promise<object> {
    const row = await this.prisma.consentLog.create({
      data: {
        userId,
        consentType: dto.consentType as ConsentType,
        consentVersion: dto.consentVersion,
        granted: dto.granted,
        ipAddress: ip,
      },
    });

    // Audit log (only for authenticated users)
    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          actorType: 'user',
          actorId: userId,
          action: 'consent.change',
          targetType: 'consent',
          targetId: row.id,
          ipAddress: ip,
          metadata: { consentType: dto.consentType, granted: dto.granted, version: dto.consentVersion },
        },
      });
    }

    return this.toDto(row);
  }

  async getMyConsents(
    userId: string,
  ): Promise<{ current: Partial<Record<ConsentType, boolean>>; history: object[] }> {
    const logs = await this.prisma.consentLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    // Build current state from latest entry per type
    const current: Partial<Record<ConsentType, boolean>> = {};
    for (const log of logs) {
      current[log.consentType] = log.granted;
    }

    return { current, history: logs.map((l) => this.toDto(l)) };
  }

  async hasActiveConsent(userId: string, type: ConsentType): Promise<boolean> {
    const latest = await this.prisma.consentLog.findFirst({
      where: { userId, consentType: type },
      orderBy: { createdAt: 'desc' },
    });
    return latest?.granted ?? false;
  }

  private toDto(row: {
    id: string;
    consentType: string;
    consentVersion: string;
    granted: boolean;
    ipAddress: string | null;
    createdAt: Date;
  }): object {
    return {
      id: row.id,
      consentType: row.consentType,
      consentVersion: row.consentVersion,
      granted: row.granted,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

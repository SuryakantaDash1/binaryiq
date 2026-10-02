import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { EncryptionService } from '../../common/services/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

const EXPORT_TTL_SECONDS = 15 * 60; // 15 minutes

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly enc: EncryptionService,
    private readonly redis: RedisService,
  ) {}

  async generateExport(
    userId: string,
    baseUrl: string,
    ip: string | null,
  ): Promise<{ downloadUrl: string; expiresAt: string }> {
    const bundle = await this.assembleBundle(userId);
    const token = randomUUID();

    await this.redis.instance.set(
      `data_export:${token}`,
      JSON.stringify(bundle),
      'EX',
      EXPORT_TTL_SECONDS,
    );

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        actorId: userId,
        action: 'account.data_export',
        targetType: 'user',
        targetId: userId,
        ipAddress: ip,
      },
    });

    const expiresAt = new Date(Date.now() + EXPORT_TTL_SECONDS * 1000).toISOString();
    return {
      downloadUrl: `${baseUrl}/v1/account/data-export/download/${token}`,
      expiresAt,
    };
  }

  async getBundle(token: string): Promise<string | null> {
    const data = await this.redis.instance.get(`data_export:${token}`);
    if (!data) return null;
    // Consume once
    await this.redis.instance.del(`data_export:${token}`);
    return data;
  }

  private async assembleBundle(userId: string): Promise<object> {
    const [user, profile, address, demographics, paypal, points, consents, surveys, polls, games] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, username: true, createdAt: true },
        }),
        this.prisma.userProfile.findUnique({ where: { userId } }),
        this.prisma.userAddress.findUnique({ where: { userId } }),
        this.prisma.userDemographics.findUnique({ where: { userId } }),
        this.prisma.paypalAccount.findUnique({ where: { userId } }),
        this.prisma.pointsTransaction.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
        this.prisma.consentLog.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
        this.prisma.surveyResponse.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
        this.prisma.pollVote.findMany({ where: { userId }, orderBy: { votedAt: 'asc' } }),
        this.prisma.gamePlay.findMany({ where: { userId }, orderBy: { playedAt: 'asc' } }),
      ]);

    // Decrypt _enc fields
    let dob: string | null = null;
    let phone: string | null = null;
    let addressLine1: string | null = null;

    if (profile?.dobEnc) {
      try {
        dob = this.enc.decrypt(profile.dobEnc);
      } catch {
        dob = null;
      }
    }

    const userWithPhone = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phoneEnc: true },
    });
    if (userWithPhone?.phoneEnc) {
      try {
        phone = this.enc.decrypt(userWithPhone.phoneEnc);
      } catch {
        phone = null;
      }
    }

    if (address?.line1Enc) {
      try {
        addressLine1 = this.enc.decrypt(address.line1Enc);
      } catch {
        addressLine1 = null;
      }
    }

    return {
      exportedAt: new Date().toISOString(),
      user: { ...user },
      profile: profile
        ? {
            firstName: profile.firstName,
            surname: profile.surname,
            dob,
            gender: profile.gender,
            photoUrl: profile.photoUrl,
            country: profile.country,
          }
        : null,
      contact: { phone },
      address: address
        ? {
            line1: addressLine1,
            city: address.city,
            pinCode: address.pinCode,
            areaType: address.areaType,
          }
        : null,
      demographics: demographics
        ? {
            educationLevel: demographics.educationLevel,
            employmentType: demographics.employmentType,
            incomeBracket: demographics.incomeBracket,
          }
        : null,
      paypal: paypal ? { paypalEmail: paypal.paypalEmail } : null,
      pointsHistory: points.map((p) => ({
        action: p.action,
        direction: p.direction,
        points: p.points,
        description: p.description,
        createdAt: p.createdAt,
      })),
      surveys: surveys.map((s) => ({ surveyId: s.surveyId, status: s.status, createdAt: s.createdAt })),
      polls: polls.map((p) => ({ pollId: p.pollId, votedAt: p.votedAt })),
      games: games.map((g) => ({ gameId: g.gameId, pointsWon: g.pointsWon, playDate: g.playDate, playedAt: g.playedAt })),
      consents: consents.map((c) => ({
        consentType: c.consentType,
        consentVersion: c.consentVersion,
        granted: c.granted,
        createdAt: c.createdAt,
      })),
    };
  }
}

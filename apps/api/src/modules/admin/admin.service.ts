import type { AdminSession, AdminStats, AdminUsersQuery, AdminUsersResult } from '@influencer/types';
import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';

import { UnauthenticatedException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../auth/token.service';

const ADMIN_TOKEN_TTL = '8h';
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async login(email: string, password: string): Promise<AdminSession> {
    const admin = await this.prisma.admin.findUnique({ where: { email: email.toLowerCase() } });
    if (!admin || !admin.isActive) throw new UnauthenticatedException('Invalid email or password');
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) throw new UnauthenticatedException('Invalid email or password');

    const accessToken = this.tokens.signAccess(
      { sub: admin.id, email: admin.email, roles: [admin.role] },
      ADMIN_TOKEN_TTL,
    );
    return {
      accessToken,
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    };
  }

  async me(adminId: string): Promise<AdminSession['admin']> {
    const admin = await this.prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin) throw new UnauthenticatedException('Admin not found');
    return { id: admin.id, email: admin.email, name: admin.name, role: admin.role };
  }

  async listUsers(q: AdminUsersQuery): Promise<AdminUsersResult> {
    const where = {
      deletedAt: null,
      ...(q.q
        ? { OR: [{ email: { contains: q.q, mode: 'insensitive' as const } }, { username: { contains: q.q, mode: 'insensitive' as const } }] }
        : {}),
      ...(q.status ? { isActive: q.status === 'active' } : {}),
      ...(q.verified ? { isVerified: q.verified === 'true' } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { pointsBalance: true },
      }),
    ]);

    return {
      items: rows.map((u) => ({
        id: u.id,
        email: u.email,
        username: u.username,
        isVerified: u.isVerified,
        isActive: u.isActive,
        balance: u.pointsBalance?.balance ?? 0,
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
        createdAt: u.createdAt.toISOString(),
      })),
      pagination: { total, page: q.page, pageSize: q.pageSize },
    };
  }

  async setUserActive(userId: string, isActive: boolean, actorId: string): Promise<{ id: string; isActive: boolean }> {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { isActive } });
    await this.prisma.auditLog
      .create({
        data: {
          actorType: 'admin',
          actorId,
          action: isActive ? 'user.unblock' : 'user.block',
          targetType: 'user',
          targetId: userId,
        },
      })
      .catch(() => void 0);
    return { id: user.id, isActive: user.isActive };
  }

  async stats(): Promise<AdminStats> {
    const now = Date.now();
    const d30 = new Date(now - 30 * DAY_MS);
    const d7 = new Date(now - 7 * DAY_MS);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      total,
      active30d,
      active7d,
      verified,
      blocked,
      newToday,
      new7d,
      new30d,
      balanceAgg,
      redemptionsTotal,
      redemptionsPending,
      surveyResponses,
      pollVotes,
      gamePlays,
      profileSurveyResponses,
      openTickets,
      redemptionsGrouped,
      genderGrouped,
      countryGrouped,
      recentSignupRows,
      recentSignupCreatedAts,
      recentActivityRows,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, lastLoginAt: { gte: d30 } } }),
      this.prisma.user.count({ where: { deletedAt: null, lastLoginAt: { gte: d7 } } }),
      this.prisma.user.count({ where: { deletedAt: null, isVerified: true } }),
      this.prisma.user.count({ where: { deletedAt: null, isActive: false } }),
      this.prisma.user.count({ where: { deletedAt: null, createdAt: { gte: startOfToday } } }),
      this.prisma.user.count({ where: { deletedAt: null, createdAt: { gte: d7 } } }),
      this.prisma.user.count({ where: { deletedAt: null, createdAt: { gte: d30 } } }),
      this.prisma.pointsBalance.aggregate({ _sum: { lifetimeEarned: true, lifetimeSpent: true, balance: true } }),
      this.prisma.rewardRedemption.count(),
      this.prisma.rewardRedemption.count({ where: { status: 'PENDING' } }),
      this.prisma.surveyResponse.count(),
      this.prisma.pollVote.count(),
      this.prisma.gamePlay.count(),
      this.prisma.profileSurveyResponse.count(),
      this.prisma.supportTicket.count({ where: { status: 'OPEN' } }),
      this.prisma.rewardRedemption.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.userProfile.groupBy({ by: ['gender'], _count: { _all: true } }),
      this.prisma.userProfile.groupBy({ by: ['country'], _count: { _all: true } }),
      this.prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, email: true, username: true, createdAt: true, isVerified: true },
      }),
      this.prisma.user.findMany({ where: { deletedAt: null, createdAt: { gte: d30 } }, select: { createdAt: true } }),
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, actorType: true, action: true, targetType: true, createdAt: true },
      }),
    ]);

    // Bucket signups per day (last 30 days) in JS.
    const buckets = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const day = new Date(now - i * DAY_MS).toISOString().slice(0, 10);
      buckets.set(day, 0);
    }
    for (const r of recentSignupCreatedAts) {
      const day = r.createdAt.toISOString().slice(0, 10);
      if (buckets.has(day)) buckets.set(day, (buckets.get(day) ?? 0) + 1);
    }

    return {
      users: { total, active30d, active7d, verified, blocked, newToday, new7d, new30d },
      points: {
        issued: balanceAgg._sum.lifetimeEarned ?? 0,
        spent: balanceAgg._sum.lifetimeSpent ?? 0,
        outstanding: balanceAgg._sum.balance ?? 0,
      },
      engagement: {
        redemptionsTotal,
        redemptionsPending,
        surveyResponses,
        pollVotes,
        gamePlays,
        profileSurveyResponses,
        openTickets,
      },
      redemptionsByStatus: redemptionsGrouped.map((g) => ({ status: g.status, count: g._count._all })),
      genderSplit: genderGrouped.map((g) => ({ gender: g.gender, count: g._count._all })),
      topCountries: countryGrouped
        .map((g) => ({ country: g.country, count: g._count._all }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      signupsByDay: Array.from(buckets.entries()).map(([date, count]) => ({ date, count })),
      recentSignups: recentSignupRows.map((u) => ({
        id: u.id,
        email: u.email,
        username: u.username,
        createdAt: u.createdAt.toISOString(),
        isVerified: u.isVerified,
      })),
      recentActivity: recentActivityRows.map((a) => ({
        id: a.id,
        actorType: a.actorType,
        action: a.action,
        targetType: a.targetType,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }
}

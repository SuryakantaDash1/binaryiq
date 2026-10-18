import { randomUUID } from 'node:crypto';

import type { AdminLoginChallenge, AdminSession, AdminTotpInput, AdminRoleType } from '@binaryiq/types';
import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

import { UnauthenticatedException } from '../../common/exceptions/domain.exception';
import { EncryptionService } from '../../common/services/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuthStateService } from '../auth/auth-state.service';
import { TokenService } from '../auth/token.service';

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 30 * 60 * 1000;
const ENROLL_TTL_SECONDS = 10 * 60;
const ISSUER = 'BinaryIQ Admin';
const DUMMY_HASH = bcrypt.hashSync(randomUUID(), 12);
// ±1 time step (30 s) tolerance for clock drift.
const totp = authenticator.clone({ window: 1 });

interface AdminRow {
  id: string;
  email: string;
  name: string;
  role: string;
  tokenVersion: number;
}

export interface AdminLoginResult {
  session: AdminSession;
  refreshToken: string;
}

/**
 * Admin sign-in: password (with lockout) → authenticator-app code → short-lived
 * access token + httpOnly refresh cookie. Every admin must use 2FA; first-time
 * admins enrol by scanning a QR code during their first login.
 */
@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly authState: AuthStateService,
    private readonly enc: EncryptionService,
    private readonly redis: RedisService,
  ) {}

  async login(email: string, password: string, ip: string | null): Promise<AdminLoginChallenge> {
    const invalid = new UnauthenticatedException('Invalid email or password');
    const admin = await this.prisma.admin.findUnique({ where: { email: email.toLowerCase() } });
    if (!admin || !admin.isActive) {
      await bcrypt.compare(password, DUMMY_HASH); // equal timing for unknown accounts
      await this.audit('admin.login_failed', null, ip);
      throw invalid;
    }

    const locked = admin.lockedUntil !== null && admin.lockedUntil.getTime() > Date.now();
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (locked || !ok) {
      if (!locked) await this.recordFailure(admin.id);
      await this.audit('admin.login_failed', admin.id, ip);
      throw invalid;
    }

    const challengeToken = this.tokens.signAdminChallenge(admin.id);
    if (admin.totpEnabledAt && admin.totpSecretEnc) return { status: 'totp_required', challengeToken };

    // Not enrolled yet: hand out a fresh secret, held encrypted in Redis until the
    // first valid code proves the admin has it in their authenticator app.
    const secret = totp.generateSecret();
    await this.redis.instance.set(this.enrollKey(admin.id), this.enc.encrypt(secret), 'EX', ENROLL_TTL_SECONDS);
    const otpauthUrl = totp.keyuri(admin.email, ISSUER, secret);
    return {
      status: 'enrollment_required',
      challengeToken,
      otpauthUrl,
      qrDataUrl: await QRCode.toDataURL(otpauthUrl),
      secret,
    };
  }

  async verifyTotp(input: AdminTotpInput, ip: string | null): Promise<AdminLoginResult> {
    const adminId = this.tokens.verifyAdminChallenge(input.challengeToken);
    const admin = await this.prisma.admin.findUnique({ where: { id: adminId } });
    const invalid = new UnauthenticatedException('Invalid code');
    if (!admin || !admin.isActive) throw invalid;
    if (admin.lockedUntil && admin.lockedUntil.getTime() > Date.now()) throw invalid;

    let secret: string;
    const enrolling = !(admin.totpEnabledAt && admin.totpSecretEnc);
    if (!enrolling) {
      secret = this.enc.decrypt(admin.totpSecretEnc!);
    } else {
      const pending = await this.redis.instance.get(this.enrollKey(admin.id));
      if (!pending) throw new UnauthenticatedException('Setup expired — sign in again to get a new QR code');
      secret = this.enc.decrypt(pending);
    }

    if (!totp.verify({ token: input.code, secret })) {
      await this.recordFailure(admin.id);
      await this.audit('admin.login_failed', admin.id, ip);
      throw invalid;
    }
    // A code is single-use even within its validity window.
    const fresh = await this.redis.instance.set(this.usedKey(admin.id, input.code), '1', 'EX', 90, 'NX');
    if (fresh !== 'OK') throw new UnauthenticatedException('Code already used — wait for the next one');

    await this.prisma.admin.update({
      where: { id: admin.id },
      data: {
        failedLogins: 0,
        lockedUntil: null,
        ...(enrolling ? { totpSecretEnc: this.enc.encrypt(secret), totpEnabledAt: new Date() } : {}),
      },
    });
    if (enrolling) {
      await this.redis.instance.del(this.enrollKey(admin.id));
      await this.audit('admin.2fa_enrolled', admin.id, ip);
    }
    await this.audit('admin.login', admin.id, ip);
    await this.authState.evict('admin', admin.id);
    return this.issue(admin);
  }

  async refresh(refreshToken: string): Promise<AdminLoginResult> {
    const claims = this.tokens.verifyRefresh(refreshToken);
    if (claims.aud !== 'admin') throw new UnauthenticatedException('Invalid refresh token');
    const admin = await this.prisma.admin.findUnique({ where: { id: claims.sub } });
    if (!admin || !admin.isActive || admin.tokenVersion !== claims.tv) {
      throw new UnauthenticatedException('Invalid refresh token');
    }
    await this.authState.consumeRefresh('admin', admin.id, claims.jti, claims.exp);
    // Keep the original absolute expiry: an admin session can't be extended past its 8 h.
    return this.issue(admin, claims.exp);
  }

  async logout(adminId: string): Promise<void> {
    await this.authState.revoke('admin', adminId);
  }

  async me(adminId: string): Promise<AdminSession['admin']> {
    const admin = await this.prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin || !admin.isActive) throw new UnauthenticatedException('Admin not found');
    return this.profile(admin);
  }

  private issue(admin: AdminRow, absoluteExp?: number): AdminLoginResult {
    const accessToken = this.tokens.signAccess({
      sub: admin.id,
      email: admin.email,
      roles: [admin.role],
      aud: 'admin',
      tv: admin.tokenVersion,
    });
    const refreshToken = this.tokens.signRefresh({ sub: admin.id, aud: 'admin', tv: admin.tokenVersion }, absoluteExp);
    return { session: { accessToken, admin: this.profile(admin) }, refreshToken };
  }

  private profile(admin: AdminRow): AdminSession['admin'] {
    return { id: admin.id, email: admin.email, name: admin.name, role: admin.role as AdminRoleType };
  }

  private async recordFailure(adminId: string): Promise<void> {
    const { failedLogins } = await this.prisma.admin.update({
      where: { id: adminId },
      data: { failedLogins: { increment: 1 } },
      select: { failedLogins: true },
    });
    if (failedLogins >= MAX_FAILED_LOGINS) {
      await this.prisma.admin.update({
        where: { id: adminId },
        data: { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCKOUT_MS) },
      });
    }
  }

  private async audit(action: string, adminId: string | null, ip: string | null): Promise<void> {
    await this.prisma.auditLog
      .create({
        data: {
          actorType: 'admin',
          actorId: adminId ?? undefined,
          action,
          targetType: 'admin',
          targetId: adminId ?? undefined,
          ipAddress: ip,
        },
      })
      .catch(() => void 0);
  }

  private enrollKey(adminId: string): string {
    return `admin:totp-enroll:${adminId}`;
  }

  private usedKey(adminId: string, code: string): string {
    return `admin:totp-used:${adminId}:${code}`;
  }
}

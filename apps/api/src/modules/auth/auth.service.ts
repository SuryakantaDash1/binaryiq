import { randomUUID } from 'node:crypto';

import {
  CONSENT_POLICY_VERSION,
  type RegisterStep1Input,
  type RegisterStep1Result,
  type RegisterStep2Input,
  type RegisterStep2Result,
  type LoginInput,
  type AuthSession,
  type VerifyEmailResult,
  type ForgotPasswordInput,
  type ResetPasswordInput,
} from '@binaryiq/types';
import { Injectable, Logger } from '@nestjs/common';
import bcrypt from 'bcryptjs';

import { hashOneTimeToken, newOneTimeToken } from '../../common/crypto/one-time-token';
import {
  ConflictException,
  UnauthenticatedException,
  UnprocessableException,
} from '../../common/exceptions/domain.exception';
import { EncryptionService } from '../../common/services/encryption.service';
import { AppConfigService } from '../../config/config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { EmailProvider } from '../notifications/email.provider';
import { verificationEmail, passwordResetEmail } from '../notifications/email.templates';
import { PointsService } from '../points/points.service';

import { AuthStateService } from './auth-state.service';
import { TokenService } from './token.service';

const BCRYPT_COST = 12;
const DRAFT_TTL_SECONDS = 60 * 60; // 1 hour
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 30 * 60 * 1000; // 30 minutes
// bcrypt hash of a random throwaway value — compared against when the email is unknown.
const DUMMY_HASH = bcrypt.hashSync(randomUUID(), BCRYPT_COST);

export interface LoginResult {
  session: AuthSession;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly tokens: TokenService,
    private readonly points: PointsService,
    private readonly email: EmailProvider,
    private readonly config: AppConfigService,
    private readonly enc: EncryptionService,
    private readonly authState: AuthStateService,
  ) {}

  /** Step 1 — stash identity basics (name, DOB, gender) in a short-lived, encrypted Redis draft. */
  async registerStep1(input: RegisterStep1Input): Promise<RegisterStep1Result> {
    const draftId = randomUUID();
    await this.redis.instance.set(
      this.draftKey(draftId),
      JSON.stringify(this.enc.encryptJson(input)),
      'EX',
      DRAFT_TTL_SECONDS,
    );
    return { draftId };
  }

  /** Step 2 — create the user, record consent, send the verification email. */
  async registerStep2(input: RegisterStep2Input, ip: string | null = null): Promise<RegisterStep2Result> {
    const raw = await this.redis.instance.get(this.draftKey(input.draftId));
    if (!raw) {
      throw new UnprocessableException('Registration session expired — please restart.');
    }
    const step1 = this.enc.decryptJson<RegisterStep1Input>(JSON.parse(raw));

    const [emailTaken, usernameTaken] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } }),
      this.prisma.user.findUnique({ where: { username: input.username } }),
    ]);
    if (emailTaken) throw new ConflictException('Email is already registered');
    if (usernameTaken) throw new ConflictException('Username is taken');

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
    const { raw: token, hash: tokenHash } = newOneTimeToken();

    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          username: input.username,
          passwordHash,
          phoneEnc: this.enc.encryptOptional(input.mobile),
          profile: {
            create: {
              firstName: step1.firstName,
              surname: step1.surname,
              dobEnc: this.enc.encrypt(step1.dob),
              gender: step1.gender,
              country: step1.country,
            },
          },
          address: { create: { pinCode: input.pinCode } },
        },
      });
      await tx.authToken.create({
        data: {
          userId: user.id,
          tokenHash,
          tokenType: 'EMAIL_VERIFICATION',
          expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
        },
      });
      // DPDP s.6: keep evidence of the consent given at sign-up (what, which version, when, from where).
      const consentBase = { userId: user.id, consentVersion: CONSENT_POLICY_VERSION, ipAddress: ip };
      await tx.consentLog.createMany({
        data: [
          { ...consentBase, consentType: 'TERMS', granted: true },
          { ...consentBase, consentType: 'PRIVACY', granted: true },
          { ...consentBase, consentType: 'MARKETING', granted: input.smsOptIn },
        ],
      });
    });

    await this.redis.instance.del(this.draftKey(input.draftId));

    const link = `${this.config.get('WEB_URL')}/verify?token=${token}`;
    const { subject, html } = verificationEmail({
      link,
      firstName: step1.firstName,
      webUrl: this.config.get('WEB_URL'),
    });
    // The account already exists at this point, so a delivery failure must not
    // surface as a failed registration (the user would retry and hit "email
    // already registered"). They can still sign in; the welcome bonus waits for
    // verification.
    const emailSent = await this.email.send({ to: input.email, subject, html }).then(
      () => true,
      (e: unknown) => {
        this.logger.error(`Verification email not delivered: ${(e as Error).message}`);
        return false;
      },
    );

    // Testing convenience: instantly verify + award points so accounts can log
    // in without clicking the emailed link. Disable in production (env flag).
    if (this.config.get('AUTO_VERIFY_EMAIL') === 'true') {
      try {
        await this.verifyEmail(token);
        this.logger.log('Auto-verified new registration');
      } catch (e) {
        this.logger.error('Auto-verify failed for new registration', (e as Error).message);
      }
    }

    return {
      email: input.email,
      emailSent,
      message: emailSent
        ? `We have sent you an activation email on ${input.email}`
        : 'Your account is ready, but we could not send the activation email right now.',
    };
  }

  /** Verify the email token, mark verified, award the welcome bonus (idempotent). */
  async verifyEmail(token: string): Promise<VerifyEmailResult> {
    const record = await this.prisma.authToken.findUnique({ where: { tokenHash: hashOneTimeToken(token) } });
    if (!record || record.tokenType !== 'EMAIL_VERIFICATION') {
      throw new UnprocessableException('Invalid verification link');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnprocessableException('Verification link has expired');
    }
    if (record.usedAt) {
      return { verified: true, pointsAwarded: 0 }; // idempotent — already verified
    }

    const bonus = this.config.get('REGISTRATION_BONUS_POINTS');
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: record.userId }, data: { isVerified: true } });
      await tx.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
      await this.points.award(tx, {
        userId: record.userId,
        points: bonus,
        action: 'REGISTRATION_BONUS',
        description: 'Welcome bonus',
        idempotencyKey: `registration_bonus:${record.userId}`,
      });
    });

    return { verified: true, pointsAwarded: bonus };
  }

  async login(input: LoginInput, ip: string | null = null): Promise<LoginResult> {
    const invalid = new UnauthenticatedException('Invalid email or password');
    const user = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user || !user.isActive || user.deletedAt) {
      // Same bcrypt cost as a real check, so response time doesn't reveal which emails exist.
      await bcrypt.compare(input.password, DUMMY_HASH);
      throw invalid;
    }

    const locked = user.lockedUntil && user.lockedUntil.getTime() > Date.now();
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (locked) throw invalid; // generic message — doesn't confirm the account exists
    if (!ok) {
      // Atomic increment so parallel guesses can't share a counter value.
      const { failedLogins } = await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: { increment: 1 } },
        select: { failedLogins: true },
      });
      if (failedLogins >= MAX_FAILED_LOGINS) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCKOUT_MS) },
        });
      }
      throw invalid;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    await this.prisma.auditLog
      .create({
        data: {
          actorType: 'user',
          actorId: user.id,
          action: 'user.login',
          targetType: 'user',
          targetId: user.id,
          ipAddress: ip,
        },
      })
      .catch((e: unknown) => this.logger.error('Audit log failed', e));

    return this.issueSession(user, ip);
  }

  /** Revokes every session of the refresh token's owner (server-side logout). */
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    try {
      const claims = this.tokens.verifyRefresh(refreshToken);
      if (claims.aud === 'member') await this.authState.revoke('member', claims.sub);
    } catch {
      // Already invalid — nothing to revoke.
    }
  }

  private issueSession(
    user: { id: string; email: string; username: string; isVerified: boolean; tokenVersion: number },
    _ip: string | null,
  ): LoginResult {
    const accessToken = this.tokens.signAccess({
      sub: user.id,
      email: user.email,
      roles: [],
      aud: 'member',
      tv: user.tokenVersion,
    });
    const refreshToken = this.tokens.signRefresh({ sub: user.id, aud: 'member', tv: user.tokenVersion });
    return {
      session: {
        accessToken,
        user: { id: user.id, email: user.email, username: user.username, isVerified: user.isVerified },
      },
      refreshToken,
    };
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: { profile: true },
    });
    // Always succeed to avoid leaking whether the email exists.
    if (!user || !user.isActive || user.deletedAt) return;

    const { raw: token, hash: tokenHash } = newOneTimeToken();
    await this.prisma.$transaction([
      // Only the newest reset link works.
      this.prisma.authToken.deleteMany({ where: { userId: user.id, tokenType: 'PASSWORD_RESET', usedAt: null } }),
      this.prisma.authToken.create({
        data: {
          userId: user.id,
          tokenHash,
          tokenType: 'PASSWORD_RESET',
          expiresAt: new Date(Date.now() + RESET_TTL_MS),
        },
      }),
    ]);
    const link = `${this.config.get('WEB_URL')}/reset-password?token=${token}`;
    const { subject, html } = passwordResetEmail({
      link,
      firstName: user.profile?.firstName ?? user.username,
      webUrl: this.config.get('WEB_URL'),
    });
    // Swallowed (and logged) so the response is identical whether or not the
    // address has an account — a 500 here would reveal that it does.
    await this.email.send({ to: user.email, subject, html }).catch((e: unknown) => {
      this.logger.error(`Password reset email not delivered: ${(e as Error).message}`);
    });
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const record = await this.prisma.authToken.findUnique({ where: { tokenHash: hashOneTimeToken(input.token) } });
    if (!record || record.tokenType !== 'PASSWORD_RESET' || record.usedAt) {
      throw new UnprocessableException('Invalid or used reset link');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnprocessableException('Reset link has expired');
    }
    const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_COST);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash, failedLogins: 0, lockedUntil: null },
      });
      await tx.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
      await tx.authToken.deleteMany({
        where: { userId: record.userId, tokenType: 'PASSWORD_RESET', usedAt: null },
      });
    });
    // Anyone holding an old session (e.g. whoever forced the reset) is signed out.
    await this.authState.revoke('member', record.userId);
  }

  /** Exchanges a valid refresh token for a new access token and a rotated refresh token. */
  async refresh(refreshToken: string): Promise<LoginResult> {
    const claims = this.tokens.verifyRefresh(refreshToken);
    if (claims.aud !== 'member') throw new UnauthenticatedException('Invalid refresh token');
    const user = await this.prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user || !user.isActive || user.deletedAt || user.tokenVersion !== claims.tv) {
      throw new UnauthenticatedException('Invalid refresh token');
    }
    await this.authState.consumeRefresh('member', user.id, claims.jti, claims.exp);
    return this.issueSession(user, null);
  }

  private draftKey(draftId: string): string {
    return `reg:draft:${draftId}`;
  }
}

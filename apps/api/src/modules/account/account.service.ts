import type { UpdateProfileInput, ChangeEmailInput, ChangePasswordInput, UpdatePaypalInput, UpdateAboutYouInput } from '@influencer/types';
import { Injectable, Logger } from '@nestjs/common';
import bcrypt from 'bcryptjs';

import { hashOneTimeToken, newOneTimeToken } from '../../common/crypto/one-time-token';
import {
  ConflictException,
  NotFoundException,
  UnprocessableException,
} from '../../common/exceptions/domain.exception';
import { EncryptionService } from '../../common/services/encryption.service';
import { AppConfigService } from '../../config/config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthStateService } from '../auth/auth-state.service';
import { EmailProvider } from '../notifications/email.provider';

const BCRYPT_COST = 12;
const EMAIL_CHANGE_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly enc: EncryptionService,
    private readonly email: EmailProvider,
    private readonly config: AppConfigService,
    private readonly authState: AuthStateService,
  ) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profile not found');
    return {
      firstName: profile.firstName,
      surname: profile.surname,
      dob: this.enc.decrypt(profile.dobEnc),
      gender: profile.gender,
      photoUrl: profile.photoUrl,
      country: profile.country,
    };
  }

  async updateProfile(userId: string, input: UpdateProfileInput, ip: string | null = null) {
    const profile = await this.prisma.userProfile.update({
      where: { userId },
      data: {
        firstName: input.firstName,
        surname: input.surname,
        dobEnc: this.enc.encrypt(input.dob),
        gender: input.gender,
      },
    });
    await this.auditLog(userId, 'profile.update', { fields: ['firstName', 'surname', 'dob', 'gender'] }, ip);
    return {
      firstName: profile.firstName,
      surname: profile.surname,
      dob: input.dob,
      gender: profile.gender,
      photoUrl: profile.photoUrl,
      country: profile.country,
    };
  }

  async updatePhoto(userId: string, url: string) {
    const profile = await this.prisma.userProfile.update({
      where: { userId },
      data: { photoUrl: url },
    });
    return { photoUrl: profile.photoUrl };
  }

  async deletePhoto(userId: string) {
    await this.prisma.userProfile.update({
      where: { userId },
      data: { photoUrl: null },
    });
    return { photoUrl: null };
  }

  async requestEmailChange(userId: string, input: ChangeEmailInput) {
    const newEmail = input.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: newEmail } });
    if (existing) throw new ConflictException('Email is already in use');

    const { raw: token, hash: tokenHash } = newOneTimeToken();
    await this.prisma.$transaction([
      this.prisma.authToken.deleteMany({ where: { userId, tokenType: 'EMAIL_CHANGE', usedAt: null } }),
      this.prisma.authToken.create({
        data: {
          userId,
          tokenHash,
          tokenType: 'EMAIL_CHANGE',
          payloadEnc: this.enc.encryptJson({ newEmail }),
          expiresAt: new Date(Date.now() + EMAIL_CHANGE_TTL_MS),
        },
      }),
    ]);

    const link = `${this.config.get('WEB_URL')}/account/email/verify?token=${token}`;
    await this.email.send({
      to: newEmail,
      subject: 'Confirm your new email address',
      html: `<p>Click <a href="${link}">here</a> to confirm your new email address. Link expires in 24 hours.</p>`,
    });

    return { pending: true, email: newEmail };
  }

  async confirmEmailChange(userId: string, token: string, ip: string | null = null) {
    const record = await this.prisma.authToken.findUnique({ where: { tokenHash: hashOneTimeToken(token) } });
    if (!record || record.tokenType !== 'EMAIL_CHANGE' || record.usedAt) {
      throw new UnprocessableException('Invalid or used token');
    }
    if (record.userId !== userId) throw new NotFoundException('Token not found');
    if (record.expiresAt.getTime() < Date.now()) throw new UnprocessableException('Token has expired');

    const payload = this.enc.decryptJson<{ newEmail: string }>(record.payloadEnc);
    const conflict = await this.prisma.user.findUnique({ where: { email: payload.newEmail } });
    if (conflict) throw new ConflictException('Email was taken in the interim');

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { email: payload.newEmail } });
      await tx.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    });

    // Never write the address itself into the (long-retained) audit trail.
    await this.auditLog(userId, 'email.change', {}, ip);
    // The login identifier changed — sign out every existing session.
    await this.authState.revoke('member', userId);
    return { email: payload.newEmail };
  }

  async changePassword(userId: string, input: ChangePasswordInput, ip: string | null = null) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const ok = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!ok) throw new UnprocessableException('current_password_incorrect');

    const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_COST);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.auditLog(userId, 'password.change', {}, ip);
    // Any other device (or attacker) holding a session is signed out.
    await this.authState.revoke('member', userId);
    return { ok: true };
  }

  async updatePaypal(userId: string, input: UpdatePaypalInput, ip: string | null = null) {
    const paypalEmailEnc = this.enc.encrypt(input.paypalEmail);
    const paypal = await this.prisma.paypalAccount.upsert({
      where: { userId },
      create: { userId, paypalEmailEnc },
      update: { paypalEmailEnc },
    });
    await this.auditLog(userId, 'paypal.update', {}, ip);
    return { paypalEmail: input.paypalEmail, verifiedAt: paypal.verifiedAt };
  }

  async getAboutYou(userId: string) {
    const [address, demographics] = await Promise.all([
      this.prisma.userAddress.findUnique({ where: { userId } }),
      this.prisma.userDemographics.findUnique({ where: { userId } }),
    ]);
    return {
      address: {
        line1: this.enc.decryptOptional(address?.line1Enc),
        city: address?.city ?? null,
        pinCode: address?.pinCode ?? null,
        areaType: address?.areaType ?? null,
      },
      demographics: {
        educationLevel: demographics?.educationLevel ?? null,
        employmentType: demographics?.employmentType ?? null,
        incomeBracket: this.enc.decryptOptional(demographics?.incomeBracketEnc),
        householdSize: demographics?.householdSize ?? null,
        childrenCount: demographics?.childrenCount ?? null,
        chiefWageEarner: demographics?.chiefWageEarner ?? null,
        assets: this.enc.decryptJsonOptional<Record<string, unknown>>(demographics?.assetsEnc),
      },
    };
  }

  async updateAboutYou(userId: string, input: UpdateAboutYouInput, ip: string | null = null) {
    await this.prisma.$transaction(async (tx) => {
      if (input.address) {
        await tx.userAddress.upsert({
          where: { userId },
          create: {
            userId,
            line1Enc: input.address.line1 ? this.enc.encrypt(input.address.line1) : undefined,
            city: input.address.city,
            pinCode: input.address.pinCode,
            areaType: input.address.areaType as 'URBAN' | 'RURAL' | 'SUBURBAN' | undefined,
          },
          update: {
            line1Enc: input.address.line1 ? this.enc.encrypt(input.address.line1) : undefined,
            city: input.address.city ?? undefined,
            pinCode: input.address.pinCode ?? undefined,
            areaType: (input.address.areaType as 'URBAN' | 'RURAL' | 'SUBURBAN' | undefined) ?? undefined,
          },
        });
      }
      if (input.demographics) {
        await tx.userDemographics.upsert({
          where: { userId },
          create: {
            userId,
            educationLevel: input.demographics.educationLevel,
            employmentType: input.demographics.employmentType,
            incomeBracketEnc: input.demographics.incomeBracket ? this.enc.encrypt(input.demographics.incomeBracket) : undefined,
            householdSize: input.demographics.householdSize,
            childrenCount: input.demographics.childrenCount,
            chiefWageEarner: input.demographics.chiefWageEarner,
            assetsEnc: input.demographics.assets ? this.enc.encryptJson(input.demographics.assets) : undefined,
          },
          update: {
            educationLevel: input.demographics.educationLevel ?? undefined,
            employmentType: input.demographics.employmentType ?? undefined,
            incomeBracketEnc: input.demographics.incomeBracket ? this.enc.encrypt(input.demographics.incomeBracket) : undefined,
            householdSize: input.demographics.householdSize ?? undefined,
            childrenCount: input.demographics.childrenCount ?? undefined,
            chiefWageEarner: input.demographics.chiefWageEarner ?? undefined,
            assetsEnc: input.demographics.assets ? this.enc.encryptJson(input.demographics.assets) : undefined,
          },
        });
      }
    });

    await this.auditLog(userId, 'about_you.update', {}, ip);
    return this.getAboutYou(userId);
  }

  async getBalance(userId: string) {
    const balance = await this.prisma.pointsBalance.findUnique({ where: { userId } });
    return { balance: balance?.balance ?? 0, lifetimeEarned: balance?.lifetimeEarned ?? 0 };
  }

  private async auditLog(userId: string, action: string, metadata: object, ip: string | null) {
    await this.prisma.auditLog.create({
      data: { actorType: 'user', actorId: userId, action, targetType: 'user', targetId: userId, ipAddress: ip, metadata },
    }).catch((e) => this.logger.error('Audit log failed', e));
  }
}

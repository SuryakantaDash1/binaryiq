import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';

import { UnauthenticatedException } from '../../common/exceptions/domain.exception';
import { AppConfigService } from '../../config/config.service';

/** Members and admins get disjoint token audiences — one can never act as the other. */
export type TokenAudience = 'member' | 'admin';

export interface AccessTokenClaims {
  sub: string;
  email: string;
  roles: string[];
  aud: TokenAudience;
  /** Principal's tokenVersion at issue time; a mismatch means the token was revoked. */
  tv: number;
}

export interface RefreshTokenClaims {
  sub: string;
  aud: TokenAudience;
  tv: number;
  /** Unique id — each refresh token can be redeemed once (AuthStateService.consumeRefresh). */
  jti: string;
  /** Absolute expiry (unix seconds) — rotation keeps it so admin sessions can't be extended. */
  exp: number;
}

const ALG = 'RS256' as const;

function isAudience(v: unknown): v is TokenAudience {
  return v === 'member' || v === 'admin';
}

/** RS256 signing/verification. Keys are required at boot (env.schema.ts). */
@Injectable()
export class TokenService {
  private readonly privateKey: string;
  private readonly publicKey: string;

  constructor(private readonly config: AppConfigService) {
    this.privateKey = Buffer.from(this.config.get('JWT_PRIVATE_KEY'), 'base64').toString('utf8');
    this.publicKey = Buffer.from(this.config.get('JWT_PUBLIC_KEY'), 'base64').toString('utf8');
  }

  signAccess(claims: AccessTokenClaims, expiresIn?: SignOptions['expiresIn']): string {
    const ttl =
      expiresIn ??
      ((claims.aud === 'admin' ? this.config.get('ADMIN_ACCESS_TTL') : this.config.get('JWT_ACCESS_TTL')) as SignOptions['expiresIn']);
    return jwt.sign({ ...claims, type: 'access' }, this.privateKey, { algorithm: ALG, expiresIn: ttl });
  }

  verifyAccess(token: string): AccessTokenClaims {
    const d = this.verify(token, 'access', 'Invalid or expired token');
    return {
      sub: String(d.sub),
      email: String(d.email),
      roles: Array.isArray(d.roles) ? (d.roles as string[]) : [],
      aud: d.aud as TokenAudience,
      tv: d.tv as number,
    };
  }

  /** Issues a refresh token. Pass `absoluteExp` when rotating to keep the original session end. */
  signRefresh(claims: { sub: string; aud: TokenAudience; tv: number }, absoluteExp?: number): string {
    const payload = { ...claims, type: 'refresh', jti: randomUUID() };
    if (absoluteExp) return jwt.sign({ ...payload, exp: absoluteExp }, this.privateKey, { algorithm: ALG });
    const ttl = (claims.aud === 'admin' ? this.config.get('ADMIN_SESSION_TTL') : this.config.get('JWT_REFRESH_TTL')) as SignOptions['expiresIn'];
    return jwt.sign(payload, this.privateKey, { algorithm: ALG, expiresIn: ttl });
  }

  verifyRefresh(token: string): RefreshTokenClaims {
    const d = this.verify(token, 'refresh', 'Invalid or expired refresh token');
    if (typeof d.jti !== 'string') throw new UnauthenticatedException('Invalid or expired refresh token');
    return { sub: String(d.sub), aud: d.aud as TokenAudience, tv: d.tv as number, jti: d.jti, exp: d.exp as number };
  }

  /** 5-minute token proving an admin passed the password step; only redeemable at the TOTP step. */
  signAdminChallenge(adminId: string): string {
    return jwt.sign({ sub: adminId, type: 'admin_challenge' }, this.privateKey, { algorithm: ALG, expiresIn: '5m' });
  }

  verifyAdminChallenge(token: string): string {
    try {
      const d = jwt.verify(token, this.publicKey, { algorithms: [ALG] }) as JwtPayload;
      if (d.type !== 'admin_challenge' || !d.sub) throw new Error('wrong token type');
      return String(d.sub);
    } catch {
      throw new UnauthenticatedException('Login session expired — sign in again');
    }
  }

  private verify(token: string, type: 'access' | 'refresh', message: string): JwtPayload {
    try {
      const d = jwt.verify(token, this.publicKey, { algorithms: [ALG] }) as JwtPayload;
      // Tokens issued before audiences/versions existed are rejected outright.
      if (d.type !== type || !isAudience(d.aud) || typeof d.tv !== 'number' || !d.sub) throw new Error('bad claims');
      return d;
    } catch {
      throw new UnauthenticatedException(message);
    }
  }
}

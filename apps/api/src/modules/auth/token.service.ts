import { Injectable, Logger } from '@nestjs/common';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';

import { UnauthenticatedException } from '../../common/exceptions/domain.exception';
import { AppConfigService } from '../../config/config.service';

export interface AccessTokenClaims {
  sub: string;
  email: string;
  roles: string[];
  type: 'access';
}

/**
 * RS256 token signing/verification. Phase 0 loads the keypair (if configured)
 * and exposes sign/verify; the register/login flows that issue tokens land in
 * Phase 1. See modules/module-00-foundation §5.6.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly privateKey?: string;
  private readonly publicKey?: string;

  constructor(private readonly config: AppConfigService) {
    const priv = this.config.get('JWT_PRIVATE_KEY');
    const pub = this.config.get('JWT_PUBLIC_KEY');
    this.privateKey = priv ? Buffer.from(priv, 'base64').toString('utf8') : undefined;
    this.publicKey = pub ? Buffer.from(pub, 'base64').toString('utf8') : undefined;
    if (!this.publicKey) {
      this.logger.warn(
        'JWT keys not configured — auth verification will reject all tokens (Phase 0).',
      );
    }
  }

  signAccess(claims: Omit<AccessTokenClaims, 'type'>): string {
    if (!this.privateKey) throw new Error('JWT_PRIVATE_KEY not configured');
    const options: SignOptions = {
      algorithm: 'RS256',
      expiresIn: this.config.get('JWT_ACCESS_TTL') as SignOptions['expiresIn'],
    };
    return jwt.sign({ ...claims, type: 'access' }, this.privateKey, options);
  }

  verifyAccess(token: string): AccessTokenClaims {
    if (!this.publicKey) throw new UnauthenticatedException('Auth not configured');
    try {
      const decoded = jwt.verify(token, this.publicKey, { algorithms: ['RS256'] }) as JwtPayload;
      if (decoded.type !== 'access') throw new Error('wrong token type');
      return {
        sub: String(decoded.sub),
        email: String(decoded.email),
        roles: Array.isArray(decoded.roles) ? (decoded.roles as string[]) : [],
        type: 'access',
      };
    } catch {
      throw new UnauthenticatedException('Invalid or expired token');
    }
  }

  signRefresh(userId: string): string {
    if (!this.privateKey) throw new Error('JWT_PRIVATE_KEY not configured');
    const options: SignOptions = {
      algorithm: 'RS256',
      expiresIn: this.config.get('JWT_REFRESH_TTL') as SignOptions['expiresIn'],
    };
    return jwt.sign({ sub: userId, type: 'refresh' }, this.privateKey, options);
  }

  verifyRefresh(token: string): { sub: string } {
    if (!this.publicKey) throw new UnauthenticatedException('Auth not configured');
    try {
      const decoded = jwt.verify(token, this.publicKey, { algorithms: ['RS256'] }) as JwtPayload;
      if (decoded.type !== 'refresh') throw new Error('wrong token type');
      return { sub: String(decoded.sub) };
    } catch {
      throw new UnauthenticatedException('Invalid or expired refresh token');
    }
  }
}

import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { TokenService } from '../../modules/auth/token.service';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UnauthenticatedException } from '../exceptions/domain.exception';

/**
 * Verifies the Bearer access token on every route unless marked @Public().
 * Registered as an APP_GUARD so it runs globally. See 03-backend-architecture §3.6.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthenticatedException('Missing bearer token');
    }
    const claims = this.tokenService.verifyAccess(header.slice(7));
    req.user = {
      id: claims.sub,
      email: claims.email,
      roles: claims.roles,
      isAdmin: claims.roles.length > 0,
    };
    return true;
  }
}

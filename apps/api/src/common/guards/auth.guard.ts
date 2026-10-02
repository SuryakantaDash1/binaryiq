import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { AuthStateService } from '../../modules/auth/auth-state.service';
import { TokenService } from '../../modules/auth/token.service';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UnauthenticatedException } from '../exceptions/domain.exception';

/**
 * Verifies the Bearer access token and the principal's live state (active,
 * not erased, token version current) on every route. On @Public() routes a valid
 * token is still attached when present (e.g. so a logged-in member's consent is
 * recorded against their account) but is never required.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly authState: AuthStateService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const header = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null;

    if (isPublic) {
      if (bearer) req.user = (await this.resolve(bearer).catch(() => undefined)) ?? undefined;
      return true;
    }
    if (!bearer) throw new UnauthenticatedException('Missing bearer token');
    req.user = await this.resolve(bearer);
    return true;
  }

  private async resolve(token: string): Promise<AuthenticatedUser> {
    const claims = this.tokenService.verifyAccess(token);
    const state = await this.authState.get(claims.aud, claims.sub);
    if (!state || !state.active || state.tokenVersion !== claims.tv) {
      throw new UnauthenticatedException('Session expired — please sign in again');
    }
    const isAdmin = claims.aud === 'admin';
    return {
      id: claims.sub,
      email: claims.email,
      roles: isAdmin && state.role ? [state.role] : [],
      isAdmin,
      aud: claims.aud,
    };
  }
}

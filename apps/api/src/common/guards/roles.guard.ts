import type { AdminRole } from '@binaryiq/db';
import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ForbiddenException } from '../exceptions/domain.exception';

/**
 * Enforces @Roles(...) on admin routes and keeps the two audiences apart: admin
 * routes need an admin session, every other authenticated route needs a member
 * session. Runs after AuthGuard. Ownership checks live in services.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const required = this.reflector.getAllAndOverride<AdminRole[] | undefined>(ROLES_KEY, targets);
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets);
    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = req.user;

    if (!required || required.length === 0) {
      if (!isPublic && user?.aud === 'admin') {
        throw new ForbiddenException('Admin sessions cannot use member endpoints');
      }
      return true;
    }

    if (user?.aud !== 'admin' || !required.some((r) => user.roles.includes(r))) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}

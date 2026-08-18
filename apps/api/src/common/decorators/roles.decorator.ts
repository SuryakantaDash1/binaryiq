import type { AdminRole } from '@influencer/db';
import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Restricts a route to the given admin roles (used with RolesGuard). */
export const Roles = (...roles: AdminRole[]): CustomDecorator => SetMetadata(ROLES_KEY, roles);

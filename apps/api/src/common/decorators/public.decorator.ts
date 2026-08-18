import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a route as public — bypasses AuthGuard. See 03-backend-architecture §3.6. */
export const Public = (): CustomDecorator => SetMetadata(IS_PUBLIC_KEY, true);

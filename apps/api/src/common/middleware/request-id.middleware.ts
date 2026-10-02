import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Attaches a request id to every request/response for log + envelope correlation. */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const raw = req.headers[REQUEST_ID_HEADER];
    const incoming = Array.isArray(raw) ? raw[0] : raw;
    // Client-supplied ids end up in logs — accept only short, safe values.
    const requestId = incoming && /^[A-Za-z0-9_-]{1,64}$/.test(incoming) ? incoming : `req_${uuidv4()}`;
    (req as Request & { requestId: string }).requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);
    next();
  }
}

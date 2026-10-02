import { Injectable } from '@nestjs/common';

import { UnauthenticatedException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

import type { TokenAudience } from './token.service';

export interface PrincipalState {
  tokenVersion: number;
  active: boolean;
  /** Admin role, read from the DB on every request (never trusted from the token). */
  role: string | null;
}

const CACHE_TTL_SECONDS = 60;
/**
 * A rotated refresh token presented again within this window is treated as a
 * benign race (two tabs refreshing at once) and still honoured.
 */
const REFRESH_REUSE_GRACE_MS = 30_000;

/**
 * Live account state checked on every authenticated request, so blocking,
 * erasing, demoting or logging out takes effect immediately rather than when the
 * JWT happens to expire. Cached briefly in Redis; every mutation evicts the entry.
 * The cache holds only ids/flags — no personal data.
 */
@Injectable()
export class AuthStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async get(aud: TokenAudience, id: string): Promise<PrincipalState | null> {
    const key = this.key(aud, id);
    const cached = await this.redis.instance.get(key);
    if (cached) return JSON.parse(cached) as PrincipalState;

    const state = aud === 'admin' ? await this.loadAdmin(id) : await this.loadMember(id);
    if (state) await this.redis.instance.set(key, JSON.stringify(state), 'EX', CACHE_TTL_SECONDS);
    return state;
  }

  /** Invalidates every outstanding token for the principal. */
  async revoke(aud: TokenAudience, id: string): Promise<void> {
    if (aud === 'admin') {
      await this.prisma.admin.update({ where: { id }, data: { tokenVersion: { increment: 1 } } });
    } else {
      await this.prisma.user.update({ where: { id }, data: { tokenVersion: { increment: 1 } } });
    }
    await this.evict(aud, id);
  }

  /**
   * Marks a refresh token as redeemed. Rotation alone doesn't invalidate the old
   * JWT, so without this a stolen refresh token would keep working until expiry.
   * A replay after the grace window means two parties hold the token — revoke the
   * whole session so both the thief and the owner must sign in again.
   */
  async consumeRefresh(aud: TokenAudience, id: string, jti: string, exp: number): Promise<void> {
    const key = `refresh:used:${jti}`;
    const ttl = Math.max(1, exp - Math.floor(Date.now() / 1000));
    const first = await this.redis.instance.set(key, String(Date.now()), 'EX', ttl, 'NX');
    if (first === 'OK') return;
    const usedAt = Number(await this.redis.instance.get(key));
    if (Number.isFinite(usedAt) && Date.now() - usedAt <= REFRESH_REUSE_GRACE_MS) return;
    await this.revoke(aud, id);
    throw new UnauthenticatedException('Invalid refresh token');
  }

  async evict(aud: TokenAudience, id: string): Promise<void> {
    await this.redis.instance.del(this.key(aud, id));
  }

  private async loadMember(id: string): Promise<PrincipalState | null> {
    const u = await this.prisma.user.findUnique({
      where: { id },
      select: { tokenVersion: true, isActive: true, deletedAt: true },
    });
    return u ? { tokenVersion: u.tokenVersion, active: u.isActive && !u.deletedAt, role: null } : null;
  }

  private async loadAdmin(id: string): Promise<PrincipalState | null> {
    const a = await this.prisma.admin.findUnique({
      where: { id },
      select: { tokenVersion: true, isActive: true, role: true },
    });
    return a ? { tokenVersion: a.tokenVersion, active: a.isActive, role: a.role } : null;
  }

  private key(aud: TokenAudience, id: string): string {
    return `authstate:${aud}:${id}`;
  }
}

import { Prisma } from '@influencer/db';
import type {
  CreateGameInput,
  GameDetail,
  GameListItem,
  PlayHistoryItem,
  SpinResult,
  SpinStatus,
  UpdateSegmentsInput,
} from '@influencer/types';
import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  ConflictException,
  NotFoundException,
  UnprocessableException,
  ValidationException,
} from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { PointsService } from '../points/points.service';

import { RNG_TOKEN, type Rng } from './rng.provider';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function istDateKey(now: Date): Date {
  const istMs = now.getTime() + IST_OFFSET_MS;
  const istDate = new Date(istMs);
  return new Date(Date.UTC(istDate.getUTCFullYear(), istDate.getUTCMonth(), istDate.getUTCDate()));
}

function secondsUntilNextMidnightIST(now: Date): number {
  const istMs = now.getTime() + IST_OFFSET_MS;
  const istDate = new Date(istMs);
  const nextMidnightIST = new Date(Date.UTC(
    istDate.getUTCFullYear(),
    istDate.getUTCMonth(),
    istDate.getUTCDate() + 1,
    0, 0, 0, 0,
  ));
  const nextMidnightUTC = nextMidnightIST.getTime() - IST_OFFSET_MS;
  return Math.max(60, Math.floor((nextMidnightUTC - now.getTime()) / 1000));
}

function nextMidnightISTString(now: Date): string {
  const secs = secondsUntilNextMidnightIST(now);
  return new Date(now.getTime() + secs * 1000).toISOString();
}

export function pickSegment<T extends { probability: { toString(): string } }>(segments: T[], rng: Rng): T {
  const r = rng();
  let acc = 0;
  for (const seg of segments) {
    acc += Number(seg.probability);
    if (r < acc) return seg;
  }
  return segments[segments.length - 1]!;
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

function validateProbabilitySum(segments: { probability: number }[]): void {
  const sum = segments.reduce((acc, s) => acc + s.probability, 0);
  const rounded = Math.round(sum * 10000) / 10000;
  if (rounded !== 1.0) {
    throw new ValidationException('Probabilities must sum to 1.0000', [
      { field: 'segments', issue: `Sum is ${rounded.toFixed(4)}, expected 1.0000` },
    ]);
  }
}

@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly points: PointsService,
    private readonly redis: RedisService,
    @Inject(RNG_TOKEN) private readonly rng: Rng,
  ) {}

  async listGames(userId: string): Promise<GameListItem[]> {
    const now = new Date();
    const playDate = istDateKey(now);
    const games = await this.prisma.game.findMany({ where: { isActive: true } });

    return Promise.all(games.map(async (g) => {
      const lockKey = `spin:daily:${userId}`;
      let playedToday = false;
      const cached = await this.redis.instance.get(lockKey);
      if (cached) {
        playedToday = true;
      } else {
        const play = await this.prisma.gamePlay.findUnique({
          where: { userId_gameId_playDate: { userId, gameId: g.id, playDate } },
        });
        playedToday = !!play;
      }
      const nextSpinAt = playedToday ? nextMidnightISTString(now) : null;
      return {
        id: g.id,
        gameName: g.gameName,
        gameType: g.gameType as GameListItem['gameType'],
        isFree: g.isFree,
        playedToday,
        nextSpinAt,
      };
    }));
  }

  async getGame(userId: string, gameId: string): Promise<GameDetail> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId, isActive: true },
      include: { segments: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!game) throw new NotFoundException('Game not found');

    const now = new Date();
    const playDate = istDateKey(now);
    const lockKey = `spin:daily:${userId}`;
    let playedToday = false;
    const cached = await this.redis.instance.get(lockKey);
    if (cached) {
      playedToday = true;
    } else {
      const play = await this.prisma.gamePlay.findUnique({
        where: { userId_gameId_playDate: { userId, gameId, playDate } },
      });
      playedToday = !!play;
    }

    return {
      id: game.id,
      gameName: game.gameName,
      gameType: game.gameType as GameDetail['gameType'],
      isFree: game.isFree,
      playedToday,
      segments: game.segments.map((s) => ({
        index: s.sortOrder,
        label: s.label,
        pointsValue: s.pointsValue,
        color: s.color,
      })),
    };
  }

  async spinStatus(userId: string): Promise<SpinStatus> {
    const now = new Date();
    const lockKey = `spin:daily:${userId}`;
    const cached = await this.redis.instance.get(lockKey);
    if (cached) {
      const data = JSON.parse(cached) as { segmentIndex: number; pointsWon: number };
      return {
        hasSpunToday: true,
        nextSpinAt: nextMidnightISTString(now),
        lastResult: { segmentIndex: data.segmentIndex, pointsWon: data.pointsWon },
      };
    }
    const playDate = istDateKey(now);
    const game = await this.prisma.game.findFirst({ where: { isActive: true, gameType: 'SPIN_WHEEL' } });
    if (!game) return { hasSpunToday: false, nextSpinAt: null, lastResult: null };

    const play = await this.prisma.gamePlay.findUnique({
      where: { userId_gameId_playDate: { userId, gameId: game.id, playDate } },
      include: { segment: true },
    });
    if (!play) return { hasSpunToday: false, nextSpinAt: null, lastResult: null };

    return {
      hasSpunToday: true,
      nextSpinAt: nextMidnightISTString(now),
      lastResult: { segmentIndex: play.segment.sortOrder, pointsWon: play.pointsWon },
    };
  }

  async spin(userId: string, gameId?: string): Promise<SpinResult> {
    const now = new Date();
    const playDate = istDateKey(now);
    const lockKey = `spin:daily:${userId}`;

    const game = await this.prisma.game.findFirst({
      where: { isActive: true, gameType: 'SPIN_WHEEL', ...(gameId ? { id: gameId } : {}) },
      include: { segments: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!game || game.segments.length === 0) throw new UnprocessableException('no_active_game', []);

    const alreadySpun = await this.redis.instance.exists(lockKey);
    if (alreadySpun) throw new ConflictException('already_spun_today');

    const segment = pickSegment(game.segments, this.rng);
    const istDateStr = playDate.toISOString().slice(0, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      let play;
      try {
        play = await tx.gamePlay.create({
          data: { userId, gameId: game.id, segmentId: segment.id, pointsWon: segment.pointsValue, playDate },
        });
      } catch (e) {
        if (isUniqueViolation(e)) throw new ConflictException('already_spun_today');
        throw e;
      }

      let newBalance: number;
      if (segment.pointsValue > 0) {
        const txn = await this.points.award(tx, {
          userId,
          action: 'GAME_SPIN',
          points: segment.pointsValue,
          refType: 'game',
          refId: game.id,
          idempotencyKey: `spin:${userId}:${istDateStr}`,
          description: 'Daily spin reward',
        });
        newBalance = txn.balanceAfter;
      } else {
        const bal = await tx.pointsBalance.findUnique({ where: { userId } });
        newBalance = bal?.balance ?? 0;
      }

      return { playId: play.id, pointsWon: segment.pointsValue, newBalance, playedAt: play.playedAt };
    });

    const ttl = secondsUntilNextMidnightIST(now);
    await this.redis.instance.set(
      lockKey,
      JSON.stringify({ segmentId: segment.id, segmentIndex: segment.sortOrder, pointsWon: segment.pointsValue }),
      'EX', ttl,
    );

    return {
      ...result,
      segmentIndex: segment.sortOrder,
      segmentId: segment.id,
      playedAt: result.playedAt.toISOString(),
    };
  }

  async history(userId: string, opts: { limit?: number; cursor?: string }): Promise<{ items: PlayHistoryItem[]; nextCursor: string | null }> {
    const limit = Math.min(opts.limit ?? 20, 50);
    const cursorDate = opts.cursor ? new Date(Buffer.from(opts.cursor, 'base64url').toString()) : undefined;

    const plays = await this.prisma.gamePlay.findMany({
      where: {
        userId,
        ...(cursorDate ? { playedAt: { lt: cursorDate } } : {}),
      },
      include: { game: true, segment: true },
      orderBy: { playedAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = plays.length > limit;
    const items = plays.slice(0, limit);
    const nextCursor = hasMore
      ? Buffer.from(items[items.length - 1]!.playedAt.toISOString()).toString('base64url')
      : null;

    return {
      items: items.map((p) => ({
        playId: p.id,
        gameName: p.game.gameName,
        label: p.segment.label,
        pointsWon: p.pointsWon,
        playedAt: p.playedAt.toISOString(),
      })),
      nextCursor,
    };
  }

  async adminList(opts: { page?: number; pageSize?: number }) {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 20;
    const [total, games] = await Promise.all([
      this.prisma.game.count(),
      this.prisma.game.findMany({
        include: { segments: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: games, total, page, pageSize };
  }

  async adminCreate(input: CreateGameInput, adminId: string) {
    validateProbabilitySum(input.segments);
    const game = await this.prisma.$transaction(async (tx) => {
      return tx.game.create({
        data: {
          gameName: input.gameName,
          gameType: input.gameType,
          isFree: input.isFree ?? true,
          segments: {
            create: input.segments.map((s) => ({
              label: s.label,
              pointsValue: s.pointsValue,
              probability: s.probability,
              color: s.color,
              sortOrder: s.sortOrder,
            })),
          },
        },
        include: { segments: { orderBy: { sortOrder: 'asc' } } },
      });
    });
    await this.auditLog(adminId, 'game.create', { gameId: game.id });
    return game;
  }

  async adminUpdateSegments(gameId: string, input: UpdateSegmentsInput, adminId: string) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');
    validateProbabilitySum(input.segments);

    const updated = await this.prisma.$transaction(async (tx) => {
      const referenced = await tx.gamePlay.findMany({
        where: { gameId },
        select: { segmentId: true },
        distinct: ['segmentId'],
      });
      const referencedIds = new Set(referenced.map((r) => r.segmentId));

      await tx.gameSegment.deleteMany({
        where: { gameId, id: { notIn: [...referencedIds] } },
      });

      await tx.gameSegment.createMany({
        data: input.segments.map((s) => ({
          gameId,
          label: s.label,
          pointsValue: s.pointsValue,
          probability: s.probability,
          color: s.color,
          sortOrder: s.sortOrder,
        })),
      });

      return tx.game.findUnique({
        where: { id: gameId },
        include: { segments: { orderBy: { sortOrder: 'asc' } } },
      });
    });

    await this.auditLog(adminId, 'game.segments.update', { gameId });
    return updated;
  }

  private async auditLog(actorId: string | null, action: string, metadata: object) {
    await this.prisma.auditLog.create({
      data: { actorType: 'admin', actorId: actorId ?? undefined, action, targetType: 'game', metadata },
    }).catch((e) => this.logger.error('Audit log failed', e));
  }
}

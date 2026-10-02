import { Prisma } from '@influencer/db';
import type {
  CreatePollInput,
  UpdatePollInput,
  PollResult,
  PollSummary,
  PollDetail,
  PollCount,
} from '@influencer/types';
import { Injectable, Logger } from '@nestjs/common';

import {
  ConflictException,
  NotFoundException,
  UnprocessableException,
  ValidationException,
} from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService } from '../points/points.service';


// Helper to detect Prisma unique violation
function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

@Injectable()
export class PollsService {
  private readonly logger = new Logger(PollsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly points: PointsService,
  ) {}

  // ─── Member read endpoints ────────────────────────────────────
  async listActiveUnvoted(userId: string): Promise<PollSummary[]> {
    const now = new Date();
    const polls = await this.prisma.poll.findMany({
      where: {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        votes: { none: { userId } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return polls.map((p) => this.toPollSummary(p));
  }

  async unvotedCount(userId: string): Promise<PollCount> {
    const now = new Date();
    const activePollWhere = {
      isActive: true as boolean,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };
    const [totalActive, voted] = await Promise.all([
      this.prisma.poll.count({ where: activePollWhere }),
      this.prisma.pollVote.count({ where: { userId, poll: activePollWhere } }),
    ]);
    return { unvotedCount: totalActive - voted, totalActive };
  }

  async getDetail(userId: string, pollId: string): Promise<PollDetail> {
    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!poll) throw new NotFoundException('Poll not found');
    const vote = await this.prisma.pollVote.findUnique({
      where: { pollId_userId: { pollId, userId } },
    });
    return {
      ...this.toPollSummary(poll),
      isActive: poll.isActive,
      hasVoted: !!vote,
      options: poll.options.map((o) => ({
        id: o.id,
        optionText: o.optionText,
        sortOrder: o.sortOrder,
      })),
    };
  }

  async getResults(userId: string, pollId: string): Promise<PollResult> {
    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!poll) throw new NotFoundException('Poll not found');
    const vote = await this.prisma.pollVote.findUnique({
      where: { pollId_userId: { pollId, userId } },
    });
    return this.buildResult(poll, poll.options, vote?.optionIds ?? []);
  }

  // ─── Vote (transactional) ─────────────────────────────────────
  async vote(userId: string, pollId: string, optionIds: string[]): Promise<PollResult> {
    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      include: { options: true },
    });
    if (!poll) throw new NotFoundException('Poll not found');
    if (!poll.isActive || (poll.expiresAt && poll.expiresAt < new Date())) {
      throw new UnprocessableException('poll_closed');
    }

    // Validate optionIds belong to this poll, no duplicates, single-choice constraint
    const pollOptionIds = new Set(poll.options.map((o) => o.id));
    const uniqueOptionIds = [...new Set(optionIds)];
    if (uniqueOptionIds.length !== optionIds.length) {
      throw new ValidationException('Duplicate option ids', [
        { field: 'optionIds', issue: 'Duplicate entries' },
      ]);
    }
    for (const id of optionIds) {
      if (!pollOptionIds.has(id)) {
        throw new ValidationException('Invalid option', [
          { field: 'optionIds', issue: `Option ${id} does not belong to this poll` },
        ]);
      }
    }
    if (poll.pollType === 'SINGLE_CHOICE' && optionIds.length !== 1) {
      throw new ValidationException('Single choice required', [
        { field: 'optionIds', issue: 'Exactly one option required for single-choice polls' },
      ]);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Insert vote — unique constraint catches double-vote
      try {
        await tx.pollVote.create({
          data: { pollId, userId, optionIds, pointsAwarded: poll.pointsReward },
        });
      } catch (e) {
        if (isUniqueViolation(e)) throw new ConflictException('already_voted');
        throw e;
      }

      // Increment totalVotes + each selected option's voteCount
      await tx.poll.update({
        where: { id: pollId },
        data: { totalVotes: { increment: 1 } },
      });
      await tx.pollOption.updateMany({
        where: { id: { in: optionIds } },
        data: { voteCount: { increment: 1 } },
      });

      // Award points via PointsService (same tx)
      await this.points.award(tx, {
        userId,
        action: 'POLL_VOTE',
        points: poll.pointsReward,
        refType: 'poll',
        refId: pollId,
        idempotencyKey: `poll_vote:${pollId}:${userId}`,
        description: 'Poll vote reward',
      });

      // Reload updated poll + options for result
      const updated = await tx.poll.findUnique({
        where: { id: pollId },
        include: { options: { orderBy: { sortOrder: 'asc' } } },
      });
      return { updated: updated!, optionIds };
    });

    return this.buildResult(result.updated, result.updated.options, result.optionIds);
  }

  // ─── Admin CRUD ───────────────────────────────────────────────
  async adminList(opts: { page?: number; pageSize?: number }) {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 20;
    const [total, polls] = await Promise.all([
      this.prisma.poll.count(),
      this.prisma.poll.findMany({
        include: { options: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: polls.map((p) => ({
        ...this.toPollSummary(p),
        isActive: p.isActive,
        options: p.options,
      })),
      total,
      page,
      pageSize,
    };
  }

  async adminGet(pollId: string) {
    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!poll) throw new NotFoundException('Poll not found');
    return { ...this.toPollSummary(poll), isActive: poll.isActive, options: poll.options };
  }

  async create(input: CreatePollInput, ip: string | null = null) {
    if (input.options.length < 2) {
      throw new ValidationException('Need at least 2 options', [
        { field: 'options', issue: 'At least 2 options required' },
      ]);
    }
    const poll = await this.prisma.$transaction(async (tx) => {
      const created = await tx.poll.create({
        data: {
          question: input.question,
          pollType: input.pollType,
          pointsReward: input.pointsReward ?? 15,
          sponsorName: input.sponsorName,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
          options: {
            create: input.options.map((o, i) => ({
              optionText: o.optionText,
              sortOrder: o.sortOrder ?? i,
            })),
          },
        },
        include: { options: { orderBy: { sortOrder: 'asc' } } },
      });
      return created;
    });
    await this.auditLog(null, 'poll.create', { pollId: poll.id }, ip);
    return { ...this.toPollSummary(poll), isActive: poll.isActive, options: poll.options };
  }

  async update(pollId: string, input: UpdatePollInput, adminId: string, ip: string | null = null) {
    const poll = await this.prisma.poll.findUnique({ where: { id: pollId } });
    if (!poll) throw new NotFoundException('Poll not found');

    const updated = await this.prisma.poll.update({
      where: { id: pollId },
      data: {
        ...(input.question !== undefined ? { question: input.question } : {}),
        ...(input.sponsorName !== undefined ? { sponsorName: input.sponsorName } : {}),
        ...(input.expiresAt !== undefined ? { expiresAt: new Date(input.expiresAt) } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });

    const action = input.isActive === false ? 'poll.deactivate' : 'poll.update';
    await this.auditLog(adminId, action, { pollId }, ip);
    return { ...this.toPollSummary(updated), isActive: updated.isActive, options: updated.options };
  }

  // ─── Private helpers ──────────────────────────────────────────
  private toPollSummary(p: {
    id: string;
    question: string;
    pollType: string;
    sponsorName: string | null;
    pointsReward: number;
    totalVotes: number;
    expiresAt: Date | null;
  }): PollSummary {
    return {
      id: p.id,
      question: p.question,
      pollType: p.pollType as PollSummary['pollType'],
      sponsorName: p.sponsorName,
      pointsReward: p.pointsReward,
      totalVotes: p.totalVotes,
      expiresAt: p.expiresAt?.toISOString() ?? null,
    };
  }

  private buildResult(
    poll: { id: string; totalVotes: number; pointsReward: number },
    options: { id: string; optionText: string; voteCount: number }[],
    userOptionIds: string[],
  ): PollResult {
    const total = poll.totalVotes;
    return {
      pollId: poll.id,
      totalVotes: total,
      pointsAwarded: poll.pointsReward,
      userOptionIds,
      options: options.map((o) => ({
        id: o.id,
        optionText: o.optionText,
        voteCount: o.voteCount,
        percentage: total > 0 ? Math.round((o.voteCount / total) * 1000) / 10 : 0,
      })),
    };
  }

  private async auditLog(actorId: string | null, action: string, metadata: object, ip: string | null) {
    await this.prisma.auditLog
      .create({
        data: {
          actorType: 'admin',
          actorId: actorId ?? undefined,
          action,
          targetType: 'poll',
          ipAddress: ip,
          metadata,
        },
      })
      .catch((e) => this.logger.error('Audit log failed', e));
  }
}

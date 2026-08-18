import type { Prisma, PointsAction } from '@influencer/db';
import { Injectable } from '@nestjs/common';

import { UnprocessableException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';

/** A Prisma transaction client — points only ever move inside a caller's tx. */
export type Tx = Prisma.TransactionClient;

export interface MovePointsInput {
  userId: string;
  points: number;
  action: PointsAction;
  description: string;
  refType?: string;
  refId?: string;
  /** Blocks double-credit on retried actions (e.g. `spin:{userId}:{date}`). */
  idempotencyKey?: string;
}

export interface PointsMovementResult {
  transactionId: string;
  balanceAfter: number;
  duplicate: boolean;
}

/**
 * The single gateway for all point movement. Every credit/debit goes through
 * here, inside the caller's `$transaction`, so a domain rollback also rolls back
 * the point movement. No feature writes points_transactions/points_balances
 * directly. See architecture/04-database §5 and 03-backend §4.
 */
@Injectable()
export class PointsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Credit points. Call inside an existing transaction. */
  award(tx: Tx, input: MovePointsInput): Promise<PointsMovementResult> {
    return this.move(tx, 'CREDIT', input);
  }

  /** Debit points. Throws UNPROCESSABLE if the balance would go negative. */
  spend(tx: Tx, input: MovePointsInput): Promise<PointsMovementResult> {
    return this.move(tx, 'DEBIT', input);
  }

  /** Convenience: run a single movement in its own transaction. */
  awardStandalone(input: MovePointsInput): Promise<PointsMovementResult> {
    return this.prisma.$transaction((tx) => this.award(tx, input));
  }

  private async move(
    tx: Tx,
    direction: 'CREDIT' | 'DEBIT',
    input: MovePointsInput,
  ): Promise<PointsMovementResult> {
    if (!Number.isInteger(input.points) || input.points <= 0) {
      throw new UnprocessableException('invalid_points_amount', [
        { field: 'points', issue: 'must be a positive integer' },
      ]);
    }

    // Idempotency short-circuit.
    if (input.idempotencyKey) {
      const existing = await tx.pointsTransaction.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        return { transactionId: existing.id, balanceAfter: existing.balanceAfter, duplicate: true };
      }
    }

    // Locked balance read (upsert creates the row for first-time users).
    const balance = await tx.pointsBalance.upsert({
      where: { userId: input.userId },
      update: {},
      create: { userId: input.userId, balance: 0, lifetimeEarned: 0, lifetimeSpent: 0 },
    });

    const delta = direction === 'CREDIT' ? input.points : -input.points;
    const balanceAfter = balance.balance + delta;
    if (balanceAfter < 0) {
      throw new UnprocessableException('insufficient_points', [
        { field: 'points', issue: 'balance would go negative' },
      ]);
    }

    try {
      const txn = await tx.pointsTransaction.create({
        data: {
          userId: input.userId,
          direction,
          action: input.action,
          points: input.points,
          balanceAfter,
          description: input.description,
          refType: input.refType,
          refId: input.refId,
          idempotencyKey: input.idempotencyKey,
        },
      });

      await tx.pointsBalance.update({
        where: { userId: input.userId },
        data: {
          balance: balanceAfter,
          ...(direction === 'CREDIT'
            ? { lifetimeEarned: { increment: input.points } }
            : { lifetimeSpent: { increment: input.points } }),
        },
      });

      return { transactionId: txn.id, balanceAfter, duplicate: false };
    } catch (err) {
      // Concurrent race on the unique idempotencyKey — return the applied row.
      if (input.idempotencyKey && isUniqueViolation(err)) {
        const applied = await tx.pointsTransaction.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (applied) {
          return { transactionId: applied.id, balanceAfter: applied.balanceAfter, duplicate: true };
        }
      }
      throw err;
    }
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  );
}

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { PointsService, type Tx } from './points.service';

/**
 * Unit tests for the ledger gateway with a faked transaction client.
 * Invariants per architecture/04-database §5.
 */
function makeTx(overrides: Partial<Record<string, unknown>> = {}): {
  tx: Tx;
  created: Array<Record<string, unknown>>;
} {
  const created: Array<Record<string, unknown>> = [];
  const state = { balance: 0, lifetimeEarned: 0, lifetimeSpent: 0 };

  const tx = {
    pointsTransaction: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `txn_${created.length + 1}`, ...data };
        created.push(row);
        return row;
      }),
    },
    pointsBalance: {
      upsert: vi.fn(async () => ({ userId: 'u1', ...state })),
      update: vi.fn(async ({ data }: { data: { balance: number } }) => {
        state.balance = data.balance;
        return state;
      }),
    },
    ...overrides,
  } as unknown as Tx;

  return { tx, created };
}

describe('PointsService', () => {
  let service: PointsService;

  beforeEach(() => {
    service = new PointsService({} as never);
  });

  it('award() writes one CREDIT row and returns the new balance', async () => {
    const { tx, created } = makeTx();
    const res = await service.award(tx, {
      userId: 'u1',
      points: 500,
      action: 'REGISTRATION_BONUS',
      description: 'Welcome bonus',
    });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ direction: 'CREDIT', points: 500, balanceAfter: 500 });
    expect(res.balanceAfter).toBe(500);
    expect(res.duplicate).toBe(false);
  });

  it('spend() throws UNPROCESSABLE when balance would go negative', async () => {
    const { tx } = makeTx();
    await expect(
      service.spend(tx, { userId: 'u1', points: 100, action: 'REDEMPTION', description: 'x' }),
    ).rejects.toThrow(/insufficient_points/);
  });

  it('throws UNPROCESSABLE when points <= 0', async () => {
    const { tx } = makeTx();
    await expect(
      service.award(tx, { userId: 'u1', points: 0, action: 'ADJUSTMENT', description: 'x' }),
    ).rejects.toThrow(/invalid_points_amount/);
  });

  it('is idempotent: existing idempotencyKey returns the row without a new credit', async () => {
    const { tx, created } = makeTx({
      pointsTransaction: {
        findUnique: vi.fn(async () => ({ id: 'txn_existing', balanceAfter: 500 })),
        create: vi.fn(),
      },
    });
    const res = await service.award(tx, {
      userId: 'u1',
      points: 500,
      action: 'REGISTRATION_BONUS',
      description: 'Welcome',
      idempotencyKey: 'registration_bonus:u1',
    });
    expect(res.duplicate).toBe(true);
    expect(res.transactionId).toBe('txn_existing');
    expect(created).toHaveLength(0);
  });
});

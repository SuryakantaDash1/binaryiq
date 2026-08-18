# 03 — Backend Architecture ⭐

The blueprint for `apps/api` — the NestJS 10 service that powers the Influencer Platform. This doc
owns **how the backend is structured and wired**: modules, layering, cross-cutting concerns, the
shared points ledger, configuration, background jobs, provider abstractions, error mapping, health,
and testing seams.

It sits beside its siblings and does not duplicate them:

- Data model & ledger rules → [04-database-architecture.md](04-database-architecture.md)
  (Prisma schema is authoritative there; ledger invariants in [§5](04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6)).
- HTTP contract (envelope, error codes, auth, pagination) → [05-api-conventions.md](05-api-conventions.md).
- Product scope & module map → [../00-project-overview.md](../00-project-overview.md).
- Build sequence & phase dependencies → [../phases/00-roadmap.md](../phases/00-roadmap.md).
- Encryption, secrets, PII handling → [07-security-compliance.md](07-security-compliance.md).
- Test targets & tooling → [08-testing-strategy.md](08-testing-strategy.md).
- Deploy, env promotion, observability → [09-devops-cicd.md](09-devops-cicd.md).

**Stack (confirmed):** NestJS 10 + TypeScript · Prisma 5 + PostgreSQL 15 · Redis · BullMQ ·
JWT RS256 · Zod validation via `packages/types`.

---

## 1. Module structure

The API is organized as **one feature module per product domain**, plus a set of **shared
infrastructure modules** that feature modules import. Feature modules never talk to each other's
internals — they collaborate through exported providers (e.g. everyone injects `PointsService`,
nobody re-implements point movement).

### 1.1 Design rules

- **One domain = one module** (`AuthModule`, `AccountModule`, `PointsModule`, …). A module owns its
  controllers, services, DTO wiring, and domain exceptions.
- **Shared/infra modules** (`PrismaModule`, `RedisModule`, `QueueModule`, `ConfigModule`,
  `HealthModule`) are marked `@Global()` where universally needed (Prisma, Config, Redis) so they
  don't have to be re-imported everywhere.
- **`PointsModule` is shared, not owned by any one feature.** It exports `PointsService`; Auth,
  Account, Surveys, Polls, Games, and Admin all import `PointsModule` to credit/debit points.
- **Providers (external SDKs) live behind `ProvidersModule`** (`@Global()`), exposing interface
  tokens (`EMAIL_PROVIDER`, `SMS_PROVIDER`, …) so concrete SDKs are swappable and mockable ([§7](#7-external-provider-abstraction)).
- **Admin surface is a sibling module** (`AdminModule`) that composes admin-only controllers over the
  same domain services; it does not fork business logic.

### 1.2 `apps/api/src` folder tree

```text
apps/api/
├── src/
│   ├── main.ts                       # bootstrap: pipes, filters, interceptors, shutdown hooks
│   ├── app.module.ts                 # root module: imports all feature + shared modules
│   │
│   ├── common/                       # cross-cutting building blocks (no domain logic)
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts     # @CurrentUser() → authenticated principal
│   │   │   ├── roles.decorator.ts            # @Roles(AdminRole.ADMIN, ...)
│   │   │   └── public.decorator.ts           # @Public() to bypass AuthGuard
│   │   ├── guards/
│   │   │   ├── auth.guard.ts                 # verifies RS256 JWT, attaches principal
│   │   │   ├── roles.guard.ts                # checks @Roles against principal
│   │   │   └── admin.guard.ts                # admin JWT audience + active check
│   │   ├── interceptors/
│   │   │   ├── response.interceptor.ts       # wraps returns in the success envelope
│   │   │   └── logging.interceptor.ts        # per-request timing + outcome (pino)
│   │   ├── filters/
│   │   │   └── all-exceptions.filter.ts      # maps everything → canonical error envelope
│   │   ├── middleware/
│   │   │   └── request-id.middleware.ts      # assigns/propagates x-request-id
│   │   ├── pipes/
│   │   │   └── zod-validation.pipe.ts        # validates DTOs against packages/types schemas
│   │   ├── exceptions/
│   │   │   └── domain.exception.ts           # DomainException + typed subclasses (§8)
│   │   └── types/
│   │       └── authenticated-user.ts         # principal shape injected by AuthGuard
│   │
│   ├── config/                       # ConfigModule + Zod env schema (§5)
│   │   ├── config.module.ts
│   │   ├── env.schema.ts                      # Zod schema validated at boot
│   │   └── configuration.ts                   # typed config factory (namespaced)
│   │
│   ├── prisma/                       # PrismaModule (@Global)
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts                  # PrismaClient + onModuleInit/onModuleDestroy
│   │
│   ├── redis/                        # RedisModule (@Global) — ioredis client + helpers
│   │   ├── redis.module.ts
│   │   └── redis.service.ts
│   │
│   ├── queue/                        # QueueModule — BullMQ registration + shared queues (§6)
│   │   ├── queue.module.ts
│   │   ├── queue.constants.ts                 # queue names, job names
│   │   └── scheduler.service.ts               # @Cron jobs (ScheduleModule) → enqueue
│   │
│   ├── providers/                    # External provider abstraction (@Global) (§7)
│   │   ├── providers.module.ts
│   │   ├── email/
│   │   │   ├── email-provider.interface.ts
│   │   │   ├── sendgrid.provider.ts
│   │   │   └── noop-email.provider.ts         # local/dev + test double
│   │   ├── sms/
│   │   │   ├── sms-provider.interface.ts
│   │   │   └── twilio.provider.ts
│   │   ├── push/
│   │   │   ├── push-provider.interface.ts
│   │   │   └── fcm.provider.ts
│   │   └── payment/
│   │       ├── payment-provider.interface.ts
│   │       └── paypal.provider.ts
│   │
│   ├── health/                       # HealthModule — liveness/readiness (§9)
│   │   ├── health.module.ts
│   │   └── health.controller.ts
│   │
│   ├── webhooks/                     # provider callbacks (SendGrid/Twilio/PayPal) — see 05-api §11
│   │   ├── webhooks.module.ts
│   │   └── webhooks.controller.ts
│   │
│   └── modules/                      # ── FEATURE MODULES (one per domain) ──
│       ├── auth/
│       │   ├── auth.module.ts
│       │   ├── auth.controller.ts
│       │   ├── auth.service.ts
│       │   ├── token.service.ts               # RS256 sign/verify, refresh rotation
│       │   └── strategies/                    # (if passport) jwt strategy
│       ├── account/                           # profile, email, password, paypal, About You
│       │   ├── account.module.ts
│       │   ├── account.controller.ts
│       │   ├── profile-survey.controller.ts
│       │   ├── account.service.ts
│       │   └── profile-survey.service.ts
│       ├── points/                            # SHARED ledger + rewards/redemptions (§4)
│       │   ├── points.module.ts
│       │   ├── points.controller.ts           # /points/*  (history, balance)
│       │   ├── rewards.controller.ts          # /rewards/*, /redemptions/*
│       │   ├── points.service.ts              # award()/spend() — THE ledger service
│       │   ├── rewards.service.ts
│       │   └── redemption.service.ts
│       ├── surveys/
│       │   ├── surveys.module.ts
│       │   ├── surveys.controller.ts
│       │   ├── surveys.service.ts
│       │   └── matching.service.ts            # profile-based targeting
│       ├── polls/
│       │   ├── polls.module.ts
│       │   ├── polls.controller.ts
│       │   └── polls.service.ts
│       ├── games/
│       │   ├── games.module.ts
│       │   ├── games.controller.ts
│       │   └── games.service.ts               # weighted spin + Redis daily lock
│       ├── notifications/
│       │   ├── notifications.module.ts
│       │   ├── notifications.controller.ts    # /notifications, /notification-preferences
│       │   ├── notifications.service.ts       # enqueues; respects preferences
│       │   └── notification.processor.ts      # BullMQ worker → providers (§6)
│       ├── support/                           # tickets + chatbot (Luna)
│       │   ├── support.module.ts
│       │   ├── support.controller.ts
│       │   ├── chatbot.controller.ts
│       │   └── support.service.ts
│       └── admin/
│           ├── admin.module.ts
│           ├── admin.controller.ts            # /admin/* composes domain services
│           └── admin.service.ts
├── test/                             # e2e specs (Jest + Supertest) — see 08-testing-strategy
├── prisma/                           # -> re-exports packages/db client (schema is in packages/db)
├── nest-cli.json
├── tsconfig.json
└── package.json
```

> The Prisma **schema** lives in `packages/db/prisma/schema.prisma` (single source of truth, see
> [04-database §1](04-database-architecture.md#1-principles)). `apps/api` consumes the generated
> client; `PrismaService` extends `PrismaClient` from that package.

---

## 2. Layering

Three strict layers, one direction of dependency:

```text
HTTP  ──▶  Controller  ──▶  Service  ──▶  Prisma / Redis / Providers
(DTO in)   (thin)          (business     (data + side effects)
                            logic, owns
                            transactions)
```

### 2.1 Layer responsibilities

| Layer | Owns | Must NOT |
|---|---|---|
| **Controller** | Routing, auth/role decorators, DTO in/out shape, HTTP status. Delegates to exactly one service call where possible. | Contain business rules, touch Prisma/Redis, build the response envelope, or do ownership checks. |
| **Service** | Business logic, validation of invariants, **transaction boundaries** (`prisma.$transaction`), ownership checks, orchestration of providers/queues, domain exceptions. | Know about HTTP (no `Request`/`Response`, no status codes). |
| **Data (Prisma/Redis/Providers)** | Persistence and external I/O. | Contain domain decisions. |

### 2.2 Rules (non-negotiable)

1. **Controllers are thin.** A controller method reads the DTO + `@CurrentUser()`, calls a service,
   returns the DTO. No `if` business logic.
2. **No Prisma in controllers.** `PrismaService` is injected only into services.
3. **Services own transactions.** Any multi-write operation (esp. anything touching points) runs
   inside a single `prisma.$transaction(...)`. See [§4](#4-pointsservice--the-shared-ledger) and
   [04-database §5](04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6).
4. **Ownership checks live in services**, not controllers or guards. A guard proves *who you are*; the
   service proves *this row is yours* ([05-api §7](05-api-conventions.md#7-auth--authorization-patterns)).
5. **Controllers return plain DTOs.** The global interceptor wraps them in the envelope
   ([05-api §2](05-api-conventions.md#2-response-envelope-always)).

### 2.3 Canonical controller + service

```ts
// polls.controller.ts — thin: auth, DTO, delegate, return
@Controller('polls')
export class PollsController {
  constructor(private readonly polls: PollsService) {}

  @Post(':id/vote')
  @HttpCode(200)
  vote(
    @Param('id', ParseUUIDPipe) pollId: string,
    @Body() dto: VoteInput,                 // validated by global ZodValidationPipe
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PollResult> {
    return this.polls.vote(user.id, pollId, dto.optionIds);
  }
}
```

```ts
// polls.service.ts — business logic + ownership + one transaction (points via PointsService)
@Injectable()
export class PollsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly points: PointsService,
  ) {}

  async vote(userId: string, pollId: string, optionIds: string[]): Promise<PollResult> {
    const poll = await this.prisma.poll.findUnique({ where: { id: pollId }, include: { options: true } });
    if (!poll) throw new NotFoundException('poll');                    // → 404 NOT_FOUND
    if (!poll.isActive || (poll.expiresAt && poll.expiresAt < new Date()))
      throw new UnprocessableException('poll_closed');                 // → 422 UNPROCESSABLE
    this.assertValidOptions(poll, optionIds);

    return this.prisma.$transaction(async (tx) => {
      // one vote per poll per user (DB unique @@unique([pollId, userId]))
      try {
        await tx.pollVote.create({
          data: { pollId, userId, optionIds, pointsAwarded: poll.pointsReward },
        });
      } catch (e) {
        if (isUniqueViolation(e)) throw new ConflictException('already_voted'); // → 409 CONFLICT
        throw e;
      }
      await this.incrementCounters(tx, pollId, optionIds);
      // EVERY point movement goes through PointsService, in the SAME tx:
      await this.points.award(tx, {
        userId, action: 'POLL_VOTE', points: poll.pointsReward,
        refType: 'poll', refId: pollId,
        idempotencyKey: `poll_vote:${pollId}:${userId}`,
        description: 'Poll vote reward',
      });
      return this.buildResult(tx, pollId, userId);
    });
  }
}
```

---

## 3. Cross-cutting concerns

All of these are wired **once** in `main.ts` / `AppModule` and apply globally, so feature code stays
clean. Order matters: middleware → guards → pipes → (handler) → interceptors → filter.

### 3.1 Global wiring (`main.ts`)

```ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));                      // nestjs-pino
  app.setGlobalPrefix('v1');                            // /v1/... (05-api §1)

  app.use(requestIdMiddleware);                         // x-request-id (3.4)
  app.useGlobalPipes(new ZodValidationPipe());         // 3.2
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ResponseInterceptor(),                          // envelope (3.3)
  );
  app.useGlobalFilters(new AllExceptionsFilter());     // error envelope (3.3, §8)

  app.enableShutdownHooks();                            // graceful shutdown (§9)
  await app.listen(config.port);
}
```

`AuthGuard` and `RolesGuard` are registered as `APP_GUARD` providers in `AppModule` so they run on
every route (opt out with `@Public()`):

```ts
providers: [
  { provide: APP_GUARD, useClass: AuthGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
],
```

### 3.2 Global `ZodValidationPipe`

DTOs are **Zod schemas from `packages/types`** — the same schemas the frontend uses, so there is no
drift ([05-api §5](05-api-conventions.md#5-validation)). The pipe resolves the schema bound to the
DTO metadata, parses (stripping unknown fields by default), and on failure throws a
`ValidationException` carrying the flattened Zod issues → mapped to `400 VALIDATION_ERROR` with
`details[]`.

```ts
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, meta: ArgumentMetadata) {
    const schema = getSchemaFor(meta.metatype);       // DTO ↔ Zod schema registry
    if (!schema) return value;
    const result = schema.safeParse(value);
    if (!result.success) {
      throw new ValidationException(
        result.error.issues.map((i) => ({ field: i.path.join('.'), issue: i.code })),
      );
    }
    return result.data;                                // services receive parsed, typed input
  }
}
```

### 3.3 Response interceptor + exception filter (the envelope)

The interceptor wraps every successful return in the success envelope; the filter formats every
error into the same envelope. Controllers never build it themselves
([05-api §2](05-api-conventions.md#2-response-envelope-always)).

```ts
// response.interceptor.ts
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T> {
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx.switchToHttp().getRequest();
    return next.handle().pipe(
      map((data) => ({
        data: data ?? null,
        error: null,
        meta: { requestId: req.id, timestamp: new Date().toISOString() },
      })),
    );
  }
}
```

The `AllExceptionsFilter` catches `DomainException`, Nest `HttpException`, Prisma known errors, and
unknowns, and emits `{ data: null, error: { code, message, details }, meta }` with the right HTTP
status. Full mapping table in [§8](#8-error-handling--domain-exceptions).

### 3.4 Request-id middleware

Assigns `x-request-id` (honoring an inbound one from the edge/gateway, else generating `req_<uuid>`),
stores it on the request and in the pino log context, and echoes it in `meta.requestId`. This is the
single correlation key across logs, audit entries, and error responses
([05-api §12](05-api-conventions.md#12-observability)).

### 3.5 Logging (pino)

Structured JSON logs via `nestjs-pino`. Each log line carries `requestId`, `userId` (when
authenticated), method, path, status, and duration. **PII is never logged** (encrypted columns and
tokens are redacted via pino `redact` paths). The `LoggingInterceptor` emits the per-request
start/finish line; providers and queue processors log with the same correlation id passed through
job data.

### 3.6 Auth: `AuthGuard`, `RolesGuard`, `@CurrentUser`

- **`AuthGuard`** — verifies the `Authorization: Bearer` **RS256** JWT against the public key,
  rejects expired/invalid tokens with `401 UNAUTHENTICATED`, and attaches an `AuthenticatedUser`
  principal to the request. Skipped on `@Public()` routes (registration, login, verify-email,
  forgot/reset password).
- **`RolesGuard`** — reads `@Roles(...)` metadata and checks the principal's role; failure →
  `403 FORBIDDEN`. `AdminGuard` is the admin-audience variant guarding `/admin/*`.
- **`@CurrentUser()`** — parameter decorator returning the principal, so controllers never parse the
  token themselves.

```ts
export const CurrentUser = createParamDecorator(
  (_data, ctx: ExecutionContext): AuthenticatedUser =>
    ctx.switchToHttp().getRequest().user,
);
```

### 3.7 Ownership checks

Authorization has two halves and they live in different places:

- **Authentication / role** → guards (who you are).
- **Ownership** (this poll vote / redemption / ticket belongs to *this* user) → **the service**, by
  scoping every query with `userId` and throwing `NotFoundException`/`ForbiddenException` when the
  row isn't the caller's. This keeps guards generic and prevents IDOR
  ([05-api §7](05-api-conventions.md#7-auth--authorization-patterns)).

---

## 4. `PointsService` — the shared ledger

`PointsService` is the **single gateway for every point movement** on the platform. Registration
bonus, profile-survey rewards, survey/poll/game credits, and redemption debits all call it — no
feature ever writes `points_transactions` or `points_balances` directly. This is what makes the
ledger auditable and the balance trustworthy.

It implements the invariants from
[04-database §5](04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6):

1. Exactly **one** `points_transactions` row per action, inside the **same** `$transaction` as the
   domain write (roll back together).
2. `points` stored positive; `direction` carries the sign.
3. `balanceAfter` computed inside the transaction (locked read → apply → snapshot).
4. `points_balances` cache updated in the same transaction (O(1) reads).
5. **Idempotency** via `idempotencyKey` unique constraint (retries can't double-credit).
6. Ledger rows are never updated/deleted — corrections are new `ADJUSTMENT` rows.

### 4.1 Transaction-aware API

Both methods accept a Prisma **transaction client** (`tx`) so the caller composes the point movement
into its own domain transaction. There is a convenience overload that opens its own transaction for
standalone credits (e.g. an admin adjustment).

```ts
type PrismaTx = Prisma.TransactionClient;

interface AwardInput {
  userId: string;
  action: PointsAction;                 // 'POLL_VOTE' | 'SURVEY_COMPLETION' | ...
  points: number;                       // positive whole points
  description: string;
  refType?: string;                     // 'poll' | 'survey' | 'game' | 'reward' ...
  refId?: string;
  idempotencyKey?: string;              // e.g. `spin:${userId}:${date}`
}

@Injectable()
export class PointsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Credit points. Pass `tx` to join the caller's transaction (required for domain writes). */
  async award(tx: PrismaTx, input: AwardInput): Promise<PointsTransaction> {
    return this.move(tx, 'CREDIT', input);
  }

  /** Debit points (redemptions). Enforces sufficient balance → 422 UNPROCESSABLE. */
  async spend(tx: PrismaTx, input: AwardInput): Promise<PointsTransaction> {
    return this.move(tx, 'DEBIT', input);
  }

  private async move(tx: PrismaTx, direction: PointsDirection, input: AwardInput) {
    const { userId, action, points, description, refType, refId, idempotencyKey } = input;
    if (points <= 0) throw new UnprocessableException('invalid_points_amount');

    // Idempotency short-circuit: if this key already applied, return the existing row.
    if (idempotencyKey) {
      const existing = await tx.pointsTransaction.findUnique({ where: { idempotencyKey } });
      if (existing) return existing;
    }

    // Locked read of the cached balance (row-level lock via upsert/serializable tx).
    const bal = await tx.pointsBalance.upsert({
      where: { userId },
      create: { userId, balance: 0, lifetimeEarned: 0, lifetimeSpent: 0 },
      update: {},
    });

    const delta = direction === 'CREDIT' ? points : -points;
    const balanceAfter = bal.balance + delta;
    if (balanceAfter < 0) throw new UnprocessableException('insufficient_points'); // 422

    let txn: PointsTransaction;
    try {
      txn = await tx.pointsTransaction.create({
        data: {
          userId, direction, action, points, balanceAfter,
          description, refType, refId, idempotencyKey,
        },
      });
    } catch (e) {
      // Concurrent retry raced us on the unique idempotencyKey → treat as already applied.
      if (isUniqueViolation(e) && idempotencyKey) {
        return tx.pointsTransaction.findUniqueOrThrow({ where: { idempotencyKey } });
      }
      throw e;
    }

    await tx.pointsBalance.update({
      where: { userId },
      data: {
        balance: balanceAfter,
        ...(direction === 'CREDIT'
          ? { lifetimeEarned: { increment: points } }
          : { lifetimeSpent: { increment: points } }),
      },
    });

    return txn;
  }
}
```

### 4.2 Usage contract

- **Credits:** callers pass a stable `idempotencyKey` for anything retryable
  (`poll_vote:{pollId}:{userId}`, `spin:{userId}:{date}`, `survey:{surveyId}:{userId}`).
- **Debits (redemptions):** `RedemptionService` calls `spend()` and creates the `reward_redemptions`
  row in the same transaction; insufficient balance → `422 UNPROCESSABLE`.
- **Reconciliation:** a nightly job recomputes each balance from the ledger and alerts on drift
  ([§6](#6-background-jobs--queues)).

> Because `move()` requires a `tx`, it is structurally impossible to credit points outside a
> transaction — the compiler and the API shape enforce ledger invariant #1.

---

## 5. Configuration

Configuration uses `@nestjs/config` with a **Zod schema validated at boot** — the process refuses to
start if any required env var is missing or malformed. Config is exposed as a typed, namespaced
object; no code reads `process.env` directly.

### 5.1 Boot-time validation

```ts
// config/env.schema.ts
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']),
  PORT: z.coerce.number().default(3000),

  // Database (pooled for app, direct for migrations — 04-database §7)
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  DB_POOL_MAX: z.coerce.number().default(10),

  // Redis / BullMQ
  REDIS_URL: z.string().url(),

  // Auth (RS256 keypair — PEM, base64-encoded in env)
  JWT_PRIVATE_KEY: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  // App-layer PII encryption (07-security-compliance)
  ENCRYPTION_KEY: z.string().length(64),      // 32-byte key, hex

  // Points economics (single monetary constant — 00-overview §1)
  POINTS_PER_INR: z.coerce.number().default(100),
  POINTS_EXPIRY_DAYS: z.coerce.number().optional(), // policy flag, off by default

  // Providers (§7)
  SENDGRID_API_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  FCM_SERVICE_ACCOUNT: z.string().optional(),   // JSON, base64
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_ENV: z.enum(['sandbox', 'live']).default('sandbox'),
});

export type Env = z.infer<typeof envSchema>;
```

```ts
// config/config.module.ts
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validate: (raw) => {
        const parsed = envSchema.safeParse(raw);
        if (!parsed.success) {
          throw new Error(`Invalid environment:\n${parsed.error}`);
        }
        return parsed.data;
      },
      load: [configuration],   // groups into config.database, config.jwt, config.providers ...
    }),
  ],
})
export class ConfigModule {}
```

- **Secrets** (keys, provider credentials) come from the platform secret store, never committed.
  See [07-security-compliance.md](07-security-compliance.md).
- **Typed access:** `config.get('jwt.accessTtl', { infer: true })` — no stringly-typed lookups.
- The **monetary constant** (`POINTS_PER_INR = 100`) lives here and nowhere else
  ([00-overview §1](../00-project-overview.md)).

---

## 6. Background jobs & queues

Two mechanisms, clear separation of concerns:

- **BullMQ (Redis-backed) queues + workers** for *fan-out / retryable I/O* — anything that talks to
  an external provider or must survive a crash and retry (notification sends, PayPal payout polling).
- **`@Cron` via `@nestjs/schedule` (`ScheduleModule`)** for *time-triggered* work. Cron handlers stay
  thin: they **enqueue a BullMQ job** (so the actual work is retryable and observable), rather than
  doing heavy work inside the scheduler tick.

Workers run in the same deployable in early phases and can be split into a dedicated worker process
later without code changes (they are plain Nest providers). See
[09-devops-cicd.md](09-devops-cicd.md).

### 6.1 Queues & processors

| Queue | Producer | Processor does | Retry policy |
|---|---|---|---|
| `notifications` | `NotificationsService` (on domain events) | resolve user preference → dispatch via Email/SMS/Push/WhatsApp provider → update `notifications.status` | exponential backoff, 5 attempts, dead-letter on exhaust |
| `payouts` | `RedemptionService` (on PayPal redemption) | call `PaymentProvider.createPayout`, poll status, update `reward_redemptions.status` + `fulfillment_ref` | backoff; idempotent by redemption id |
| `reconciliation` | `SchedulerService` (nightly cron) | recompute each user balance from ledger, alert on drift | single attempt, alert on failure |
| `maintenance` | `SchedulerService` (crons) | token cleanup, spin-lock reset housekeeping | single attempt |

```ts
// notifications/notification.processor.ts
@Processor(QUEUES.NOTIFICATIONS)
export class NotificationProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    @Inject(SMS_PROVIDER)   private readonly sms: SmsProvider,
    @Inject(PUSH_PROVIDER)  private readonly push: PushProvider,
  ) { super(); }

  async process(job: Job<SendNotificationJob>): Promise<void> {
    const { notificationId, channel } = job.data;
    const n = await this.prisma.notification.findUniqueOrThrow({ where: { id: notificationId } });
    try {
      await this.dispatch(channel, n);                                  // provider call
      await this.prisma.notification.update({
        where: { id: n.id }, data: { status: 'SENT', sentAt: new Date() },
      });
    } catch (err) {
      // Let BullMQ retry; only mark FAILED once attempts are exhausted.
      if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
        await this.prisma.notification.update({ where: { id: n.id }, data: { status: 'FAILED' } });
      }
      throw err;
    }
  }
}
```

### 6.2 Scheduled jobs (`@Cron`)

```ts
// queue/scheduler.service.ts
@Injectable()
export class SchedulerService {
  constructor(
    @InjectQueue(QUEUES.RECONCILIATION) private readonly reconQ: Queue,
    @InjectQueue(QUEUES.MAINTENANCE)    private readonly maintQ: Queue,
    private readonly prisma: PrismaService,
  ) {}

  // Nightly ledger reconciliation (04-database §5, invariant 7)
  @Cron('0 2 * * *', { timeZone: 'Asia/Kolkata' })
  enqueueReconciliation() { return this.reconQ.add('reconcile-balances', {}); }

  // Expired auth-token cleanup (email verification / password reset)
  @Cron('0 3 * * *', { timeZone: 'Asia/Kolkata' })
  enqueueTokenCleanup() { return this.maintQ.add('purge-expired-tokens', {}); }
}
```

### 6.3 Daily spin reset — Redis TTL, not a cron

The daily Spin-the-Wheel lock is **not** reset by a job. It is a Redis key
`spin:daily:{userId}` set with a TTL to the user's next local midnight
([04-database §6](04-database-architecture.md#6-redis-usage-not-postgres-but-part-of-the-data-layer)).
The key expires itself — no scheduled reset, no clock skew window. The
`game_plays` unique constraint `@@unique([userId, gameId, playDate])` is the durable backstop if
Redis is unavailable. The nightly `maintenance` queue only does opportunistic housekeeping, never
correctness-critical resets.

---

## 7. External provider abstraction

Every third-party dependency (SendGrid, Twilio, FCM, PayPal) sits **behind an interface** and is
injected via a token. Concrete SDK code lives in one file per provider; the rest of the app depends
only on the interface. This makes providers **swappable** (change the binding, not the callers) and
**mockable** (inject a fake in tests) — a launch risk called out in
[../phases/00-roadmap.md](../phases/00-roadmap.md#risk-notes).

### 7.1 Interfaces

```ts
// providers/email/email-provider.interface.ts
export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
export interface EmailProvider {
  send(msg: { to: string; templateId: string; data: Record<string, unknown> }): Promise<{ providerMessageId: string }>;
}

// providers/sms/sms-provider.interface.ts
export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
export interface SmsProvider {
  send(msg: { to: string; body: string }): Promise<{ providerMessageId: string }>;
}

// providers/push/push-provider.interface.ts
export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');
export interface PushProvider {
  send(msg: { tokens: string[]; title: string; body: string; data?: Record<string, string> }): Promise<void>;
}

// providers/payment/payment-provider.interface.ts
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
export interface PaymentProvider {
  createPayout(p: { email: string; amountInr: number; idempotencyKey: string }): Promise<{ payoutId: string; status: string }>;
  getPayout(payoutId: string): Promise<{ status: string }>;
}
```

### 7.2 Binding (swap by env)

```ts
// providers/providers.module.ts
@Global()
@Module({
  providers: [
    {
      provide: EMAIL_PROVIDER,
      useClass: process.env.NODE_ENV === 'production' ? SendGridProvider : NoopEmailProvider,
    },
    { provide: SMS_PROVIDER,     useClass: TwilioProvider },
    { provide: PUSH_PROVIDER,    useClass: FcmProvider },
    { provide: PAYMENT_PROVIDER, useClass: PaypalProvider },
  ],
  exports: [EMAIL_PROVIDER, SMS_PROVIDER, PUSH_PROVIDER, PAYMENT_PROVIDER],
})
export class ProvidersModule {}
```

Provider callbacks (delivery status, payout status) arrive via `/v1/webhooks/{provider}`,
signature-verified and processed idempotently
([05-api §11](05-api-conventions.md#11-webhooks--external-callbacks)).

---

## 8. Error handling & domain exceptions

Services throw **typed domain exceptions**; the global `AllExceptionsFilter` maps them to the
**canonical error codes** in [05-api §4](05-api-conventions.md#4-canonical-error-codes). Domain
nuance is expressed via `message` + `details`, never new top-level codes — clients switch on a small
stable set.

### 8.1 Domain exception base

```ts
// common/exceptions/domain.exception.ts
export abstract class DomainException extends Error {
  abstract readonly code: ErrorCode;     // canonical code (05-api §4)
  abstract readonly status: number;
  readonly details?: unknown[];
  constructor(message: string, details?: unknown[]) { super(message); this.details = details; }
}

export class ValidationException extends DomainException {
  readonly code = 'VALIDATION_ERROR'; readonly status = 400;
}
export class ConflictException extends DomainException {
  readonly code = 'CONFLICT'; readonly status = 409;         // already voted / already spun / email taken
}
export class UnprocessableException extends DomainException {
  readonly code = 'UNPROCESSABLE'; readonly status = 422;    // insufficient points / survey full
}
// NotFoundException (404), ForbiddenException (403), UnauthenticatedException (401) likewise.
```

### 8.2 Mapping table

| Thrown | HTTP | `error.code` | Typical trigger |
|---|---|---|---|
| `ValidationException` / Zod pipe failure | 400 | `VALIDATION_ERROR` | bad DTO; `details[]` lists fields |
| `UnauthenticatedException` / `AuthGuard` reject | 401 | `UNAUTHENTICATED` | missing/expired JWT |
| `ForbiddenException` / `RolesGuard` reject | 403 | `FORBIDDEN` | role or ownership check failed |
| `NotFoundException` | 404 | `NOT_FOUND` | unknown id / not caller's row |
| `ConflictException` | 409 | `CONFLICT` | duplicate vote, already spun, email exists |
| `UnprocessableException` | 422 | `UNPROCESSABLE` | insufficient balance, survey full/expired |
| (rate limiter) | 429 | `RATE_LIMITED` | throttle exceeded; adds `Retry-After` |
| Prisma `P2002` (unique) | 409 | `CONFLICT` | translated at the filter as a safety net |
| Prisma `P2025` (not found) | 404 | `NOT_FOUND` | translated at the filter |
| any other `Error` | 500 | `INTERNAL_ERROR` | logged with `requestId`; **never leaks internals** |

### 8.3 Filter sketch

```ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(err: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const req = host.switchToHttp().getRequest();
    const { status, code, message, details } = normalize(err);   // domain/http/prisma/unknown
    if (status >= 500) this.logger.error({ err, requestId: req.id });
    res.status(status).json({
      data: null,
      error: { code, message: status >= 500 ? 'Internal server error' : message, details },
      meta: { requestId: req.id, timestamp: new Date().toISOString() },
    });
  }
}
```

---

## 9. Health checks, graceful shutdown, DB pooling

### 9.1 Health checks

`HealthModule` (via `@nestjs/terminus`) exposes:

- **`GET /v1/health/live`** — liveness: process is up. No dependency checks (used by the orchestrator
  to decide restart).
- **`GET /v1/health/ready`** — readiness: pings Postgres (`SELECT 1`), Redis (`PING`), and BullMQ
  connectivity. Returns unhealthy (503) if any dependency is down, so traffic isn't routed to a pod
  that can't serve. Both are `@Public()`.

### 9.2 Graceful shutdown

`app.enableShutdownHooks()` is on. On `SIGTERM`:

1. Stop accepting new HTTP connections; drain in-flight requests.
2. BullMQ workers stop pulling new jobs and finish the current one.
3. `PrismaService.onModuleDestroy()` calls `$disconnect()`; the Redis client quits cleanly.

This prevents half-applied ledger transactions during a deploy roll.

```ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit()  { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
```

### 9.3 DB connection pooling

- The app uses `DATABASE_URL` pointed at the **pooled** connection (PgBouncer), `DIRECT_URL` for
  migrations only ([04-database §7](04-database-architecture.md#7-migrations--seeding)).
- Pool size (`DB_POOL_MAX`) is bounded per instance so total connections across replicas stay under
  Postgres limits. With PgBouncer in transaction mode, Prisma runs with `pgbouncer=true` and
  prepared statements disabled as required.
- Transactions are kept **short** — no external I/O (provider/email calls) inside a
  `prisma.$transaction`; those are enqueued and run after commit, so DB locks aren't held across the
  network.

---

## 10. Testing seams

DI is the test seam: every service takes its collaborators (`PrismaService`, `PointsService`,
provider tokens, queues) via the constructor, so units are tested in isolation with fakes. Details,
coverage targets, and tooling live in [08-testing-strategy.md](08-testing-strategy.md); the
structural affordances the backend provides are:

- **Unit tests** — instantiate a service with mocked collaborators; assert business rules and
  exceptions. E.g. `PointsService.spend()` with a fake `tx` verifies `insufficient_points` → 422
  and that idempotency returns the existing row.
- **Provider mocks** — bind `NoopEmailProvider` / in-memory fakes to the provider tokens
  (`EMAIL_PROVIDER`, …) so no network calls occur; assert the interface contract.
- **Queue fakes** — inject a fake `Queue` to assert a job was enqueued with the right payload, and
  test processors directly by calling `process(job)` with a synthetic `Job`.
- **Integration tests** — spin a real Postgres + Redis (testcontainers), run migrations + seed, and
  exercise services through the module, especially **ledger transaction rollback** (domain write
  fails → point credit rolls back) and idempotency under concurrency.
- **e2e tests** — `Supertest` against the booted Nest app; assert the full envelope, status codes,
  auth guards, and error codes conform to [05-api-conventions.md](05-api-conventions.md).

Because point movement is funneled through one injectable `PointsService`, ledger behaviour is
tested once, centrally, rather than re-verified in every feature.

---

## Related documents

- [00-project-overview.md](../00-project-overview.md) — vision, module map, glossary.
- [04-database-architecture.md](04-database-architecture.md) — Prisma schema + ledger rules.
- [05-api-conventions.md](05-api-conventions.md) — envelope, error codes, auth, pagination.
- [07-security-compliance.md](07-security-compliance.md) — encryption, JWT keys, PII.
- [08-testing-strategy.md](08-testing-strategy.md) — coverage targets, tooling.
- [09-devops-cicd.md](09-devops-cicd.md) — deploy, workers, observability.
- [../phases/00-roadmap.md](../phases/00-roadmap.md) — build order & dependencies.

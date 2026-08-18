# 01 — System Architecture ⭐

The bird's-eye view of how the **Influencer Platform** fits together: the runtime topology, the
monorepo layout, who owns what, and how a request flows from browser to database and back. This doc is
the **structural backbone**. The data model lives in
[04-database-architecture.md](04-database-architecture.md); the wire contract lives in
[05-api-conventions.md](05-api-conventions.md). This doc references both rather than repeating them.

> Read this first, then `04` (data) and `05` (API), then a module doc. Build sequence is in
> [phases/00-roadmap.md](../phases/00-roadmap.md); product context in
> [00-project-overview.md](../00-project-overview.md).

---

## 1. Principles

- **Two deployables, one repo.** A Next.js frontend (`apps/web`) and a NestJS API (`apps/api`) live in
  one Turborepo monorepo and share typed contracts via `packages/*`. They deploy independently.
- **The API is the only writer of business state.** All domain logic, the points ledger, and every
  mutation live in NestJS. The web app renders and calls the API — it never touches Postgres directly.
- **One schema, everywhere.** Zod schemas in `packages/types` are the single definition of every DTO,
  used by both the API (validation) and the web app (forms + typed client). See §5.
- **Stateless services.** The API holds no in-process session state; sessions, locks, and caches live in
  Redis so any instance can serve any request and we scale horizontally (§10).
- **Config over code.** Monetary constant (`100 points = ₹1.00`), point values, and provider keys come
  from config/env, never hard-coded (§6). Consistent with
  [00-project-overview §1](../00-project-overview.md).
- **Providers behind interfaces.** SendGrid / Twilio / FCM / S3-Cloudinary / PayPal are injected behind
  NestJS provider tokens so they're swappable and mockable (per
  [roadmap risk notes](../phases/00-roadmap.md#risk-notes)).

---

## 2. High-level architecture

```
                                   ┌───────────────────────────────────────────┐
                                   │                 CLIENT                      │
                                   │   Browser (responsive web / PWA-ready)      │
                                   └───────────────┬─────────────────────────────┘
                                                   │ HTTPS (TLS 1.3)
                     ┌─────────────────────────────┼───────────────────────────────────┐
                     │ Vercel Edge / CDN           │                                   │
                     │  • static assets, images    │  RSC payloads & SSR HTML          │
                     │  • ISR/edge cache            ▼                                   │
                     │            ┌──────────────────────────────────┐                 │
                     │            │  apps/web — Next.js 14 (App Router)│                 │
                     │            │  Server Components / SSR / Route   │                 │
                     │            │  Handlers (BFF: cookies, proxy)    │                 │
                     │            └───────────────┬──────────────────┘                 │
                     └────────────────────────────┼──────────────────────────────────── ┘
                                                  │ JSON over HTTPS
                                                  │ Authorization: Bearer <JWT>
                                                  │ (typed client from packages/types)
                                                  ▼
                     ┌──────────────────────────────────────────────────────────────────┐
                     │  Railway                                                          │
                     │   ┌────────────────────────────────────────────────────────────┐ │
                     │   │  apps/api — NestJS (stateless, N replicas)                   │ │
                     │   │   Guards → ZodValidationPipe → Controller → Service →        │ │
                     │   │   Prisma ($transaction) │ Interceptor (envelope) │ Filter    │ │
                     │   │   BullMQ producers ─────┐                                    │ │
                     │   └─────────┬───────────────┼────────────┬──────────────────────┘ │
                     │             │               │            │                         │
                     │   ┌─────────▼───────┐  ┌────▼──────┐  ┌──▼───────────────────────┐ │
                     │   │ PostgreSQL 15    │  │  Redis    │  │  BullMQ Worker           │ │
                     │   │ (via PgBouncer)  │  │  cache /  │◄─┤  (NestJS process,        │ │
                     │   │ source of truth  │  │  locks /  │  │   consumes queues)       │ │
                     │   │ (04-database)    │  │  queues   │  └──┬───────────────────────┘ │
                     │   └──────────────────┘  └───────────┘     │                         │
                     └───────────────────────────────────────────┼───────────────────────┘
                                                                 │ outbound (async jobs) + webhooks (inbound)
                                                                 ▼
        ┌───────────────────────────────────────────────────────────────────────────────────┐
        │  External providers (behind NestJS interfaces)                                       │
        │  SendGrid (email) · Twilio (SMS/WhatsApp) · Firebase FCM (push) ·                    │
        │  AWS S3 / Cloudinary (media) · PayPal (payouts)                                       │
        │  ── inbound callbacks ──►  POST /v1/webhooks/{provider}  (signature-verified, 05§11)  │
        └───────────────────────────────────────────────────────────────────────────────────┘
```

**Trust boundary:** the browser is untrusted. Everything security-relevant — auth verification, point
awards, weighted spin outcomes, ownership checks — happens in `apps/api`. The web app is a rendering +
BFF layer.

---

## 3. Monorepo layout

Turborepo drives build/test/lint pipelines with caching. Two apps, four shared packages.

```
influencer_platform_toluna/
├── apps/
│   ├── web/                         # Next.js 14 App Router (TypeScript) — deployed to Vercel
│   │   ├── app/                     #   route segments (RSC by default); (auth), (dashboard) groups
│   │   │   ├── (auth)/              #   login, register, verify, reset — public routes
│   │   │   ├── (app)/               #   authenticated shell: dashboard, surveys, polls, game, rewards
│   │   │   └── api/                 #   Route Handlers used ONLY as a BFF (cookie<->bearer, proxy)
│   │   ├── components/              #   app-specific compositions (built FROM packages/ui primitives)
│   │   ├── lib/                     #   api client instance, auth helpers, server actions, fetch wrappers
│   │   ├── hooks/                   #   client hooks (React Query, forms)
│   │   └── public/                  #   static assets served via CDN
│   └── api/                         # NestJS (TypeScript) — deployed to Railway
│       ├── src/
│       │   ├── main.ts              #   bootstrap: global pipe/interceptor/filter, config validation
│       │   ├── app.module.ts        #   root module wiring
│       │   ├── common/              #   guards, decorators (@CurrentUser), interceptors, filters, logger
│       │   ├── config/              #   typed config module + boot-time env validation (§6)
│       │   ├── modules/             #   feature modules: auth, account, points, surveys, polls,
│       │   │                        #     games, notifications, support, admin, webhooks
│       │   ├── queue/               #   BullMQ registration, processors, schedulers (§8)
│       │   └── prisma/              #   PrismaService (wraps packages/db client, lifecycle hooks)
│       └── test/                    #   e2e / integration specs
├── packages/
│   ├── ui/                          # Design system + base component kit (React) — the ONLY source of
│   │                               #   shared components/tokens (design-system/11, /13). Never forked.
│   ├── types/                       # Zod schemas = DTOs + domain types; the typed API client contract.
│   │                               #   Single source of truth shared by web (forms) & api (validation).
│   ├── config/                      # Shared eslint config, tsconfig bases, tailwind preset — one style.
│   └── db/                          # Prisma schema + generated client + migrations + seed (04-database).
├── turbo.json                       # pipeline: build/lint/test/typecheck with dependency graph + cache
├── package.json                     # workspaces root; pnpm workspace
└── tsconfig.base.json               # extended by every package (from packages/config)
```

One-line responsibilities:

| Path | Owns |
|---|---|
| `apps/web` | UI, routing, SSR/RSC, BFF route handlers, client data fetching. No business logic. |
| `apps/api` | All domain logic, auth, ledger, validation, DB access, jobs, provider integration. |
| `packages/ui` | Design tokens + accessible base components consumed by `apps/web`. |
| `packages/types` | Zod DTO/domain schemas + inferred TS types; the API client contract. |
| `packages/config` | ESLint / tsconfig / Tailwind preset shared across apps & packages. |
| `packages/db` | Prisma schema, client, migrations, seed — the data layer (see `04`). |

---

## 4. Responsibility boundaries

### What lives where

| Concern | `apps/web` | `apps/api` | `packages/*` |
|---|---|---|---|
| Rendering, layout, animation | ✅ | — | `ui` primitives |
| Form UX + client validation | ✅ (RHF + Zod) | — | `types` (Zod) |
| Auth *session* (cookie handling) | ✅ (BFF) | — | — |
| Auth *verification* (JWT verify, guards) | — | ✅ | — |
| Business rules (award points, spin outcome, quotas) | — | ✅ | — |
| DB reads/writes, transactions | — | ✅ (Prisma) | `db` (schema/client) |
| DTO shapes / validation contract | consumes | enforces | `types` (owns) |
| Provider calls (email/SMS/push/payout/media) | — | ✅ | — |
| Background jobs / schedules | — | ✅ | — |

### Why a dedicated NestJS API (not Next.js API routes)

Next.js Route Handlers are used only as a thin **BFF** (translate the httpOnly refresh cookie into a
bearer call, proxy, set headers). The system of record is a standalone NestJS service because:

1. **Independent scaling & lifecycle.** The API scales on request/job load; the web app scales on render
   load. They deploy on separate platforms (Railway vs Vercel) with different runtime needs (long-lived
   Node process + connection pool vs edge/serverless rendering).
2. **A real server runtime.** Background workers, BullMQ queues, cron schedulers, persistent DB pools,
   and webhook processing need a long-lived process — awkward/impossible on Vercel's serverless model.
3. **One canonical API surface.** Mobile/PWA/admin/third-party all consume the same versioned
   `/v1` contract ([05](05-api-conventions.md)) instead of frontend-coupled route handlers.
4. **Structured domain architecture.** NestJS modules/providers/guards/interceptors give first-class
   DI, testability, and the global envelope/filter that [05 §2](05-api-conventions.md) mandates.
5. **Security isolation.** Secrets (DB, provider keys, encryption keys) and the ledger never sit inside
   the public-facing rendering tier.

---

## 5. Request lifecycle (authenticated request, end to end)

Example: a member votes on a poll (`POST /v1/polls/:id/vote`, see [05 §10](05-api-conventions.md)).

```
Browser (client component)
  └─ React Query mutation → typed client (packages/types) → fetch()
     with Authorization: Bearer <accessToken>
        │
        ▼
apps/web Route Handler (BFF, optional)
  └─ attaches/refreshes token from httpOnly cookie, forwards to API
        │  HTTPS
        ▼
apps/api (NestJS)
  1. Middleware      → assign requestId, start structured log span (09-devops)
  2. RateLimit guard → per-IP / per-user window via Redis (05 §8)
  3. JwtAuthGuard    → verify RS256 access token; load principal
  4. @CurrentUser()  → inject authenticated user into handler args
  5. ZodValidationPipe → validate body against VoteInput (packages/types); 400 VALIDATION_ERROR on fail
  6. Controller      → thin; delegates to PollsService (no envelope building here)
  7. Service         → business rules + ownership:
                        • poll active/not expired?  else 422 UNPROCESSABLE
                        • already voted?            else 409 CONFLICT (DB unique backstop)
  8. prisma.$transaction:                                    ┐  atomic
        • insert poll_votes                                  │
        • increment poll/option counters (denormalized)      │
        • PointsService.award(+15, idempotencyKey)           │  one ledger row
        • update points_balances cache                       ┘  (04 §5)
  9. return DTO (PollResult)
  10. Response Interceptor → wrap in { data, error:null, meta:{ requestId, timestamp } }
        │   (Exception Filter would instead format { data:null, error:{ code,... } })
        ▼
Browser ← 200 envelope → React Query updates cache → UI re-renders results
```

Key rules (all defined in referenced docs, enforced here):
- The **response envelope** is applied once by a global interceptor; errors by a global exception filter
  ([05 §2](05-api-conventions.md)). Controllers return plain DTOs.
- The **point credit and the domain write share one Prisma `$transaction`** — if either fails, both roll
  back ([04 §5](04-database-architecture.md)). `idempotencyKey` blocks double-credit on retry.
- Ownership checks live in the **service**, not the controller ([05 §7](05-api-conventions.md)).

---

## 6. Shared types flow (frontend ⇄ backend in sync)

`packages/types` is the **single source of truth** for every request/response shape. One Zod schema,
inferred TS types, consumed on both sides — no drift ([05 §5](05-api-conventions.md)).

```
                     packages/types
                     ┌───────────────────────────────────────────┐
                     │  export const VoteInput = z.object({...})  │  ← authored ONCE
                     │  export type  VoteInput = z.infer<...>     │
                     │  export const PollResult = z.object({...}) │
                     └───────────────┬───────────────┬───────────┘
                     (build-time dep) │               │ (build-time dep)
                                      ▼               ▼
             apps/web                                          apps/api
   • React Hook Form resolver = VoteInput      • ZodValidationPipe(VoteInput) at boundary
   • typed api client: request/response types  • controller returns PollResult (type-checked)
   • compile error if the shape changes        • compile error if the shape changes
```

Because both apps import the *same* module, a breaking change to a DTO fails **compilation on both
sides** in CI — the contract cannot silently drift. Domain enums used across the wire (e.g.
`SurveyType`, `NotificationChannel`) are mirrored/derived here to match the Prisma enums in
[04 §4](04-database-architecture.md).

---

## 7. Configuration & environments

- **Environments:** `local → staging → production` (per [roadmap §Environments](../phases/00-roadmap.md)).
  Each app has its own env set; nothing is shared implicitly across the trust boundary.
- **Boot-time validation.** `apps/api` validates its environment against a Zod schema in `src/config` on
  startup; a missing/malformed var **fails fast** (process exits) rather than erroring at first use. The
  web app validates its public/runtime vars similarly.
- **Public vs secret.** Only `NEXT_PUBLIC_*` (e.g. API base URL) is exposed to the browser. Secrets —
  `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY`, `ENCRYPTION_KEY` (AES-256-GCM, [04 §1](04-database-architecture.md)),
  provider API keys, `DATABASE_URL` — live only in the API's environment (Railway secrets / Vercel
  encrypted env), never committed.
- **Constants in config, not code.** `POINTS_PER_INR = 100` and default point values are config-driven
  ([00 §1](../00-project-overview.md)).
- **`DATABASE_URL` vs `DIRECT_URL`.** The app connects through the **pooled** `DATABASE_URL` (PgBouncer,
  transaction mode) for high-concurrency request handling; Prisma **Migrate** uses `DIRECT_URL` (a direct,
  unpooled connection) because migrations need session-level features PgBouncer transaction pooling
  can't provide. Both are set in `packages/db` datasource per [04 §7](04-database-architecture.md).

---

## 8. Caching & Redis roles

Redis is the shared state layer that keeps the API stateless. Full key catalogue and TTLs are in
[04 §6](04-database-architecture.md); at the architecture level Redis plays four roles:

| Role | Examples | Notes |
|---|---|---|
| **Session / auth fast-path** | `session:{id}`, refresh-token rotation | Sliding TTL; enables horizontal scale |
| **Distributed locks / idempotency** | `spin:daily:{userId}`, `otp:{phone}` | Fast path; DB unique constraint is durable backstop ([04 §6](04-database-architecture.md)) |
| **Rate limiting** | `ratelimit:{scope}:{ip|user}` | Enforces [05 §8](05-api-conventions.md) windows across replicas |
| **Cache** | reference data (rewards catalogue, active polls), `reg:draft:{sessionId}` | Read-through; invalidate on admin mutation |

Cache is never the source of truth. Postgres owns state; the `points_balances` table is itself a
reconciled cache of the ledger ([04 §5](04-database-architecture.md)), and Redis caches derived reads.

---

## 9. Background jobs & queues (BullMQ on Redis)

Anything that must not block a request, must run on a schedule, or must retry on failure runs as a
**BullMQ** job backed by Redis. Producers live in feature modules; a dedicated **worker process**
(same NestJS codebase, `queue/` processors) consumes them.

```
Request path (fast)                 Queue (async, retriable)              Worker process
──────────────────                  ─────────────────────────            ─────────────────
Controller/Service                  ┌──────────────┐                     @Processor('notifications')
  producer.add(job) ───────────────►│ notifications │──────────────────► send via SendGrid/Twilio/FCM,
                                     ├──────────────┤                     write notifications.status
                                     │ payouts       │──────────────────► PayPal payout, poll status,
                                     ├──────────────┤                     update reward_redemptions
                                     │ scheduled     │◄── @Cron triggers  daily reset, reconciliation,
                                     └──────────────┘   (Nest Schedule)   token cleanup
```

- **Notifications** (Phase 7, scaffolded Phase 1): every send is a job so a slow/failed provider never
  blocks the user; status transitions (`QUEUED→SENT→DELIVERED/FAILED`) are driven by the worker and
  provider webhooks ([04 §4](04-database-architecture.md), [05 §11](05-api-conventions.md)).
- **Daily reset** (Phase 6): a scheduled job clears/rolls the Spin-the-Wheel daily locks at local
  midnight (Redis fast path; DB `@@unique(userId, gameId, playDate)` is the durable guarantee).
- **Ledger reconciliation** (nightly): recomputes each user's balance from `points_transactions`,
  alerts on drift ([04 §5 invariant 7](04-database-architecture.md)).
- **Token cleanup:** purge expired `auth_tokens`.
- **Scheduling** uses `@nestjs/schedule` (`@Cron`) to *enqueue* jobs; the actual work runs in the BullMQ
  worker so retries/backoff/concurrency are managed by the queue, not the cron tick. In multi-replica
  deployments only one scheduler owns the cron (leader/lock) to avoid duplicate enqueues.

---

## 10. Cross-cutting concerns

Applied uniformly via NestJS global providers, per [roadmap §Cross-cutting](../phases/00-roadmap.md).

- **Auth / authorization.** RS256 JWT access tokens (15 min) verified by `JwtAuthGuard`; refresh tokens
  in httpOnly secure cookies; `AdminGuard` + role for `/admin/*`. `@CurrentUser()` injects the principal;
  ownership enforced in services ([05 §7](05-api-conventions.md),
  [07-security-compliance.md](07-security-compliance.md)).
- **Validation.** `ZodValidationPipe` at every boundary using `packages/types`; services trust their
  input ([05 §5](05-api-conventions.md)).
- **Response envelope & errors.** Global response interceptor + exception filter produce the canonical
  `{ data, error, meta }` shape and the stable error-code set ([05 §2–4](05-api-conventions.md)).
- **Observability.** Every request carries a `requestId` (returned in `meta`), and logs/audit/errors are
  correlated by it ([05 §12](05-api-conventions.md)). Structured JSON logging; details in
  [09-devops-cicd.md](09-devops-cicd.md).
- **Audit.** Every mutating admin/user action writes an `audit_logs` row (actor, action, target, IP, UA)
  from Phase 0 ([04 §4](04-database-architecture.md)).
- **Encryption.** Sensitive PII encrypted (AES-256-GCM) at the app layer before write
  ([04 §1](04-database-architecture.md), [07-security-compliance.md](07-security-compliance.md)).
- **Rate limiting.** Redis-backed, per [05 §8](05-api-conventions.md); defense-in-depth alongside
  business rules (daily lock, one-vote, balance checks).

---

## 11. Scalability & deployment topology

```
   Vercel (web)                      Railway (api plane)
   ┌───────────────┐                 ┌───────────────────────────────────────────┐
   │ CDN + edge     │                │  API replicas (stateless, autoscale N)      │
   │ SSR/RSC/ISR    │  ──HTTPS──►    │   api-1   api-2   …   api-N                  │
   │ static assets  │                │      \      |      /                         │
   └───────────────┘                │        \    |    /   BullMQ worker(s)        │
          ▲                          │         ▼   ▼   ▼                            │
          │ media URLs               │      ┌──────────────┐   ┌──────────────┐    │
   S3 / Cloudinary                   │      │  PgBouncer     │   │    Redis     │    │
   (user photos, assets)            │      │ (pooler,       │   │ cache/locks/ │    │
                                     │      │  txn mode)     │   │ queues       │    │
                                     │      └──────┬─────────┘   └──────────────┘    │
                                     │             ▼                                 │
                                     │      PostgreSQL 15 (primary; read replica →)  │
                                     └───────────────────────────────────────────── ┘
```

- **Stateless API → horizontal scale.** No in-process session/cache state (all in Redis), so replicas
  add linearly behind a load balancer. Jobs/schedulers run leader-guarded to avoid duplication (§9).
- **Connection pooling.** Many API replicas × Prisma pools would exhaust Postgres connections; requests
  go through **PgBouncer** (`DATABASE_URL`), migrations bypass it (`DIRECT_URL`) — see §6 and
  [04 §7](04-database-architecture.md).
- **Read scaling.** Hot read paths use denormalized counters and indexed queries
  ([04 §8](04-database-architecture.md)); heavy read endpoints can target a Postgres read replica later.
- **CDN / static.** Vercel serves static assets, RSC payloads, and ISR pages from the edge; user-uploaded
  media is served from S3/Cloudinary URLs, never proxied through the API.
- **Isolation of tiers.** Rendering (Vercel) and domain/data (Railway) fail and scale independently; an
  API deploy never risks the CDN edge and vice-versa.

---

## 12. Related architecture docs

- [04-database-architecture.md](04-database-architecture.md) — data model, Prisma schema, ledger rules,
  Redis key catalogue, migrations. **The source of truth for data.**
- [05-api-conventions.md](05-api-conventions.md) — response envelope, error codes, auth, pagination,
  webhooks, observability. **The source of truth for the wire contract.**
- 07-security-compliance.md — encryption, JWT, DPDP/CERT-In/GDPR (to be authored).
- 08-testing-strategy.md — coverage targets, integration/e2e (to be authored).
- 09-devops-cicd.md — pipelines, environments, logging/monitoring (to be authored).
- [../phases/00-roadmap.md](../phases/00-roadmap.md) — build order & cross-cutting sequencing.
- [../00-project-overview.md](../00-project-overview.md) — product vision, modules, glossary.

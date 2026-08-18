# Module 00 — Foundation ⭐

**Phase:** 0 — Foundation · **Weeks:** 1–2 · **Depends on:** — (nothing)
**Roadmap row:** [phases/00-roadmap.md](../phases/00-roadmap.md) · **Product context:** [00-project-overview.md](../00-project-overview.md)

Phase 0 has **no end-user feature**. It stands up the entire platform skeleton — monorepo, tooling,
design system, database, auth scaffold, CI/CD, and the shared `PointsService` — so that every later
phase (1–9) builds on one consistent, already-proven foundation instead of reinventing it. This doc is
the **build spec for that skeleton**; it references the architecture and design docs rather than
duplicating them.

Read the backbone first: [01-system-architecture](../architecture/01-system-architecture.md),
[03-backend-architecture](../architecture/03-backend-architecture.md),
[04-database-architecture](../architecture/04-database-architecture.md),
[05-api-conventions](../architecture/05-api-conventions.md),
[06-frontend-architecture](../architecture/06-frontend-architecture.md),
[09-devops-cicd](../architecture/09-devops-cicd.md),
[11-color-system](../design-system/11-color-system.md),
[13-components-library](../design-system/13-components-library.md),
[15-coding-standards](../standards/15-coding-standards.md).

---

## 1. Overview & goal

### Why Phase 0 exists

Every later phase depends on the same primitives: a typed API contract, a points ledger, a design
system, auth guards, a database, and a deploy pipeline. If each phase built these ad-hoc, we would get
drift — a second modal, a duplicated env lookup, a feature writing `points_transactions` directly. The
[roadmap](../phases/00-roadmap.md#cross-cutting-concerns-present-from-phase-0) names these as
**cross-cutting concerns present from Phase 0**. This module is where they are **built once** so that
["build once, use everywhere"](../design-system/13-components-library.md) is a fact, not an aspiration.

### The "empty but running" outcome

At the end of Phase 0 the platform is a **fully wired skeleton with zero member-facing features**:

- `pnpm dev` boots both apps — `apps/web` (Next.js, `:3000`) and `apps/api` (NestJS, `:4000`) — against
  a local Postgres + Redis in Docker.
- The API responds to `GET /v1/health/live` and `GET /v1/health/ready` (green), applies the first Prisma
  migration, and seeds reference data (14 profile categories, spin game + segments, rewards catalogue,
  super-admin).
- The web app renders an authenticated **`AppShell`** and a token-driven **sample page** proving the
  design tokens, Tailwind preset, and base UI kit all resolve.
- **Storybook** shows the base component kit (`Button`, `Input`, `FormField`, `Modal`, `Card`, `Text`,
  `Heading`) with a11y checks.
- `PointsService.award()/spend()` compiles and is unit-tested, but **no route awards points yet** — the
  first real credit is the +500 verification bonus in [Phase 1](module-01-auth-registration.md).
- **CI is green** (install → lint → typecheck → unit → build → integration) and the deploy stages to
  Vercel/Railway are configured.

Nothing a member can *do* ships in Phase 0. Everything a developer *needs* to ship the next eight phases
does.

---

## 2. Scope

### In scope

| Area | What Phase 0 delivers |
|---|---|
| **Monorepo** | pnpm workspaces + Turborepo: `apps/web`, `apps/api`, `packages/ui`, `packages/types`, `packages/config`, `packages/db` ([01 §3](../architecture/01-system-architecture.md#3-monorepo-layout)) |
| **Shared tooling** | One `tsconfig` base, one ESLint flat config, one Prettier config, one Tailwind preset in `packages/config` ([15 §1–2](../standards/15-coding-standards.md)) |
| **Database** | Prisma init; **Identity + Points-core + `admins` + `audit_logs`** models + **first migration** + **seed scaffold** ([04 §4, §7](../architecture/04-database-architecture.md)) |
| **Ledger** | `PointsService` skeleton (`award`/`spend`, tx-aware, idempotent) — no callers yet ([03 §4](../architecture/03-backend-architecture.md#4-pointsservice--the-shared-ledger)) |
| **Backend bootstrap** | NestJS `main.ts` (global pipe/interceptor/filter, request-id middleware), config module + Zod env validation, `PrismaModule`, `RedisModule`, `HealthModule` ([03 §3, §5, §9](../architecture/03-backend-architecture.md)) |
| **Frontend skeleton** | Next.js App Router structure, root providers, `tokens.css` wiring, `AppShell`/`Header`, base UI kit, Storybook ([06 §1, §7](../architecture/06-frontend-architecture.md)) |
| **Typed API client** | Envelope-aware `apiFetch` + `ApiError`, server/client variants, typed against `@influencer/types` ([06 §3.3](../architecture/06-frontend-architecture.md)) |
| **Auth scaffold** | RS256 keypair handling, `AuthGuard`/`RolesGuard`/`AdminGuard`, `@CurrentUser()`, `@Public()`, `TokenService` shell — **no login/registration flow** ([03 §3.6](../architecture/03-backend-architecture.md)) |
| **CI/CD** | GitHub Actions pipeline (install→lint→typecheck→unit→build→integration), Turborepo remote cache, deploy stages ([09 §3](../architecture/09-devops-cicd.md)) |
| **Local infra** | `docker-compose` for Postgres 15 + Redis 7; `.env.example`; env management ([09 §1–2](../architecture/09-devops-cicd.md)) |

### Out of scope (deferred to later phases)

- **Any user-facing feature.** No registration, login, profile surveys, rewards UI, surveys, polls,
  games, notifications, or chatbot — those are [Phases 1–8](../phases/00-roadmap.md#phase--module--deliverable).
- **Feature tables.** `surveys`, `polls`, `games`, `notifications`, `support_*`, `consent_logs`, and the
  rest of Identity's optional relations arrive **via later migrations** ([04 §4](../architecture/04-database-architecture.md) note: "Phase 0 creates Identity + Points core + `admins` + `audit_logs`; later phases add their tables").
- **Points-awarding endpoints.** `PointsService` exists but is called by no controller until Phase 1.
- **Full provider integrations.** SendGrid/Twilio/FCM/PayPal interfaces may be stubbed with no-op
  providers, but real sends are Phase 7 ([03 §7](../architecture/03-backend-architecture.md#7-external-provider-abstraction)).
- **BullMQ workers & schedulers.** The `QueueModule` may be scaffolded, but no processors/crons run in
  Phase 0 (queues land with the features that need them, [01 §9](../architecture/01-system-architecture.md)).

---

## 3. Deliverables checklist

- [ ] pnpm + Turborepo monorepo initialised with the six workspaces and `turbo.json` pipeline.
- [ ] `packages/config`: shared `tsconfig` bases, ESLint flat config, Prettier config, Tailwind preset.
- [ ] Path aliases (`@influencer/ui|types|config|db`, `@/*`) resolve in TS, bundler, and ESLint.
- [ ] husky + lint-staged + commitlint pre-commit hooks installed.
- [ ] `packages/db`: Prisma initialised; Identity + Points-core + `admins` + `audit_logs` models.
- [ ] First migration generated and applied; `PrismaClient` generated and re-exported.
- [ ] Idempotent seed scaffold: 14 profile categories, spin game + 8 segments, rewards catalogue, super-admin.
- [ ] `PointsService` skeleton with `award()`/`spend()` (tx-aware, idempotent) + unit tests.
- [ ] NestJS bootstrap: global `ZodValidationPipe`, `ResponseInterceptor`, `AllExceptionsFilter`, request-id middleware, `/v1` prefix, shutdown hooks.
- [ ] Config module with boot-time Zod env validation (fails fast).
- [ ] `PrismaModule`, `RedisModule`, `HealthModule` (`/health/live`, `/health/ready`) wired `@Global` where required.
- [ ] Auth scaffold: `AuthGuard`/`RolesGuard`/`AdminGuard`, `@CurrentUser()`, `@Public()`, RS256 keypair loading, `TokenService` shell.
- [ ] Next.js App Router skeleton: route groups, root layout with providers, `globals.css` importing `tokens.css`.
- [ ] `packages/ui`: `tokens.css`, Tailwind preset consumption, base kit (`Button`, `Input`, `FormField`, `Modal`, `Card`, `Text`, `Heading`) + `AppShell`/`Header`.
- [ ] Storybook running with stories + a11y addon for the base kit.
- [ ] Typed API client (`apiFetch` + `ApiError`, server + client variants).
- [ ] Token-driven **sample page** rendered inside `AppShell`.
- [ ] GitHub Actions CI pipeline green; Turborepo remote cache configured.
- [ ] `docker-compose.yml` (Postgres 15 + Redis 7) and `.env.example` committed.
- [ ] Vercel (web) + Railway (api/data) projects created for `staging`; `production` gated.

---

## 4. Data model (Phase 0 slice)

The full schema is authoritative in [04-database-architecture.md](../architecture/04-database-architecture.md).
Phase 0 creates **only** the tables needed for identity, the ledger, staff, and audit — the rest are
added by later phases' migrations ([04 §4](../architecture/04-database-architecture.md)). This keeps the
first migration small and reviewable while establishing the append-only ledger from day one.

### 4.1 Tables created in Phase 0

| Group | Prisma model → table | Why in Phase 0 |
|---|---|---|
| **Identity** | `User` → `users` | Root of every relation; auth + ledger hang off it |
| | `UserProfile` → `user_profiles` | 1:1 profile (Phase 2 fills it, table exists now) |
| | `UserAddress` → `user_addresses` | PIN/address single source ([overview §7.3](../00-project-overview.md)) |
| | `UserDemographics` → `user_demographics` | About-You demographics container |
| | `PaypalAccount` → `paypal_accounts` | Payout target (Phase 3 uses it) |
| | `AuthToken` → `auth_tokens` | Email-verification / password-reset tokens (Phase 1) |
| **Points core** | `PointsTransaction` → `points_transactions` | **Append-only ledger** — the financial truth |
| | `PointsBalance` → `points_balances` | Derived O(1) balance cache |
| | `Reward` → `rewards` | Data-driven catalogue (seeded now) |
| | `RewardRedemption` → `reward_redemptions` | Redemption records (Phase 3) |
| **Staff** | `Admin` → `admins` | Super-admin seeded now; back-office auth base |
| **Compliance** | `AuditLog` → `audit_logs` | Every mutating action logged **from Phase 0** ([01 §10](../architecture/01-system-architecture.md#10-cross-cutting-concerns)) |

Enums required by these tables are also created: `Gender`, `AuthTokenType`, `PointsAction`,
`PointsDirection`, `RedemptionStatus`, `RewardType`, `AreaType`. Feature enums (`SurveyType`, `PollType`,
`GameType`, `NotificationChannel`, …) may be declared in the schema but their **tables** land later.

> **Ledger invariants apply from creation.** `points_transactions` is immutable (no update/delete),
> `points` is positive with `direction` carrying the sign, `idempotencyKey` is unique, and
> `points_balances` is the reconciled cache — all per
> [04 §5](../architecture/04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6).

### 4.2 First migration

- Named `0000_init_identity_points` (Prisma Migrate; one migration per PR, reviewed —
  [15 §8](../standards/15-coding-standards.md)).
- Every FK is indexed and hot-path indexes are included (`points_transactions(user_id, created_at)`,
  `points_transactions(ref_type, ref_id)`, `reward_redemptions(user_id, created_at)`,
  `audit_logs(actor_type, actor_id)`, `audit_logs(action, created_at)`) per
  [04 §8](../architecture/04-database-architecture.md#8-indexing--performance-notes).
- Applied via `prisma migrate deploy` using `DIRECT_URL`; the app connects via pooled `DATABASE_URL`
  ([04 §7](../architecture/04-database-architecture.md), [09 §5](../architecture/09-devops-cicd.md)).

### 4.3 Seed contents (prepared here, consumed later)

`packages/db/prisma/seed.ts` is **idempotent** (`upsert` by natural key) so it re-runs safely on every
environment ([09 §5](../architecture/09-devops-cicd.md)). It seeds the reference data later phases assume:

**1. 14 profile-survey categories** (`profile_survey_categories`) — even though the *responses* table is a
Phase 2 addition, the **categories are reference data** and are seeded now so Phase 2 has stable
`key`/`sortOrder`/`pointsValue`. Keys (per the spec's demographic set): `about_you`, `household`,
`health`, `automotive`, `travel`, `technology`, `food_drink`, `shopping`, `finance`, `entertainment`,
`sports`, `beauty`, `pets`, `career`. Each carries a `points_value` (100 or 200, [overview §4](../00-project-overview.md))
and a JSONB `schema` (question definitions for the data-driven form).

**2. Spin-the-Wheel game + 8 weighted segments** (`games`, `game_segments`) — game
`{ gameName: "Daily Spin", gameType: SPIN_WHEEL, isFree: true }` with **8 segments whose probabilities
sum to exactly `1.0000`** and points spanning the documented **0–1,000** range including a 0-pt "better
luck" segment ([overview §7.5](../00-project-overview.md), [04 §4 `GameSegment`](../architecture/04-database-architecture.md)).
Each segment has a `color` (hex, from the design tokens) and `sortOrder`. Consumed by [Phase 6](module-06-games.md).

**3. Rewards catalogue** (`rewards`) — a data-driven initial set: charity items and the PayPal payout tier,
each with `rewardType` (`CHARITY`/`PAYPAL`/`VOUCHER`/`MERCHANDISE`), `pointsRequired`, `sortOrder`, and
`metadata`. The catalogue is fully data-driven so product can add mid-tier items without code changes
([overview §7.2](../00-project-overview.md)). Consumed by [Phase 3](module-03-points-rewards.md).

**4. Super-admin** (`admins`) — one `{ role: SUPER_ADMIN, isActive: true }` account. Password comes from a
seed env var (`SEED_SUPERADMIN_PASSWORD`), hashed with the same algorithm the API uses; **never** a
hard-coded default in production. This is the bootstrap account for the back office.

> The seed writes **reference/config rows only** — no member data, no ledger rows. The ledger stays empty
> until the first real credit in Phase 1.

---

## 5. Backend setup (`apps/api`)

Structure and layering are authoritative in [03-backend-architecture.md](../architecture/03-backend-architecture.md);
Phase 0 builds the **shared/infra skeleton** and leaves feature modules as empty folders.

### 5.1 Bootstrap (`main.ts`)

Wire the global cross-cutting providers **once**, in the order
`middleware → guards → pipes → (handler) → interceptors → filter`
([03 §3.1](../architecture/03-backend-architecture.md#31-global-wiring-maints)):

```ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));                 // nestjs-pino, requestId-bound (03 §3.5)
  app.setGlobalPrefix('v1');                        // /v1/... (05 §1)

  app.use(requestIdMiddleware);                     // x-request-id (03 §3.4)
  app.useGlobalPipes(new ZodValidationPipe());      // DTOs from @influencer/types (05 §5)
  app.useGlobalInterceptors(new LoggingInterceptor(), new ResponseInterceptor()); // envelope (05 §2)
  app.useGlobalFilters(new AllExceptionsFilter());  // canonical error envelope (05 §4)

  app.enableShutdownHooks();                        // graceful drain (03 §9.2)
  await app.listen(config.get('port', { infer: true }));
}
```

`AuthGuard` and `RolesGuard` are registered as `APP_GUARD` in `AppModule` so they run on every route;
routes opt out with `@Public()` ([03 §3.1](../architecture/03-backend-architecture.md)). In Phase 0 the
guards **verify** tokens but there is no login flow to issue them, so effectively every non-health route
is either `@Public()` or unreachable — that is expected.

### 5.2 Module tree scaffolded in Phase 0

Following the folder tree in [03 §1.2](../architecture/03-backend-architecture.md#12-appsapisrc-folder-tree):

```text
apps/api/src/
├── main.ts                     # bootstrap (5.1) — BUILT
├── app.module.ts               # imports shared modules; feature modules empty — BUILT
├── common/                     # BUILT: guards, decorators, interceptors, filters, middleware, pipes, exceptions
│   ├── guards/                 # auth.guard.ts · roles.guard.ts · admin.guard.ts
│   ├── decorators/             # current-user.decorator.ts · roles.decorator.ts · public.decorator.ts
│   ├── interceptors/           # response.interceptor.ts · logging.interceptor.ts
│   ├── filters/                # all-exceptions.filter.ts
│   ├── middleware/             # request-id.middleware.ts
│   ├── pipes/                  # zod-validation.pipe.ts
│   └── exceptions/             # domain.exception.ts + typed subclasses (03 §8)
├── config/                     # BUILT: config.module.ts · env.schema.ts · configuration.ts (5.4)
├── prisma/                     # BUILT: prisma.module.ts (@Global) · prisma.service.ts (lifecycle hooks)
├── redis/                      # BUILT: redis.module.ts (@Global) · redis.service.ts (ioredis)
├── health/                     # BUILT: health.module.ts · health.controller.ts (5.5)
├── modules/
│   ├── points/                 # BUILT (skeleton): points.module.ts · points.service.ts (5.3)
│   └── auth/                   # SCAFFOLD: auth.module.ts · token.service.ts (keys only) — no flows
└── (queue/ providers/ webhooks/ + other feature modules) # DEFERRED to later phases
```

`PrismaModule`, `RedisModule`, and `ConfigModule` are `@Global()` so feature modules import them
implicitly ([03 §1.1](../architecture/03-backend-architecture.md#11-design-rules)). `PrismaService`
extends the `PrismaClient` generated in `packages/db` and manages `onModuleInit`/`onModuleDestroy`
([03 §9.2](../architecture/03-backend-architecture.md)).

### 5.3 `PointsService` skeleton

Build the single ledger gateway now, unit-test it, wire **no callers** ([03 §4](../architecture/03-backend-architecture.md#4-pointsservice--the-shared-ledger),
[04 §5](../architecture/04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6)):

- `award(tx, input)` → `move(tx, 'CREDIT', input)`; `spend(tx, input)` → `move(tx, 'DEBIT', input)`.
- Both take a Prisma **transaction client** so callers compose the credit into their own domain
  transaction — it is structurally impossible to move points outside a `$transaction`.
- `move()` enforces: positive `points`, idempotency short-circuit on `idempotencyKey`, locked balance
  read (upsert), `balanceAfter` snapshot, `insufficient_points` → `422 UNPROCESSABLE` on debit, unique
  ledger row, `points_balances` update (lifetime earned/spent) — all in one transaction.
- Exported from `PointsModule` so every future feature module injects it (nobody re-implements point
  movement — [15 §8](../standards/15-coding-standards.md)).

The exact implementation is in [03 §4.1](../architecture/03-backend-architecture.md#41-transaction-aware-api);
Phase 0 copies that shape verbatim and covers it with the unit tests in [§12](#12-test-cases).

### 5.4 Config schema (boot-time validation)

`@nestjs/config` with a Zod schema validated at boot — the process refuses to start on a missing or
malformed var ([03 §5](../architecture/03-backend-architecture.md#5-configuration), [01 §7](../architecture/01-system-architecture.md#7-configuration--environments)).
Phase 0 needs the core keys; provider keys are `.optional()` until Phase 7:

```ts
// config/env.schema.ts (Phase 0 subset — full schema in 03 §5.1)
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),                 // pooled (app)
  DIRECT_URL: z.string().url(),                   // unpooled (migrations)
  REDIS_URL: z.string().url(),
  JWT_PRIVATE_KEY: z.string().min(1),             // RS256 PEM, base64
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  ENCRYPTION_KEY: z.string().length(64),          // 32-byte hex (07-security)
  POINTS_PER_INR: z.coerce.number().default(100), // single monetary constant (00 §1)
  SEED_SUPERADMIN_EMAIL: z.string().email().optional(),
  SEED_SUPERADMIN_PASSWORD: z.string().min(12).optional(),
});
```

No code reads `process.env` directly — the ESLint `no-restricted-syntax` rule blocks it; access is via
the typed `ConfigService` ([15 §2.2, §7.4](../standards/15-coding-standards.md)).

### 5.5 Health endpoint

`HealthModule` via `@nestjs/terminus`, both routes `@Public()`
([03 §9.1](../architecture/03-backend-architecture.md#91-health-checks), [09 §8](../architecture/09-devops-cicd.md#8-observability--ops)):

- **`GET /v1/health/live`** — liveness: process is up, no dependency checks (orchestrator restart signal).
- **`GET /v1/health/ready`** — readiness: `SELECT 1` on Postgres + `PING` on Redis; `503` if any
  dependency is down so traffic isn't routed to a pod that can't serve. Railway uses these to gate
  deploys and restarts.

### 5.6 Auth scaffold (guards & keys — no flows)

Phase 0 builds the **verification** half of auth; the **flows** (register/login/verify/reset) are
[Phase 1](module-01-auth-registration.md) ([03 §3.6](../architecture/03-backend-architecture.md#36-auth-authguard-rolesguard-currentuser),
[05 §7](../architecture/05-api-conventions.md#7-auth--authorization-patterns)):

- **`AuthGuard`** — verifies the `Authorization: Bearer` **RS256** JWT against `JWT_PUBLIC_KEY`, rejects
  expired/invalid with `401 UNAUTHENTICATED`, attaches an `AuthenticatedUser` principal.
- **`RolesGuard`** / **`AdminGuard`** — `@Roles(...)` metadata + admin-audience check (`403 FORBIDDEN`).
- **`@CurrentUser()`** — parameter decorator returning the principal; **`@Public()`** — bypasses `AuthGuard`.
- **`TokenService` shell** — loads the RS256 keypair from config and exposes `sign`/`verify`/`rotate`
  signatures; Phase 1 fills in the register/login logic.

Ownership checks live in services, not guards — a guard proves *who you are*, the service proves *this
row is yours* ([03 §3.7](../architecture/03-backend-architecture.md#37-ownership-checks)).

---

## 6. Frontend setup (`apps/web`)

Structure and rendering rules are authoritative in [06-frontend-architecture.md](../architecture/06-frontend-architecture.md);
Phase 0 builds the **shell, theming wiring, and the base kit**, with routes present but mostly placeholder.

### 6.1 App Router structure

Create the route-group skeleton from [06 §1](../architecture/06-frontend-architecture.md#1-app-router-folder-structure)
with placeholder pages (real flows land per phase):

```text
apps/web/app/
├─ layout.tsx        # root: <html>, providers (Query, Theme, Session), fonts, imports globals.css  — BUILT
├─ globals.css       # imports @influencer/ui tokens.css + Tailwind layers                           — BUILT
├─ not-found.tsx · error.tsx   # global 404 + root error boundary (shared EmptyState/Alert)          — BUILT
├─ (marketing)/      # public shell + placeholder landing                                            — SCAFFOLD
├─ (auth)/           # centred-card shell, placeholder login/register pages                          — SCAFFOLD (flows: Phase 1)
├─ (app)/
│  ├─ layout.tsx     # <AppShell>: Header + SidebarNav/BottomNav                                      — BUILT
│  ├─ loading.tsx · error.tsx                                                                          — BUILT
│  └─ sample/page.tsx   # token-driven sample page (acceptance criterion, §10)                        — BUILT
└─ middleware.ts     # route protection matcher (guards (app)/admin) — UX only, API is authority      — BUILT (matcher)
```

Everything is a **React Server Component by default**; `"use client"` is pushed to the leaves
([06 §2](../architecture/06-frontend-architecture.md#2-rendering-strategy-server-vs-client-components),
[15 §6.1](../standards/15-coding-standards.md)). The root layout mounts the TanStack Query provider, the
`ThemeProvider` (with the pre-hydration anti-flash script), and NextAuth's `SessionProvider`.

### 6.2 Tailwind preset + `tokens.css` wiring

Theming is a **config change, not a code change** ([11 §6](../design-system/11-color-system.md),
[06 §7](../architecture/06-frontend-architecture.md#7-theming--tokens)):

- **`packages/ui/src/styles/tokens.css`** — primitive + semantic tokens from
  [11 §2–3](../design-system/11-color-system.md) (magenta scale, neutral scale, semantic hues, radius,
  shadow, `--focus-ring`), plus the `[data-theme="dark"]` overrides. Imported **once** in
  `app/globals.css`.
- **`packages/config/tailwind-preset.ts`** — maps the CSS variables to utilities (`bg-primary`,
  `text-muted`, `border-default`, `ring-focus`) and is shared by `apps/web` **and Storybook**, so app and
  component library render identically.
- `apps/web/tailwind.config.ts` is thin: `presets: [preset]`, `content` pointing at `app/**` +
  `@influencer/ui`.
- Dark mode flips semantic tokens via `data-theme="dark"` on `<html>`; components use **semantic tokens
  only**, never raw hex ([11 §4](../design-system/11-color-system.md), [15 §6.3](../standards/15-coding-standards.md)).

### 6.3 `AppShell` / `Header`

Built in `packages/ui` per [13 §7](../design-system/13-components-library.md#7-navigation--shell):

- **`AppShell`** — authenticated layout: `Header` + `SidebarNav` (desktop) / `BottomNav` (mobile) +
  content region; responsive per [06 §10](../architecture/06-frontend-architecture.md).
- **`Header`** — logo, points balance slot (`PointsPill`, static/zero in Phase 0), notifications bell
  placeholder, avatar menu. The live balance chip wires up in Phase 3; Phase 0 renders the shell shape.

### 6.4 Base UI kit (Phase 0 set)

Ship the reuse backbone from [13-components-library.md](../design-system/13-components-library.md) — the
**minimum kit later phases assume**, each with a Storybook story + a11y pass:

| Component | Ref | Notes |
|---|---|---|
| `Text` | [13 §1](../design-system/13-components-library.md#1-foundations) | typographic text, semantic color tokens |
| `Heading` | [13 §1](../design-system/13-components-library.md#1-foundations) | h1–h6 type scale |
| `Button` | [13 §2](../design-system/13-components-library.md#2-actions) | variants `primary/secondary/outline/ghost/danger`, `loading`; primary = magenta-600 |
| `Input` | [13 §3](../design-system/13-components-library.md#3-form-fields-the-reuse-backbone-for-all-forms) | text/email/password with show/hide |
| `FormField` | [13 §3](../design-system/13-components-library.md#3-form-fields-the-reuse-backbone-for-all-forms) | label + control + hint + error slot; the form backbone |
| `Modal` | [13 §4](../design-system/13-components-library.md#4-overlays-single-modal-system--reuse-everywhere) | Radix Dialog base; the single modal system |
| `Card` | [13 §5](../design-system/13-components-library.md#5-data-display) | base surface for every card composition |

Additional primitives (`Box`/`Stack`, `Alert`, `Skeleton`, `EmptyState`, `Badge`) are added as later
phases need them; the seven above are the **Phase 0 acceptance set**. Every component is styled with
semantic tokens, typed with an exported props interface, and built on Radix where interactive
([13 Principles](../design-system/13-components-library.md)).

### 6.5 Typed API client

One envelope-aware client in `app/lib/api/`, typed against `@influencer/types`
([06 §3.3](../architecture/06-frontend-architecture.md#33-the-typed-api-client-wrapper-envelope-aware)):

- `apiFetch<T>()` reads the `{ data, error, meta }` envelope: on success returns `data`; on error throws
  a typed `ApiError` (`code`, `message`, `details[]`, `status`) — callers never see the envelope.
- **Server variant** (`server.ts`) pulls the token from the NextAuth session; **client variant** is used
  only through TanStack Query hooks — components never call `fetch` directly ([15 §6.2](../standards/15-coding-standards.md)).
- In Phase 0 the only live call the sample page can make is `GET /v1/health/ready` (proving the client
  ⇄ envelope wiring end-to-end); real endpoints arrive per phase.

### 6.6 Storybook

Storybook runs against `packages/ui`, sharing the **same Tailwind preset + `tokens.css`** so stories look
identical to the app ([13 Principles](../design-system/13-components-library.md), [11 §6](../design-system/11-color-system.md)).
The a11y addon runs on every story; new shared components require a story + a11y pass ([13 §10](../design-system/13-components-library.md#10-rules)).

---

## 7. Repo & tooling

Monorepo shape is fixed by [01 §3](../architecture/01-system-architecture.md#3-monorepo-layout); tooling
rules by [15 §1–2](../standards/15-coding-standards.md).

### 7.1 Workspaces (`package.json` + `pnpm-workspace.yaml`)

pnpm workspaces over `apps/*` and `packages/*`. The root `package.json` pins the package manager
(`"packageManager": "pnpm@x"`) so CI and every dev use one version ([09 §3](../architecture/09-devops-cicd.md)).
Package names use the `@influencer/*` scope ([15 §1.3](../standards/15-coding-standards.md)):

| Package | Name | Role |
|---|---|---|
| `packages/ui` | `@influencer/ui` | design system + base kit ([13](../design-system/13-components-library.md)) |
| `packages/types` | `@influencer/types` | Zod DTO/domain schemas — the API contract ([01 §6](../architecture/01-system-architecture.md#6-shared-types-flow-frontend--backend-in-sync)) |
| `packages/config` | `@influencer/config` | eslint/tsconfig/tailwind presets |
| `packages/db` | `@influencer/db` | Prisma schema/client/migrations/seed ([04](../architecture/04-database-architecture.md)) |

> **Naming note:** the canonical package scope per [15 §1.3](../standards/15-coding-standards.md) is
> `@influencer/*` (e.g. `@influencer/db`). Phase 0 standardises on it, and the CI `--filter` targets in
> [09 §3](../architecture/09-devops-cicd.md) match those names.

### 7.2 `turbo.json` pipeline

Per [09 §4](../architecture/09-devops-cicd.md#4-turborepo-caching--task-pipeline):

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env", "tsconfig.base.json"],
  "globalEnv": ["NODE_ENV"],
  "remoteCache": { "enabled": true },
  "tasks": {
    "build":     { "dependsOn": ["^build"], "outputs": [".next/**", "!.next/cache/**", "dist/**"],
                   "env": ["DATABASE_URL", "NEXT_PUBLIC_API_URL"] },
    "lint":      { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"], "outputs": [] },
    "test":      { "dependsOn": ["build"], "outputs": ["coverage/**"] },
    "test:integration": { "dependsOn": ["build"], "cache": false },
    "dev":       { "cache": false, "persistent": true }
  }
}
```

`^build` builds upstream deps first (`@influencer/db`, `@influencer/types`, `@influencer/ui` before the
apps). Declared `env` keys are part of the cache hash so stale config can't be silently reused.
`pnpm dev` runs the persistent `dev` task across `apps/web` + `apps/api`.

### 7.3 Path aliases & tsconfig

- Shared base at `packages/config/tsconfig/base.json` with **`strict: true`, `noUncheckedIndexedAccess`,
  `verbatimModuleSyntax`, `isolatedModules`** — extended by every package/app, never relaxed per-package
  ([15 §1.1–1.2](../standards/15-coding-standards.md)).
- Aliases `@influencer/ui|types|config|db` (cross-package) and `@/*` (intra-app), resolved identically by
  TS, the bundler, and ESLint ([15 §1.3](../standards/15-coding-standards.md)). No deep relative traversal
  across package boundaries.

### 7.4 ESLint / Prettier / husky / lint-staged

- One flat ESLint config in `packages/config` (`strictTypeChecked`, `no-explicit-any: error`,
  `no-floating-promises`, `import/order`, `import/no-cycle`, `no-console: error`, the `process.env`
  restriction) with web/api overlays ([15 §2.2](../standards/15-coding-standards.md)).
- Prettier config in `packages/config` (`singleQuote`, `trailingComma: all`, `printWidth: 100`,
  `prettier-plugin-tailwindcss`) ([15 §2.1](../standards/15-coding-standards.md)).
- **husky** hooks: `pre-commit` → `pnpm lint-staged` (eslint `--fix --max-warnings=0` + prettier on staged
  files); `commit-msg` → commitlint (Conventional Commits) ([15 §2.3, §9](../standards/15-coding-standards.md)).

---

## 8. CI/CD & infra

Authoritative in [09-devops-cicd.md](../architecture/09-devops-cicd.md); Phase 0 stands up the pipeline
and the environments.

### 8.1 CI pipeline (GitHub Actions)

Stages ordered cheap→expensive, **fail fast**, Turborepo running only **affected** tasks with remote
cache ([09 §3](../architecture/09-devops-cicd.md#3-ci-pipeline-github-actions)):

1. **install** — pnpm + Node 20, `pnpm install --frozen-lockfile`.
2. **lint** — `turbo run lint`.
3. **typecheck** — `turbo run typecheck` (`tsc --noEmit`).
4. **unit** — `turbo run test`.
5. **build** — `turbo run build`.
6. **integration** — ephemeral Postgres 15 + Redis 7 services, `prisma migrate deploy`, `prisma db seed`,
   `turbo run test:integration` (proves the first migration + seed + `PointsService` against a real DB).
7. **deploy** — gated by GitHub **Environments**: staging on push to `main`/`develop`, production on
   annotated tag `vX.Y.Z` (required reviewer) ([09 §6](../architecture/09-devops-cicd.md#6-branching--deploy-mapping)).

For Phase 0, e2e (Playwright) may be a stub until there are flows to exercise; the **integration stage is
the meaningful gate** (migration applies, seed runs, ledger service passes). Coverage thresholds per
[08-testing-strategy](../architecture/08-testing-strategy.md) apply as flows arrive.

### 8.2 Local infra (`docker-compose`)

`docker-compose.yml` for local Postgres 15 + Redis 7 ([09 §1–2](../architecture/09-devops-cicd.md)):

```yaml
services:
  postgres:
    image: postgres:15
    environment: { POSTGRES_USER: app, POSTGRES_PASSWORD: app, POSTGRES_DB: influencer }
    ports: ['5432:5432']
    volumes: ['pgdata:/var/lib/postgresql/data']
  redis:
    image: redis:7
    ports: ['6379:6379']
volumes: { pgdata: {} }
```

`pnpm dev` assumes these are up. Locally there is no PgBouncer, so `DATABASE_URL` and `DIRECT_URL` point
at the same instance (as in CI) — pooling matters only in staging/prod ([09 §5](../architecture/09-devops-cicd.md)).

### 8.3 Env management

- **`.env.example`** committed, documenting every key by name (no values) — boot-time Zod validation
  fails fast on anything missing ([09 §9](../architecture/09-devops-cicd.md#9-secrets--config-management), [03 §5](../architecture/03-backend-architecture.md)).
- **`.env.local`** gitignored. Only `NEXT_PUBLIC_*` (e.g. `NEXT_PUBLIC_API_URL`) reaches the browser;
  secrets (`DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `JWT_*`, `ENCRYPTION_KEY`, provider keys) are
  server-only ([01 §7](../architecture/01-system-architecture.md), [09 §9](../architecture/09-devops-cicd.md)).
- Per-environment secret stores: Vercel env vars (web), Railway variables (api/data), GitHub Secrets +
  Environments (CI/deploy).

### 8.4 Vercel / Railway project setup

- **Vercel (web)** — project for `apps/web`; preview deploy per PR (pointing at the **staging** API),
  production aliased to the domain; `NEXT_PUBLIC_API_URL` set per environment scope
  ([09 §2 Vercel](../architecture/09-devops-cicd.md#2-infrastructure-topology)).
- **Railway (api + data)** — `api-staging` / `api-production` services (health-checked at `/health`),
  managed Postgres 15 (via PgBouncer, `DATABASE_URL` pooled / `DIRECT_URL` direct) and managed Redis 7;
  `prisma migrate deploy` runs as the **release command** before the new instance takes traffic
  ([09 §2 Railway, §5](../architecture/09-devops-cicd.md)).
- **Parity:** config differs, code/migrations do not; prod is never hand-edited; staging holds no raw PII
  ([09 §1](../architecture/09-devops-cicd.md#1-environments)).

---

## 9. Reuse notes — the "build once" contract

**Everything in Phase 0 *is* the reuse foundation.** No later phase re-creates any of it; they consume
it. This is the enforceable contract every subsequent module doc points back to:

- **One ledger.** All point movement goes through `PointsService.award()/spend()`. No feature ever writes
  `points_transactions` or `points_balances` directly ([03 §4](../architecture/03-backend-architecture.md#4-pointsservice--the-shared-ledger),
  [15 §8](../standards/15-coding-standards.md)). Ledger behaviour is tested **once**, centrally.
- **One design system.** UI comes from `@influencer/ui` + the tokens/preset. Feature code never ships a
  one-off button/input/modal/table or a raw hex color; new shared components are added to `packages/ui`
  first (story + a11y), then consumed ([13 §10](../design-system/13-components-library.md#10-rules),
  [11 §6](../design-system/11-color-system.md), [06 §6](../architecture/06-frontend-architecture.md#6-component-reuse-strategy)).
- **One contract.** Every DTO is a Zod schema in `@influencer/types`, consumed by both the API
  (`ZodValidationPipe`) and the web (RHF resolver + typed client). A breaking change fails compilation on
  both sides ([01 §6](../architecture/01-system-architecture.md#6-shared-types-flow-frontend--backend-in-sync),
  [05 §5](../architecture/05-api-conventions.md)).
- **One envelope + error set.** The global interceptor + exception filter produce `{ data, error, meta }`
  and the canonical error codes; controllers return plain DTOs ([05 §2–4](../architecture/05-api-conventions.md),
  [03 §3.3](../architecture/03-backend-architecture.md)).
- **One auth model.** `AuthGuard`/`RolesGuard`/`AdminGuard` + `@CurrentUser()`; ownership in services.
  Phase 1 issues tokens; every later phase's endpoints reuse these guards ([03 §3.6–3.7](../architecture/03-backend-architecture.md)).
- **One config discipline.** Boot-time Zod-validated env; `POINTS_PER_INR = 100` and all constants live in
  config, never in code ([03 §5](../architecture/03-backend-architecture.md), [15 §7.4](../standards/15-coding-standards.md)).
- **One data source of truth.** The Prisma schema in `packages/db`; later phases add tables via
  migrations, never a second schema ([04 §4](../architecture/04-database-architecture.md)).
- **One pipeline.** The turbo + GitHub Actions pipeline and the Vercel/Railway topology serve every phase
  unchanged ([09](../architecture/09-devops-cicd.md)).

If a later phase needs something shared that does not exist yet, it is **added to the foundation** (a
`packages/*` or an exported service) — not copied into a feature. That is the whole point of Phase 0.

---

## 10. Acceptance criteria

Phase 0 is **done** when all of the following pass (the phase-level DoD in
[roadmap §Definition of Done](../phases/00-roadmap.md#definition-of-done-every-phase) also applies):

1. **`pnpm dev` runs web + api.** `apps/web` serves on `:3000`, `apps/api` on `:4000`, both against the
   docker-compose Postgres + Redis.
2. **Health checks green.** `GET /v1/health/live` returns `200`; `GET /v1/health/ready` returns `200` with
   Postgres + Redis up (and `503` when a dependency is down).
3. **Migration applies.** `prisma migrate deploy` (via `DIRECT_URL`) applies `0000_init_identity_points`
   cleanly on a fresh database; `prisma generate` produces the client.
4. **Seed runs (idempotently).** `prisma db seed` inserts 14 profile categories, the spin game + 8
   segments (probabilities summing to `1.0000`), the rewards catalogue, and one super-admin — and
   re-running changes nothing.
5. **`PointsService` unit tests pass.** `award`/`spend` behave per the ledger invariants (see [§12](#12-test-cases)).
6. **Storybook shows the base kit.** `Button`, `Input`, `FormField`, `Modal`, `Card`, `Text`, `Heading`
   render with stories and pass the a11y addon.
7. **Token-based sample page renders.** `app/(app)/sample/page.tsx` renders inside `AppShell` using only
   semantic tokens / `@influencer/ui` primitives (no raw hex), light **and** dark theme, and successfully
   calls `GET /v1/health/ready` through the typed API client (envelope unwrapped).
8. **Envelope + errors verified.** A `@Public()` test route returns the success envelope; a forced error
   returns the canonical `{ data: null, error: { code, ... }, meta }` shape with the right status.
9. **CI is green.** install → lint → typecheck → unit → build → integration all pass on a PR; Turborepo
   remote cache is active.
10. **Deploy targets configured.** Vercel (web) and Railway (`api-staging` + Postgres + Redis) exist and a
    staging deploy of the skeleton succeeds; `production` environment is gated with a required reviewer.
11. **Boot-time validation fails fast.** Removing a required env var causes the API to exit on startup
    with a clear error (not a lazy failure at first use).

---

## 11. Tasks (ordered, PR-sized)

Each is one focused PR (< ~400-line diff where practical), Conventional-Commit titled
([15 §9](../standards/15-coding-standards.md)), green on CI before merge.

1. **`chore(repo): init pnpm + turborepo monorepo`** — root `package.json` (workspaces, `packageManager`),
   `pnpm-workspace.yaml`, empty `apps/*` + `packages/*`, `turbo.json`, `.gitignore`.
2. **`chore(config): shared tsconfig + eslint + prettier presets`** — `packages/config` bases; root
   `tsconfig.base.json`; verify `strict` + aliases resolve.
3. **`chore(repo): husky + lint-staged + commitlint`** — pre-commit + commit-msg hooks.
4. **`feat(db): prisma init + identity/points/admins/audit models`** — `packages/db` schema (Phase 0
   slice, [§4.1](#41-tables-created-in-phase-0)); generate client.
5. **`feat(db): first migration + generated client re-export`** — `0000_init_identity_points` with FK +
   hot-path indexes; `@influencer/db` barrel.
6. **`feat(db): idempotent seed scaffold`** — 14 categories, spin game + 8 segments, rewards, super-admin
   ([§4.3](#43-seed-contents-prepared-here-consumed-later)).
7. **`feat(config): tailwind preset + design tokens`** — `packages/config/tailwind-preset.ts`,
   `packages/ui/src/styles/tokens.css` ([11](../design-system/11-color-system.md)).
8. **`feat(ui): base component kit + storybook`** — `Text`, `Heading`, `Button`, `Input`, `FormField`,
   `Modal`, `Card` with stories + a11y ([§6.4](#64-base-ui-kit-phase-0-set)).
9. **`feat(ui): AppShell + Header shell`** — [§6.3](#63-appshell--header).
10. **`feat(api): nestjs bootstrap + config module`** — `main.ts`, global pipe/interceptor/filter,
    request-id middleware, Zod env validation ([§5.1, §5.4](#5-backend-setup-appsapi)).
11. **`feat(api): prisma + redis modules`** — `@Global` `PrismaModule`/`RedisModule` + services.
12. **`feat(api): health module (live/ready)`** — terminus, `@Public()` ([§5.5](#55-health-endpoint)).
13. **`feat(points): PointsService skeleton + unit tests`** — `award`/`spend`, tx-aware, idempotent
    ([§5.3](#53-pointsservice-skeleton), [§12](#12-test-cases)).
14. **`feat(auth): guards + JWT key loading + TokenService shell`** — no flows ([§5.6](#56-auth-scaffold-guards--keys--no-flows)).
15. **`feat(web): app router skeleton + providers + globals.css`** — route groups, root layout, theme
    provider, `tokens.css` import ([§6.1–6.2](#6-frontend-setup-appsweb)).
16. **`feat(web): typed API client (envelope-aware)`** — `apiFetch` + `ApiError`, server/client variants
    ([§6.5](#65-typed-api-client)).
17. **`feat(web): token-driven sample page in AppShell`** — acceptance criterion #7.
18. **`ci(repo): github actions pipeline + turbo remote cache`** — install→lint→typecheck→unit→build→
    integration ([§8.1](#81-ci-pipeline-github-actions)).
19. **`chore(infra): docker-compose + .env.example`** — local Postgres/Redis + env docs ([§8.2–8.3](#82-local-infra-docker-compose)).
20. **`chore(infra): vercel + railway project setup (staging)`** — projects, env scopes, production gate
    ([§8.4](#84-vercel--railway-project-setup)).

---

## 12. Test cases

Coverage targets and tooling live in [08-testing-strategy](../architecture/08-testing-strategy.md); the
tests Phase 0 must ship:

### 12.1 Smoke / integration

| # | Test | Expected |
|---|---|---|
| S1 | Boot the Nest app with valid env | starts; `GET /v1/health/live` → `200` |
| S2 | `GET /v1/health/ready` with Postgres + Redis up | `200`, both dependencies `up` |
| S3 | `GET /v1/health/ready` with Redis down | `503`, `redis` reported down |
| S4 | Boot with a required env var removed | process **exits at startup** with a clear validation error (§5.4) |
| S5 | `prisma migrate deploy` on a fresh DB | migration applies; expected tables + indexes exist |
| S6 | `prisma db seed` then re-run | 14 categories / spin game+8 segments / rewards / 1 super-admin; re-run is a no-op |
| S7 | Seed segment integrity | `SUM(game_segments.probability) = 1.0000` for the spin game |
| S8 | Success envelope | a `@Public()` test route returns `{ data, error: null, meta: { requestId } }` |
| S9 | Error envelope | a forced domain error returns `{ data: null, error: { code, message }, meta }` with the mapped status ([05 §4](../architecture/05-api-conventions.md)) |
| S10 | `AuthGuard` on a protected route without a token | `401 UNAUTHENTICATED` |

### 12.2 `PointsService` unit test skeleton

Instantiate with a fake `tx`; assert the invariants from
[04 §5](../architecture/04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6) /
[03 §4](../architecture/03-backend-architecture.md#4-pointsservice--the-shared-ledger):

```ts
// points.service.spec.ts
describe('PointsService', () => {
  it('award() writes one CREDIT row and updates balance + lifetimeEarned', async () => { /* … */ });
  it('spend() writes one DEBIT row and updates balance + lifetimeSpent', async () => { /* … */ });
  it('spend() throws UNPROCESSABLE (insufficient_points) when balance would go negative', async () => { /* … */ });
  it('throws UNPROCESSABLE (invalid_points_amount) when points <= 0', async () => { /* … */ });
  it('is idempotent: same idempotencyKey returns the existing row, no double-credit', async () => { /* … */ });
  it('on a concurrent unique-violation race, returns the already-applied row', async () => { /* … */ });
  it('snapshots balanceAfter inside the transaction (self-describing history row)', async () => { /* … */ });
});
```

An **integration** variant runs the same assertions against a real Postgres (testcontainers / CI service)
and additionally verifies **transaction rollback**: if a synthetic domain write fails inside the same
`$transaction`, the point credit rolls back and no ledger row remains ([03 §10](../architecture/03-backend-architecture.md#10-testing-seams)).

### 12.3 CI verifying build/lint/typecheck

- **T1** — `turbo run lint` fails the PR on any ESLint error or warning (`--max-warnings=0`,
  [15 §2.3](../standards/15-coding-standards.md)).
- **T2** — `turbo run typecheck` fails on any type error, including a deliberate DTO-shape break in
  `@influencer/types` failing **both** apps ([15 §1.1](../standards/15-coding-standards.md)).
- **T3** — `turbo run build` succeeds for `apps/web`, `apps/api`, and all packages; caches populate.
- **T4** — the integration job (ephemeral Postgres + Redis) runs migrate + seed + `test:integration`
  green (exercises S5–S7 and the ledger integration test).

### 12.4 Frontend smoke

- **F1** — Storybook builds; every base-kit story renders and passes the a11y addon ([§6.4](#64-base-ui-kit-phase-0-set)).
- **F2** — the sample page renders inside `AppShell` in light and dark theme using only semantic tokens
  (no raw hex — lint-enforced, [15 §6.3](../standards/15-coding-standards.md)).
- **F3** — the typed API client unwraps a success envelope to `data` and throws a typed `ApiError` on an
  error envelope ([06 §3.3](../architecture/06-frontend-architecture.md)).

---

## Related documents

- [00-project-overview.md](../00-project-overview.md) — vision, module map, points/INR constant, spec gaps.
- [phases/00-roadmap.md](../phases/00-roadmap.md) — build order, cross-cutting sequencing, DoD.
- [01-system-architecture.md](../architecture/01-system-architecture.md) — monorepo layout, boundaries, request lifecycle.
- [03-backend-architecture.md](../architecture/03-backend-architecture.md) — NestJS structure, `PointsService`, config, health. ⭐
- [04-database-architecture.md](../architecture/04-database-architecture.md) — schema, ledger rules, seed. ⭐
- [05-api-conventions.md](../architecture/05-api-conventions.md) — envelope, error codes, auth, pagination. ⭐
- [06-frontend-architecture.md](../architecture/06-frontend-architecture.md) — App Router, tokens, API client. ⭐
- [09-devops-cicd.md](../architecture/09-devops-cicd.md) — pipeline, environments, migrations, secrets. ⭐
- [11-color-system.md](../design-system/11-color-system.md) — design tokens, dark mode, Tailwind preset. ⭐
- [13-components-library.md](../design-system/13-components-library.md) — the shared UI kit. ⭐
- [15-coding-standards.md](../standards/15-coding-standards.md) — TS/ESLint/Prisma/Nest/React rules. ⭐
- **Next:** [module-01-auth-registration.md](module-01-auth-registration.md) — the first feature phase.

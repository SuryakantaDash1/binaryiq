# 09 — DevOps, CI/CD & Infrastructure ⭐

How the **BinaryIQ** is built, tested, shipped, observed, and recovered. This is the
operational contract for the monorepo. It complements the data contract in
[04-database-architecture.md](04-database-architecture.md) and the API contract in
[05-api-conventions.md](05-api-conventions.md).

**Stack recap** (see [../00-project-overview.md](../00-project-overview.md)): a **Turborepo** monorepo
with a **Next.js** web app on **Vercel** and a **NestJS** API + **PostgreSQL 15** + **Redis** on
**Railway**. Package manager is **pnpm**. Environments are `local → staging → production` per the
[roadmap](../phases/00-roadmap.md).

> Naming: this doc uses `develop` for the integration branch and `main` for the production line. If the
> project standardises on a single trunk (`main` only), the mapping in §6 collapses to
> "trunk → staging, tags → production" — the pipeline stages are unchanged.

---

## 1. Environments

Three long-lived environments plus ephemeral PR previews. **Parity is a first principle**: every
environment runs the same container image / build artifact and the same migration set; only
configuration (env vars/secrets) and data differ. Nothing is hand-edited in a running environment.

| Aspect | `local` | `staging` | `production` |
|---|---|---|---|
| Purpose | Develop & debug | Pre-prod verification, QA, smoke, UAT | Live members |
| Web | `next dev` (localhost:3000) | Vercel (staging project/branch) | Vercel (production domain) |
| API | `nest start --watch` (localhost:4000) | Railway `staging` service | Railway `production` service |
| Postgres | Docker (`postgres:15`) or Railway dev DB | Railway managed (small plan) | Railway managed (HA plan) |
| Redis | Docker (`redis:7`) | Railway managed | Railway managed |
| Object storage | LocalStack / Cloudinary dev folder | S3/Cloudinary `staging` bucket | S3/Cloudinary `prod` bucket |
| Data | Seed + throwaway | **Anonymised** subset, safe to wipe | Real PII (encrypted) |
| Secrets source | `.env.local` (gitignored) | Vercel/Railway env (staging scope) | Vercel/Railway env (prod scope) |
| Migrations | `prisma migrate dev` | `prisma migrate deploy` (auto on deploy) | `prisma migrate deploy` (gated on release) |
| Who can deploy | Any dev, locally | Auto on merge to `develop`/`main` | Release manager / maintainers via tag + approval |
| External providers | Sandbox keys (SendGrid/Twilio/FCM/PayPal) | Sandbox keys | Live keys |

**Parity principles**

- **Config, not code, differs.** Environment-specific behaviour is driven by env vars validated at boot
  (fail-fast if missing). No `if (env === 'production')` business logic.
- **Same artifact promoted.** The image/build that passed staging is the one released; we do not rebuild
  from source per environment where avoidable.
- **Same migration set.** A migration is applied to staging before production, in order, never skipped.
- **Prod is never edited by hand.** No manual DB writes, no console env tweaks. Changes flow through
  Git → CI → deploy.
- **Staging holds no raw PII.** Data is anonymised on refresh so a staging leak is not a personal-data
  breach (DPDP Act 2023 — see [07-security-compliance.md](07-security-compliance.md)).

---

## 2. Infrastructure topology

```
                 ┌─────────────────────────── Vercel ───────────────────────────┐
   Members ──▶   │  Edge Network / CDN  ──▶  Next.js (apps/web)                   │
                 │  • static + ISR cached at edge   • preview deploy per PR        │
                 └───────────────┬───────────────────────────────────────────────┘
                                 │  HTTPS (server actions / fetch → NEXT_PUBLIC_API_URL)
                                 ▼
                 ┌─────────────────────────── Railway ──────────────────────────┐
                 │  NestJS API (apps/api)  ──▶  PgBouncer ──▶  Postgres 15         │
                 │        │                                    (managed, backups) │
                 │        └──▶  Redis 7 (managed)                                  │
                 └───────────────┬───────────────────────────────────────────────┘
                                 ▼
        Object storage: AWS S3 (private) or Cloudinary  •  presigned uploads
        Providers: SendGrid • Twilio • FCM • WhatsApp Cloud API • PayPal Payouts
        Observability: Sentry (errors) • pino → log drain • uptime checks
```

### Vercel (web)
- Hosts `apps/web` (Next.js). Serves static assets and ISR pages from the **edge CDN**; SSR/route
  handlers run in Vercel's serverless/edge runtime.
- **Preview deploys**: every PR gets a unique immutable URL. Previews point at the **staging** API and a
  safe data set (never production).
- **Production**: the production branch/tag deploy is aliased to the primary domain. Instant rollback via
  "promote previous deployment".
- The web app talks to the API over HTTPS using `NEXT_PUBLIC_API_URL`; only `NEXT_PUBLIC_*` vars are
  exposed to the browser — everything else is server-only.

### Railway (API + data)
- **NestJS API service** — containerised (Nixpacks or Dockerfile), autoscaled by plan, health-checked at
  `/health` (see §8). One service per environment (`api-staging`, `api-production`).
- **Managed Postgres 15** — the source of truth ([04](04-database-architecture.md)). App connects
  through **PgBouncer** (transaction pooling) via `DATABASE_URL`; migrations use the unpooled
  `DIRECT_URL` (§5).
- **Managed Redis 7** — sessions, OTP, daily-spin lock, rate-limit counters
  ([04 §6](04-database-architecture.md)). Not a durable store; every Redis fact has a DB backstop.

### Object storage
- User photos and reward assets live in **S3 (private bucket)** or **Cloudinary**. Uploads use
  **presigned URLs** (client → storage direct); the API never proxies file bytes.
- Buckets are per-environment and private-by-default; public delivery is via CDN/Cloudinary transforms.
- Photo URLs are stored as `photo_url` on `user_profiles` ([04](04-database-architecture.md)).

### Secrets & env-var management per platform
| Platform | Where vars live | Scoping |
|---|---|---|
| Vercel | Project → Settings → Environment Variables | `Development` / `Preview` / `Production` |
| Railway | Service → Variables (+ shared **project variables**) | per environment/service |
| GitHub Actions | Repo/Org **Secrets** + **Environments** (`staging`, `production`) | required reviewers on `production` |
| Local | `.env.local` from `.env.example` | never committed |

Details, ownership, and rotation in §9.

---

## 3. CI pipeline (GitHub Actions)

Every push/PR runs the pipeline. Stages are ordered cheap→expensive and **fail fast**. Turborepo runs
only **affected** tasks and hydrates from **remote cache**, so most PRs finish in a fraction of a full
build.

**Stage order**

1. **install** — checkout, setup pnpm + Node, restore pnpm store cache, `pnpm install --frozen-lockfile`.
2. **lint** — `turbo run lint` (ESLint + Prettier check).
3. **typecheck** — `turbo run typecheck` (`tsc --noEmit`).
4. **unit tests** — `turbo run test` (Vitest/Jest).
5. **build** — `turbo run build` (affected + remote cache).
6. **integration tests** — spin up an **ephemeral Postgres** service, `prisma migrate deploy`, run
   API integration tests against it.
7. **e2e** — **Playwright** against a built app (web + API + DB wired via Docker/compose or Railway
   preview). Traces/screenshots uploaded on failure.
8. **deploy** — only on protected branches/tags, gated by the GitHub **Environment** approval (§6).

Quality gates: full green required for merge; coverage thresholds enforced per
[08-testing-strategy.md](08-testing-strategy.md).

### Sample workflow (skeleton)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
  push:
    branches: [main, develop]
    tags: ['v*']

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}      # Vercel Remote Cache
  TURBO_TEAM: ${{ vars.TURBO_TEAM }}
  STORE_PATH: ~/.pnpm-store

jobs:
  verify:
    name: Lint · Typecheck · Unit · Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }               # full history → turbo affected

      - uses: pnpm/action-setup@v4             # version pinned via package.json#packageManager
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install
        run: pnpm install --frozen-lockfile

      - run: pnpm turbo run lint typecheck test build
        # affected + remote cache handled by turbo.json

  integration:
    name: Integration (ephemeral Postgres)
    runs-on: ubuntu-latest
    needs: verify
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: app
          POSTGRES_PASSWORD: app
          POSTGRES_DB: app_test
        ports: ['5432:5432']
        options: >-
          --health-cmd="pg_isready -U app"
          --health-interval=5s --health-timeout=5s --health-retries=10
      redis:
        image: redis:7
        ports: ['6379:6379']
    env:
      DATABASE_URL: postgresql://app:app@localhost:5432/app_test
      DIRECT_URL:   postgresql://app:app@localhost:5432/app_test   # no pooler in CI
      REDIS_URL:    redis://localhost:6379
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @binaryiq/db prisma migrate deploy
      - run: pnpm --filter @binaryiq/db prisma db seed   # deterministic test seed
      - run: pnpm turbo run test:integration

  e2e:
    name: E2E (Playwright)
    runs-on: ubuntu-latest
    needs: integration
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm turbo run build
      - run: pnpm turbo run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: playwright-report/ }

  deploy-staging:
    name: Deploy → staging
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    needs: [e2e]
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      # Railway API deploy (migrations run via release command, see §5)
      - run: railway up --service api-staging
        env: { RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN_STAGING }} }
      # Web deploys automatically via the Vercel Git integration.

  deploy-production:
    name: Deploy → production
    if: startsWith(github.ref, 'refs/tags/v')
    needs: [e2e]
    runs-on: ubuntu-latest
    environment: production            # requires reviewer approval
    steps:
      - uses: actions/checkout@v4
      - run: railway up --service api-production
        env: { RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN_PROD }} }
```

> The `deploy-*` jobs assume Railway CLI. Web deploys are driven by Vercel's native Git integration
> (preview per PR, production on the production branch/alias). Keep secrets in GitHub **Environments** so
> `production` can enforce required reviewers.

---

## 4. Turborepo caching & task pipeline

`turbo.json` declares the task graph, inputs/outputs, and cacheability. Local runs use the local cache;
CI and developers share the **Vercel Remote Cache** (`TURBO_TOKEN`/`TURBO_TEAM`), so a build another
machine already produced is downloaded instead of recomputed.

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env", "tsconfig.base.json"],
  "globalEnv": ["NODE_ENV"],
  "remoteCache": { "enabled": true },
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"],
      "env": ["DATABASE_URL", "NEXT_PUBLIC_API_URL"]
    },
    "lint":      { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"], "outputs": [] },
    "test":      { "dependsOn": ["build"], "outputs": ["coverage/**"] },
    "test:integration": { "dependsOn": ["build"], "cache": false },
    "test:e2e":  { "dependsOn": ["build"], "cache": false },
    "dev":       { "cache": false, "persistent": true }
  }
}
```

Notes:
- `^build` = build upstream workspace deps first (e.g. `@binaryiq/db`, `@binaryiq/ui` before `apps/web`/`apps/api`).
- `.next/cache` is excluded from outputs; integration/e2e/`dev` are **never cached** (side effects).
- `env` keys are part of each task's cache hash — changing a declared var invalidates the cache, so
  cached artifacts can't silently carry stale config.
- CI uses `pnpm turbo run <task> --filter=...[origin/main]` (affected) to skip untouched packages.

---

## 5. Database migrations in CI/CD

Prisma Migrate, per [04 §7](04-database-architecture.md). **Two connection strings** (Prisma + PgBouncer):

| Var | Points at | Used for |
|---|---|---|
| `DATABASE_URL` | Postgres **via PgBouncer** (transaction pooling) | the running app (short-lived, pooled queries) |
| `DIRECT_URL` | Postgres **directly** (no pooler) | `prisma migrate` / introspection (needs advisory locks, DDL) |

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled — app runtime
  directUrl = env("DIRECT_URL")     // unpooled — migrations
}
```

**Flow**
- **Local**: `prisma migrate dev` creates + applies a migration and regenerates the client. One
  migration per PR; reviewed; **never edit an applied migration**.
- **Staging/Production**: on deploy, a **release step** runs `prisma migrate deploy` (applies pending
  migrations only, no schema drift authoring) using `DIRECT_URL`, **before** the new app instance takes
  traffic. On Railway this is the service *release command*; it runs once per deploy, not per instance.

**Backward-compatible (expand/contract) rule** — because migrate runs before the new code and old
instances may briefly overlap, every migration must be safe for the *currently running* code:
1. **Expand**: add columns/tables/indexes as **nullable / with defaults**; deploy code that writes both.
2. **Migrate data**: backfill in a separate step/job.
3. **Contract**: only after the new code is fully live, a *later* migration drops the old column/constraint.

Forbidden in a single release: renaming/dropping a column still read by live code, adding a `NOT NULL`
column with no default, or a blocking `CREATE INDEX` on a hot table (use `CONCURRENTLY` where supported).

**Seeding** — `packages/db/prisma/seed.ts` seeds the 14 profile-survey categories, the Spin-the-Wheel
game + 8 segments, the initial rewards catalogue, and a super-admin
([04 §7](04-database-architecture.md)). Seeds are **idempotent** (`upsert`) so re-running is safe.
Reference data is seeded on all environments; test seeds are deterministic for CI.

---

## 6. Branching → deploy mapping

Follows the team Git workflow (see [06-git-workflow.md](06-git-workflow.md) when published; conventions
below are the contract until then).

| Git event | Builds/tests | Deploys to | Migrations | Approval |
|---|---|---|---|---|
| **PR opened / pushed** | full CI | **Vercel Preview** (per-PR URL) → staging API | none (preview reuses staging DB) | none |
| **Merge → `develop`** | full CI | staging (early integration) | `migrate deploy` on staging | auto |
| **Merge → `main`** | full CI | **staging** (release candidate) | `migrate deploy` on staging | auto |
| **Tag `vX.Y.Z`** (from `main`) | full CI | **production** | `migrate deploy` on prod | **required reviewer** |

- Preview deploys are **immutable** and safe to share for review/QA; they never touch production data.
- Production ships **only from an annotated tag** cut off `main`, gated by the GitHub `production`
  Environment (required reviewers) — this is the human checkpoint before members are affected.
- All branches are short-lived; PRs must be green and up to date with base before merge.

---

## 7. Release process, versioning & rollback

**Versioning** — Semantic Versioning `MAJOR.MINOR.PATCH`, single version for the deployable set, tagged
`vX.Y.Z`. A `CHANGELOG.md` is generated from Conventional Commits.

**Release steps**
1. Cut a release branch/PR off `main`; ensure CI green and staging smoke-tested (roadmap DoD §8).
2. Bump version, update changelog, open release PR, get approval.
3. Merge and push tag `vX.Y.Z` → triggers the gated production deploy.
4. Release command runs `prisma migrate deploy`, then the new API instance rolls in behind the health
   check; Vercel promotes the production build.
5. Post-deploy **smoke test** (auth, points award, health) + watch Sentry/metrics for the release window.

**Rollback strategy**
- **Web (Vercel)**: instant — promote the previous deployment (immutable, seconds).
- **API (Railway)**: redeploy the previous image/commit (previous release is retained).
- **Fast path**: for a bad but non-schema release, roll the app back first, investigate second.

**Database rollback — caution.** Migrations are **roll-forward only** in production. Do **not**
`migrate resolve`/down-migrate a live DB. Because we follow expand/contract (§5), an app rollback stays
compatible with the newer schema (the new columns are additive/nullable), so reverting code does **not**
require reverting the DB. If data is corrupted, prefer a forward-fix migration or a
**point-in-time restore** (§10) — never a destructive down-migration on production. The append-only
`points_transactions` ledger ([04 §5](04-database-architecture.md)) means financial state is corrected
with new `ADJUSTMENT` rows, never by editing history.

---

## 8. Observability & ops

**Structured logging** — the NestJS API uses **pino** (JSON logs). Every log line carries `service`,
`env`, `level`, `time`, and a **`requestId`**. A middleware/interceptor reads or generates
`x-request-id` per request and binds it to a request-scoped logger, so a single request is traceable
end-to-end (web → API → DB). Logs are shipped to a drain/aggregator; **never log PII in plaintext** —
encrypted PII fields ([04 §1](04-database-architecture.md)) stay out of logs.

**Error tracking** — **Sentry** on both `apps/web` and `apps/api`, with release tagging (`vX.Y.Z`) and
source maps uploaded in CI so stack traces are readable. Errors correlate to `requestId` and release.

**Health checks** — API exposes:
- `GET /health` (liveness) — process is up.
- `GET /health/ready` (readiness) — checks Postgres + Redis connectivity before receiving traffic.
Railway uses these for deploy gating and restarts; uptime monitoring (e.g. Better Uptime / Pingdom)
polls a public health endpoint for both web and API.

**Metrics & alerts** — platform metrics (CPU/memory/instances) from Railway; app metrics (request rate,
p95 latency, error rate, queue depth for notification sends). **Alerts** page on: API 5xx rate spike,
readiness failing, DB connection saturation, Redis eviction, points **reconciliation drift**
([04 §5](04-database-architecture.md)), and failed provider webhooks (PayPal/SendGrid).

**Log retention** — application logs 30–90 days operationally; **`audit_logs` and `consent_logs`
retained ≥ 180 days** to satisfy **CERT-In 2022** directions (and DPDP accountability). Audit/consent
data lives in Postgres ([04](04-database-architecture.md)), included in backups (§10), and is
append-only. See [07-security-compliance.md](07-security-compliance.md).

---

## 9. Secrets & config management

- **Source of truth per platform** (§2): Vercel env vars (web), Railway variables (API/data), GitHub
  Secrets + Environments (CI/deploy). No secrets in the repo, in `NEXT_PUBLIC_*`, or in logs.
- **`.env.example`** is committed and documents every required key (name only). Boot-time schema
  validation (e.g. `zod`/`envalid`) fails fast if a required var is missing or malformed.
- **Least privilege**: separate credentials per environment; staging cannot reach production data;
  provider keys are sandbox in non-prod.
- **Sensitive keys**: `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, JWT signing secret, the **AES-256
  application encryption key** (PII, [04 §1](04-database-architecture.md)), SendGrid/Twilio/FCM/WhatsApp
  and PayPal credentials, S3/Cloudinary keys, `SENTRY_DSN`, `TURBO_TOKEN`, `RAILWAY_TOKEN`.

**Rotation**
- Routine rotation ≤ 90 days for provider/API keys; JWT and encryption keys rotated via versioned keys
  so old data stays decryptable during transition (key-id tagged).
- **Immediate** rotation on suspected exposure or contributor offboarding.
- Rotate by updating the platform secret store and redeploying (no code change). DB/Redis credentials
  rotated through Railway. Track rotation dates in the ops runbook.

---

## 10. Backups & disaster recovery

- **Automated Postgres backups** on Railway: nightly full + point-in-time recovery (WAL). Backups are
  **encrypted at rest (AES-256)** and cover audit/consent tables for compliance.
- **Retention**: daily ≥ 30 days; the 180-day audit-retention requirement (§8) is met by the DB rows
  themselves plus backup coverage.
- **Restore drills**: quarterly — restore latest backup into a throwaway environment, run migrations +
  smoke tests, verify row counts and ledger integrity. A backup is not "done" until a restore is proven.
- **Redis** is treated as ephemeral (rebuildable from Postgres); no DR dependency on it.
- **Object storage**: S3 versioning + lifecycle (or Cloudinary's managed durability); buckets are
  region-durable and access-logged.

**Targets**

| Metric | Target | Meaning |
|---|---|---|
| **RPO** | ≤ 5 min (PITR) / ≤ 24 h (nightly) | max acceptable data loss |
| **RTO** | ≤ 1 h (app) / ≤ 4 h (full DB restore) | max acceptable downtime |

DR runbook: (1) declare incident + status page, (2) restore DB to last good PITR point, (3) redeploy
last-good app image, (4) rehydrate Redis (auto), (5) reconcile ledger + verify audit continuity,
(6) post-incident review. Ledger reconciliation ([04 §5](04-database-architecture.md)) is the final
integrity gate before reopening traffic.

---

## 11. Cost & scaling notes

- **Scaling**: Vercel scales the web tier automatically (edge/serverless). The Railway API scales
  vertically by plan and horizontally by replicas; **Postgres connection count is the real ceiling** —
  hence **PgBouncer** transaction pooling (§5) lets many API workers share few DB connections.
- **Redis** absorbs hot paths (sessions, daily-spin lock, rate limits) so they don't hit Postgres.
- **Turborepo remote cache** is the main CI cost lever — cache hits cut build minutes and speed PRs.
- **Vercel edge/CDN + ISR** keeps origin/API load low for cacheable pages; keep dynamic member data on
  the API.
- **Cost guardrails**: right-size Railway plans per environment (staging small, prod HA); set spend
  alerts on Vercel/Railway/AWS; expire Playwright artifacts and old preview deploys; keep object storage
  lifecycle rules (transition/expire).
- **Scale triggers to watch** (§8 alerts): sustained p95 latency, DB connection saturation, Redis
  eviction rate — each maps to a specific lever (add API replicas, raise pool/DB plan, raise Redis memory).

---

## See also

- [00-project-overview.md](../00-project-overview.md) — product & stack.
- [04-database-architecture.md](04-database-architecture.md) — schema, ledger, `DATABASE_URL`/`DIRECT_URL`, seed.
- [05-api-conventions.md](05-api-conventions.md) — API envelope, errors, pagination.
- [07-security-compliance.md](07-security-compliance.md) — encryption, DPDP/CERT-In, audit.
- [08-testing-strategy.md](08-testing-strategy.md) — coverage gates for CI.
- [../phases/00-roadmap.md](../phases/00-roadmap.md) — environments & definition of done.

# 02 — Technology Stack ⭐

The authoritative record of **what** we build the BinaryIQ with and **why**. This document
is decision-of-record for every technology choice; module and architecture docs reference it rather
than re-arguing a choice. If a technology is swapped, it is changed here first (with rationale) before
any code moves.

Read alongside:
[00-project-overview](../00-project-overview.md) ·
[04-database-architecture](04-database-architecture.md) ·
[05-api-conventions](05-api-conventions.md) ·
[phases/00-roadmap](../phases/00-roadmap.md).

---

## 1. Guiding principles

Every choice below serves one or more of these constraints — they are the tie-breakers when two
options look equal on paper:

1. **One language end-to-end (TypeScript).** Frontend, backend, shared contracts, tests, and infra
   scripts are all TS. A single mental model, one toolchain, one hiring profile, and — critically —
   **types shared across the network boundary** (see `packages/types`).
2. **Type safety from DB to DOM.** Prisma types → NestJS DTOs → Zod schemas in `packages/types` →
   React Hook Form → UI. A schema change surfaces as a compile error, not a runtime 500.
3. **Managed over self-hosted.** A small team ships product, not infrastructure. We prefer managed
   Postgres/Redis and PaaS deploys over running our own clusters.
4. **Swappable providers behind interfaces.** Email/SMS/push/payments/storage are abstracted so a
   vendor can be replaced without touching domain code (a launch risk called out in the
   [roadmap](../phases/00-roadmap.md#risk-notes)).
5. **Boring, well-supported, LTS.** We pin to stable, widely-adopted, actively-maintained versions —
   no bleeding edge in the critical path (ledger, auth, payments).
6. **Compliance-first.** India DPDP 2023 / CERT-In / GDPR-ready obligations influence auth, crypto,
   audit, and hosting-region choices.

---

## 2. Master stack table

Versions are the **current stable / LTS** target at time of writing; see
[§16 Version pinning & upgrade policy](#16-version-pinning--upgrade-policy) for how they are held and
advanced.

| Layer | Technology | Version | Why chosen | Alternatives considered & why rejected |
|---|---|---|---|---|
| Language | **TypeScript** | 5.x | One language across the whole stack; structural typing; shared contracts over the wire. | Plain JS (no type safety); ReScript/Elm (niche, hiring). |
| Runtime | **Node.js** | 20 LTS | LTS stability to 2026; native fetch/test runner; universal ecosystem for FE+BE. | Bun (young, prod gaps in 2024); Deno (ecosystem/NestJS friction). |
| Monorepo | **Turborepo** + **pnpm workspaces** | Turbo 2.x / pnpm 9 | Remote-cached task graph; incremental FE+BE builds; content-addressed installs. | Nx (heavier, more opinionated); Lerna (largely superseded); npm/yarn workspaces (slower, no cache graph). |
| Frontend framework | **Next.js (App Router)** | 14 | RSC + streaming, file routing, image/SEO, first-class Vercel deploy. | Remix (smaller ecosystem); plain Vite SPA (no SSR/SEO); Nuxt (Vue, breaks single-language). |
| UI runtime | **React** | 18 | Concurrent features, Server Components, largest ecosystem. | Vue/Svelte/SolidJS (fine tech, but off the React/Next path we standardized on). |
| Styling | **Tailwind CSS** | 3.x | Utility-first, token-driven, zero runtime, tree-shaken. | CSS Modules (verbose); styled-components/Emotion (runtime cost, RSC friction). |
| Component primitives | **Radix UI** | 1.x | Unstyled, accessible (WAI-ARIA) primitives — a11y for free. | Headless UI (smaller set); MUI/Chakra (opinionated styling fights Tailwind). |
| Variant system | **class-variance-authority (cva)** + **tailwind-merge** | latest | Typed component variants; deterministic class merging. | Hand-rolled `clsx` conditionals (unscalable, untyped). |
| Icons | **lucide-react** | latest | Consistent, tree-shakeable SVG set, MIT. | Font Awesome (licensing/weight); Heroicons (smaller set). |
| Toasts | **sonner** | latest | Accessible, lightweight, promise-aware notifications. | react-toastify (heavier, dated API). |
| Backend framework | **NestJS** | 10 | Modular DI architecture, guards/interceptors/pipes, first-class TS. | Express (unstructured at scale); Fastify raw (less structure); FastAPI/Python (see [§7](#7-why-nestjs-decision-of-record)). |
| API style | **REST + OpenAPI** (Nest) | — | Simple, cacheable, matches CRUD domain; typed client from schema. | GraphQL (overkill for this domain, N+1/caching cost); tRPC (couples to TS client, weaker for external/webhook consumers). |
| Database | **PostgreSQL** | 15 | ACID + row locking for the ledger; JSONB for flexible survey answers; enums; mature. | MySQL (weaker JSON/enum/CTE story); MongoDB (no ACID guarantees for a **financial ledger**). |
| ORM | **Prisma** | 5.x | Type-safe client, declarative migrations, single source-of-truth schema. | TypeORM (decorator drift, migration pain); Drizzle (younger); Knex (no types). |
| Cache / queue broker | **Redis** | 7 | Daily-spin lock, sessions, rate limits, OTP, BullMQ backend. | Memcached (no data structures/persistence); in-memory (not multi-instance safe). |
| Job queue | **BullMQ** (on Redis) | latest | Reliable delayed/retry jobs for notifications, reconciliation, payouts. | Agenda (Mongo-based); cloud queues (extra infra, vendor lock). |
| Auth | **NextAuth.js** + **JWT (RS256)** | NextAuth 4.x / jose | Session mgmt on web, asymmetric-signed stateless API tokens. | Auth0/Clerk (cost, data-residency for DPDP); session-cookie-only (no clean API auth). |
| Validation / contracts | **Zod** (in `packages/types`) | 3.x | One schema → TS type + runtime validation, shared FE↔BE. | Yup (weaker inference); Joi (no TS-native types); class-validator alone (not shareable to FE). |
| Forms | **React Hook Form** | 7.x | Uncontrolled perf, minimal re-renders, `zodResolver` bridge. | Formik (more re-renders, less active); controlled state (perf). |
| Email | **SendGrid** | v3 API | High deliverability, templates, webhooks; behind a provider interface. | AWS SES (more setup/warm-up); Mailgun; Postmark. |
| SMS / WhatsApp | **Twilio** | latest SDK | One vendor for SMS **and** WhatsApp (OTP + notifications). | MSG91 (regional); Vonage; AWS SNS (no WhatsApp). |
| Push | **Firebase Cloud Messaging (FCM)** | latest SDK | Free, reliable web/mobile push; standard for PWA. | OneSignal (extra vendor); web-push VAPID only (no mobile path later). |
| File storage | **AWS S3** (primary) / **Cloudinary** (image transform) | latest SDK | Durable object store; Cloudinary for on-the-fly avatar/image transforms. | Local disk (not durable/scalable); GCS/Azure Blob (fine, but S3 is the ecosystem default). |
| Payments / payouts | **PayPal Payouts** | Payouts v1 | Spec-mandated cash payout rail; Payouts API for reward redemptions. | Stripe Connect (payout availability/region); Razorpay (payouts fit less cleanly to the spec). |
| Unit / integration tests | **Vitest** (web) / **Jest** (api) | latest | Vitest = fast Vite-native FE tests; Jest = NestJS default with rich mocking. | One runner everywhere (each tool is best-in-class in its half). |
| E2E tests | **Playwright** | latest | Cross-browser, auto-wait, trace viewer, CI-friendly. | Cypress (single-process model, flakier cross-browser). |
| Lint / format | **ESLint** + **Prettier** | latest | Standard TS quality gates, wired into the Turbo pipeline. | Biome (promising but not yet standard here); tslint (deprecated). |
| Hosting (web) | **Vercel** | — | Native Next.js host: edge, previews, image optimization. | Netlify; self-host (loses Next integrations). |
| Hosting (api/db/redis) | **Railway** | — | Managed Node + Postgres + Redis, simple env promotion. | Render; Fly.io; raw AWS (more ops overhead). |

---

## 3. Frontend

**Next.js 14 (App Router) + React 18 + TypeScript**, in `apps/web`.

- **App Router + React Server Components** keep data-heavy pages (dashboard, transaction history,
  survey lists) light on client JS; interactive islands (spin animation, poll voting, forms) are
  client components. Streaming/`Suspense` improves perceived load on list pages that use cursor
  pagination (per [05-api-conventions](05-api-conventions.md)).
- **Responsive web only** for the initial release — no native apps ([overview §3](../00-project-overview.md#3-non-goals-initial-release));
  Next.js gives us a clean PWA path later without re-platforming.
- **SEO & performance**: `next/image`, metadata API, and Vercel's edge/image optimization matter for
  a public, consumer-facing acquisition surface.
- **Styling** is Tailwind-only, driven by design tokens in
  [11-color-system](../design-system/11-color-system.md); components come from
  [13-components-library](../design-system/13-components-library.md) and `packages/ui`. No one-off
  colors or forked components (a [Definition-of-Done](../phases/00-roadmap.md#definition-of-done-every-phase) gate).

## 4. Backend

**NestJS 10 + TypeScript**, in `apps/api`. Rationale is expanded in [§7](#7-why-nestjs-decision-of-record).

- **Modular architecture** maps 1:1 to the [module map](../00-project-overview.md#4-module-map-build-modules):
  `AuthModule`, `PointsModule`, `SurveysModule`, `PollsModule`, `GamesModule`, `NotificationsModule`,
  etc. Each is a self-contained Nest module with its own controllers/services/providers.
- **DI + Guards + Interceptors + Pipes** give us cross-cutting concerns for free: `JwtAuthGuard`,
  ownership/authZ guards, a response-envelope interceptor, a `ZodValidationPipe`, and audit-logging
  middleware (audit is present from Phase 0 per the [roadmap](../phases/00-roadmap.md#cross-cutting-concerns-present-from-phase-0)).
- **The `PointsService`** — the platform's financial core — lives here and enforces the append-only
  ledger invariants defined in [04-database §5](04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6),
  wrapping domain writes in a single Prisma `$transaction`.
- **REST + OpenAPI**: endpoints follow the shared envelope, error shape, auth, and pagination rules in
  [05-api-conventions](05-api-conventions.md). OpenAPI generation feeds a typed client.

## 5. Database & ORM

**PostgreSQL 15 + Prisma 5.** The full data model is authoritative in
[04-database-architecture](04-database-architecture.md); this section covers only the *choice*.

- **Postgres** is chosen for the **ledger**: it needs ACID transactions and `SELECT … FOR UPDATE`
  row locking so a point credit and its domain write commit or roll back together. A document store
  cannot make that guarantee — non-negotiable for a monetary system (`100 points = ₹1.00`).
- **JSONB** stores flexible, data-driven survey/question definitions and answers (`Json @db.JsonB`)
  without schema churn, while relational integrity holds for identity, points, and redemptions.
- **Prisma** gives a single declarative schema as source-of-truth, fully typed client (types flow
  into DTOs and `packages/types`), and reviewed, versioned migrations (one per PR).
- **Connection pooling** via `DATABASE_URL` (pooled) + `DIRECT_URL` (migrations) per the
  Prisma + PgBouncer guidance in [04-database §7](04-database-architecture.md#7-migrations--seeding).

## 6. Cache, queue & background jobs

**Redis 7 + BullMQ.**

- **Redis** is the fast path for the **daily Spin-the-Wheel lock** (`spin:daily:{userId}`), sessions,
  OTP (`otp:{phone}`), rate-limit counters, and in-progress registration drafts — the full key map is
  in [04-database §6](04-database-architecture.md#6-redis-usage-not-postgres-but-part-of-data-layer).
  The DB unique constraint on `game_plays` is the durable backstop; Redis is speed, Postgres is truth.
- **BullMQ** (Redis-backed) runs asynchronous, retryable work: notification fan-out (email/SMS/
  WhatsApp/push), nightly **ledger reconciliation**, token cleanup, and PayPal payout processing.
  Delayed jobs power survey/game reminders. Keeping this on Redis avoids introducing a second broker.

## 7. Why NestJS (decision of record)

### 7.1 Why NestJS over Next.js API routes

Next.js *can* host backend logic via Route Handlers, and we still use a few (auth callbacks, light
BFF glue). But the **core API is a standalone NestJS service** because:

| Concern | Next.js API routes | NestJS |
|---|---|---|
| Architecture | Ad-hoc per-file handlers | First-class **modules** matching our domain map |
| Cross-cutting logic | Manual per-route wiring | **Guards / interceptors / pipes** applied declaratively |
| Dependency injection | None (manual imports) | Built-in DI → testable, mockable providers |
| The `PointsService` | Would be re-imported and re-wired everywhere | One injected, transaction-owning service |
| Background jobs | Awkward (serverless, no long-lived workers) | Natural home for BullMQ workers |
| Testability | Route-level only | Unit-test services in isolation via DI |
| Deploy shape | Coupled to the web app / serverless limits | Independent, long-lived service on Railway; scales & deploys separately |

A financial ledger, queue workers, webhook handlers (SendGrid/Twilio/PayPal), and per-endpoint authZ
want a **structured, long-lived server** — not serverless request handlers. Splitting `apps/web` and
`apps/api` also lets the two scale and deploy independently.

### 7.2 Why NestJS over Python / FastAPI

FastAPI is excellent, but it is **rejected** here:

- **Breaks single-language.** It reintroduces Python — a second runtime, dependency manager, lint/format
  toolchain, and hiring profile — violating principle #1.
- **No shared types over the wire.** Our biggest safety win is one Zod schema in `packages/types`
  validating both client and server. A Python backend severs that; we would hand-maintain parallel
  Pydantic + TS models and they *will* drift.
- **No ML/data-science need.** The single reason to reach for Python — heavy ML/numeric work — does
  not exist in this product ([non-goals](../00-project-overview.md#3-non-goals-initial-release)). The
  weighted spin outcome is a trivial weighted-random pick, not ML.
- **DI/guards/testability parity.** Everything FastAPI offers (DI, validation, OpenAPI) NestJS also
  offers **inside our existing TypeScript stack**, so there is no capability we would gain.

**Decision:** NestJS. Python/FastAPI is only revisited if a genuine ML workload appears, and even then
as an isolated service behind the same REST contract — never as the primary API.

## 8. Auth

**NextAuth.js (web sessions) + JWT signed with RS256 (API).**

- **RS256 (asymmetric)** means the API signs tokens with a private key and any service verifies with
  the public key — no shared secret to leak, and clean key rotation. Suits a split web/api topology.
- **NextAuth** manages the web session/refresh flow; sessions ride in Redis (`session:{sessionId}`).
- **`JwtAuthGuard`** plus ownership/role guards enforce authZ on every NestJS endpoint;
  `AdminRole` (from [04-database](04-database-architecture.md)) drives admin RBAC.
- Managed IdPs (Auth0/Clerk) were rejected on **cost and DPDP data-residency** grounds — auth data
  and PII stay within infrastructure we control. Hardening details live in `07-security-compliance.md`.

## 9. Forms & validation

**React Hook Form + Zod (via `packages/types`).**

- **Zod is the contract layer.** Each schema lives once in `packages/types`, yielding both a static TS
  type and a runtime validator. The **same schema** validates the RHF form on the client and the
  request body on the server (NestJS `ZodValidationPipe`) — no drift between UI rules and API rules.
- **React Hook Form** provides performant, uncontrolled forms; `@hookform/resolvers`' `zodResolver`
  wires Zod straight into field-level validation. This powers 2-step registration, the 14 data-driven
  profile-survey forms, and all account tabs.

## 10. UI / design system

**Radix UI + Tailwind + cva + tailwind-merge + lucide-react + sonner**, packaged in `packages/ui`.

- **Radix** supplies accessible, unstyled primitives (dialog, dropdown, tabs, tooltip, radio/checkbox);
  we skin them with Tailwind so accessibility is built in, not bolted on.
- **cva + tailwind-merge** give typed, conflict-free component variants (button/input/badge sizes and
  intents).
- **lucide-react** (icons) and **sonner** (toasts) round out the primitives.
- All of it is consumed through the shared kit and tokens
  ([13-components-library](../design-system/13-components-library.md),
  [11-color-system](../design-system/11-color-system.md)); phases consume the kit and never fork it.

## 11. Notifications providers

Four channels, each behind a **provider interface** so vendors are swappable and mockable
(a [roadmap risk](../phases/00-roadmap.md#risk-notes)); orchestrated via BullMQ and governed by
`notification_preferences` ([04-database](04-database-architecture.md)):

| Channel | Provider | Use |
|---|---|---|
| Email | **SendGrid** | Verification (+500 flow), survey invites/reminders, reward updates |
| SMS | **Twilio** | OTP, transactional alerts |
| WhatsApp | **Twilio** | Opt-in engagement/reminders |
| Push | **Firebase FCM** | Web (and future mobile/PWA) push; tokens in `push_tokens` |

Deep design is in `07-notifications` module doc / `module-07-notifications`. Minimal email exists from
Phase 1; full multi-channel arrives in Phase 7.

## 12. File storage

**AWS S3 (durable object store) + Cloudinary (image transforms).**

- **S3** for durable storage of profile photos and any uploaded assets; presigned URLs for
  direct-to-bucket uploads.
- **Cloudinary** for on-the-fly avatar resizing/format optimization, avoiding home-grown image
  pipelines. Both sit behind a storage interface so the pair can be collapsed to one later.

## 13. Payments

**PayPal Payouts.**

- The reward system converts points to cash payouts (`100 points = ₹1.00`) and charity donations. The
  **PayPal Payouts API** disburses cash redemptions; the payout id is recorded on
  `reward_redemptions.fulfillmentRef` ([04-database](04-database-architecture.md)).
- Payout jobs run through **BullMQ** with retries and idempotency keys so a retried webhook never
  double-pays (ledger idempotency, [04-database §5](04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6)).
- The mid-tier voucher/merchandise gap is handled by the data-driven `rewards` table, not new
  payment rails ([overview §7.2](../00-project-overview.md#7-resolved-spec-gaps-decisions-of-record)).

## 14. Testing

**Vitest (web) · Jest (api) · Playwright (e2e).**

- **Vitest** for `apps/web` and `packages/*` — Vite-native, fast, jsdom + React Testing Library.
- **Jest** for `apps/api` — the NestJS default, with strong module/provider mocking for service and
  ledger unit tests.
- **Playwright** for cross-browser e2e of the milestone flows (register→verify→login, earn→redeem,
  vote, spin) called out in the [roadmap milestones](../phases/00-roadmap.md#milestones).
- Coverage targets and the full pyramid live in `08-testing-strategy` and gate each phase's
  [Definition of Done](../phases/00-roadmap.md#definition-of-done-every-phase).

## 15. Tooling & monorepo

**Turborepo + pnpm 9 + ESLint + Prettier.**

- **Workspaces:** `apps/web`, `apps/api`, and shared `packages/ui`, `packages/types` (Zod contracts),
  `packages/config` (shared ESLint/TS/Tailwind config), `packages/db` (Prisma schema, client, seed).
- **Turborepo** orchestrates `build`/`lint`/`test`/`typecheck` as a cached task graph — only affected
  packages rebuild, and remote cache shares results across CI and developers.
- **pnpm 9** for fast, disk-efficient, content-addressed installs with strict, non-hoisted
  `node_modules` (prevents phantom dependencies).
- **ESLint + Prettier** are shared via `packages/config` and enforced in the Turbo pipeline and CI.

## 16. Version pinning & upgrade policy

- **Exact pins for the critical path.** Runtime, framework, ORM, DB client, auth, and crypto libs are
  pinned to exact versions in `package.json`; `pnpm-lock.yaml` is committed and is the source of truth.
  No floating ranges on anything touching the ledger, auth, or payments.
- **Caret ranges only for low-risk leaf libs** (icons, toasts) where a minor bump is safe.
- **One toolchain version** across the repo: Node 20 LTS pinned via `engines` + `.nvmrc`; pnpm pinned
  via `packageManager`. CI fails on mismatch.
- **Cadence:**
  - *Patch* — applied promptly (security patches immediately, via the process below).
  - *Minor* — batched roughly monthly behind green CI.
  - *Major* — deliberate, its own PR, with a migration note; **Node** follows LTS (stay on an active
    LTS, upgrade before EOL); **Postgres** and **Prisma** majors get a staging soak before production.
- **Renovate/Dependabot** opens grouped update PRs; nothing merges without a green Turbo pipeline
  (lint + typecheck + unit + integration + e2e smoke).
- **Migrations promote with the app** through `local → staging → production`
  ([roadmap environments](../phases/00-roadmap.md#environments)); an applied Prisma migration is never
  edited ([04-database §7](04-database-architecture.md#7-migrations--seeding)).

## 17. Dependency governance

How a **new dependency** enters the repo:

1. **Justify.** Prefer the platform/stdlib or an existing dep. A new package must earn its place —
   trivial helpers get written in-house, not installed.
2. **Vet.** Check maintenance (recent releases, open-issue health), license (permissive: MIT/Apache-2.0/
   ISC — copyleft needs explicit sign-off), bundle-size impact for `apps/web`, transitive-dependency
   weight, and known CVEs (`pnpm audit`).
3. **Place correctly.** Shared runtime code → the right `packages/*`; app-only deps stay in that app;
   dev tools go in `devDependencies`. No duplicate libraries doing the same job across workspaces
   (single toaster, single icon set, single date lib, etc.).
4. **Wrap external services.** SDKs for SendGrid/Twilio/FCM/S3/PayPal are used **only behind our
   provider interfaces**, never called directly from domain code — keeping them swappable and mockable.
5. **Review.** Adding a dependency is a reviewed PR change; the diff to `package.json` +
   `pnpm-lock.yaml` is scrutinized, and CI (incl. audit) must pass.
6. **Pin.** Critical-path additions are pinned per [§16](#16-version-pinning--upgrade-policy).

**Removal is a feature.** Unused dependencies are pruned as deliberately as they are added; a periodic
`depcheck`/`knip` pass keeps the graph lean.

---

## 18. Deployment & CI/CD (summary)

`apps/web` → **Vercel** (edge, preview deploys per PR, image optimization). `apps/api` + **PostgreSQL**
+ **Redis** → **Railway** (managed, simple env promotion). CI runs the Turborepo pipeline
(lint → typecheck → test → build) with remote caching; migrations promote with the app across
`local → staging → production`. Full pipeline detail lives in `09-devops-cicd`.

---

### Related documents

[00-project-overview](../00-project-overview.md) ·
[04-database-architecture](04-database-architecture.md) ·
[05-api-conventions](05-api-conventions.md) ·
[phases/00-roadmap](../phases/00-roadmap.md) ·
[design-system/11-color-system](../design-system/11-color-system.md) ·
[design-system/13-components-library](../design-system/13-components-library.md)

# 08 — Testing Strategy ⭐

How we prove the **BinaryIQ** works and stays working. This is the single source of truth
for *what* we test, *where* each kind of test lives, *how* we isolate and seed data, and the *gates* a
change must pass to merge. Module docs list their own acceptance criteria; the mechanics, layering,
coverage targets, and CI gates live **here** and are not repeated per module.

Read first for context: [00-project-overview](../00-project-overview.md),
[04-database-architecture](04-database-architecture.md) (the points ledger — the highest-risk thing we
test), [05-api-conventions](05-api-conventions.md) (envelope/error contract the API tests assert),
and [phases/00-roadmap](../phases/00-roadmap.md) (Definition of Done references this doc).

---

## 1. Testing pyramid & philosophy

We follow a classic **testing pyramid**: many fast unit tests, a focused band of integration tests
against real infrastructure, and a small set of high-value end-to-end (e2e) journeys. We do **not**
chase an inverted "ice-cream cone" of slow, brittle UI tests.

```
            ▲  few          E2E (Playwright)              ~10–20 journeys
           ╱ ╲               user-visible flows, real browser, seeded DB
          ╱   ╲   some       Integration                   ~hundreds
         ╱     ╲             API + Testcontainers Postgres, Supertest, Redis
        ╱       ╲  many      Unit                           ~thousands
       ╱_________╲           services (mocked Prisma), Zod, hooks, components
```

**Principles**

- **Fast feedback first.** The unit layer runs in-memory with no network or DB and must complete in
  seconds. Developers run it on save; CI runs it on every push.
- **Test behaviour, not implementation.** Assert observable outcomes (API responses, DB rows, rendered
  text, emitted provider calls), not private methods or internal call counts — except where a call
  *is* the contract (e.g. "a suppressed notification must **not** call the email provider").
- **Push logic down the pyramid.** A rule provable at the unit layer (weighted-spin selection, balance
  math, Zod validation) is tested there; integration tests confirm the wiring and the DB constraints;
  e2e confirms the human journey. We do not re-assert the same rule at three layers — each layer tests
  what *only it* can.
- **Determinism is mandatory.** Every test injects its clock and RNG (§4). No `Date.now()`,
  `Math.random()`, or real timers in assertions. A test that can flake will flake in CI at 2 a.m.
- **The ledger gets the most scrutiny.** Points integrity is the platform's financial guarantee
  ([04 §5](04-database-architecture.md)); it earns the highest coverage bar and the most adversarial
  tests (§3.1, §6).
- **Contract over duplication.** Web and API share Zod types from `packages/types`; contract tests
  (§9) prevent drift instead of hand-maintaining two copies of each DTO shape.

**What each layer owns**

| Layer | Owns (only it can prove) | Does NOT re-test |
|---|---|---|
| Unit | Business rules, pure functions, validation, component rendering, hook state | DB constraints, HTTP wiring |
| Integration | Prisma queries, transactions, DB unique/FK constraints, envelope shaping, guards | Pixel layout, animation |
| E2E | Multi-step human journeys across web↔api↔db | Every branch of a rule (unit did that) |

---

## 2. Tooling & rationale

| Concern | Tool | Why |
|---|---|---|
| Unit — web & packages | **Vitest** | Native ESM/TS, Vite-fast, jsdom, first-class in a Vite/Next workspace; shares config with the app build. |
| Unit/integration — api (NestJS) | **Jest** | See decision below. |
| API integration (HTTP) | **Supertest** | Drives the real Nest HTTP app in-process; asserts status + envelope without a network hop. |
| Integration DB | **Testcontainers** (Postgres 15) + Prisma | A real, disposable Postgres per run — exercises actual constraints, transactions, `FOR UPDATE`, enums. A mock cannot prove a `@@unique` blocks a double-vote. |
| Redis integration | **Testcontainers** (Redis 7) | Real daily-spin lock / rate-limit counters; ioredis-mock is a fallback for pure unit tests. |
| Component tests (web/ui) | **React Testing Library** (+ Vitest + jsdom) | User-centric queries (`getByRole`), discourages testing internals. |
| UI catalog + a11y | **Storybook** + **@storybook/addon-a11y** (axe) | Visual/interaction docs for `packages/ui`; a11y addon fails stories on WCAG violations. |
| Provider mocking | **MSW** + provider interface fakes | Intercept outbound HTTP (SendGrid/Twilio/FCM/PayPal) at the network boundary; no real sends. |
| E2E | **Playwright** | Cross-browser, auto-wait, trace viewer, parallel workers, great CI story. |
| Schema/DTO | **Vitest** over Zod | `packages/types` schemas tested as plain functions. |
| Load/perf | **k6** | Scriptable load on hot paths (spin/vote); thresholds as pass/fail gates (§10). |

### Decision: Jest for `apps/api`, Vitest everywhere else

**Choice:** **Jest** for the NestJS API; **Vitest** for `apps/web`, `packages/ui`, `packages/types`.

**Justification.** NestJS ships first-class Jest support: `@nestjs/testing`'s `Test.createTestingModule`,
the default `--maxWorkers` isolation, and the ecosystem's documented mocking patterns all target Jest.
Its DI-container test harness, `jest.mock` for the Prisma client, and Supertest examples are the
paved road; deviating buys friction for no gain. The web/packages side is Vite-native, so Vitest is the
paved road *there* — same config as the build, instant HMR-speed watch mode, and jsdom for components.
Using each ecosystem's default keeps both fast and low-maintenance. The one cross-cutting artifact,
the Zod contract in `packages/types`, is framework-agnostic and consumed by both runners, so the split
does not fragment the contract tests (§9). Turborepo runs both under one `turbo run test` (§8).

---

## 3. Layer-by-layer strategy

### 3.0 Directory & naming conventions

- Co-locate unit tests: `foo.service.ts` → `foo.service.spec.ts` (Nest/Jest convention),
  `useSpin.ts` → `useSpin.test.ts` (web/Vitest convention).
- Integration tests live under `apps/api/test/integration/**/*.int-spec.ts` and are selected by a
  separate Jest project/config so the fast unit run never boots a container.
- E2E lives under `apps/web/e2e/**/*.e2e.ts` (Playwright) and `apps/api/test/e2e` for pure API journeys.
- Every test file states its layer in the name (`.spec` unit, `.int-spec` integration, `.e2e`).

### 3.1 `apps/api` (NestJS) — the heart of the test suite

Three tiers, ascending in cost:

**(a) Service unit tests — mocked Prisma.** The default. Instantiate the service with a mocked
`PrismaService` (a deep mock, e.g. `vitest-mock-extended`/`jest-mock-extended`) and mocked provider
interfaces. Test every branch of business logic:

```ts
// points.service.spec.ts (illustrative)
describe('PointsService.award', () => {
  it('credits within a single $transaction and snapshots balanceAfter', async () => {
    const tx = mockTx({ balance: 500 });
    prisma.$transaction.mockImplementation((fn) => fn(tx));
    await service.award({ userId, action: 'POLL_VOTE', points: 15, idempotencyKey: 'poll:v:1' });
    expect(tx.pointsTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ balanceAfter: 515, direction: 'CREDIT' }) }));
    expect(tx.pointsBalance.update).toHaveBeenCalled(); // same tx
  });
  it('is a no-op on duplicate idempotencyKey (P2002)', async () => { /* unique-violation → swallow, no double credit */ });
  it('throws UNPROCESSABLE when spend exceeds balance', async () => { /* 422 path */ });
});
```

Mocked-Prisma tests prove *logic and control flow* (sign of direction, `balanceAfter` math, error
mapping, idempotency handling) — but they **cannot** prove the DB actually enforces a constraint or
that `$transaction` truly rolls back. That is the next tier's job.

**(b) Integration tests — real Postgres via Testcontainers.** Boot a throwaway Postgres 15 container,
`prisma migrate deploy`, and run the *real* `PrismaService` against it. These prove the things a mock
lies about:

- The `@@unique([pollId, userId])` constraint really rejects a second vote (→ maps to `409 CONFLICT`).
- The `@@unique([userId, gameId, playDate])` really enforces one spin per day at the DB level.
- `points_transactions.idempotencyKey @unique` really blocks a double-credit under concurrent inserts.
- A domain write + ledger insert in one `$transaction` **both roll back** when the domain write fails
  (deliberately throw after the ledger row is created; assert **zero** rows persisted).
- Cascade deletes, enum acceptance, and `FOR UPDATE` locking behave as designed.

**(c) Controller/e2e via Supertest.** Build the full Nest app with
`Test.createTestingModule({ imports: [AppModule] })`, apply the same global pipes/interceptors/filters
as production, wire it to the Testcontainers DB + Redis, and hit real HTTP. Assert the
[05-api-conventions](05-api-conventions.md) contract end-to-end:

- Every success wraps `{ data, error: null, meta.requestId }`; every error wraps
  `{ data: null, error: { code, message, details? } }`.
- Status↔code mapping: `409 CONFLICT` (double vote/spin, email taken), `422 UNPROCESSABLE`
  (insufficient points, survey full/expired), `401 UNAUTHENTICATED`, `403 FORBIDDEN`, `400
  VALIDATION_ERROR` with `details[]`.
- Guards: unauthenticated → 401; wrong owner → 403; non-admin hitting `/admin/*` → 403.
- `Idempotency-Key` header threads through to the ledger `idempotencyKey`.
- Cursor pagination shape on list endpoints (`meta.pagination.nextCursor`).
- Webhook endpoints (`/v1/webhooks/{provider}`) reject bad signatures and process valid ones exactly
  once.

### 3.2 `apps/web` (Next.js)

- **Component tests (RTL + Vitest/jsdom):** render components with realistic props; assert by role/text;
  test loading/empty/error states, form validation surfacing (Zod errors → field messages), and
  accessibility affordances. Network calls are stubbed with **MSW** (§5) so a component test never hits
  a real API.
- **Hook tests:** custom hooks (`useSpin`, `usePointsBalance`, auth/session hooks) via
  `renderHook`; assert state transitions, optimistic updates, and error rollback. Inject clock/RNG.
- **Server components / route handlers:** test data-shaping logic as plain functions; MSW backs any
  fetch. Keep Next-specific plumbing thin so it needs little testing.
- **E2E (Playwright):** real browser against a running web+api+seeded-DB stack — the journeys in §7.

### 3.3 `packages/ui`

- **RTL component tests** for logic-bearing components (inputs, modals, the points widget, spin wheel).
- **Storybook** is the canonical catalog; every exported component has a story with its key states.
- **`@storybook/addon-a11y` (axe)** runs on stories; **a WCAG violation fails the story** in CI
  (`test-runner` + axe). This is our first-line accessibility gate — no bespoke colors/contrast
  regressions, consistent with [13-components-library](../design-system/13-components-library.md) and
  [11-color-system](../design-system/11-color-system.md).
- Interaction tests via Storybook `play` functions for complex components (wheel spin animation state,
  multi-step forms) where a story doubles as a test.

### 3.4 `packages/types` (Zod schemas)

The DTO contract. Tested as pure functions with Vitest:

- **Accept** valid payloads (representative fixtures per DTO).
- **Reject** each invalid case with the expected issue path (bad email, negative points, missing
  required field, wrong enum) — these map to `VALIDATION_ERROR.details[]` at the API.
- **Boundary** cases: max lengths, `limit` ≤ 100 (pagination), integer-only points, UUID format.
- **Inference guard:** a `tsd`/type-level test that `z.infer` matches the exported TS type, so the
  frontend and API cannot drift from the schema.

---

## 4. Test data, fixtures & isolation

### 4.1 Factories over fixtures

A typed **factory** per aggregate (`makeUser`, `makePoll`, `makeGameWithSegments`, `makeReward`,
`makeLedgerEntry`) produces valid objects with sane defaults and per-test overrides. Factories return
data shaped by the Prisma models in [04](04-database-architecture.md) so they never drift from schema.
Prefer factories to static JSON fixtures — they are composable and self-documenting.

```ts
const user = makeUser({ isVerified: true });
const game = makeGameWithSegments({ segments: EIGHT_SPEC_SEGMENTS }); // probs sum to 1.0000
```

### 4.2 Seed vs. per-test data

- The shared `packages/db/prisma/seed.ts` (14 profile categories, spin game + 8 segments, rewards,
  super-admin) seeds **reference/config** data once per integration DB boot.
- **Transactional/user data** is created per test by factories, never assumed from a global seed, so
  tests don't couple to each other.

### 4.3 Isolation & cleanup

- **Unit:** no shared state; mocks reset in `beforeEach` (`vi.resetAllMocks` / `jest.resetAllMocks`).
- **Integration (default):** wrap each test in a DB transaction and **roll back** in `afterEach`
  (fast, total isolation) — *except* tests that themselves assert `$transaction`/rollback behaviour,
  which instead **truncate** the affected tables between tests. Truncation (not `DROP`) preserves the
  seeded reference rows.
- **One container per worker**, reused across a file's tests, torn down after the run. Never share a
  container between parallel workers writing the same rows.
- **E2E:** each spec provisions its own user(s) via an API/factory setup step and a unique email
  (`user+{uuid}@…`); no reliance on data another spec left behind.

### 4.4 Deterministic time & randomness (non-negotiable)

External-world sources are injected, never called directly:

- **Clock:** services depend on a `Clock` (or `TimeProvider`) interface; production binds it to system
  time, tests bind a `FixedClock`. This is essential for the **daily** spin (`playDate`), token
  **expiry** (`auth_tokens.expiresAt`), lockout windows (`lockedUntil`), and "next local midnight"
  Redis TTLs. Tests set the clock explicitly and, where needed, advance it (`fake timers`) to prove
  expiry/reset transitions.
- **RNG:** the weighted-spin selector takes an injected `Rng` (returns `[0,1)`). Tests feed a scripted
  sequence to land the wheel on a chosen segment deterministically, and a **seeded** PRNG for the
  statistical distribution test (§3.1 / §6). No test ever depends on real `Math.random()`.
- **UUIDs/request IDs:** injected or matched with a shape assertion, never asserted literally.

---

## 5. Mocking external providers

All external providers sit behind **interfaces** (the platform's "abstract behind interfaces so they're
swappable and mockable" rule — [roadmap risk notes](../phases/00-roadmap.md)): `EmailProvider`
(SendGrid), `SmsProvider` (Twilio), `PushProvider` (FCM), `PayoutProvider` (PayPal). We mock at two
levels:

- **Unit tests** inject a **fake implementation** of the interface (in-memory spy) and assert *intent*:
  "verification email was requested for `user.email` with template `REGISTRATION`", "a suppressed
  channel produced **no** call". This is the primary way we test notification-preference suppression
  (§3 critical area) — a preference that is off must result in **zero** provider invocations.
- **Integration/e2e tests** use **MSW** to intercept the actual outbound HTTP the provider adapters
  make (SendGrid/Twilio/FCM/PayPal REST calls), returning canned success/failure/timeout responses.
  This exercises the real adapter code (serialization, retry, error mapping) without sending anything.
- **Webhooks** (inbound provider callbacks) are tested by posting signed sample payloads to
  `/v1/webhooks/{provider}`; MSW is not needed for inbound, but signature verification and
  idempotent processing are asserted (bad signature → rejected; same event twice → single effect).

No test suite ever holds real provider credentials; a missing key must not be reachable from tests.

---

## 6. Critical test areas (MUST be covered)

These are the platform's highest-risk behaviours. Each row is a **required** coverage area; a phase is
not "done" ([roadmap DoD](../phases/00-roadmap.md)) until its rows are green.

### 6.1 Points ledger integrity ⭐ (module 3; consumed by 1/5/6 — see [04 §5](04-database-architecture.md))

| Guarantee | Layer(s) | Test |
|---|---|---|
| Credit/debit is transactional | unit + **integration** | Force the domain write to throw after the ledger insert; assert **zero** ledger rows and **unchanged** balance (real `$transaction` rollback). |
| Idempotency — no double-credit | unit + **integration** | Two `award` calls with the same `idempotencyKey`; assert exactly one row and balance credited once (DB `@unique` proves it, even under concurrency). |
| Concurrency safety | **integration** | Fire N concurrent spins/votes for one user; assert exactly one succeeds, others get `409`, balance credited once (row-lock / unique). |
| **Balance == Σ ledger** | **integration** | After a randomized sequence of credits/debits, assert `points_balances.balance == Σ(credits) − Σ(debits)` and `== last row's balanceAfter`. This is the invariant the nightly reconciliation also checks. |
| Direction sign correctness | unit | CREDIT increases, DEBIT decreases; `points` always stored positive. |
| Ledger append-only | **integration** | Attempt update/delete of a `points_transactions` row is not part of any service path; assert corrections are new `ADJUSTMENT` rows. |
| Insufficient balance blocks debit | unit + integration | Redemption with balance < cost → `422 UNPROCESSABLE`, no row written. |

### 6.2 Auth flows (module 1)

Register → email verify (+500) → login → password reset → **lockout**. Cover: duplicate email →
`409`; unverified login blocked; verification token single-use and **expiry** (FixedClock); reset token
single-use/expiry; `failedLogins` increments and `lockedUntil` locks after threshold, then unlocks
after the window (advance clock); the +500 registration bonus is credited **exactly once** via the
ledger (idempotency on `REGISTRATION_BONUS`).

### 6.3 One-vote-per-poll (module 5)

Unit: service rejects a second vote. **Integration:** the `@@unique([pollId, userId])` constraint
enforces it even if two requests race; second → `409 CONFLICT`; the 15-pt credit happens once, in the
same transaction as the vote, and counters (`total_votes`, `vote_count`) increment atomically.

### 6.4 One-spin-per-day (module 6) — Redis + DB unique

The **Redis** `spin:daily:{userId}` lock is the fast path; the `@@unique([userId, gameId, playDate])`
is the durable backstop. Tests:

- Second spin same `playDate` → `409` (Redis short-circuits; if Redis is flushed, the DB unique still
  blocks — test both by clearing Redis and retrying).
- Reset at "next local midnight": advance FixedClock past midnight → a new spin is allowed (new
  `playDate`, new Redis key/TTL).
- Race: two concurrent spins → exactly one play row, one credit.

### 6.5 Weighted-random spin distribution (statistical)

The server picks the segment via the injected `Rng` over segment `probability` weights (sum = 1.0000).
Two complementary tests:

- **Deterministic:** feed scripted RNG values landing on the boundary of each segment; assert the exact
  segment and its `pointsValue` — proves the cumulative-weight selection is correct per segment.
- **Statistical:** with a **seeded** PRNG, draw a large N (e.g. 100k) and assert each segment's observed
  frequency is within tolerance of its probability (chi-square goodness-of-fit, or per-segment
  `|observed − expected| < 3σ`). Seeded ⇒ deterministic pass/fail, not flaky. Also assert probabilities
  sum to exactly `1.0000` (guards the seed/config).

### 6.6 Redemption balance checks (module 3)

Redeem with sufficient balance → `PENDING` redemption + single DEBIT, balance decremented in one
transaction; insufficient → `422`, nothing written; reward `stock` (when not null) decremented and
`stock == 0` blocks further redemptions.

### 6.7 Notification preference suppression (module 7)

For each `NotificationType`, if a channel preference is off, dispatching that notification produces
**zero** calls to that channel's provider (asserted on the interface fake) and no `notifications` row
for the suppressed channel — while enabled channels still send. Default preferences (email/push on,
sms/whatsapp off) are honoured for a fresh user.

---

## 7. E2E scenarios (Playwright) — mapped to modules/phases

Small, high-value journeys only. Each runs against a running stack with a seeded DB and provider HTTP
intercepted by MSW (so verification/OTP emails are captured, not sent).

| # | Journey | Modules / Phase | Asserts |
|---|---|---|---|
| E1 | Register → receive verify link → verify → land on dashboard with **500 pts** | 1 / M1 | Full signup + ledger credit visible in UI |
| E2 | Login, lockout after N bad passwords, unlock after window | 1 | Auth + lockout UX |
| E3 | Password reset via emailed link | 1 | Reset token flow end-to-end |
| E4 | Complete a profile-survey category → points increment | 2 / M2 | Profile earning + dashboard update |
| E5 | Browse rewards → redeem a charity item → balance drops, redemption `PENDING` | 3 / M2 | Earn-and-redeem loop |
| E6 | Attempt redeem with insufficient points → blocked with clear message | 3 | `422` surfaced in UI |
| E7 | Match & complete a survey → points credited | 4 / M3 | Survey matching + credit |
| E8 | Vote on a poll → live results; second vote blocked | 5 / M3 | One-vote-per-poll + live % |
| E9 | Spin the wheel → animation → points; second spin same day blocked | 6 / M3 | Daily spin + Redis/DB lock |
| E10 | Toggle a notification preference off → that channel no longer notifies | 7 | Preference suppression |
| E11 | Chatbot FAQ → escalate to a support ticket | 8 | Luna escalation |
| E12 | Admin creates a poll → it appears for a member | 5 (+admin) | Admin authZ + propagation |

E2E is deliberately shallow per rule (branches are covered by unit/integration); it proves the *seams*
between web, api, and db hold.

---

## 8. CI integration

Detailed pipeline definition lives in [09-devops-cicd](09-devops-cicd.md); this section states what
runs and the gates.

**Where tests run in the pipeline** (per PR, blocking merge):

1. **Lint + typecheck** (`turbo run lint typecheck`) — fastest, fails first.
2. **Unit** (`turbo run test`) — Vitest (web/ui/types) + Jest (api unit) across the workspace, in
   parallel.
3. **Contract tests** (§9) — shared-type conformance.
4. **Integration** (`turbo run test:int`) — spins Testcontainers Postgres + Redis; runs api
   `.int-spec` + Supertest e2e-api. Requires Docker on the runner.
5. **Storybook a11y** (`turbo run test:storybook`) — axe over stories.
6. **E2E** (Playwright) — against an ephemeral stack (web + api + seeded DB); traces/videos uploaded on
   failure. Runs on PRs touching `apps/**` and always on the merge queue.

**Parallelization via Turborepo.** `turbo run` executes package tasks in parallel with dependency-aware
scheduling and **remote caching** — unchanged packages are cache hits, so a docs-only or single-package
change does not re-run the whole suite. Playwright shards across workers; integration tests shard by
Jest project with one container per worker.

**Gates.** A PR cannot merge unless: lint/typecheck pass, all unit+integration+contract suites green,
coverage thresholds met (§ below), Storybook a11y clean, and the E2E smoke set green. Coverage
regressions below threshold fail the build.

**Flaky-test policy.**

- A test that fails then passes on retry is **flaky by definition** and is treated as a defect, not a
  nuisance. CI allows **at most one automatic retry** for e2e (network reality); unit/integration get
  **zero** retries — they must be deterministic (§4).
- A flaky test is **quarantined** (tagged, excluded from the merge gate) with a tracking issue and an
  owner, and **must be fixed or deleted within one sprint**. Quarantine is a debt ledger, not a
  dumping ground; the quarantine list is reviewed each sprint and cannot grow unbounded.
- Repeated flakiness in the same area triggers a root-cause fix (usually a missing injected clock/RNG,
  a real timer, or shared DB state) rather than another retry.

---

## 9. Contract testing (web ↔ api)

The web and api share **one** definition of every request/response DTO: the Zod schemas in
`packages/types` ([05 §5](05-api-conventions.md)). Contract safety comes from making drift impossible
rather than diffing two hand-written copies:

- The API validates inbound requests with those exact schemas (`ZodValidationPipe`) and the frontend
  validates the same forms with them (React Hook Form). A field that changes shape breaks **both**
  sides' tests at compile/validation time.
- **Response contract tests** parse real API responses (from Supertest integration runs) through the
  corresponding response schema — if the controller returns a shape the schema rejects, the test fails.
  This asserts the [05](05-api-conventions.md) envelope and every DTO in one place.
- **Type-inference tests** (§3.4) assert `z.infer<typeof Schema>` equals the exported TS type, so the
  typed API client the frontend consumes cannot silently diverge.
- When a schema changes, the failing consumer tests are the signal — no separate consumer-driven
  contract broker is needed for a monorepo with a single shared type source.

---

## 10. Performance / load testing (k6)

Beyond correctness, the two **hot paths** — poll **vote** and daily **spin** — are load-tested with
**k6**, because both do a locked read + ledger write + counter update under concurrency and are the
mechanics most likely to be hammered at peak (daily reset, sponsored-poll launch).

- **Scenarios:** ramping VUs against `POST /v1/polls/:id/vote` and `POST /v1/games/:id/spin` on a
  staging-like stack with realistic seeded data.
- **Assertions (thresholds as pass/fail):** p95 latency budget, error rate ≈ 0 (excluding *expected*
  `409` from the one-vote/one-spin rule), and — critically — **no lost or double credits under load**
  (post-run reconciliation: `balance == Σ ledger` for every VU, §6.1). Load testing is where the
  ledger's concurrency guarantees are proven at scale, complementing the deterministic concurrency
  integration tests.
- k6 runs on a schedule and before major releases (not on every PR); regressions past threshold block
  the release. See [09-devops-cicd](09-devops-cicd.md) for scheduling.

---

## 11. Summary — coverage targets & responsibilities

| Area | Line/branch coverage target | Primary layer |
|---|---|---|
| **`PointsService` / ledger** | **≥ 95%** (incl. branches) | unit + integration |
| **Auth (register/verify/login/reset/lockout)** | **≥ 95%** | unit + integration + e2e |
| Polls / Games (vote-once, spin-once, weighted) | ≥ 90% | unit + integration |
| Redemptions | ≥ 90% | unit + integration |
| Notifications (suppression) | ≥ 90% | unit + integration |
| `packages/types` (Zod) | ≥ 95% | unit |
| `packages/ui` components | ≥ 85% + a11y clean | RTL + Storybook |
| `apps/web` components/hooks | ≥ 80% | unit + e2e |
| **Overall repo** | **≥ 80%** | all |

Coverage is a floor, not a goal — a green 80% with the §6 critical areas untested is a failing suite.
The number that matters most is that, for the ledger, **balance always equals the sum of the ledger**,
proven deterministically at unit and integration and under load.

---

### Related docs

- [00-project-overview](../00-project-overview.md) — vision, module map, glossary.
- [04-database-architecture §5](04-database-architecture.md) — points ledger rules (the thing we test hardest).
- [05-api-conventions](05-api-conventions.md) — envelope/error/pagination contract the API tests assert.
- [phases/00-roadmap](../phases/00-roadmap.md) — Definition of Done references these gates.
- [09-devops-cicd](09-devops-cicd.md) — pipeline stages, runners, scheduling (forward reference).
- [13-components-library](../design-system/13-components-library.md) · [11-color-system](../design-system/11-color-system.md) — what Storybook a11y protects.

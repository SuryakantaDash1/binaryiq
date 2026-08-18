# 15 — Coding Standards ⭐

The engineering rulebook for the **Influencer Platform**. Every line of TypeScript in this monorepo —
`apps/web`, `apps/api`, and every `packages/*` — follows the conventions below. These rules are
**enforced by tooling** (tsconfig, ESLint, Prettier, pre-commit hooks, CI) so that "correct" is the
path of least resistance and review focuses on design, not formatting.

This doc is the source of truth for **how we write code**. It defers to and does not duplicate:

- [../architecture/01-system-architecture.md](../architecture/01-system-architecture.md) — monorepo
  layout, responsibility boundaries, request lifecycle.
- [../architecture/04-database-architecture.md](../architecture/04-database-architecture.md) — the
  data model, Prisma conventions, and the **points ledger rules**. **Source of truth for data.**
- [../architecture/05-api-conventions.md](../architecture/05-api-conventions.md) — response envelope,
  error codes, validation, auth. **Source of truth for the wire contract.**

Git branching, PR review checklist, and merge policy live in the sibling
[16-git-workflow.md](16-git-workflow.md); §9 here covers only commit-message format.

> **How to apply this doc:** if a rule here conflicts with something you see in the codebase, the rule
> wins — fix the code. If a rule is genuinely wrong for a case, change the rule here in a PR (with an
> ADR if it is a big decision, §10), don't quietly deviate.

---

## Table of contents

1. [TypeScript configuration](#1-typescript-configuration)
2. [Linting & formatting](#2-linting--formatting)
3. [Naming conventions](#3-naming-conventions)
4. [Folder & module conventions](#4-folder--module-conventions)
5. [Code style rules](#5-code-style-rules)
6. [React / Next.js specifics](#6-react--nextjs-specifics)
7. [NestJS specifics](#7-nestjs-specifics)
8. [Prisma & data rules](#8-prisma--data-rules)
9. [Commit conventions](#9-commit-conventions)
10. [Documentation & comments](#10-documentation--comments)
11. [Error & logging conventions](#11-error--logging-conventions)

---

## 1. TypeScript configuration

TypeScript is **strict, everywhere, non-negotiable**. There is one shared base config in
`packages/config`; every app and package extends it so we can never drift into "one lax package".

### 1.1 The shared base (`packages/config`)

```jsonc
// packages/config/tsconfig/base.json — extended by tsconfig.base.json at the repo root
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,                       // enables the full strict family (noImplicitAny, strictNullChecks, …)
    "noUncheckedIndexedAccess": true,     // arr[i] is T | undefined — forces you to handle the gap
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,  // case-sensitive imports (Linux CI vs Windows dev)
    "verbatimModuleSyntax": true,         // explicit `import type` for type-only imports
    "isolatedModules": true,
    "skipLibCheck": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

Each package/app has a thin `tsconfig.json` that extends the base and only adds environment specifics:

```jsonc
// apps/web/tsconfig.json
{ "extends": "@influencer/config/tsconfig/next.json", "include": ["**/*.ts", "**/*.tsx", ".next/types/**/*.ts"] }

// apps/api/tsconfig.json
{ "extends": "@influencer/config/tsconfig/node.json", "compilerOptions": { "emitDecoratorMetadata": true, "experimentalDecorators": true } }
```

`typecheck` (`tsc --noEmit`) runs in the Turborepo pipeline and is a **CI gate** — a type error fails
the build. Because `packages/types` is a build-time dependency of both apps, a breaking DTO change
fails compilation on **both sides** (see
[01 §6](../architecture/01-system-architecture.md), [05 §5](../architecture/05-api-conventions.md)).

### 1.2 Hard rules

- **`strict: true` stays on.** Never disable it per-file or per-package.
- **`noUncheckedIndexedAccess` is on.** Indexed and record access yields `T | undefined`; handle the
  `undefined` explicitly. Don't reach for `!` to silence it — narrow instead.

  ```ts
  // ❌ non-null assertion hides a real runtime gap
  const first = items[0]!;

  // ✅ narrow, then use
  const first = items[0];
  if (!first) throw new NotFoundError('items empty');
  ```

- **No `any`.** Use `unknown` at boundaries (JSON, `catch`, third-party) and narrow with a Zod schema
  or type guard. `any` is an ESLint **error**, not a warning. Escape hatches (`as`, `// @ts-expect-error`)
  require an inline comment justifying why and are flagged in review.

  ```ts
  // ❌
  function parse(input: any) { return input.value; }

  // ✅ validate unknown input into a typed shape
  function parse(input: unknown): Vote {
    return VoteInput.parse(input); // Zod from @influencer/types → typed & safe
  }
  ```

- **Prefer `type` for object shapes and unions; `interface` only when you need declaration merging**
  (rare — mostly module augmentation). Be consistent within a file.
- **No enums for wire/domain values** — use Zod-derived union types or `as const` objects. Prisma
  `enum`s are the exception (they are the DB contract, see §8 and
  [04 §4](../architecture/04-database-architecture.md)) and are mirrored in `packages/types`.
- **Return types are explicit on exported/public functions.** Let inference handle locals.

### 1.3 Path aliases

Imports use workspace package aliases, never deep relative traversal across package boundaries. Aliases
map to the workspace packages and are resolved by TS, the bundler, and ESLint identically.

| Alias | Resolves to | Contains |
|---|---|---|
| `@influencer/ui` | `packages/ui` | Design-system components + tokens (the only shared UI source) |
| `@influencer/types` | `packages/types` | Zod DTO/domain schemas + inferred TS types (the API contract) |
| `@influencer/config` | `packages/config` | ESLint / tsconfig / Tailwind presets |
| `@influencer/db` | `packages/db` | Prisma schema, generated client, migrations, seed |

Within an app, use a local alias for intra-app imports (`@/` → app root) and reserve relative imports
(`./`, `../`) for **same-feature, nearby** files only.

```ts
// ✅ cross-package via alias
import { Button } from '@influencer/ui';
import { VoteInput, type PollResult } from '@influencer/types';

// ✅ intra-app absolute
import { apiClient } from '@/lib/api-client';

// ❌ never reach into another package's internals or climb out of the app
import { Button } from '../../../../packages/ui/src/button';
```

---

## 2. Linting & formatting

One shared ESLint + Prettier config in `packages/config`, consumed by every workspace. Formatting is
**never** debated in review — Prettier owns it; ESLint owns correctness and consistency.

### 2.1 Prettier (formatting)

```jsonc
// packages/config/prettier/index.json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"]   // canonical Tailwind class ordering
}
```

### 2.2 ESLint (correctness & consistency)

Flat config in `packages/config`, composed of layered rule sets so each surface gets exactly what it
needs:

```ts
// packages/config/eslint/base.ts — shared by everything
export default [
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,      // typed lint: no-floating-promises, no-misused-promises, …
  ...tseslint.configs.stylisticTypeChecked,
  importPlugin.flatConfigs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',   // every promise awaited or explicitly voided
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'error',                                 // see §11 — use the logger
      'eqeqeq': ['error', 'always'],
      'no-restricted-syntax': [
        'error',
        { selector: "MemberExpression[object.meta.name='process'][property.name='env']", message: 'Use ConfigService (api) / typed env module (web), not process.env directly.' }
      ],
      'import/order': ['error', {
        groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
        pathGroups: [{ pattern: '@influencer/**', group: 'internal', position: 'before' }],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      }],
      'import/no-cycle': 'error',
      'import/no-default-export': 'error',   // named exports by default (overridden where a framework demands default)
    },
  },
];
```

Surface-specific overlays:

- **`apps/web`** — `eslint-plugin-react`, `eslint-plugin-react-hooks` (`rules-of-hooks`,
  `exhaustive-deps` as **error**), `@next/eslint-plugin-next`. `import/no-default-export` is relaxed
  for `app/**` route files and `next.config`/config files that Next requires to default-export.
- **`apps/api`** — NestJS-oriented rules; decorator-friendly config; forbids `process.env`
  (use `ConfigService`, §7); `import/no-default-export` stays on (Nest uses named classes).
- **No cross-feature imports** are enforced with `import/no-restricted-paths` boundaries (§4).

### 2.3 Enforcement — local & CI

Pre-commit via **husky + lint-staged** so nothing unformatted or lint-broken is ever committed:

```jsonc
// package.json (root)
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix --max-warnings=0", "prettier --write"],
    "*.{json,md,yml,css}": ["prettier --write"]
  }
}
```

```bash
# .husky/pre-commit
pnpm lint-staged
```

CI runs the **full** suite on every PR and blocks merge on any failure — pre-commit only touches
staged files, so CI is the real gate:

```
turbo run typecheck lint format:check test
```

`--max-warnings=0`: **warnings are failures.** We do not accumulate lint debt.

---

## 3. Naming conventions

Consistent names are load-bearing across the TS ⇄ DB ⇄ wire boundaries. The DB is `snake_case`, TS is
`camelCase`, and Prisma bridges them with `@map`/`@@map` (see
[04 §1–2](../architecture/04-database-architecture.md)).

### 3.1 Files & directories

| Kind | Convention | Example |
|---|---|---|
| General files & folders | `kebab-case` | `api-client.ts`, `use-points-balance.ts`, `poll-card/` |
| React component file | `kebab-case` file, `PascalCase` export | `poll-card.tsx` → `export function PollCard()` |
| React hook file | `kebab-case`, `use-` prefix | `use-current-user.ts` |
| NestJS files | `kebab-case` + role suffix | `polls.controller.ts`, `polls.service.ts`, `polls.module.ts` |
| Zod schema / types | `kebab-case` by domain | `poll.schema.ts`, `points.types.ts` |
| Test files | mirror source, `.spec`/`.test` | `polls.service.spec.ts`, `poll-card.test.tsx` |
| Route segments (Next) | Next conventions (lowercase) | `app/(app)/polls/[id]/page.tsx` |

Component files are `kebab-case` on disk (so the repo is case-consistent on Linux CI and Windows dev)
while the **exported component symbol is PascalCase**.

### 3.2 Identifiers

| Kind | Convention | Example |
|---|---|---|
| Variables, functions, params | `camelCase` | `pointsBalance`, `awardPoints()` |
| React components (symbols) | `PascalCase` | `PollCard`, `RewardsGrid` |
| React hooks | `useX` | `usePointsBalance`, `usePollVote` |
| Types & interfaces | `PascalCase`, **no `I` prefix** | `PollResult`, `VoteInput` — never `IPollResult` |
| Zod schema value | `PascalCase` (matches inferred type) | `export const VoteInput = z.object({…})` |
| Enums / union members & consts | `UPPER_SNAKE_CASE` | `POINTS_PER_INR`, `SPIN_WHEEL` |
| Booleans | `is/has/can/should` prefix | `isActive`, `hasVoted`, `canRedeem` |
| Event handlers (props) | `onX`; internal: `handleX` | `onVote` / `handleVoteClick` |
| Generics | `T`-prefixed, meaningful | `TData`, `TResponse` |

The Zod schema and its inferred type intentionally **share one PascalCase name** so there is a single
mental model per DTO ([05 §5](../architecture/05-api-conventions.md)):

```ts
export const VoteInput = z.object({ optionIds: z.array(z.string().uuid()) });
export type VoteInput = z.infer<typeof VoteInput>;
```

### 3.3 Database ⇄ TypeScript boundary

| Layer | Casing | Example |
|---|---|---|
| Postgres table | `snake_case`, **plural** | `poll_votes`, `points_transactions` |
| Postgres column | `snake_case` | `user_id`, `balance_after`, `created_at` |
| Prisma model | `PascalCase`, **singular** + `@@map` | `model PollVote { … @@map("poll_votes") }` |
| Prisma field | `camelCase` + `@map` where names differ | `balanceAfter Int @map("balance_after")` |
| Prisma enum | `PascalCase` name, `UPPER_SNAKE` members | `enum PointsDirection { CREDIT DEBIT }` |
| TS (app code) | `camelCase` | `pollVote.balanceAfter` |

```prisma
model PollVote {
  id            String   @id @default(uuid()) @db.Uuid
  pollId        String   @map("poll_id") @db.Uuid
  userId        String   @map("user_id") @db.Uuid
  pointsAwarded Int      @map("points_awarded")
  @@unique([pollId, userId])
  @@map("poll_votes")
}
```

FK fields are `<entity>Id` (`userId`, `pollId`); timestamps are `createdAt`/`updatedAt` mapped to
`created_at`/`updated_at`. Full rules in [04 §2](../architecture/04-database-architecture.md).

### 3.4 API paths

- Resource paths are **plural, kebab-case** nouns under the version prefix:
  `/v1/polls`, `/v1/reward-redemptions`, `/v1/notification-preferences`.
- Actions on a resource are sub-paths: `POST /v1/polls/:id/vote`.
- Query params are `camelCase`: `?pageSize=20&sort=createdAt&order=desc`.
- Admin surface is prefixed `/v1/admin/...`.

See [05 §1 & §9](../architecture/05-api-conventions.md) for the full catalogue.

---

## 4. Folder & module conventions

The monorepo shape is fixed by [01 §3](../architecture/01-system-architecture.md). Within each app we
organise **feature-first**: everything a feature needs lives together, and shared code is promoted to
`packages/*` — not copied.

### 4.1 Where code lives

| Kind of code | Home |
|---|---|
| Shared React components + design tokens | `packages/ui` (the **only** shared UI source; never fork it) |
| Shared DTO/domain schemas + types | `packages/types` (Zod, single source of truth) |
| Shared lint/tsconfig/tailwind presets | `packages/config` |
| Prisma schema, client, migrations, seed | `packages/db` |
| App-specific UI compositions | `apps/web/components` (built **from** `@influencer/ui`) |
| Domain/business logic | `apps/api` only (never in `apps/web`) |

Decision rule: **used by more than one app or feature → it belongs in `packages/*`.** Used by exactly
one feature → keep it local to that feature.

### 4.2 Feature-first structure — web

```
apps/web/app/(app)/polls/         # route segment (RSC by default)
  page.tsx                        # server component: fetches via RSC, renders
  loading.tsx  error.tsx
apps/web/components/polls/         # app-specific compositions for this feature
  poll-card.tsx  poll-list.tsx
apps/web/hooks/polls/              # client hooks (TanStack Query, forms)
  use-poll-vote.ts
apps/web/lib/                      # api client, auth helpers, server actions (cross-feature infra)
```

### 4.3 Feature-first structure — api (NestJS module)

```
apps/api/src/modules/polls/
  polls.module.ts       # wiring: imports, providers, exports
  polls.controller.ts   # thin HTTP layer, returns plain DTOs
  polls.service.ts      # business logic (one responsibility, §7)
  polls.repository.ts   # (optional) Prisma access if the service gets large
  dto/                  # re-exports/uses Zod schemas from @influencer/types
  polls.service.spec.ts
```

Each module is self-contained; cross-module needs go through an **injected service** exported by the
owning module (e.g. `PointsService`), never by importing another module's internals.

### 4.4 Barrel exports policy

- **`packages/*` expose a curated public API** via a top-level `index.ts` barrel. Consumers import from
  the package root (`@influencer/ui`), not deep paths. Internals are not re-exported.
- **Inside an app, avoid barrels** for feature folders — they defeat tree-shaking, encourage import
  cycles, and blur boundaries. Import the specific file you need.
- `import/no-cycle` is an ESLint error; barrels are the most common source of cycles, hence the
  restriction above.

### 4.5 No cross-feature imports

A feature must not reach into a sibling feature's internals. Shared needs are promoted to `packages/*`
(shared) or exposed through a service boundary (api). This is enforced with ESLint boundaries:

```ts
// eslint import/no-restricted-paths — a feature may not import another feature directly
{ target: './apps/web/components/polls', from: './apps/web/components/surveys',
  message: 'No cross-feature imports. Promote shared UI to @influencer/ui.' }
```

```ts
// ❌ polls feature reaching into surveys feature
import { SurveyProgress } from '@/components/surveys/survey-progress';

// ✅ shared primitive lives in the design system
import { ProgressBar } from '@influencer/ui';
```

---

## 5. Code style rules

Rules that keep functions readable, correct, and safe to change.

### 5.1 Functions

- **Small and single-purpose.** A function does one thing. Practical guideline: **≲ 40 lines** and
  **≲ 4 parameters** — beyond that, extract helpers or pass an options object. These are smells to
  investigate in review, not hard compiler limits.
- **Early returns over nested conditionals.** Guard clauses first; keep the happy path unindented.

  ```ts
  // ✅ guard-and-return
  function awardVotePoints(poll: Poll, user: User): number {
    if (!poll.isActive) throw new UnprocessableError('poll inactive');
    if (poll.expiresAt && poll.expiresAt < new Date()) throw new UnprocessableError('poll expired');
    return poll.pointsReward;
  }
  ```

### 5.2 Async

- **`async/await` only** — never `.then()/.catch()` chains in app code.
- **No floating promises** (ESLint `no-floating-promises`). Await it, or `void` it deliberately with a
  comment for genuine fire-and-forget (rare; prefer a queued job — [01 §9](../architecture/01-system-architecture.md)).
- Parallelise independent awaits with `Promise.all`; don't serialise unrelated I/O.

  ```ts
  const [poll, balance] = await Promise.all([pollsRepo.byId(id), pointsRepo.balance(userId)]);
  ```

### 5.3 Error handling — never swallow

- **Never catch-and-ignore.** An empty or log-only `catch` that hides a failure is prohibited. Either
  handle it meaningfully, translate it to a domain error, or let it propagate.

  ```ts
  // ❌ swallowed — the failure vanishes
  try { await pointsService.award(...); } catch { /* ignore */ }

  // ✅ translate to a typed domain error the exception filter maps to an envelope (05 §4)
  try {
    await pointsService.award({ userId, action: 'POLL_VOTE', points, idempotencyKey });
  } catch (err) {
    if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Already voted'); // → 409 CONFLICT
    }
    throw err; // unknown → propagate → 500 INTERNAL_ERROR, logged with requestId
  }
  ```

- `catch (err: unknown)` — narrow before use; never assume `Error`.
- Throw **typed domain errors** (mapped by the global exception filter to the canonical codes in
  [05 §4](../architecture/05-api-conventions.md)); don't throw bare strings.

### 5.4 Immutability & purity

- Prefer `const`; use `let` only when reassignment is real. No `var`.
- **Don't mutate inputs.** Treat function parameters and shared state as read-only; return new values.
  Use immutable array/object ops (`map`, `filter`, spread) over in-place mutation.
- Keep business calculations **pure** (points math, percentages, eligibility) — deterministic, no I/O —
  so they are trivially unit-testable. Push side effects (DB, providers) to the edges.
- Mark deeply-shared config/constants `readonly` / `as const`.

### 5.5 Comments density

- **Match the surrounding code.** Don't over- or under-comment relative to the file's norm.
- Comments explain **why**, not **what** — the code already says what. Document intent, trade-offs,
  invariants, and non-obvious constraints.

  ```ts
  // ✅ explains a non-obvious invariant
  // balanceAfter is snapshotted inside the txn (row locked FOR UPDATE) so history rows are
  // self-describing even after later movements — see 04 §5 invariant 3.

  // ❌ restates the code
  // increment the balance by points
  balance += points;
  ```

- Dead/commented-out code is not committed — Git is the history.

---

## 6. React / Next.js specifics

`apps/web` is a rendering + BFF layer with **no business logic** ([01 §4](../architecture/01-system-architecture.md)).
It uses the Next 14 App Router.

### 6.1 Server vs Client components

- **Server Components are the default.** A file is a Client Component **only** when it needs
  interactivity, browser APIs, state, or effects — and then it declares `'use client'` at the top.
- **Push `'use client'` to the leaves.** Keep pages/layouts as Server Components and isolate
  interactivity in small client components, so most of the tree stays server-rendered.
- Never pass non-serialisable values (functions, class instances) across the server→client boundary.

### 6.2 Data fetching — no `useEffect` fetching

- **Server-side reads:** fetch in Server Components / Route Handlers (BFF) directly with the typed API
  client. This is the default for initial page data.
- **Client-side reads/mutations:** use **TanStack Query** (`useQuery`/`useMutation`). Query keys are
  stable arrays; mutations invalidate the affected keys.
- **`useEffect` must not be used for data fetching.** It causes waterfalls, races, and duplicate
  requests. Data comes from RSC or TanStack Query — never a manual `fetch` in an effect.

  ```tsx
  // ❌ forbidden — effect-based fetching
  useEffect(() => { fetch('/api/polls').then(r => r.json()).then(setPolls); }, []);

  // ✅ client read via TanStack Query
  const { data: polls } = useQuery({ queryKey: ['polls', 'active'], queryFn: api.polls.listActive });
  ```

`useEffect` is reserved for genuine synchronisation with external systems (subscriptions, event
listeners, focus management) — not for loading data.

### 6.3 Keys, memoization, tokens

- **Keys:** stable, unique domain IDs (`key={poll.id}`). **Never the array index** for dynamic lists.
- **Memoization is intentional, not reflexive.** Reach for `useMemo`/`useCallback`/`memo` only for a
  measured cost (expensive compute, referential stability that a dependency array needs, large lists).
  Premature memoization adds noise and bugs.
- **No inline hex colors** — ever. Use semantic design tokens / Tailwind classes from `@influencer/ui`
  and the Tailwind preset. See [../design-system/11-color-system.md](../design-system/11-color-system.md).

  ```tsx
  // ❌ raw hex, off the design system
  <span style={{ color: '#E91E8C' }}>Points</span>

  // ✅ semantic token via the shared preset
  <span className="text-primary">Points</span>
  ```

- Prefer components from `@influencer/ui` over bespoke markup; compose, don't fork
  ([../design-system/13-components-library.md](../design-system/13-components-library.md)).

---

## 7. NestJS specifics

`apps/api` is the system of record — all domain logic, the ledger, validation, and provider calls live
here ([01 §4](../architecture/01-system-architecture.md)).

### 7.1 Layering

- **Controllers are thin.** They map HTTP ⇄ method calls and return **plain DTOs** — no business logic,
  no envelope building (the global interceptor does that, [05 §2](../architecture/05-api-conventions.md)).
- **Services hold business logic, one responsibility each.** A `PollsService` handles polls; it does
  **not** also send emails or move points — it injects `NotificationsService` / `PointsService`.
- Optional **repository** layer for Prisma access once a service grows; otherwise the service may use
  `PrismaService` directly.

```ts
@Controller('polls')
export class PollsController {
  constructor(private readonly polls: PollsService) {}

  @Post(':id/vote')
  vote(@Param('id') id: string, @Body() body: VoteInput, @CurrentUser() user: AuthUser): Promise<PollResult> {
    return this.polls.vote(id, body, user.id); // thin: delegate, return DTO
  }
}
```

### 7.2 DTOs & validation

- Request/response DTOs are **Zod schemas from `@influencer/types`** — the same schemas the web app uses
  ([05 §5](../architecture/05-api-conventions.md)). No hand-written class DTOs duplicating shapes.
- Validate at the boundary with a global **`ZodValidationPipe`**; services trust their input.

### 7.3 Dependency injection

- Depend on **abstractions, injected via constructor.** No `new` on services, no singletons-by-import.
- External providers (SendGrid, Twilio, FCM, S3/Cloudinary, PayPal) sit **behind provider tokens /
  interfaces** so they are swappable and mockable in tests ([01 §1](../architecture/01-system-architecture.md)).

### 7.4 Config — no direct `process.env`

- **Never read `process.env` directly** (ESLint-blocked, §2.2). Use the typed **`ConfigService`** backed
  by the boot-time Zod-validated config module ([01 §7](../architecture/01-system-architecture.md)).
- Constants like `POINTS_PER_INR = 100` are config-driven, never hard-coded literals scattered in code.

  ```ts
  // ❌
  const key = process.env.SENDGRID_API_KEY;

  // ✅ typed, validated at boot, fails fast if missing
  const key = this.config.get('sendgrid.apiKey', { infer: true });
  ```

---

## 8. Prisma & data rules

The data model and the **points-ledger invariants** are authoritative in
[04-database-architecture.md](../architecture/04-database-architecture.md); this section is the coding
discipline around them.

- **All point movements go through `PointsService`** (`award(...)` / `spend(...)`). No feature writes
  `points_transactions` or `points_balances` directly. This is the single choke point that guarantees
  ledger integrity ([04 §5](../architecture/04-database-architecture.md)).
- **The ledger is append-only** — never update or delete a `points_transactions` row. Corrections are
  new `ADJUSTMENT` rows.
- **Multi-write operations use one `prisma.$transaction`.** The domain write and its point credit share
  one transaction — if either fails, both roll back. Pass an `idempotencyKey` for retriable actions to
  block double-credits ([04 §5](../architecture/04-database-architecture.md)).

  ```ts
  await this.prisma.$transaction(async (tx) => {
    await tx.pollVote.create({ data: { pollId, userId, optionIds } });
    await tx.pollOption.updateMany({ where: { id: { in: optionIds } }, data: { voteCount: { increment: 1 } } });
    await this.points.award({ tx, userId, action: 'POLL_VOTE', points: poll.pointsReward,
      idempotencyKey: `poll-vote:${pollId}:${userId}` });
  });
  ```

- **No raw SQL unless reviewed.** Prefer the typed Prisma client. `$queryRaw`/`$executeRaw` require an
  explicit reviewer sign-off, must be parameterised (never string-interpolated — SQL-injection risk),
  and should carry a comment explaining why the query builder wasn't enough.
- **Every FK is indexed** and hot `where`/`orderBy` columns are indexed — Prisma does not auto-index FKs
  ([04 §8](../architecture/04-database-architecture.md)).
- **Migrations:** Prisma Migrate, **one migration per PR, reviewed.** **Never edit an applied
  migration** — add a new one. App connects via pooled `DATABASE_URL`; migrations use `DIRECT_URL`
  ([04 §7](../architecture/04-database-architecture.md)).
- Money/points are **integers**; the INR value is derived (`points / 100`) in the app layer, never
  stored ([04 §1](../architecture/04-database-architecture.md)).

---

## 9. Commit conventions

We use **[Conventional Commits](https://www.conventionalcommits.org/)**, enforced by commitlint in the
`commit-msg` husky hook. This gives a clean, machine-parseable history and drives changelog/versioning.

```
<type>(<scope>): <subject>

[optional body — the "why", wrapped at 72 cols]

[optional footer — BREAKING CHANGE:, Refs #123]
```

- **type** (required): `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`,
  `style`, `revert`.
- **scope** (recommended): the app/package/feature — `web`, `api`, `db`, `ui`, `types`, `config`,
  `polls`, `points`, `auth`, …
- **subject:** imperative mood, lower-case, no trailing period ("add", not "added"/"adds").

**Examples**

```
feat(polls): award 15 points on first vote within one transaction
fix(auth): reject expired RS256 access tokens with UNAUTHENTICATED
refactor(points): extract balance snapshot into PointsService.award
perf(notifications): batch FCM sends in the worker
docs(standards): add coding standards (15)
chore(db): add index on points_transactions(user_id, created_at)
```

Breaking change:

```
feat(api): return cursor pagination on /v1/points/transactions

BREAKING CHANGE: `page`/`pageSize` removed for this endpoint; use `cursor`/`limit` (05 §6).
```

**PR size:** keep PRs small and focused — ideally **< ~400 lines of diff**, one logical change per PR.
Large mechanical changes (renames, generated code) go in a separate, clearly-labelled PR. Every PR must
pass the full CI gate (§2.3) and the review checklist in [16-git-workflow.md](16-git-workflow.md).

---

## 10. Documentation & comments

- **JSDoc on the public API of every `packages/*`** (exported functions, components, schemas). These are
  cross-package contracts — document parameters, return shape, and non-obvious behaviour so consumers
  don't read the implementation.

  ```ts
  /**
   * Credits points to a user inside the caller's transaction, writing one immutable ledger row.
   * Idempotent when `idempotencyKey` is supplied (unique constraint blocks double-credit).
   *
   * @param tx  active Prisma transaction client — MUST be the same txn as the domain write
   * @returns   the new balance after the credit
   * @throws    ConflictError when `idempotencyKey` was already used
   */
  award(params: AwardParams): Promise<number>;
  ```

- **App-internal code** is documented sparingly (§5.5) — public package APIs get the JSDoc rigour.
- **TODO policy:** `// TODO(owner): description — LINK` — every TODO names an owner and links a tracking
  issue. Ownerless/undated TODOs fail review. Use `// FIXME(owner):` for known-broken code that must be
  addressed before release.
- **ADRs for big decisions.** Architecture-significant choices (new dependency, data-model shift, auth
  change, provider swap) get a short Architecture Decision Record in `docs/adr/` (context → decision →
  consequences) and are linked from the PR. Small, reversible choices don't need one.

---

## 11. Error & logging conventions

- **No `console.log` in committed code.** ESLint `no-console` is an **error** (§2.2). Use the injected
  structured logger.
- **Structured JSON logging.** Every log line is structured and carries the request's `requestId` so
  logs, audit entries, and errors correlate ([05 §12](../architecture/05-api-conventions.md),
  [01 §10](../architecture/01-system-architecture.md)). Log the context, not string-concatenated blobs.

  ```ts
  // ❌
  console.log('vote failed for ' + userId);

  // ✅ structured, correlatable, level-appropriate
  this.logger.warn({ event: 'poll.vote.conflict', requestId, userId, pollId }, 'duplicate vote rejected');
  ```

- **Choose the right level:** `error` (needs attention), `warn` (handled anomaly), `info` (notable
  business event), `debug` (dev diagnostics, off in prod). Don't log at `error` for expected 4xx flows.
- **Never log secrets or PII.** Tokens, passwords, encryption keys, and encrypted PII columns
  (`*_enc`) are redacted. Log user IDs, not emails/phones.
- **API errors never leak internals.** Clients receive only the canonical
  `{ code, message, details }` envelope ([05 §2–4](../architecture/05-api-conventions.md)); stack
  traces, SQL, and provider errors stay in server logs. An unexpected fault surfaces as a generic
  `500 INTERNAL_ERROR` with the `requestId` for support to trace — the internal cause is logged, never
  returned.

---

## Related docs

- [../architecture/01-system-architecture.md](../architecture/01-system-architecture.md) — monorepo layout & boundaries.
- [../architecture/04-database-architecture.md](../architecture/04-database-architecture.md) — data model, Prisma, ledger. ⭐
- [../architecture/05-api-conventions.md](../architecture/05-api-conventions.md) — envelope, errors, validation, auth. ⭐
- [../design-system/11-color-system.md](../design-system/11-color-system.md) — design tokens (no inline hex).
- [../design-system/13-components-library.md](../design-system/13-components-library.md) — reusable component catalogue.
- [16-git-workflow.md](16-git-workflow.md) — branching, PR review checklist, merge policy.

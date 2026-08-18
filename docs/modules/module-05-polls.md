# Module 05 — Polls (Sponsored)

**Phase 5 · Week 6** · earns **+15 points per vote** · one vote per poll per user.

Sponsored single- or multi-choice opinion polls. Members vote, earn 15 points, and immediately see a
live percentage breakdown. This doc is the full build spec for the Polls module: flows, data model,
API contracts, frontend, backend, points rules, tasks, acceptance criteria, and tests.

It **references** the backbone docs rather than restating them:

- Product context & module map → [../00-project-overview.md](../00-project-overview.md)
- Source spec (§6 Polls, endpoints + vote flow) → [../Influencer_Platform_Full_Breakdown.md](../Influencer_Platform_Full_Breakdown.md)
- Backend structure, layering, `PointsService` → [../architecture/03-backend-architecture.md](../architecture/03-backend-architecture.md)
- Data model (`Poll`, `PollOption`, `PollVote`) + ledger rules → [../architecture/04-database-architecture.md](../architecture/04-database-architecture.md)
- Envelope, error codes, endpoint-spec template → [../architecture/05-api-conventions.md](../architecture/05-api-conventions.md)
- App Router, RSC/client split, TanStack Query → [../architecture/06-frontend-architecture.md](../architecture/06-frontend-architecture.md)
- Shared UI kit (`PollCard`, `PollResultBars`, `ModuleTeaserCard`, `RadioGroup`, `MultiSelect`) → [../design-system/13-components-library.md](../design-system/13-components-library.md)
- Canonical UI patterns (form/modal/list/state/points) → [../design-system/14-patterns.md](../design-system/14-patterns.md)

---

## 1. Overview & goal

Polls are short **sponsored** opinion questions — much lighter than surveys. A brand asks a single
question with a handful of options; a member picks their answer, earns **15 points**, and sees how
everyone else voted. They are a **daily-engagement hook** (alongside the Spin-the-Wheel game) that
drives DAU and feeds brands quick consumer sentiment.

**Goal of the module:** let a member discover unvoted polls from the homepage, vote exactly once per
poll, be credited 15 points atomically with the vote, and see live percentage results — while the
homepage unvoted counter decrements the moment they vote.

Two question shapes exist:

| Type (`PollType`) | Input | Example |
|---|---|---|
| `SINGLE_CHOICE` | `RadioGroup` (one option) | *"Do you think Westside brand is a 'Made in India' brand?"* → Yes / No |
| `MULTI_CHOICE` | `CheckboxGroup` / `MultiSelect` (one or more) | *"How frequently do you listen to FM Radio?"* → Everyday / 2–3 days a week / 1 day a week / Less frequently / Do not listen |

The homepage **Polls** teaser reads: *"0 of X voted — Your opinion matters! X polls are eager for
your input."* with a **Participate** button.

---

## 2. Scope

### 2.1 In scope

- Homepage **Polls `ModuleTeaserCard`** with a live "voted / total" counter and Participate CTA.
- Member **polls listing** page (`/polls`) — a grid of active, not-yet-voted polls.
- Poll **detail + vote** page (`/polls/[id]`) — question, options (radio or checkbox), `Vote (15 Points)`.
- **Vote submission**: record vote → award 15 pts (same transaction) → bump denormalized counters →
  return results.
- **Results view**: percentage bars per option, user's choice highlighted.
- **One-vote enforcement**: DB unique `[pollId, userId]` → `409 CONFLICT`.
- **Expiry / deactivation**: `expiresAt` and `isActive` gate voting → `422 UNPROCESSABLE`.
- **Live homepage decrement**: unvoted count refreshes after a vote via TanStack Query invalidation.
- **Admin CRUD**: create/list/update polls, options, deactivate, set expiry.
- Points credit via the shared `PointsService` (`POLL_VOTE`, idempotent).

### 2.2 Out of scope (handled elsewhere or deferred)

- **Points ledger internals** — owned by `PointsService` / Module 3
  ([04-database §5](../architecture/04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6)).
- **Auth, JWT, guards** — Module 1 / [03-backend §3.6](../architecture/03-backend-architecture.md).
- **Notifications** for new polls — Module 7 (a poll can *enqueue* a `POINTS_UPDATE`/offer notification,
  but the channel logic lives there).
- **Surveys** (longer, higher-value, external URLs) — Module 4. Polls are deliberately in-app only.
- Poll **result analytics dashboards** for sponsors, poll **scheduling/campaigns**, weighted/quota
  targeting, editing a poll's options *after* votes exist (admin may deactivate + clone instead).
- Anonymous voting — voting requires an authenticated member.

---

## 3. User flows

### 3.1 Homepage teaser → listing → vote → results (happy path)

```
Dashboard (RSC)
  └─ Polls ModuleTeaserCard: "0 of 5 voted — Your opinion matters! 5 polls are eager for your input."
       │  [Participate]
       ▼
/polls  (listing)  ── GET /v1/polls  (active, excludes already-voted)
  └─ grid of PollCard: sponsor, question, "1,240 voted", [Vote (15 Points)]
       │  (click a card / its CTA)
       ▼
/polls/:id  (detail)  ── GET /v1/polls/:id
  └─ question + options
        • SINGLE_CHOICE → RadioGroup
        • MULTI_CHOICE  → CheckboxGroup / MultiSelect
     [Vote (15 Points)]
       │  POST /v1/polls/:id/vote { optionIds: [...] }
       ▼
Results (same page, VotePanel swaps in)
  └─ PollResultBars: each option's % (user's choice = primary magenta, others = neutral)
     +15 pts toast · PointsPill in header animates
     Homepage teaser count → "1 of 5 voted" (4 remaining) on next dashboard visit / invalidation
```

1. Member sees the **Polls teaser** on the dashboard (server-rendered count from `GET /polls/count`).
2. Clicks **Participate** → lands on `/polls`, sees a `PollCard` grid of active, unvoted polls.
3. Opens a poll → `/polls/:id` shows the question and options in the correct input type.
4. Selects an answer and clicks **Vote (15 Points)**.
5. On success: the `VotePanel` swaps to **`PollResultBars`** (optimistic), a **+15 pts** toast fires,
   the header `PointsPill` animates, and the poll drops out of the listing on refetch.
6. The homepage unvoted count decrements (query invalidation, see [§6.6](#66-live-homepage-counter)).

### 3.2 Multi-choice vote

Same as 3.1 but the detail page renders a `CheckboxGroup`/`MultiSelect`; the member may pick one or
more options. `optionIds` carries **all** selected ids. The vote is still **one row**, one 15-pt
credit — points are per *vote*, not per option. Results bars show every option's share; **each**
option the user selected is highlighted primary.

### 3.3 Already-voted handling

- The listing **excludes** polls the member already voted on, so they normally never re-open one.
- If they reach a voted poll by direct URL and submit, the DB unique `[pollId, userId]` raises →
  service maps to **`409 CONFLICT` (`already_voted`)**. The frontend catches the `ApiError` and shows
  the shared **"You've already voted"** `Modal` ([14-patterns §2b](../design-system/14-patterns.md#2b-informational--result-modals--modal)),
  then loads and displays the **existing results** via `GET /polls/:id/results` (read-only).
- No second credit is possible — the ledger `idempotencyKey` is a second guard (see [§7](#7-points--ledger-rules)).

### 3.4 Expired / inactive poll

- If `isActive === false` **or** `expiresAt < now`, the poll is treated as **closed**.
- Closed polls are excluded from `GET /polls` and the homepage count, but `GET /polls/:id` and
  `GET /polls/:id/results` still return them (read-only) so a stale link shows results, not a 404.
- A vote on a closed poll → **`422 UNPROCESSABLE` (`poll_closed`)**. The frontend disables the Vote
  button when the poll is closed and shows a persistent inline `Alert` ("This poll has closed —
  here's how people voted") above read-only `PollResultBars`.

### 3.5 Empty state

When `GET /polls` returns `[]` (all voted or none active), the listing renders the shared
`EmptyState`: *"No polls right now — check back soon."* with a CTA back to the dashboard. The homepage
teaser then reads *"0 polls are eager for your input"* and its CTA is de-emphasised.

### 3.6 Flow at a glance (source spec §6.6)

Record vote → award 15 via `PointsService` (same tx) → increment `poll.totalVotes` + each
`option.voteCount` → return results → homepage unvoted count decrements. See
[../Influencer_Platform_Full_Breakdown.md](../Influencer_Platform_Full_Breakdown.md) §6.6.

---

## 4. Data model

Authoritative Prisma models live in
[04-database §4](../architecture/04-database-architecture.md#4-prisma-schema-authoritative) — **not
redefined here**. Summary of the three Polls models and the invariants that matter to this module:

### 4.1 Entities

```
polls ─1:n─ poll_options
polls ─1:n─ poll_votes ─n:1─ users
```

| Model | Key fields | Notes |
|---|---|---|
| `Poll` | `id`, `question`, `pollType` (`SINGLE_CHOICE`\|`MULTI_CHOICE`), `pointsReward` (default **15**), `sponsorName?`, **`totalVotes`** (denormalized), `isActive` (default true), `expiresAt?`, timestamps | `@@index([isActive])` for the active-listing hot path. |
| `PollOption` | `id`, `pollId`, `optionText`, **`voteCount`** (denormalized), `sortOrder` | `onDelete: Cascade` from poll; `@@index([pollId])`. |
| `PollVote` | `id`, `pollId`, `userId`, **`optionIds String[] @db.Uuid`**, `pointsAwarded`, `votedAt` | **`@@unique([pollId, userId])`** — one vote per poll per user; `@@index([userId])`. |

### 4.2 Denormalized counters (why)

`poll.totalVotes` and `pollOption.voteCount` are **cached counters** incremented **in the same
transaction** as the vote insert, so results are computed as O(1) arithmetic from the poll row instead
of `COUNT(*)`/`GROUP BY` over `poll_votes` on every read
([04-database §8](../architecture/04-database-architecture.md#8-indexing--performance-notes)). A vote
increments `totalVotes` by **1** and each selected option's `voteCount` by **1**.

> Consequence for multi-choice: the sum of `voteCount` across options can **exceed** `totalVotes`
> (a voter may pick several options). Percentages are therefore computed **per option against
> `totalVotes` (voters)**, not against the sum of option counts — see [§6.4](#64-results-computation).

### 4.3 `optionIds` array

`PollVote.optionIds` is a `String[] @db.Uuid` holding **every** selected option id (one element for
single-choice, one-or-more for multi-choice). Storing the selection inline on the vote row keeps a
vote atomic (no `poll_vote_options` join table) and lets us re-derive a user's own choice for
highlighting results without an extra table.

### 4.4 One-vote uniqueness

`@@unique([pollId, userId])` is the **source of truth** for "one vote per poll per user". The service
attempts the insert and translates a unique-violation into `409 CONFLICT` — it does **not** pre-check
with a `findFirst` (that would be racy; see [§8.3](#83-concurrency--the-race)). This is a hard DB
guarantee, not application-level bookkeeping.

### 4.5 Validation constraints (enforced in service, mirrored in Zod)

- Every id in `optionIds` must belong to **this** poll → else `400 VALIDATION_ERROR`.
- `optionIds` must be non-empty; for `SINGLE_CHOICE` it must contain **exactly one** id.
- `optionIds` must contain no duplicates (Zod dedupes / rejects).

---

## 5. API contracts

All endpoints live under `/v1/polls/*` (member) and `/v1/admin/polls/*` (admin) and follow the global
**envelope, status codes, and error codes** in
[05-api-conventions §2–§4](../architecture/05-api-conventions.md#2-response-envelope-always). DTOs are
Zod schemas in `@influencer/types` shared by API and frontend. Responses shown are the **unwrapped
`data`** (the interceptor wraps it in `{ data, error, meta }`).

### 5.1 Member endpoints

#### `GET /v1/polls` — list active, unvoted polls

- **Auth:** member
- **Query:** none required (small list; no pagination needed initially — add cursor per
  [05 §6](../architecture/05-api-conventions.md#6-pagination-filtering-sorting) if it grows)
- **200:** `{ data: PollSummary[] }`
- **Filtering:** returns polls where `isActive = true` **AND** (`expiresAt IS NULL OR expiresAt > now`)
  **AND** the user has **no** `poll_votes` row for the poll (anti-join on `[pollId, userId]`).
- **`PollSummary`:** `{ id, question, pollType, sponsorName, pointsReward, totalVotes, expiresAt }`

```jsonc
// GET /v1/polls  → 200
{
  "data": [
    { "id": "…", "question": "Do you think Westside brand is a 'Made in India' brand?",
      "pollType": "SINGLE_CHOICE", "sponsorName": "Westside", "pointsReward": 15,
      "totalVotes": 1240, "expiresAt": null }
  ],
  "error": null,
  "meta": { "requestId": "req_…", "timestamp": "2026-08-13T10:00:00Z" }
}
```

#### `GET /v1/polls/:id` — poll detail with options

- **Auth:** member
- **Path:** `id` (uuid)
- **200:** `{ data: PollDetail }`
- **Errors:** `404 NOT_FOUND` unknown poll
- **`PollDetail`:** `PollSummary` + `options: { id, optionText, sortOrder }[]` + `isActive`, `hasVoted`
  (whether the current user already voted). Returns closed polls too (read-only); the client uses
  `isActive`/`expiresAt`/`hasVoted` to decide whether to show the vote form or results.

#### `POST /v1/polls/:id/vote` — cast a vote *(mutating; side-effects)*

- **Auth:** member
- **Path:** `id` (uuid)
- **Body:** `{ optionIds: string[] }` (Zod: **`VoteInput`**) — 1 for single-choice, ≥1 for multi
- **Idempotency:** ledger key **`poll_vote:{pollId}:{userId}`** (also accepts an `Idempotency-Key`
  header per [05 §1](../architecture/05-api-conventions.md#1-general-rules))
- **200:** `{ data: PollResult }`
- **Errors:**
  - `400 VALIDATION_ERROR` — empty/duplicate `optionIds`, ids not on this poll, >1 id for single-choice
  - `404 NOT_FOUND` — unknown poll
  - `409 CONFLICT` (`already_voted`) — unique `[pollId, userId]` violated
  - `422 UNPROCESSABLE` (`poll_closed`) — poll inactive or expired
- **Side effects (all in ONE `prisma.$transaction`):**
  1. insert `poll_votes` `{ pollId, userId, optionIds, pointsAwarded: poll.pointsReward }`
  2. `poll.totalVotes += 1`; for each selected option `option.voteCount += 1`
  3. **award `poll.pointsReward` (15) via `PointsService.award(tx, …)`** with
     `action: 'POLL_VOTE'`, `refType: 'poll'`, `refId: pollId`,
     `idempotencyKey: 'poll_vote:{pollId}:{userId}'`
  4. compute and return `PollResult`
  - After commit (client-side): homepage unvoted count decrements via query invalidation
- **`PollResult`:** `{ pollId, totalVotes, pointsAwarded, userOptionIds: string[],
  options: { id, optionText, voteCount, percentage }[] }`

```jsonc
// POST /v1/polls/{id}/vote   body: { "optionIds": ["opt_yes"] }   → 200
{
  "data": {
    "pollId": "…", "totalVotes": 1241, "pointsAwarded": 15,
    "userOptionIds": ["opt_yes"],
    "options": [
      { "id": "opt_yes", "optionText": "Yes", "voteCount": 800, "percentage": 64.5 },
      { "id": "opt_no",  "optionText": "No",  "voteCount": 441, "percentage": 35.5 }
    ]
  },
  "error": null,
  "meta": { "requestId": "req_…", "timestamp": "…" }
}
```

> This is the module's realization of the endpoint template in
> [05-api-conventions §10](../architecture/05-api-conventions.md#10-example-a-mutating-endpoint-spec-template).

#### `GET /v1/polls/:id/results` — read results (no vote)

- **Auth:** member
- **Path:** `id` (uuid)
- **200:** `{ data: PollResult }` — same shape; `userOptionIds` reflects the caller's prior vote
  (empty array if they haven't voted). Used to show results after an `already_voted`/`poll_closed`
  case, or to poll for live movement.
- **Errors:** `404 NOT_FOUND`

#### `GET /v1/polls/count` — unvoted count for the homepage

- **Auth:** member
- **200:** `{ data: { unvotedCount: number, totalActive: number } }`
- Powers the teaser copy *"{totalActive − unvotedCount} of {totalActive} voted"* and *"{unvotedCount}
  polls are eager for your input."* `unvotedCount` counts active, unexpired polls the user hasn't
  voted on; `totalActive` is all active, unexpired polls.

### 5.2 Admin endpoints (`AdminGuard` + role)

Prefixed `/v1/admin/polls/*`, guarded by `AdminGuard` and a role check
(`SUPER_ADMIN`/`ADMIN`) per [05 §7](../architecture/05-api-conventions.md#7-auth--authorization-patterns).
These compose the same `PollsService` — admin does **not** fork business logic
([03-backend §1.1](../architecture/03-backend-architecture.md#11-design-rules)).

| Method | Endpoint | Body / notes | Success |
|---|---|---|---|
| `GET` | `/v1/admin/polls` | offset pagination (`?page=&pageSize=`), includes inactive/expired + vote counts | `200 { data: AdminPoll[] }` |
| `GET` | `/v1/admin/polls/:id` | full poll incl. options + counters | `200 { data: AdminPoll }` |
| `POST` | `/v1/admin/polls` | `CreatePollInput`: `{ question, pollType, pointsReward?, sponsorName?, expiresAt?, options: { optionText, sortOrder? }[] }` (≥2 options) | `201 { data: AdminPoll }` |
| `PUT` | `/v1/admin/polls/:id` | `UpdatePollInput`: editable `question/sponsorName/expiresAt/isActive`; **deactivate** = `{ isActive: false }` | `200 { data: AdminPoll }` |

**Admin rules**
- **Create** validates `pollType` vs options (≥2), `pointsReward` defaults to **15**.
- **Deactivate / expiry** (`PUT`) is the primary "close" mechanism — it does not delete votes; results
  remain readable. Every admin mutation writes an `audit_logs` row (`poll.create`, `poll.update`,
  `poll.deactivate`) per [04-database](../architecture/04-database-architecture.md).
- **Editing options after votes exist is disallowed** (would corrupt counters/percentages) → `422
  UNPROCESSABLE`; admins deactivate and create a fresh poll instead.

---

## 6. Frontend

Structure, RSC/client rules, and the typed API client are defined in
[06-frontend-architecture](../architecture/06-frontend-architecture.md). Polls-specific composition:

### 6.1 Routes & islands

| Path | Rendering | Contents |
|---|---|---|
| `app/(app)/dashboard/page.tsx` | **RSC** | renders the Polls `ModuleTeaserCard` from server-fetched `GET /polls/count` |
| `app/(app)/polls/page.tsx` | **RSC** shell + client grid | fetches `GET /polls` server-side, hydrates a client `PollGrid` |
| `app/(app)/polls/[id]/page.tsx` | **RSC** shell + `VotePanel` island | fetches `GET /polls/:id` server-side; the vote/results interactivity is the client island |

Feature code lives in `apps/web/features/polls/` (`components/`, `hooks/`, `index.ts`) and **composes
`@influencer/ui` only** — no bespoke buttons/cards/bars
([06 §6](../architecture/06-frontend-architecture.md#6-component-reuse-strategy)).

### 6.2 Components (from the shared kit)

| Component | Role | Source |
|---|---|---|
| `ModuleTeaserCard` | Homepage Polls teaser (count + Participate) | [13 §8](../design-system/13-components-library.md#8-feature-specific-shared-components-still-in-packagesui-or-appswebcomponents) |
| `PollCard` | One poll in the listing grid (sponsor, question, voted-count, CTA) | [13 §8](../design-system/13-components-library.md#8-feature-specific-shared-components-still-in-packagesui-or-appswebcomponents) |
| `PollResultBars` | Percentage bars after voting | [13 §8](../design-system/13-components-library.md#8-feature-specific-shared-components-still-in-packagesui-or-appswebcomponents) + `ProgressBar` |
| `RadioGroup` | Single-choice input | [13 §3](../design-system/13-components-library.md#3-form-fields-the-reuse-backbone-for-all-forms) |
| `CheckboxGroup` / `MultiSelect` | Multi-choice input | [13 §3](../design-system/13-components-library.md#3-form-fields-the-reuse-backbone-for-all-forms) |
| `Button` | `Vote (15 Points)` CTA (`variant="primary"`, `loading`) | [13 §2](../design-system/13-components-library.md#2-actions) |
| `PointsPill` | header `+15` animation after vote | [13 §6](../design-system/13-components-library.md#6-feedback--status) |
| `Modal` | "You've already voted" | [14 §2b](../design-system/14-patterns.md#2b-informational--result-modals--modal) |
| `EmptyState` / `Skeleton` / `Alert` | empty / loading / closed states | [14 §3](../design-system/14-patterns.md#3-empty--loading--error-state-pattern) |

### 6.3 Listing page (`PollGrid`)

Follows the **list + card pattern** ([14 §6](../design-system/14-patterns.md#6-list--card-pattern)):
a responsive grid (`sm:grid-cols-2 lg:grid-cols-3`) of `PollCard`s. Each card: sponsor `Badge`,
question (title), `"{totalVotes} voted"` meta, footer with a `PointsPill` (`+15 pts`) and a primary
CTA. States: `Skeleton` card grid while pending, `EmptyState` when `[]`, `Alert` + Retry on error.
`Card interactive` makes the whole card a single link to `/polls/:id` (one anchor, a11y-safe).

### 6.4 Vote panel + results computation

The `VotePanel` is the **client island** on `/polls/[id]`:

- Renders `RadioGroup` when `pollType === 'SINGLE_CHOICE'`, else `CheckboxGroup`/`MultiSelect`.
- Uses **React Hook Form + `zodResolver(VoteInput)`** — the *same* Zod schema the API validates with
  ([14 §1](../design-system/14-patterns.md#1-form-pattern-the-canonical-form)). Submit is disabled
  until a valid selection exists and while `isSubmitting`.
- The Vote button label is literally **`Vote (15 Points)`** (points from `poll.pointsReward`).
- On submit → `useVote()` TanStack **mutation** → `POST /polls/:id/vote`.
- On success it swaps the form for **`PollResultBars`** with **optimistic** data, fires a **+15 pts**
  success toast, and highlights the user's choice.

**Percentage rule (must match backend [§6.4 API]):** each option's `percentage =
round1(voteCount / totalVotes * 100)` where `totalVotes` = number of **voters**. Bars therefore can
sum to >100% for multi-choice (voters pick several) — this is intentional and labelled per option.
Never divide by the sum of option counts.

**Colour mapping** ([11-color-system](../design-system/11-color-system.md) via the kit): the user's
selected option(s) render in **primary magenta**; all other options render in a **neutral** track.
Meaning is never colour-only — each bar shows its `optionText`, `%`, and a check icon on the user's
choice.

### 6.5 State & data hooks

- `usePollsList()` → `useQuery(['polls'], …)` (listing).
- `usePoll(id)` → `useQuery(['polls', id], …)`, hydrated from RSC `initialData`.
- `useVote(id)` → `useMutation` that on success:
  1. `invalidateQueries(['polls'])` (poll leaves the listing),
  2. `invalidateQueries(['polls', id])` (detail now `hasVoted`),
  3. `invalidateQueries(['polls', 'count'])` (**homepage teaser**),
  4. `invalidateQueries(['account', 'balance'])` / `['points','balance']` (**`PointsPill`**).
  Optimistic update writes `PollResult` into `['polls', id]` immediately, rolling back on error
  ([06 §3.2](../architecture/06-frontend-architecture.md#32-tanstack-query-in-client-components-mutations--live-data),
  [14 §8](../design-system/14-patterns.md#8-points--reward-feedback-pattern)).
- Errors mapped from the envelope: `409 CONFLICT` → "already voted" `Modal` + load
  `GET /polls/:id/results`; `422 UNPROCESSABLE` → persistent `Alert` + read-only results;
  `VALIDATION_ERROR` → field error on the option group.

### 6.6 Live homepage counter

The dashboard Polls `ModuleTeaserCard` reads `GET /polls/count`. Because `useVote()` invalidates
`['polls', 'count']`, the counter **decrements live** without a full reload: the query refetches and
the teaser re-renders *"{voted} of {total} voted — {unvotedCount} polls are eager for your input."*
When the member is on `/polls` (not the dashboard), the invalidation is queued and applies on next
dashboard mount — the count is always consistent with the ledger.

---

## 7. Backend

Lives in `apps/api/src/modules/polls/` — `polls.module.ts`, `polls.controller.ts`,
`polls.service.ts` ([03-backend §1.2](../architecture/03-backend-architecture.md#12-appsapisrc-folder-tree)).
Admin routes are added by `AdminModule` composing `PollsService`.

### 7.1 Module wiring

```ts
@Module({
  imports: [PointsModule],          // shared ledger — import, never re-implement
  controllers: [PollsController],   // + admin controller via AdminModule
  providers: [PollsService],
  exports: [PollsService],          // AdminModule composes it
})
export class PollsModule {}
```

### 7.2 Controller (thin)

Per [03-backend §2](../architecture/03-backend-architecture.md#2-layering): controller reads DTO +
`@CurrentUser()`, delegates to one service call, returns a plain DTO. No Prisma, no envelope, no
business `if`s.

```ts
@Controller('polls')
export class PollsController {
  constructor(private readonly polls: PollsService) {}

  @Get()               list(@CurrentUser() u: AuthenticatedUser) { return this.polls.listActiveUnvoted(u.id); }
  @Get('count')        count(@CurrentUser() u: AuthenticatedUser) { return this.polls.unvotedCount(u.id); }
  @Get(':id')          detail(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthenticatedUser) { return this.polls.getDetail(u.id, id); }
  @Get(':id/results')  results(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthenticatedUser) { return this.polls.getResults(u.id, id); }

  @Post(':id/vote') @HttpCode(200)
  vote(@Param('id', ParseUUIDPipe) id: string, @Body() dto: VoteInput, @CurrentUser() u: AuthenticatedUser) {
    return this.polls.vote(u.id, id, dto.optionIds);
  }
}
```

### 7.3 Vote service — transactional (the core)

Business rules, ownership, and the **single transaction** live in the service. This is the canonical
implementation from [03-backend §2.3](../architecture/03-backend-architecture.md#23-canonical-controller--service):

```ts
async vote(userId: string, pollId: string, optionIds: string[]): Promise<PollResult> {
  const poll = await this.prisma.poll.findUnique({ where: { id: pollId }, include: { options: true } });
  if (!poll) throw new NotFoundException('poll');                                  // 404
  if (!poll.isActive || (poll.expiresAt && poll.expiresAt < new Date()))
    throw new UnprocessableException('poll_closed');                              // 422
  this.assertValidOptions(poll, optionIds); // ids ⊆ poll, non-empty, single⇒exactly 1 → else 400

  return this.prisma.$transaction(async (tx) => {
    try {
      await tx.pollVote.create({ data: { pollId, userId, optionIds, pointsAwarded: poll.pointsReward } });
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('already_voted');     // 409
      throw e;
    }
    await this.incrementCounters(tx, pollId, optionIds); // totalVotes +1; each voteCount +1
    await this.points.award(tx, {                        // 15 pts, SAME tx
      userId, action: 'POLL_VOTE', points: poll.pointsReward,
      refType: 'poll', refId: pollId,
      idempotencyKey: `poll_vote:${pollId}:${userId}`,
      description: 'Poll vote reward',
    });
    return this.buildResult(tx, pollId, userId);         // counters → percentages
  });
}
```

Key points:
- **One transaction** wraps the vote insert, both counter bumps, and the point credit. If any step
  fails, everything rolls back — no orphan credit, no half-incremented counter
  ([04-database §5 invariant 1](../architecture/04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6)).
- **No pre-check for existing votes** — the unique constraint is the arbiter; the `catch` maps
  `P2002` → `409`.
- **No external I/O inside the transaction** (no provider/email calls) — keep it short
  ([03-backend §9.3](../architecture/03-backend-architecture.md#93-db-connection-pooling)). New-poll
  notifications, if any, are enqueued **after** commit.

### 7.4 Results computation (from counters)

`buildResult` / `getResults` read the poll + options (denormalized counters) and the caller's own
`PollVote.optionIds`, then compute per-option `percentage = totalVotes ? round1(voteCount /
totalVotes * 100) : 0`. **No `COUNT(*)`** over `poll_votes` — counters are the source. `userOptionIds`
comes from the caller's vote row (empty if none) for result highlighting.

### 7.5 Listing / count queries

- `listActiveUnvoted(userId)`: active + unexpired polls with **no** matching `poll_votes` row for the
  user (Prisma `where: { isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  votes: { none: { userId } } }`), ordered `createdAt desc`. Backed by `@@index([isActive])`.
- `unvotedCount(userId)`: `{ unvotedCount, totalActive }` via two `count`s (or one grouped query).

### 7.6 Admin CRUD + deactivate/expiry

`PollsService` also exposes `adminList`, `adminGet`, `create`, `update`. `create` validates
`pollType` vs option count and inserts poll + options in one transaction. `update` handles field
edits, **deactivation** (`isActive: false`) and **expiry** (`expiresAt`), rejects option edits once
votes exist (`422`), and writes an `audit_logs` entry. Admin controllers are guarded by `AdminGuard`
+ role ([03-backend §3.6](../architecture/03-backend-architecture.md#36-auth-authguard-rolesguard-currentuser)).

### 7.7 Guards & ownership

- `AuthGuard` (global) requires a valid member JWT on all `/polls/*`
  ([03-backend §3.6](../architecture/03-backend-architecture.md#36-auth-authguard-rolesguard-currentuser)).
- `AdminGuard` + `@Roles` guard `/admin/polls/*`.
- **Ownership** for votes is intrinsic: every vote/result query is scoped by `userId`, so a member can
  only ever create/read *their own* vote — no IDOR ([03-backend §3.7](../architecture/03-backend-architecture.md#37-ownership-checks)).

### 7.8 Error mapping

Domain exceptions map via the global filter
([03-backend §8.2](../architecture/03-backend-architecture.md#82-mapping-table)):
`NotFoundException`→404, `ConflictException('already_voted')`→409, `UnprocessableException('poll_closed')`→422,
`ValidationException`/Zod→400, Prisma `P2002`→409 (safety net).

---

## 8. Points / ledger rules

Every point movement goes through the shared `PointsService`; Polls **never** writes
`points_transactions` / `points_balances` directly
([04-database §5](../architecture/04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6),
[03-backend §4](../architecture/03-backend-architecture.md#4-pointsservice--the-shared-ledger)).

### 8.1 The credit

| Field | Value |
|---|---|
| `action` | `POLL_VOTE` (enum `PointsAction`) |
| `direction` | `CREDIT` |
| `points` | `poll.pointsReward` (**15** by default; positive integer) |
| `refType` / `refId` | `'poll'` / `pollId` |
| `idempotencyKey` | **`poll_vote:{pollId}:{userId}`** |
| `description` | `'Poll vote reward'` |

The credit runs **inside the vote transaction**, so the ledger row, the counters, and the vote commit
or roll back together. `balanceAfter` is snapshotted and `points_balances` updated in the same tx
(O(1) balance reads).

### 8.2 Idempotency & no double-credit

Two independent guards make a double credit impossible:

1. **`poll_votes` unique `[pollId, userId]`** — a second vote insert fails → `409`, so the transaction
   never reaches the award step.
2. **Ledger `idempotencyKey` unique** `poll_vote:{pollId}:{userId}` — even if a retry somehow reached
   `award()`, `PointsService.move()` short-circuits and returns the existing transaction instead of
   creating a new one ([03-backend §4.1](../architecture/03-backend-architecture.md#41-transaction-aware-api)).

### 8.3 Concurrency — the race

Two simultaneous vote requests for the same `(poll, user)` (double-click / retry) both enter the
transaction; the DB unique constraint lets exactly **one** insert win. The loser gets `P2002` →
`409 CONFLICT`. Only **one** ledger credit of 15 is written. See test [§11.7](#117-concurrent-double-submit).

### 8.4 INR display

15 points = **₹0.15** (`points / 100`), computed client-side only, never stored or sent as money
([05 §1](../architecture/05-api-conventions.md#1-general-rules)).

---

## 9. Reuse notes

This module **adds almost no new primitives** — it wires existing ones:

- **Ledger:** `PointsService.award()` — reused verbatim from Auth/Profile/Surveys/Games. Polls only
  supplies the `POLL_VOTE` action + idempotency key.
- **UI kit:** `PollCard`, `PollResultBars`, `ModuleTeaserCard`, `RadioGroup`, `CheckboxGroup`/
  `MultiSelect`, `Button`, `PointsPill`, `Modal`, `EmptyState`, `Skeleton`, `Alert`, `ProgressBar` —
  all pre-existing in `@influencer/ui` ([13](../design-system/13-components-library.md)).
- **Patterns:** form ([14 §1](../design-system/14-patterns.md#1-form-pattern-the-canonical-form)),
  list+card ([14 §6](../design-system/14-patterns.md#6-list--card-pattern)),
  empty/loading/error ([14 §3](../design-system/14-patterns.md#3-empty--loading--error-state-pattern)),
  points feedback ([14 §8](../design-system/14-patterns.md#8-points--reward-feedback-pattern)),
  informational Modal ([14 §2b](../design-system/14-patterns.md#2b-informational--result-modals--modal)).
- **API contract:** envelope, error codes, endpoint template — [05](../architecture/05-api-conventions.md).
- **Admin:** `AdminGuard`, `DataTable`, `Modal` form, `audit_logs` — reused from the admin shell.

New Polls-only code: `PollsModule`/`PollsController`/`PollsService`, the `VoteInput`/`PollResult` Zod
DTOs in `@influencer/types`, and the `features/polls/*` hooks/components that compose the kit.

---

## 10. Acceptance criteria

- [ ] Homepage shows a Polls `ModuleTeaserCard` with correct *"{voted} of {total} voted — {unvoted}
      polls are eager for your input."* copy and a Participate CTA → `/polls`.
- [ ] `/polls` lists only **active, unexpired, not-yet-voted** polls; voted/expired/inactive polls are
      excluded.
- [ ] A single-choice poll renders a `RadioGroup`; a multi-choice poll renders a `CheckboxGroup`/
      `MultiSelect`.
- [ ] The Vote button reads **`Vote (15 Points)`** and is disabled until a valid selection is made.
- [ ] A successful vote inserts **one** `poll_votes` row, bumps `poll.totalVotes` and each selected
      `option.voteCount`, and credits **exactly 15** points via `PointsService` — **all in one
      transaction**.
- [ ] After voting, the page shows `PollResultBars` with correct percentages; the user's choice(s) are
      **primary magenta**, others neutral; result text (option, %) is present (not colour-only).
- [ ] A second vote on the same poll by the same user returns **`409 CONFLICT`** and awards **no**
      further points; the "already voted" `Modal` + read-only results are shown.
- [ ] Voting on an inactive/expired poll returns **`422 UNPROCESSABLE`**; the vote form is disabled and
      read-only results are shown.
- [ ] The homepage unvoted count **decrements live** after a vote (query invalidation), and the header
      `PointsPill` updates by +15.
- [ ] Multi-choice votes record **all** selected `optionIds` in one row and still award 15 (once).
- [ ] Admin can create (≥2 options), list, update, deactivate, and set expiry on polls; every admin
      mutation is audit-logged; option edits after votes exist are rejected (`422`).
- [ ] Concurrent double-submit for the same `(poll, user)` results in exactly one vote and one 15-pt
      credit; the loser gets `409`.
- [ ] Empty listing shows the shared `EmptyState`.

---

## 11. Tasks (ordered)

1. **DTOs & types** — add `VoteInput`, `PollSummary`, `PollDetail`, `PollResult`, `CreatePollInput`,
   `UpdatePollInput` Zod schemas to `@influencer/types` (shared by API + web).
2. **Prisma** — confirm `Poll`/`PollOption`/`PollVote` migration (models already in
   [04-database §4](../architecture/04-database-architecture.md#4-prisma-schema-authoritative));
   ensure `@@unique([pollId, userId])`, `@@index([isActive])`, `@@index([pollId])`, `@@index([userId])`.
3. **Seed** — a few sample polls (Westside Yes/No single-choice; FM Radio multi-choice) for dev/demo.
4. **`PollsModule`** — module + `PollsController` + `PollsService`; import `PointsModule`.
5. **Read endpoints** — `listActiveUnvoted`, `getDetail`, `getResults`, `unvotedCount` + controller
   routes.
6. **Vote endpoint** — transactional `vote()`: insert → counters → `PointsService.award()` →
   `buildResult`; unique-violation → 409; closed → 422; invalid options → 400.
7. **Admin CRUD** — `create`/`adminList`/`adminGet`/`update` in `PollsService`; admin controller via
   `AdminModule` with `AdminGuard`; audit logging; reject option edits post-votes.
8. **Frontend hooks** — `usePollsList`, `usePoll`, `useVote` (with invalidations + optimistic update)
   in `features/polls/hooks/`.
9. **Frontend pages** — dashboard `ModuleTeaserCard`; `/polls` `PollGrid`; `/polls/[id]` RSC +
   `VotePanel` island with `RadioGroup`/`CheckboxGroup` and `PollResultBars`.
10. **State handling** — already-voted `Modal`, closed-poll `Alert`, `EmptyState`, `Skeleton`, error
    `Alert` + Retry; +15 pts toast + `PointsPill` animation.
11. **Wire homepage live counter** — `useVote` invalidates `['polls','count']`.
12. **Tests** — unit (service), integration (transaction + idempotency + concurrency), e2e (envelope,
    status codes) per [§12](#12-test-cases).
13. **Admin UI** — `/admin/polls` `DataTable` + `Modal` create/edit forms (compose the kit).

---

## 12. Test cases

Coverage targets & tooling live in
[08-testing-strategy](../architecture/08-testing-strategy.md); the Polls-specific cases:

### 12.1 Vote awards 15 once
Given an active poll and a first-time voter, `POST /polls/:id/vote` returns `200` with
`pointsAwarded: 15`; exactly one `poll_votes` row and one `POLL_VOTE` `points_transactions` row exist;
`points_balances.balance` increased by 15; `totalVotes` +1 and the selected `voteCount` +1.

### 12.2 Second vote → 409
A second `POST …/vote` for the same `(poll, user)` returns `409 CONFLICT` (`already_voted`); **no**
new `poll_votes` row, **no** new ledger row, balance unchanged, counters unchanged.

### 12.3 Multi-choice records multiple options
For a `MULTI_CHOICE` poll, voting `{ optionIds: [a, b, c] }` stores all three ids in one
`PollVote.optionIds`; each of `a/b/c` `voteCount` +1; `totalVotes` +1; **15** points awarded **once**.

### 12.4 Results percentages correct
`GET /polls/:id/results` returns per-option `percentage = round1(voteCount / totalVotes * 100)`; for a
single-choice poll the option percentages sum to ~100%; `userOptionIds` reflects the caller's choice;
computed from counters (assert **no** `COUNT(*)` on `poll_votes`).

### 12.5 Expired poll rejected → 422
Voting on a poll with `expiresAt < now` (or `isActive = false`) returns `422 UNPROCESSABLE`
(`poll_closed`); no vote, no credit. `GET /polls/:id/results` on it still returns read-only results.

### 12.6 Homepage count excludes voted
`GET /polls/count` returns `unvotedCount` that **excludes** polls the user has voted on and
inactive/expired polls; after a successful vote the value decreases by 1.

### 12.7 Concurrent double-submit blocked
Two vote requests fired concurrently for the same `(poll, user)` yield exactly one `200` and one
`409`; exactly one `poll_votes` row and one 15-pt ledger row exist (ledger `idempotencyKey`
`poll_vote:{pollId}:{userId}` is the second guard). Validates
[03-backend §10 integration seam](../architecture/03-backend-architecture.md#10-testing-seams).

### 12.8 Invalid options → 400
`optionIds` empty, containing ids not on the poll, containing duplicates, or containing >1 id for a
`SINGLE_CHOICE` poll → `400 VALIDATION_ERROR` (no vote, no credit).

### 12.9 Unknown poll → 404
`GET /polls/:id`, `…/results`, and `POST …/vote` with an unknown id → `404 NOT_FOUND`.

### 12.10 Ledger rollback on failure
If the point credit (or a counter update) fails inside the transaction, the whole vote rolls back — no
`poll_votes` row and no ledger row persist (integration test with an injected failure).

### 12.11 Admin
Create rejects <2 options and mismatched `pollType`; deactivate sets `isActive:false` and removes the
poll from `GET /polls` while `…/results` stays readable; option edits after votes exist → `422`; every
admin mutation writes an `audit_logs` row; non-admin token → `403 FORBIDDEN`.

---

## Related documents

- [../00-project-overview.md](../00-project-overview.md) — vision, module map, points/INR constant.
- [../Influencer_Platform_Full_Breakdown.md](../Influencer_Platform_Full_Breakdown.md) — source spec §6 (Polls).
- [../architecture/03-backend-architecture.md](../architecture/03-backend-architecture.md) — modules, layering, `PointsService`.
- [../architecture/04-database-architecture.md](../architecture/04-database-architecture.md) — `Poll`/`PollOption`/`PollVote`, ledger rules.
- [../architecture/05-api-conventions.md](../architecture/05-api-conventions.md) — envelope, error codes, endpoint template.
- [../architecture/06-frontend-architecture.md](../architecture/06-frontend-architecture.md) — App Router, RSC/client, TanStack Query.
- [../design-system/13-components-library.md](../design-system/13-components-library.md) — `PollCard`, `PollResultBars`, `ModuleTeaserCard`, `RadioGroup`, `MultiSelect`.
- [../design-system/14-patterns.md](../design-system/14-patterns.md) — form, list+card, state, modal, points-feedback patterns.

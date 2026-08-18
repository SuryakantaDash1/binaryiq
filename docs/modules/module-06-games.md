# Module 06 — Games (Daily Spin the Wheel)

> Phase 6 of the build. The daily engagement hook: a free, once-per-day Spin-the-Wheel game whose
> outcome is decided **server-side** by weighted random **before** any animation, then rendered by a
> purely-visual wheel. Points are credited through the shared ledger in one transaction, and the daily
> limit is enforced by a Redis fast-path plus a durable DB backstop.

This doc specifies *what* the Games module builds and *how its flows behave*. It does **not** redefine
the cross-cutting contracts, which live in the backbone docs and are referenced, not duplicated:

- Product scope, module map, points/INR constant → [00-project-overview](../00-project-overview.md)
- Detailed spec (§7 Games) → [Influencer_Platform_Full_Breakdown](../Influencer_Platform_Full_Breakdown.md)
- Backend structure, layering, `PointsService`, jobs → [03-backend-architecture](../architecture/03-backend-architecture.md)
- Data model (`Game`/`GameSegment`/`GamePlay`), ledger rules, Redis keys → [04-database-architecture](../architecture/04-database-architecture.md)
- Envelope, error codes, auth, pagination → [05-api-conventions](../architecture/05-api-conventions.md)
- App Router, RSC/client split, TanStack Query, forms → [06-frontend-architecture](../architecture/06-frontend-architecture.md)
- `SpinWheel`, `ModuleTeaserCard` → [13-components-library](../design-system/13-components-library.md)
- Motion & reduced-motion policy → [10-design-principles](../design-system/10-design-principles.md#35-motion--reduced-motion)
- Build order & definition of done → [phases/00-roadmap](../phases/00-roadmap.md)

---

## 1. Overview & goal

The Games module delivers **daily engagement**: a reason for members to return every day. The launch
game is **"Spin the Daily Wheel"** — free (no points to play), playable **once per user per day**
(resets at local midnight), with **8 weighted segments** whose point prizes range **0–1,000 pts**
(₹0.00–₹10.00 at the `100 pts = ₹1` constant, [00 §1](../00-project-overview.md)).

The single most important property: **the outcome is server-decided by weighted random selection
before the animation runs**. The spinning wheel is a visual dramatization that *lands on the
server's answer*; it can never change or influence the prize. This is the module's anti-manipulation
backbone (see [§6](#6-anti-abuse--integrity-critical)).

**Goals**

- One free spin per user per calendar day, reliably enforced (Redis fast-path + DB unique backstop).
- Server-authoritative, statistically-correct weighted outcomes (probabilities sum to `1.0000`).
- Points credited atomically through `PointsService` in the same transaction as the play record.
- A polished, celebratory wheel experience that fully respects `prefers-reduced-motion` and never
  gates the reward on the animation.
- Data-driven segments (admin-editable) with a sum-to-1.0 invariant.

**Non-goals for this phase:** the `QUIZ` game type (the `GameType` enum reserves it, but only
`SPIN_WHEEL` ships), paid/entry-fee games, multi-spin packs, leaderboards, and any second daily game.

---

## 2. Scope

### 2.1 In scope

- Member endpoints: list games, game detail + segments, **spin**, spin status, play history.
- Redis daily-lock lifecycle: check before spin, set after spin, TTL to next **local** midnight.
- DB backstop: `game_plays` unique `[userId, gameId, playDate]`.
- Server-side weighted-random selection with an **injected RNG** for testability.
- Points award via `PointsService.award(...)` (`GAME_SPIN`) inside the spin transaction, idempotent
  per user per day.
- Homepage **Games `ModuleTeaserCard`** ("0 of 1 played — Calling all gamers!") and the games page
  with the `SpinWheel` island (animation, confetti, result modal, reduced-motion fallback).
- Admin: list/create games and **edit segments** with the sum-to-1.0 validation.
- Seed: the Spin-the-Wheel game + its 8 segments (from [04 §7](../architecture/04-database-architecture.md#7-migrations--seeding)).

### 2.2 Out of scope

- Quiz/other game types, entry fees, streak bonuses, referral-linked games.
- A cron-based daily reset — the Redis key **expires itself** ([04 §6](../architecture/04-database-architecture.md#6-redis-usage-not-postgres-but-part-of-the-data-layer), [03 §6.3](../architecture/03-backend-architecture.md#63-daily-spin-reset--redis-ttl-not-a-cron)).
- Any point-movement logic beyond calling the shared `PointsService` (owned by module-03).
- Notifications ("come back and spin") — that is module-07's `GAME_REMINDER` type; Games only emits
  the domain event.

---

## 3. User flows

### 3.1 Happy path (first spin of the day)

1. **Homepage / dashboard** — the member sees the Games `ModuleTeaserCard`:
   *"0 of 1 played — Calling all gamers! Check out our exciting new games!"* with a **Participate**
   button. The `0 of 1` count comes from `GET /games` (`playedToday: false`).
2. **Games page** (`/games`) — shows *"Spin the Daily Wheel — Free game"* and the large wheel with 8
   colored segments labelled with their point values, plus a central **Spin the Wheel** button.
3. **Spin** — the member clicks Spin. The client sends `POST /v1/games/spin` and disables the button
   (prevents double-submit) while it awaits the response.
4. **Server decides** — the server validates auth + not-already-spun (Redis then DB), draws the
   weighted-random outcome, writes Redis + `game_plays` + the ledger credit in one transaction, and
   returns `{ segmentIndex, pointsWon, ... }` ([§4](#4-data-model), [§5](#5-api-contracts)).
5. **Animate** — the client animates the wheel for **3–4 s**, decelerating (cubic-bezier) to land
   exactly on `segmentIndex` (angle math in [§7.2](#72-spinwheel-landing--animation-math)).
6. **Result** — a result `Modal` overlay appears: *"Congratulations! You won 100 Points!"* (or
   *"Better luck tomorrow!"* on the 0-pt segment). **Confetti** fires only on a non-zero win.
7. **Balance updates** — the header points chip and dashboard reflect the new balance immediately
   (TanStack Query invalidation of `['points','balance']`, [06 §3.2](../architecture/06-frontend-architecture.md#32-tanstack-query-in-client-components-mutations--live-data)).

### 3.2 Already spun today (return visit)

- On the games page, the Spin control is **replaced** with *"Come back tomorrow to spin again!"* and
  a countdown/next-reset hint. The teaser card reads *"1 of 1 played"*.
- If the client somehow issues a second `POST /v1/games/spin`, the server responds
  **`409 CONFLICT`** ("already spun today") — the animation never starts.
- Status is authoritative via `GET /games/spin/status` (`{ hasSpunToday, nextSpinAt }`).

### 3.3 Reduced-motion path

- When `prefers-reduced-motion: reduce` is set, the wheel skips the long spin and performs a **quick,
  minimal transition straight to the result** (no multi-second spin, no confetti, no strobing) —
  [10 §3.5](../design-system/10-design-principles.md#35-motion--reduced-motion). The **reward is
  identical and is never gated on animation completing**; the result modal and updated balance still
  appear. Screen-reader users get the outcome announced via an `aria-live="polite"` region.

### 3.4 Flow diagram

```text
Homepage ModuleTeaserCard ("0 of 1 played")
      │ Participate
      ▼
/games page ── wheel + Spin button
      │ click Spin  ──►  POST /v1/games/spin
      │                        │
      │                  validate auth + not-already-spun (Redis → DB)
      │                  weighted-random outcome (server, before animation)
      │                  $transaction: game_play insert + PointsService.award + Redis set
      │                        │
      │  ◄── { segmentIndex, pointsWon } ──┘
      ▼
animate wheel 3–4s → land on segmentIndex   (reduced-motion: quick jump)
      ▼
result Modal (+ confetti if pointsWon>0) → header balance updates
      ▼
return visit → "Come back tomorrow to spin again!"  (409 on re-POST)
```

---

## 4. Data model

The schema is **authoritative in** [04 §4](../architecture/04-database-architecture.md#4-prisma-schema-authoritative);
below is how Games uses it. Three tables plus one Redis key.

### 4.1 `Game`

The container for a game. Only one active `SPIN_WHEEL` game ships (`isFree = true`,
`isActive = true`). `gameType` is the `GameType` enum (`SPIN_WHEEL` | `QUIZ`).

### 4.2 `GameSegment`

One row per wheel slice, ordered by `sortOrder` (0..7 = wheel index).

- `label` — display text (e.g. `"100 Points"`, `"Better luck next time!"`).
- `pointsValue Int` — prize; **`0` for the "better luck" segment**.
- `probability Decimal @db.Decimal(5,4)` — weighted probability. **The sum of a game's segment
  probabilities MUST equal `1.0000`** (enforced at seed + admin edit, [§8.4](#84-admin-segment-editing)).
- `color VarChar(7)` — hex for the slice.

**Seed distribution (8 segments, probabilities sum to 1.0000):**

| index | label | pointsValue | probability | INR |
|---|---|---|---|---|
| 0 | Better luck next time! | 0 | 0.1500 | ₹0.00 |
| 1 | 40 Points | 40 | 0.2000 | ₹0.40 |
| 2 | 80 Points | 80 | 0.2000 | ₹0.80 |
| 3 | 100 Points | 100 | 0.1800 | ₹1.00 |
| 4 | 200 Points | 200 | 0.1200 | ₹2.00 |
| 5 | 300 Points | 300 | 0.0800 | ₹3.00 |
| 6 | 500 Points | 500 | 0.0500 | ₹5.00 |
| 7 | 1000 Points | 1000 | 0.0200 | ₹10.00 |

> Sum check: `0.15 + 0.20 + 0.20 + 0.18 + 0.12 + 0.08 + 0.05 + 0.02 = 1.00`. Expected value per spin
> ≈ **129.4 pts** (`0·.15 + 40·.20 + 80·.20 + 100·.18 + 200·.12 + 300·.08 + 500·.05 + 1000·.02`).

The `segmentIndex` returned by the API is this ordered position (by `sortOrder`), so the client wheel
and the server agree on which slice is which without leaking probabilities.

### 4.3 `GamePlay`

One row per spin (durable record and the **DB-level daily backstop**):

- `segmentId` → the landed segment; `pointsWon Int` → the awarded points (mirrors the segment value).
- `playedAt Timestamptz` → exact spin time; `playDate Date` → the **local** calendar date used for
  the daily-limit uniqueness.
- **`@@unique([userId, gameId, playDate])`** — the correctness-critical constraint: at most one play
  per user per game per day, even if Redis is down or races. A duplicate insert raises
  `P2002` → mapped to **`409 CONFLICT`**.

### 4.4 Redis daily lock — `spin:daily:{userId}`

The **fast path** for the daily limit ([04 §6](../architecture/04-database-architecture.md#6-redis-usage-not-postgres-but-part-of-the-data-layer)):

- **Key:** `spin:daily:{userId}`.
- **Value:** the day's outcome snapshot (`segmentId`, `segmentIndex`, `pointsWon`, `playedAt`) — so
  `spin/status` can answer without a DB hit and a client retry can be told what it already won.
- **TTL:** set to expire at the user's **next local midnight** (not a cron; the key self-expires,
  so there is no clock-skew reset window, [03 §6.3](../architecture/03-backend-architecture.md#63-daily-spin-reset--redis-ttl-not-a-cron)).
- **Lifecycle:** `EXISTS` check before spin (present → already spun); `SET` with computed TTL after a
  successful spin transaction.

### 4.5 Timezone handling (must be explicit)

Both the Redis TTL and `playDate` depend on a single, well-defined "day" boundary:

- The platform's canonical timezone is **`Asia/Kolkata` (IST)** — the same zone the cron jobs use
  ([03 §6.2](../architecture/03-backend-architecture.md#62-scheduled-jobs-cron)). "Once per day" means
  once per **IST calendar day**.
- `playDate` is computed as the IST calendar date of `playedAt` (store the IST-local date, not the UTC
  date, so a 23:30 IST spin doesn't count against "tomorrow").
- The Redis TTL is `secondsUntil(nextMidnightIST)` at spin time, so the lock releases at the same IST
  midnight boundary that flips `playDate`. **Redis TTL and DB `playDate` therefore agree on the day
  boundary** — no window where one thinks it's a new day and the other doesn't.
- Rationale for a fixed platform TZ (vs per-user TZ): it keeps the two enforcement mechanisms
  consistent and avoids a user shifting timezones to earn extra spins. Per-user TZ is a future option
  but is explicitly **not** built now.

---

## 5. API contracts

All endpoints follow [05-api-conventions](../architecture/05-api-conventions.md): `/v1` prefix,
`Bearer` JWT auth, the standard success/error **envelope**, and the canonical error codes. DTOs are
Zod schemas in `@influencer/types`. Base prefix: `/v1/games`, admin under `/v1/admin/games`.

### 5.1 Member endpoints

> **`GET /v1/games`** — list active games with today's play status
> - **Auth:** member
> - **200:** `{ data: GameListItem[] }` — each `{ id, gameName, gameType, isFree, playedToday, nextSpinAt? }`
> - **Notes:** drives the homepage teaser count (`playedToday` → "0 of 1" / "1 of 1"). `playedToday`
>   is read from Redis (`spin:daily:{userId}`), falling back to `game_plays` for today's `playDate`.

> **`GET /v1/games/:id`** — game detail + segments (for rendering the wheel)
> - **Auth:** member · **Path:** `id` (uuid)
> - **200:** `{ data: GameDetail }` — `{ id, gameName, gameType, isFree, playedToday, segments: SegmentView[] }`
>   where `SegmentView = { index, label, pointsValue, color }`.
> - **Errors:** `404 NOT_FOUND` unknown/inactive game.
> - **Security note:** `SegmentView` **omits `probability`** — weights are never sent to the client
>   (they are irrelevant to the visual wheel and could aid manipulation attempts).

> **`POST /v1/games/spin`** — execute the daily spin (the core endpoint)
> - **Auth:** member · **Body:** none (server picks the active game) or `{ gameId }` (optional)
> - **Idempotency:** server-derived key `spin:{userId}:{date}` (IST date). An `Idempotency-Key`
>   header, if sent, maps to this same ledger key ([05 §1](../architecture/05-api-conventions.md#1-general-rules)).
> - **200:** `{ data: SpinResult }` where
>   `SpinResult = { playId, segmentIndex, segmentId, pointsWon, newBalance, playedAt }`.
> - **Errors:**
>   - **`409 CONFLICT`** — already spun today (Redis fast-path or `game_plays` unique violation).
>   - `422 UNPROCESSABLE` — no active game / game inactive.
>   - `401 UNAUTHENTICATED` — missing/expired token.
>   - `429 RATE_LIMITED` — throttle (defense-in-depth atop the daily lock, [05 §8](../architecture/05-api-conventions.md#8-rate-limiting)).
> - **Side effects (all in ONE `prisma.$transaction`):**
>   1. insert `game_plays` (`userId, gameId, segmentId, pointsWon, playedAt, playDate`),
>   2. award points via `PointsService.award(tx, { action: 'GAME_SPIN', points: pointsWon,
>      refType: 'game', refId: gameId, idempotencyKey: 'spin:{userId}:{date}' })` — **only when
>      `pointsWon > 0`** (see [§9](#9-pointsledger-rules)),
>   3. `SET spin:daily:{userId}` with the outcome + TTL to next IST midnight (after commit, or in a
>      post-commit hook — Redis write is idempotent and the DB unique row is the source of truth).
>   The outcome is computed **before** the response is sent and before any client animation.

> **`GET /v1/games/spin/status`** — has the user spun today?
> - **Auth:** member
> - **200:** `{ data: { hasSpunToday: boolean, nextSpinAt: string|null, lastResult?: { segmentIndex, pointsWon } } }`
> - **Notes:** answered from Redis first; DB fallback by today's `playDate`. `nextSpinAt` = next IST
>   midnight when `hasSpunToday`.

> **`GET /v1/games/history`** — the user's own play history
> - **Auth:** member (ownership enforced in service — only the caller's plays)
> - **Query:** cursor pagination (`limit`, `cursor`) per [05 §6](../architecture/05-api-conventions.md#6-pagination-filtering-sorting)
> - **200:** `{ data: PlayHistoryItem[], meta.pagination }` — `{ playId, gameName, label, pointsWon, playedAt }`

### 5.2 Admin endpoints (`/v1/admin/games`, `AdminGuard` + role)

> **`GET /v1/admin/games`** — list all games (active + inactive)
> - **Auth:** admin (`SUPER_ADMIN`/`ADMIN`) · **200:** `{ data: AdminGame[] }` (offset pagination allowed)

> **`POST /v1/admin/games`** — create a game
> - **Auth:** admin · **Body:** `{ gameName, gameType, isFree, segments: SegmentInput[] }`
> - **201:** `{ data: AdminGame }`
> - **Validation:** `sum(segments.probability) === 1.0000` (see [§8.4](#84-admin-segment-editing));
>   otherwise `400 VALIDATION_ERROR` with a `probabilitySum` detail. Writes `audit_logs` (`game.create`).

> **`PUT /v1/admin/games/:id/segments`** — replace/edit wheel segments & probabilities
> - **Auth:** admin · **Path:** `id` (uuid) · **Body:** `{ segments: SegmentInput[] }`
>   (`SegmentInput = { label, pointsValue, probability, color, sortOrder }`)
> - **200:** `{ data: AdminGame }`
> - **Errors:** `400 VALIDATION_ERROR` if probabilities don't sum to `1.0000` or `pointsValue < 0`;
>   `404 NOT_FOUND` unknown game.
> - **Side effects:** replaces `game_segments` in one transaction; writes `audit_logs`
>   (`game.segments.update`). Existing `game_plays` keep their historical `segmentId` (segments are
>   not hard-deleted if referenced — deactivate/replace by new rows to preserve history).

---

## 6. Anti-abuse & integrity (CRITICAL)

This is the module's defining concern. Four layers make the outcome impossible to manipulate and the
daily limit impossible to bypass.

### 6.1 Server-side outcome — decided before animation

The prize is drawn by the **server** using weighted-random selection **before** the API responds. The
client receives a fixed `{ segmentIndex, pointsWon }` and merely animates the wheel to that slice. The
animation is cosmetic — there is no client input that feeds the outcome, and nothing the client does
(devtools, timing, replaying the animation) can change the awarded points. The points are already
committed to the ledger by the time the wheel starts spinning.

### 6.2 Redis fast-path + DB unique backstop (defense in depth)

- **Fast path:** `EXISTS spin:daily:{userId}` short-circuits repeat spins cheaply (`409` without
  touching Postgres).
- **Durable backstop:** the `game_plays` `@@unique([userId, gameId, playDate])` constraint is the
  source of truth. Even if Redis is **down, flushed, or races** two concurrent requests, the unique
  index guarantees at most one play per user/day — the second insert raises `P2002` → `409 CONFLICT`.
- The spin transaction **inserts the `game_play` first**; the Redis `SET` follows commit. So Redis can
  never grant a spin the DB would reject.

### 6.3 Why the animation cannot change the result

The response is sent and the ledger credit is committed **before** `requestAnimationFrame` runs. The
returned `segmentIndex` is the *only* input to the landing math; the wheel is a deterministic function
of that index. Tampering with the animation just draws a wrong picture of an already-final result —
and the server never reads client animation state back.

### 6.4 Weighted-random implementation (injected RNG for testability)

Selection is a standard cumulative-weight draw over `probability`:

```ts
// games.service.ts — pure, deterministic given rng
type Rng = () => number; // [0,1)

export function pickSegment(segments: GameSegment[], rng: Rng): GameSegment {
  const r = rng();                       // single draw in [0,1)
  let acc = 0;
  for (const seg of segments) {          // segments ordered by sortOrder
    acc += Number(seg.probability);
    if (r < acc) return seg;
  }
  return segments[segments.length - 1];  // FP safety net (acc→1.0)
}
```

- The RNG is **injected** (`RNG` provider), defaulting to `crypto.randomInt`-based uniform in
  `[0,1)`. Tests bind a deterministic RNG to assert exact segment selection at boundary values
  (`r = 0`, `r = 0.149`, `r = 0.15`, `r = 0.98`, `r ≈ 0.9999`).
- Weights come from the DB (`game_segments.probability`), so the seeded/admin-edited distribution is
  the single source of truth. A boot/edit-time assertion checks the sum is `1.0000` so the loop can't
  under-cover the `[0,1)` range.

### 6.5 Additional guards

- Rate limiting on `POST /games/spin` ([05 §8](../architecture/05-api-conventions.md#8-rate-limiting))
  as defense-in-depth (the daily lock is the primary control).
- Ownership: `spin`, `status`, and `history` are always scoped to `@CurrentUser().id` in the service
  ([03 §3.7](../architecture/03-backend-architecture.md#37-ownership-checks)); no user can read
  another's plays (no IDOR).
- The timezone is server-fixed (IST), so a user can't shift device clocks/TZ to earn extra spins
  ([§4.5](#45-timezone-handling-must-be-explicit)).

---

## 7. Frontend

Per [06-frontend-architecture](../architecture/06-frontend-architecture.md): the `/games` page is a
thin **RSC** that fetches `GET /games/:id` for initial wheel data, and embeds the **`SpinWheel`
client island** for the interactive spin. `SpinWheel` is a self-contained shared component
([13 §8](../design-system/13-components-library.md#8-feature-specific-shared-components-still-in-packagesui-or-appswebcomponents))
and is `next/dynamic`-imported with `ssr: false` + a `Skeleton` fallback so its animation code doesn't
bloat the server render or initial bundle ([06 §9](../architecture/06-frontend-architecture.md#9-routing-code-splitting-image-optimization)).

### 7.1 `SpinWheel` component

- **Rendering:** SVG (or Canvas) wheel — each segment is a pie slice drawn from
  `GET /games/:id` segments (`label`, `pointsValue`, `color`), with label text rotated along the arc.
  8 equal slices of `360/8 = 45°`.
- **Spin action:** on click, calls the `useSpin` mutation (TanStack Query → typed API client →
  `POST /games/spin`). The button is disabled while pending and after a completed spin.
- **Deterministic landing:** it animates to the **returned `segmentIndex`** — the wheel is a function
  of the server answer, never the reverse.
- **Result:** on resolve, shows the shared **`Modal`** result overlay (*"Congratulations! You won N
  Points!"* / *"Better luck tomorrow!"*), fires **`canvas-confetti`** only when `pointsWon > 0`
  (celebration is scarce — [10 §5](../design-system/10-design-principles.md)), and invalidates
  `['points','balance']` + `['games']` so the **header balance chip** and teaser update.
- **Already-spun state:** if `playedToday`, render the *"Come back tomorrow to spin again!"* message
  instead of the Spin button; a `409 CONFLICT` from a stray submit is caught and rendered the same way
  (with the `lastResult` if available).
- **Errors:** map `ApiError` codes to UI — `409` → already-spun message, other codes → `Alert`/toast
  ([06 §5](../architecture/06-frontend-architecture.md#5-forms-rhf--zod-one-schema-everywhere)).

### 7.2 `SpinWheel` landing & animation math

```ts
// deterministic target rotation from the server's segmentIndex
const SEGMENTS = 8;
const SLICE = 360 / SEGMENTS;                 // 45°
const EXTRA_TURNS = 5;                         // full rotations for drama (random 4–6)
// center the pointer on the target slice; subtract from 360 so the wheel turns toward it
const targetAngle =
  EXTRA_TURNS * 360 + (360 - (segmentIndex * SLICE + SLICE / 2));

// applied as CSS transform: rotate(targetAngle deg) with cubic-bezier easing
// duration 3–4s; requestAnimationFrame for 60fps; deceleration via --ease-emphasis
```

- `angle = (360 / 8) * segmentIndex + randomFullRotations`, per spec [§7.8](../Influencer_Platform_Full_Breakdown.md),
  with the half-slice offset so the pointer sits on the slice's center, not its edge.
- Easing: CSS `cubic-bezier` deceleration (`--ease-emphasis`) — one of the **sanctioned long-motion
  exceptions** ([10 §5](../design-system/10-design-principles.md)). Duration 3–4 s.
- Uses `requestAnimationFrame`/CSS transition for smooth 60fps; the transform is the single source of
  the wheel position.

### 7.3 Reduced-motion fallback (mandatory)

- On `prefers-reduced-motion: reduce`: **skip the long spin** — snap/short-transition (≤ `--motion-base`)
  directly to the target slice, **no confetti**, no strobing
  ([10 §3.5](../design-system/10-design-principles.md#35-motion--reduced-motion)).
- **The result is never gated on animation.** The result `Modal` and updated balance are shown
  regardless. The outcome is announced in an `aria-live="polite"` region for assistive tech.

### 7.4 Homepage `ModuleTeaserCard`

- The Games teaser uses the shared `ModuleTeaserCard`
  ([13 §8](../design-system/13-components-library.md#8-feature-specific-shared-components-still-in-packagesui-or-appswebcomponents)):
  *"0 of 1 played — Calling all gamers! Check out our exciting new games!"* with a **Participate**
  link to `/games`. The `0 of 1` / `1 of 1` count derives from `GET /games` `playedToday`.

---

## 8. Backend

Per [03-backend-architecture](../architecture/03-backend-architecture.md): one feature module, thin
controllers, service owns business logic + transactions, `PointsService` imported for the credit.

### 8.1 `GamesModule`

```text
apps/api/src/modules/games/
├── games.module.ts        # imports PrismaModule (global), RedisModule (global), PointsModule
├── games.controller.ts    # /games/* — thin; auth + DTO + delegate
├── games.service.ts       # weighted spin + Redis daily lock + transactional award
└── rng.provider.ts        # injectable RNG token (default crypto uniform; test double swappable)
```

- Imports `PointsModule` to inject `PointsService` (never writes `points_transactions` directly,
  [03 §4](../architecture/03-backend-architecture.md#4-pointsservice--the-shared-ledger)).
- `RedisService` (global) for the `spin:daily:{userId}` key.
- Admin game/segment endpoints are composed by `AdminModule` over `GamesService`
  ([03 §1.1](../architecture/03-backend-architecture.md#11-design-rules)) — no forked logic.

### 8.2 Spin service (the core)

```ts
async spin(userId: string, gameId?: string): Promise<SpinResult> {
  const game = await this.getActiveSpinGame(gameId);      // 422 if none/inactive
  const dateKey = istDateKey(new Date());                 // IST calendar date (§4.5)
  const lockKey = `spin:daily:${userId}`;

  // 1) Redis fast-path
  if (await this.redis.exists(lockKey)) throw new ConflictException('already_spun_today'); // 409

  // 2) server-side weighted outcome — BEFORE any animation exists
  const segment = pickSegment(game.segments, this.rng);   // injected RNG (§6.4)

  // 3) one transaction: durable play row (backstop) + points credit
  const result = await this.prisma.$transaction(async (tx) => {
    let play;
    try {
      play = await tx.gamePlay.create({ data: {
        gameId: game.id, userId, segmentId: segment.id,
        pointsWon: segment.pointsValue, playDate: dateKey,
      }});
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('already_spun_today'); // 409 backstop
      throw e;
    }
    let newBalance = await this.points.currentBalance(tx, userId);
    if (segment.pointsValue > 0) {                          // 0-pt: play row only, no ledger row (§9)
      const txn = await this.points.award(tx, {
        userId, action: 'GAME_SPIN', points: segment.pointsValue,
        refType: 'game', refId: game.id,
        idempotencyKey: `spin:${userId}:${dateKey}`,
        description: 'Daily spin reward',
      });
      newBalance = txn.balanceAfter;
    }
    return { playId: play.id, pointsWon: segment.pointsValue, newBalance, playedAt: play.playedAt };
  });

  // 4) set the Redis lock with TTL to next IST midnight (post-commit; DB row is source of truth)
  await this.redis.set(lockKey,
    JSON.stringify({ segmentId: segment.id, segmentIndex: segment.sortOrder, pointsWon: segment.pointsValue }),
    'EX', secondsUntilNextMidnightIST());

  return { ...result, segmentIndex: segment.sortOrder, segmentId: segment.id };
}
```

- **Transaction boundary** owns the play insert **and** the points credit — if either fails, both roll
  back (ledger invariant #1, [04 §5](../architecture/04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6)).
- **No external I/O inside the transaction** — the Redis `SET` happens after commit
  ([03 §9.3](../architecture/03-backend-architecture.md#93-db-connection-pooling)). The DB unique row,
  not Redis, is the correctness backstop, so a post-commit Redis write is safe.

### 8.3 Status endpoint

`spin/status` reads Redis first (`GET spin:daily:{userId}`), and on a miss falls back to
`game_plays` where `playDate = todayIST`. Returns `hasSpunToday`, `nextSpinAt` (next IST midnight),
and the cached `lastResult` when present.

### 8.4 Admin segment editing (sum = 1.0 validation)

- `POST /admin/games` and `PUT /admin/games/:id/segments` validate that
  **`Σ probability === 1.0000`** (compared on the `Decimal(5,4)` scale to avoid float drift) and that
  every `pointsValue >= 0`. Failure → `400 VALIDATION_ERROR` with a `probabilitySum` detail.
- Segment replacement runs in one transaction; writes an `audit_logs` row. Segments referenced by
  historical `game_plays` are preserved (deactivate/append rather than hard-delete) so history stays
  intact.

---

## 9. Points/ledger rules

Point movement is owned entirely by the shared `PointsService`
([03 §4](../architecture/03-backend-architecture.md#4-pointsservice--the-shared-ledger),
[04 §5](../architecture/04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6)).
Games only *calls* it.

- **Action:** `GAME_SPIN` (CREDIT). **Amount:** the landed segment's `pointsValue`, range **0–1,000**.
- **One transaction:** the credit is created in the same `$transaction` as the `game_plays` insert —
  they commit or roll back together.
- **Idempotency:** `idempotencyKey = spin:{userId}:{date}` (IST date). Combined with the daily lock,
  this guarantees **at most one `GAME_SPIN` credit per user per day** — a retried/replayed request
  returns the existing ledger row, never a second credit.
- **Zero-point decision (of record):** on the "Better luck next time!" (0-pt) segment we **always
  create the `game_plays` record** (so the daily limit is consumed and history/analytics are complete)
  but **do not write a `points_transactions` row** (`PointsService.award` requires `points > 0`; a
  0-pt ledger entry adds no financial signal and would pollute history). So: **play record always;
  ledger row only when `pointsWon > 0`**. The user's balance is unchanged and the header does not need
  invalidation for a 0 result (though the client may still refetch harmlessly).
- **`balanceAfter`** on the credit row is the snapshot used by history displays; `newBalance` returned
  by the spin comes from that snapshot (or the unchanged balance for a 0 result).

---

## 10. Reuse notes

Games builds almost entirely on existing infrastructure — it introduces no new cross-cutting patterns:

- **`PointsService`** (module-03) — the only way points move; Games never touches the ledger tables.
- **Response envelope, error codes, auth guards, `@CurrentUser`, ownership-in-service** — all from
  [05](../architecture/05-api-conventions.md) / [03](../architecture/03-backend-architecture.md).
- **`RedisService`** (global) — same client used for sessions, OTP, rate limits ([04 §6](../architecture/04-database-architecture.md#6-redis-usage-not-postgres-but-part-of-the-data-layer)).
- **`Modal`, `Button`, `Alert`, `Skeleton`, `EmptyState`** and the `ModuleTeaserCard` / `SpinWheel`
  from the shared UI kit ([13](../design-system/13-components-library.md)) — no bespoke dialogs.
- **TanStack Query / typed API client / RSC-island pattern** from [06](../architecture/06-frontend-architecture.md);
  `useSpin` mirrors `useVote` (polls) exactly — optimistic-friendly mutation + balance invalidation.
- **Admin composition** over domain services + `audit_logs` — same as polls/surveys admin.
- **Motion/confetti/reduced-motion policy** from [10](../design-system/10-design-principles.md) — the
  wheel and confetti are the *sanctioned* long-motion exceptions, suppressed under reduced-motion.

---

## 11. Acceptance criteria

1. A member can spin exactly **once per IST day**; a second spin (same day) returns **`409 CONFLICT`**
   and never animates.
2. The daily limit holds even with **Redis unavailable** (DB unique `[userId, gameId, playDate]`
   backstop) and under **two concurrent** spin requests (exactly one succeeds).
3. Outcomes are **server-decided by weighted random before the animation**; the client cannot alter
   the awarded points.
4. Over a large sample, observed segment frequencies **match the configured probabilities** within
   statistical tolerance; probabilities always sum to `1.0000`.
5. `POST /games/spin` returns `{ segmentIndex, pointsWon, ... }`; the wheel **lands exactly on
   `segmentIndex`**.
6. Points are credited **once**, equal to the landed segment, via `GAME_SPIN` in the **same
   transaction** as the play; the header balance updates immediately.
7. The **0-pt segment** creates a play record but **no ledger row**; balance is unchanged.
8. The **Redis key expires at the next IST midnight**, after which the user can spin again (no cron
   needed).
9. **`prefers-reduced-motion`** skips the long spin and confetti but **still shows the result and
   credits points**.
10. Homepage teaser shows **"0 of 1 played"** before and **"1 of 1 played"** after the day's spin.
11. Admin segment edits are **rejected unless probabilities sum to `1.0000`** and all points ≥ 0;
    changes are audit-logged. Client-facing segment payloads **never include probabilities**.

---

## 12. Tasks (ordered)

1. **Schema/seed** — confirm `Game`/`GameSegment`/`GamePlay` migrations applied; seed the Spin-the-Wheel
   game + 8 segments (probabilities from [§4.2](#42-gamesegment)), asserting the sum is `1.0000`
   ([04 §7](../architecture/04-database-architecture.md#7-migrations--seeding)).
2. **RNG provider** — injectable `RNG` token (default crypto uniform `[0,1)`), test double swappable.
3. **`pickSegment`** — pure cumulative-weight selection ([§6.4](#64-weighted-random-implementation-injected-rng-for-testability)) + unit tests at boundaries.
4. **TZ helpers** — `istDateKey()` and `secondsUntilNextMidnightIST()` ([§4.5](#45-timezone-handling-must-be-explicit)) + tests around midnight.
5. **`GamesService.spin`** — Redis fast-path → weighted outcome → `$transaction` (play insert +
   conditional `PointsService.award`) → post-commit Redis `SET`; map `P2002` → `409`.
6. **`spin/status`, `getGames`, `getGame`, `history`** service methods (ownership-scoped; `probability`
   omitted from `GameDetail`).
7. **`GamesController`** — thin `/games/*` routes, DTOs in `@influencer/types`, Zod validation.
8. **Admin** — `GET/POST /admin/games`, `PUT /admin/games/:id/segments` with sum=1.0 validation +
   `audit_logs`.
9. **Types package** — `SpinResult`, `GameDetail`, `SegmentView`, `SpinStatus`, `SegmentInput` schemas.
10. **Frontend** — `/games` RSC page + `SpinWheel` island (landing math, cubic-bezier easing,
    `canvas-confetti`, result `Modal`), `useSpin` hook (invalidates `['points','balance']`), already-spun
    state, `next/dynamic ssr:false`.
11. **Reduced-motion** — short-transition fallback + `aria-live` result; no confetti.
12. **Homepage** — wire the Games `ModuleTeaserCard` count from `GET /games`.
13. **Tests** — unit (RNG/selection/TZ), integration (Redis+DB lock, transaction rollback, distribution),
    e2e (envelope, `409`, one-per-day), and the reduced-motion result check ([§13](#13-test-cases)).

---

## 13. Test cases

**Daily limit (Redis AND DB)**
- First spin of the day → `200` with a valid `segmentIndex`/`pointsWon`; second spin same day → `409
  CONFLICT`.
- **Redis down/flushed** before a second spin → still `409` via `game_plays` unique constraint.
- **Concurrency:** two simultaneous `POST /games/spin` for one user → exactly one `200`, one `409`;
  exactly one `game_plays` row and (if non-zero) one ledger row.

**Weighted distribution (statistical)**
- Over N = 100k spins with the seeded weights (deterministic RNG or fresh users), observed per-segment
  frequencies are within tolerance of `{0.15, 0.20, 0.20, 0.18, 0.12, 0.08, 0.05, 0.02}` (e.g.
  chi-square goodness-of-fit passes).
- `pickSegment` boundary tests: `r=0`→index0, `r=0.149`→index0, `r=0.15`→index1, `r≈0.9999`→index7.

**Server-decided / not client-trusted**
- The client sends **no** outcome in the request body; the awarded points equal the server's
  `segmentIndex` regardless of any client-supplied field. The ledger credit exists **before** the
  animation could run (assert commit precedes response).
- `GET /games/:id` response contains **no `probability`** field.

**Midnight reset**
- With TTL to next IST midnight, `spin/status` shows `hasSpunToday=true` before midnight and, after the
  key expires, a new spin succeeds. `playDate` for the new spin is the new IST date.

**Points awarded once & matches segment**
- Non-zero spin: exactly one `GAME_SPIN` credit with `points === segment.pointsValue`; `newBalance`
  matches ledger snapshot; retry with same `idempotencyKey` returns the same row (no double-credit).
- **0-pt spin:** a `game_plays` row exists, **no** `points_transactions` row, balance unchanged.
- Transaction rollback: if the ledger credit fails, the `game_plays` insert rolls back (no orphan play).

**Reduced-motion still yields result**
- With `prefers-reduced-motion: reduce`, the long spin/confetti are skipped, but the result modal
  renders, the balance updates, and the outcome is announced via `aria-live`.

---

## Related documents

- [00-project-overview](../00-project-overview.md) — module map, points/INR constant, spin range decision (§7.5).
- [Influencer_Platform_Full_Breakdown §7](../Influencer_Platform_Full_Breakdown.md) — source spec (Redis, server-side outcome, flow).
- [03-backend-architecture](../architecture/03-backend-architecture.md) — modules, `PointsService`, jobs, spin-reset via TTL.
- [04-database-architecture](../architecture/04-database-architecture.md) — `Game`/`GameSegment`/`GamePlay`, ledger rules, Redis keys.
- [05-api-conventions](../architecture/05-api-conventions.md) — envelope, error codes, auth, pagination.
- [06-frontend-architecture](../architecture/06-frontend-architecture.md) — RSC/island, TanStack Query, dynamic import.
- [10-design-principles](../design-system/10-design-principles.md) — motion, reduced-motion, scarce confetti.
- [13-components-library](../design-system/13-components-library.md) — `SpinWheel`, `ModuleTeaserCard`, `Modal`.
- [phases/00-roadmap](../phases/00-roadmap.md) — build order & definition of done.

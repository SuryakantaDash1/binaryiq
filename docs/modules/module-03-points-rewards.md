# Module 03 — Points & Rewards

**Phase 3** · Weeks 5 · Depends on: Phase 1 (auth), Phase 0 (points ledger + UI kit) ·
Milestone **M2** — full earn-and-redeem loop works.

This is the member-facing surface over the **points ledger** and the **rewards economy**: the points
dashboard, the transaction/redemption history, the rewards catalogue, the redemption flow (charity +
PayPal), and the admin rewards CRUD + redemption status management.

This doc is the **module spec** — it does **not** redefine the shared spine. The ledger data model,
its invariants, and the `PointsService` gateway are authoritative elsewhere and are only referenced
here:

- Product context & the `100 pts = ₹1` constant → [../00-project-overview.md](../00-project-overview.md)
  (§1, §6 glossary), source spec [../Influencer_Platform_Full_Breakdown.md](../Influencer_Platform_Full_Breakdown.md) §4.
- **`PointsService` (the ledger gateway)** → [../architecture/03-backend-architecture.md](../architecture/03-backend-architecture.md) §4.
- **Ledger data model + invariants** → [../architecture/04-database-architecture.md](../architecture/04-database-architecture.md)
  (`PointsTransaction`, `PointsBalance`, `Reward`, `RewardRedemption`) and its
  [§5 ledger rules](../architecture/04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6).
- HTTP envelope, error codes, cursor pagination → [../architecture/05-api-conventions.md](../architecture/05-api-conventions.md).
- Frontend structure, RSC vs client, TanStack Query → [../architecture/06-frontend-architecture.md](../architecture/06-frontend-architecture.md).
- Security (redemption authZ, ownership, audit, webhook signatures) → [../architecture/07-security-compliance.md](../architecture/07-security-compliance.md) (§5.2 row "Redeem", §11 Phase 3).
- UI kit (`StatCard`, `DataTable`, `RewardCard`, `ConfirmModal`, `RangeFilter`, `Tabs`) → [../design-system/13-components-library.md](../design-system/13-components-library.md).
- Canonical UI patterns (history table, RangeFilter, redeem ConfirmModal, points feedback) → [../design-system/14-patterns.md](../design-system/14-patterns.md).
- Build order & Definition of Done → [../phases/00-roadmap.md](../phases/00-roadmap.md).

---

## 1. Overview & goal

Points are the platform's reward currency. Every engagement action (register, profile survey, survey,
poll vote, spin) **credits** points; rewards let members **debit** them for real-world value. Module 3
closes that **earn ↔ redeem loop**:

```
        EARN (modules 1/2/4/5/6)                     REDEEM (module 3)
   ┌───────────────────────────────┐        ┌──────────────────────────────┐
   register +500 · profile +100/200 │        │ browse catalogue → redeem     │
   survey up to 3,400 · poll +15    │──CREDIT─▶  points_transactions  ─DEBIT─▶ RewardRedemption
   spin 0–1,000                     │  (award) │  (append-only ledger)  (spend)│ charity / PayPal payout
   └───────────────────────────────┘        └──────────────────────────────┘
                          ▲                              │
                          └──────────  PointsBalance (derived cache)  ◀──────────┘
```

**The ledger is the single source of truth.** `points_transactions` is append-only and immutable;
`points_balances` is a derived cache; INR is never stored (derived `points / 100` at display time).
The goal of this module is to make that ledger **legible** (dashboard + history), **spendable**
(catalogue + redemption), and **operable** (admin rewards CRUD + redemption fulfilment), while never
compromising ledger integrity — **every** point movement still flows through the one
[`PointsService`](../architecture/03-backend-architecture.md#4-pointsservice--the-shared-ledger).

**Conversion constant:** `100 points = ₹1.00` — lives in config (`POINTS_PER_INR`), never hard-coded
([00-overview §1](../00-project-overview.md), [03-backend §5](../architecture/03-backend-architecture.md#5-configuration)).

**Why this module is also the "points spine" doc:** modules 1/2/4/5/6 *produce* credits by calling
`PointsService.award(...)`; this module *reads* the resulting ledger (balance/history/dashboard) and
*consumes* it (redemption debits). The award call-sites live in their own modules; here we own the
**read/query/history/dashboard/redemption** APIs and the **rewards admin**.

---

## 2. Scope

### In scope

- **Points dashboard** — Current Balance, Earned Points (lifetime), Spent Points; date-range filter.
- **Points History** — Date / Description / Points, cursor-paginated, date-range filterable (a
  `Tabs` view alongside Rewards History).
- **Rewards History** — the member's redemptions with status (Pending / Completed / …).
- **Rewards catalogue** — data-driven list of active `rewards` (charity + PayPal + future
  voucher/merchandise), sorted, with points cost and derived INR value.
- **Redemption flow** — balance check (`>= pointsRequired`, else `422 UNPROCESSABLE`), transactional
  DEBIT via `PointsService.spend` + `RewardRedemption` creation (PENDING), then fulfilment
  (charity = immediate receipt; PayPal = async payout).
- **Redemption status management** — status lifecycle (PENDING → PROCESSING → COMPLETED / REJECTED /
  CANCELLED), member tracking + admin control.
- **PayPal payout integration** — `PaymentProvider` (PayPal) createPayout + status polling, and the
  **webhook** that flips redemption status; **refund via `ADJUSTMENT`** when a payout is rejected.
- **Admin rewards CRUD** — list/create/update/deactivate catalogue items; admin redemption status
  override.

### Out of scope (owned elsewhere)

- **The earning events themselves.** Registration bonus (module 1), profile-survey credits (module 2),
  survey/poll/game credits (modules 4/5/6) each own their `PointsService.award(...)` call. This module
  only reads what they wrote.
- **`PointsService` internals** (award/spend, `balanceAfter` computation, idempotency mechanism) —
  defined in [03-backend §4](../architecture/03-backend-architecture.md#4-pointsservice--the-shared-ledger).
- **Ledger schema & invariants** — [04-database §4/§5](../architecture/04-database-architecture.md).
- **HTTP envelope / error codes / pagination mechanics** — [05-api](../architecture/05-api-conventions.md).
- **PII encryption, JWT, CORS, headers** — [07-security](../architecture/07-security-compliance.md).
  (`paypal_accounts.paypal_email` handling is defined there; this module consumes it.)
- **Points expiry** — decision of record: **no expiry by default**, a config flag
  (`POINTS_EXPIRY_DAYS`) reserved for later ([00-overview §7.4](../00-project-overview.md)); not built
  here.

---

## 3. User flows

### 3.1 View the points dashboard

1. Member opens **Rewards → Points** (`/(app)/rewards` teaser + dedicated points view) or the
   dashboard points area.
2. RSC fetches `GET /points/balance` → three `StatCard`s: **Current Balance**, **Earned (lifetime)**,
   **Spent**. Each shows the derived INR (`points / 100`) as a sub-label.
3. A `Tabs` control shows **Points History** (default) and **Rewards History**.
4. A `RangeFilter` (date range) sits above the active history tab.

### 3.2 Filter history by date range

1. Member picks a range in `RangeFilter` (presets `7d / 30d / 90d / ytd`, or custom `from`/`to`).
2. The range becomes part of the TanStack query key → automatic refetch; params go to the API as
   explicit `?from=&to=` ([14-patterns §9](../design-system/14-patterns.md)).
3. `GET /points/transactions?from=&to=&cursor=&limit=` returns the page; `DataTable` renders
   Date / Description / Points; "Load more" pulls the next cursor.

### 3.3 Browse the rewards catalogue

1. Member opens **Rewards** (`/(app)/rewards`).
2. RSC fetches `GET /rewards` (active only) → `RewardCard` grid: name, description, image, points cost,
   derived INR, and a **Redeem** CTA.
3. Cards whose `pointsRequired > balance` show the CTA disabled with a "Need N more points" hint
   (balance comes from the `['points','balance']` query so it stays live).

### 3.4 Redeem → confirm modal → result

1. Member clicks **Redeem** on a `RewardCard` (or on the reward detail page `/rewards/[id]`).
2. A `ConfirmModal` opens: *"Redeem 4,500 points for 'Plant 1 tree in Madagascar'? This can't be
   undone."* with **Redeem now** / **Keep points** ([14-patterns §2a](../design-system/14-patterns.md)).
3. On confirm → `POST /redemptions { rewardId }` (with an `Idempotency-Key`).
4. **Success (201):** modal closes; the `['points','balance']` query is invalidated (PointsPill
   updates everywhere); a celebratory `+`/redeemed toast; redemption appears in **Rewards History** as
   **Pending**. Charity rewards typically settle to **Completed** immediately; PayPal stays **Pending
   → Processing** until the payout resolves.
5. **Insufficient balance (422 UNPROCESSABLE):** the modal surfaces a persistent inline `Alert`
   ("Not enough points — you need 4,500, you have 3,200"), **not** a transient toast
   ([14-patterns §4](../design-system/14-patterns.md)). No debit occurs.
6. **Inactive/unknown reward (404 / 422):** inline `Alert`; catalogue refetched.

### 3.5 Track redemption status

1. Member opens the **Rewards History** tab (or `/rewards/history`).
2. `GET /redemptions?cursor=&limit=` → `DataTable` of redemptions: reward name, points spent, derived
   INR, **status `Badge`**, date.
3. Status updates arrive out-of-band: charity receipt (immediate), PayPal payout webhook → status
   flips PENDING/PROCESSING → COMPLETED (or REJECTED, which triggers an automatic points refund — see
   §7.4). The list reflects the latest status on refetch; a rejected+refunded redemption shows
   **Rejected** with the paired `ADJUSTMENT` credit visible in Points History.

---

## 4. Data model

All models are **authoritative in** [04-database §4](../architecture/04-database-architecture.md); this
module adds no new tables. Summary of the four this module reads/writes:

| Model | Role in this module | Key fields |
|---|---|---|
| `PointsTransaction` | append-only ledger row per movement — the source of history | `direction` (CREDIT/DEBIT), `action` (…, `REDEMPTION`, `ADJUSTMENT`), `points` (positive), `balanceAfter` (snapshot), `description`, `refType`/`refId`, `idempotencyKey` (unique), `createdAt` |
| `PointsBalance` | derived cache for O(1) dashboard reads | `balance`, `lifetimeEarned`, `lifetimeSpent`, `updatedAt` |
| `Reward` | data-driven catalogue item | `name`, `description`, `rewardType` (`CHARITY`/`PAYPAL`/`VOUCHER`/`MERCHANDISE`), `pointsRequired`, `imageUrl`, `metadata` (charity id / payout config), `stock` (null = unlimited), `isActive`, `sortOrder` |
| `RewardRedemption` | a member's spend against a reward | `userId`, `rewardId`, `pointsSpent`, `status` (`PENDING`/`PROCESSING`/`COMPLETED`/`REJECTED`/`CANCELLED`), `fulfillmentRef` (PayPal payout id / charity receipt), `notes`, `createdAt`/`updatedAt` |

Relevant enums (from [04-database §4](../architecture/04-database-architecture.md)):

```prisma
enum PointsAction    { REGISTRATION_BONUS PROFILE_SURVEY SURVEY_COMPLETION POLL_VOTE
                       GAME_SPIN REDEMPTION ADJUSTMENT REFERRAL }
enum PointsDirection { CREDIT DEBIT }
enum RewardType      { CHARITY PAYPAL VOUCHER MERCHANDISE }
enum RedemptionStatus{ PENDING PROCESSING COMPLETED REJECTED CANCELLED }
```

**Notes that matter for this module:**

- **`balanceAfter` snapshots power history display.** Each ledger row carries the running balance *at
  that moment*, computed inside the transaction ([04-database §5 invariant 3](../architecture/04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6)).
  History therefore never re-sums on read — the row is self-describing (Date / Description / signed
  Points / running balance).
- **`points` is always positive; `direction` carries the sign.** The dashboard's Spent metric =
  `lifetimeSpent` (sum of DEBIT points); a redemption debit is `direction=DEBIT, action=REDEMPTION`.
- **INR is derived, never stored** — `points / 100`, computed in the app/UI layer
  ([04-database §1](../architecture/04-database-architecture.md), [05-api §1](../architecture/05-api-conventions.md#1-general-rules)).
- **A redemption is two coupled rows written in one transaction:** the `RewardRedemption` row **and**
  its `PointsTransaction` DEBIT. They commit or roll back together
  ([04-database §5 invariant 1](../architecture/04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6)).
- **Refunds are new `ADJUSTMENT` credits**, never edits/deletes of the original DEBIT
  ([§5 invariant 6](../architecture/04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6)).
- **Catalogue is fully data-driven** (`rewards` table) so product can add mid-tier voucher/merchandise
  rewards with **no code change** ([00-overview §7.2](../00-project-overview.md)).

**Seed catalogue** (from [04-database §7](../architecture/04-database-architecture.md#7-migrations--seeding) + spec §4.3):

| name | rewardType | pointsRequired | ≈ INR |
|---|---|---|---|
| Offer 4 meals to kids (Africa) | `CHARITY` | 4,500 | ₹45 |
| Plant 1 tree in Madagascar | `CHARITY` | 4,500 | ₹45 |
| Remove 100g plastic from ocean | `CHARITY` | 4,500 | ₹45 |
| PayPal Payout (USD) | `PAYPAL` | 90,000 | ₹900 |

---

## 5. API contracts

All endpoints follow [05-api-conventions](../architecture/05-api-conventions.md): the `{ data, error,
meta }` envelope (§2), canonical error codes (§4), `Bearer` auth (§7), cursor pagination (§6). Base:
`/v1`. Member endpoints require auth + **ownership** (a member only ever sees their own ledger/
redemptions — enforced in the service, [07-security §2.3](../architecture/07-security-compliance.md)).

### 5.1 Member — points

> **`GET /v1/points/balance`** — current balance + lifetime totals
> - **Auth:** member
> - **200:** `{ data: PointsBalanceView }` = `{ balance, lifetimeEarned, lifetimeSpent, updatedAt }`
>   (all integers; INR derived client-side). Powers the three `StatCard`s.
> - **Errors:** `401 UNAUTHENTICATED`.
> - **Notes:** O(1) read from `points_balances` (the derived cache), scoped to `currentUser.id`.

> **`GET /v1/points/transactions`** — points history (Date / Description / Points)
> - **Auth:** member
> - **Query:** `limit` (default 20, max 100), `cursor` (opaque), `from` / `to` (ISO date, optional
>   date-range filter), `direction` (optional `CREDIT`/`DEBIT`), `action` (optional filter).
> - **200:** `{ data: PointsTransactionView[], meta.pagination }` — each item
>   `{ id, direction, action, points, balanceAfter, description, refType, refId, createdAt }`.
>   `meta.pagination = { nextCursor, hasMore, limit }` ([05-api §6](../architecture/05-api-conventions.md#6-pagination-filtering-sorting)).
> - **Errors:** `400 VALIDATION_ERROR` (bad cursor/date), `401 UNAUTHENTICATED`.
> - **Notes:** **cursor pagination** over the append-only ledger, ordered `createdAt desc`, served by
>   the `points_transactions (user_id, created_at)` index ([04-database §8](../architecture/04-database-architecture.md#8-indexing--performance-notes)).
>   The `RangeFilter` maps to `from`/`to`.

### 5.2 Member — rewards & redemptions

> **`GET /v1/rewards`** — active catalogue
> - **Auth:** member
> - **Query:** `type` (optional `CHARITY`/`PAYPAL`/`VOUCHER`/`MERCHANDISE`).
> - **200:** `{ data: RewardView[] }` — `{ id, name, description, rewardType, pointsRequired,
>   imageUrl, stock }`, only `isActive=true`, ordered by `(isActive, sortOrder)`. INR derived
>   client-side.
> - **Errors:** `401 UNAUTHENTICATED`.

> **`GET /v1/rewards/:id`** — reward detail
> - **Auth:** member · **Path:** `id` (uuid)
> - **200:** `{ data: RewardView }` · **Errors:** `404 NOT_FOUND` (unknown/inactive).

> **`POST /v1/redemptions`** — redeem a reward (the debit)
> - **Auth:** member
> - **Headers:** `Idempotency-Key` (recommended; maps to the ledger `idempotencyKey`,
>   [05-api §1](../architecture/05-api-conventions.md#1-general-rules)).
> - **Body:** `{ rewardId: string }` (Zod: `RedeemInput`).
> - **201:** `{ data: RedemptionView }` = `{ id, rewardId, rewardName, pointsSpent, status,
>   fulfillmentRef, createdAt }` — status `PENDING` (charity may already be `COMPLETED`).
> - **Errors:**
>   - `422 UNPROCESSABLE` — **insufficient balance** (`balance < pointsRequired`) **or** reward
>     inactive / out of stock. No debit performed.
>   - `404 NOT_FOUND` — unknown reward.
>   - `400 VALIDATION_ERROR` — bad body.
>   - `409 CONFLICT` — replayed `Idempotency-Key` for a different payload (safety net).
> - **Side effects:** in **one transaction** — `PointsService.spend({ action: 'REDEMPTION',
>   points: reward.pointsRequired, refType: 'reward', refId: reward.id, idempotencyKey })` +
>   `reward_redemptions` row (PENDING); then enqueues fulfilment (charity receipt / `payouts` queue for
>   PayPal). Audit-logged ([07-security §6.1](../architecture/07-security-compliance.md#61-what-is-logged)).

> **`GET /v1/redemptions`** — the member's redemption history
> - **Auth:** member
> - **Query:** `limit`, `cursor`, `status` (optional), `from`/`to` (optional).
> - **200:** `{ data: RedemptionView[], meta.pagination }` — `{ id, rewardName, rewardType,
>   pointsSpent, status, fulfillmentRef, createdAt }`, ordered `createdAt desc`
>   (index `reward_redemptions (user_id, created_at)`). Cursor-paginated. Powers the **Rewards
>   History** tab.
> - **Errors:** `401 UNAUTHENTICATED`, `400 VALIDATION_ERROR`.

### 5.3 Admin — rewards CRUD & redemption status

Prefixed `/v1/admin/*`, protected by `AdminGuard` + `@Roles(SUPER_ADMIN, ADMIN)`
([05-api §7](../architecture/05-api-conventions.md#7-auth--authorization-patterns),
[07-security §2.2](../architecture/07-security-compliance.md#22-guard-strategy)). All admin writes are
audit-logged.

> **`GET /v1/admin/rewards`** — list all rewards (incl. inactive)
> - **Auth:** admin (`ADMIN`+) · **Query:** offset pagination `page`/`pageSize`, `isActive`, `type`.
> - **200:** `{ data: RewardAdminView[], meta.pagination }` (offset — small admin table,
>   [05-api §6](../architecture/05-api-conventions.md#6-pagination-filtering-sorting)).

> **`POST /v1/admin/rewards`** — create a reward
> - **Auth:** admin (`ADMIN`+)
> - **Body:** `{ name, description, rewardType, pointsRequired, imageUrl?, metadata?, stock?,
>   sortOrder?, isActive? }` (Zod: `CreateRewardInput`; `pointsRequired` > 0).
> - **201:** `{ data: RewardAdminView }` · **Errors:** `400 VALIDATION_ERROR`, `403 FORBIDDEN`.

> **`PUT /v1/admin/rewards/:id`** — update / deactivate a reward
> - **Auth:** admin (`ADMIN`+) · **Path:** `id` (uuid)
> - **Body:** partial `UpdateRewardInput` (incl. `isActive` to deactivate; never hard-delete —
>   deactivation preserves referential history from `reward_redemptions`).
> - **200:** `{ data: RewardAdminView }` · **Errors:** `404 NOT_FOUND`, `400 VALIDATION_ERROR`.

> **`PUT /v1/admin/redemptions/:id/status`** — set redemption status (manual fulfilment / correction)
> - **Auth:** admin (`ADMIN`+, or `SUPPORT` for read context) · **Path:** `id` (uuid)
> - **Body:** `{ status: RedemptionStatus, fulfillmentRef?, notes? }` (Zod: `UpdateRedemptionStatusInput`).
> - **200:** `{ data: RedemptionView }`.
> - **Side effects:** transitions status per the state machine (§6.2). **If moved to `REJECTED`/
>   `CANCELLED` and the points were already debited, an `ADJUSTMENT` credit refunds `pointsSpent` in the
>   same transaction** (§7.4). Audit-logged.
> - **Errors:** `404 NOT_FOUND`, `422 UNPROCESSABLE` (illegal transition), `403 FORBIDDEN`.

### 5.4 PayPal payout webhook

> **`POST /v1/webhooks/paypal`** — payout status callback
> - **Auth:** none (public) but **signature-verified** — reject unsigned/invalid
>   ([05-api §11](../architecture/05-api-conventions.md#11-webhooks--external-callbacks),
>   [07-security §5.1](../architecture/07-security-compliance.md#51-limits)).
> - **Body:** PayPal payout event (`PAYMENT.PAYOUTS-ITEM.SUCCEEDED` / `.FAILED` / `.DENIED` / …).
> - **200:** `{ data: { received: true } }` (always ack a verified event so PayPal stops retrying).
> - **Side effects (idempotent):** match event → `reward_redemptions` by `fulfillmentRef` (payout id);
>   on success → status `COMPLETED`; on failure/denied → status `REJECTED` **and refund via
>   `ADJUSTMENT`** (§7.4). Processed idempotently by payout id (duplicate deliveries are no-ops).
> - **Errors:** `401`/`403` on bad signature; unknown payout id → `200` ack + logged (no state change).

---

## 6. Frontend

Follows [06-frontend-architecture](../architecture/06-frontend-architecture.md): RSC-by-default with
client islands, TanStack Query for mutations/live data, the typed envelope-aware API client, shared
`@influencer/ui` components only.

### 6.1 Screens & files

```text
apps/web/app/(app)/rewards/
├─ page.tsx            # RSC: RewardCard grid (GET /rewards)  — §3.3
├─ [id]/page.tsx       # RSC: reward detail + <RedeemButton/> island — §3.4
└─ history/page.tsx    # RSC shell: Points dashboard + Tabs(history) — §3.1/3.5

apps/web/features/points/
├─ components/         # PointsDashboard, PointsHistoryTable, RewardsHistoryTable, StatCards
├─ hooks/              # usePointsBalance, usePointsHistory (useInfiniteQuery), useRedemptions
apps/web/features/rewards/
├─ components/         # RewardGrid, RedeemButton (ConfirmModal island), StatusBadge
├─ hooks/              # useRewards, useRedeem (mutation)
apps/web/hooks/usePoints.ts   # ['points','balance'] + INR helper (points/100)
```

### 6.2 Points dashboard

- **Three `StatCard`s** — Current Balance / Earned (lifetime) / Spent — from `usePointsBalance`
  (`GET /points/balance`). Each renders points **and** derived INR via
  `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` on `points / 100`
  ([06-frontend §10](../architecture/06-frontend-architecture.md#10-accessibility-responsive-i18n-readiness-page-states)).
- **`Tabs`** — **Points History** (default) / **Rewards History**
  ([13-components §5](../design-system/13-components-library.md)).
- **`RangeFilter`** above the active tab → `?from=&to=` in the query key
  ([14-patterns §9](../design-system/14-patterns.md)); on mobile it hosts in a `Drawer`.

### 6.3 History tables

- **Points History** — `DataTable` columns **Date / Description / Points** (signed, colored via
  semantic tokens + text sign, never color-only), fed by `usePointsHistory` (`useInfiniteQuery` bound
  to `meta.pagination.nextCursor`, [14-patterns §5](../design-system/14-patterns.md)). "Load more"
  pulls the next cursor.
- **Rewards History** — `DataTable` columns reward / points spent / **status `Badge`** / date, from
  `useRedemptions`. Status → `Badge` tone: `PENDING`/`PROCESSING` = warning/info, `COMPLETED` = success,
  `REJECTED`/`CANCELLED` = danger/neutral — always with a text label (a11y, not color-only).

### 6.4 Rewards catalogue & redemption

- **`RewardCard` grid** (`RewardGrid`) — one card per active reward: image (`next/image`), name,
  description, points cost, derived INR, **Redeem** CTA. Cards where `pointsRequired > balance` disable
  the CTA with a "Need N more points" hint (balance from `['points','balance']`, [14-patterns §6](../design-system/14-patterns.md)).
- **Redeem** — `RedeemButton` client island opens a **`ConfirmModal`** ("Redeem X points for '…'? This
  can't be undone.") → `useRedeem` mutation → `POST /redemptions`
  ([14-patterns §2a](../design-system/14-patterns.md)). On success: invalidate
  `['points','balance']` + `['redemptions']`, close modal, celebratory toast
  ([14-patterns §8](../design-system/14-patterns.md)). On `422`: persistent inline `Alert` inside the
  modal ("Not enough points…", [14-patterns §4](../design-system/14-patterns.md)) — never a
  vanishing toast for a blocking rule.

### 6.5 States (mandatory, shared components)

- **Loading** — `loading.tsx` with `StatCard`/table `Skeleton` shapes mirroring the layout (no bare
  spinner) ([06-frontend §1](../architecture/06-frontend-architecture.md), [14-patterns §3](../design-system/14-patterns.md)).
- **Empty** — `EmptyState`: "No points activity yet — vote in a poll or take a survey" (CTA to
  `/polls`/`/surveys`); "No redemptions yet" (CTA to catalogue); "No rewards right now".
- **Error** — `error.tsx` boundary + inline `Alert` with **Retry** wired to `refetch()`/`reset()`.

### 6.6 Admin (rewards CRUD)

Under `apps/web/app/admin/rewards/` — `DataTable` list + `Modal`-hosted RHF forms
(`CreateRewardInput`/`UpdateRewardInput`) following the [form pattern](../design-system/14-patterns.md#1-form-pattern-the-canonical-form).
A redemptions admin view (`DataTable` + status-change `Modal`) drives
`PUT /admin/redemptions/:id/status`. Same shared components — no bespoke admin UI.

---

## 7. Backend

Follows [03-backend-architecture](../architecture/03-backend-architecture.md): thin controllers →
services own transactions → Prisma/providers/queues. Point movement **only** via `PointsService`.

### 7.1 Modules & services

Physically these live in the shared **`points`** feature module (which already exports `PointsService`,
[03-backend §1.2](../architecture/03-backend-architecture.md#12-appsapisrc-folder-tree)); logically this
phase adds three concerns:

| Concern | Controller | Service | Responsibility |
|---|---|---|---|
| **Points read** (dashboard/history) | `points.controller.ts` (`/points/*`) | `points.service.ts` (already exists) | balance read, transaction history query (cursor + date filter). No new writes. |
| **Rewards** (catalogue/admin) | `rewards.controller.ts` (`/rewards/*`) + admin routes | `rewards.service.ts` | list active catalogue; admin CRUD/deactivate. |
| **Redemptions** | `rewards.controller.ts` (`/redemptions/*`) + admin | `redemption.service.ts` | the transactional debit, fulfilment orchestration, status management, PayPal + webhook. |

The **admin surface** is composed by `AdminModule` over the same services (no forked logic,
[03-backend §1.1](../architecture/03-backend-architecture.md#11-design-rules)); admin routes carry
`AdminGuard` + `@Roles(...)`.

### 7.2 Redemption service — transactional debit + idempotency

The core money-path. One `prisma.$transaction` couples the DEBIT and the `RewardRedemption`, so a
failure in either rolls back both (ledger invariant 1):

```ts
// redemption.service.ts (shape — see 03-backend §4 for PointsService)
async redeem(userId: string, rewardId: string, idempotencyKey?: string): Promise<RedemptionView> {
  const reward = await this.prisma.reward.findUnique({ where: { id: rewardId } });
  if (!reward || !reward.isActive) throw new NotFoundException('reward');          // 404
  if (reward.stock !== null && reward.stock <= 0)
    throw new UnprocessableException('out_of_stock');                              // 422

  const redemption = await this.prisma.$transaction(async (tx) => {
    // spend() enforces balance >= pointsRequired → 422 UNPROCESSABLE ('insufficient_points')
    await this.points.spend(tx, {
      userId, action: 'REDEMPTION', points: reward.pointsRequired,
      description: `Redemption: ${reward.name}`,
      refType: 'reward', refId: reward.id,
      idempotencyKey: idempotencyKey ?? `redeem:${userId}:${rewardId}:${crypto.randomUUID()}`,
    });
    if (reward.stock !== null)
      await tx.reward.update({ where: { id: reward.id }, data: { stock: { decrement: 1 } } });
    return tx.rewardRedemption.create({
      data: { userId, rewardId: reward.id, pointsSpent: reward.pointsRequired, status: 'PENDING' },
    });
  });

  await this.fulfil(reward, redemption); // charity=immediate receipt; PayPal=enqueue payouts queue
  return this.toView(redemption);
}
```

- **Balance check** is delegated to `PointsService.spend()`, which computes `balanceAfter` under a
  locked read and throws `422 UNPROCESSABLE` if it would go negative — so the rule can't be bypassed
  and can't overspend under concurrency ([03-backend §4](../architecture/03-backend-architecture.md#4-pointsservice--the-shared-ledger),
  [04-database §5](../architecture/04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6)).
- **Idempotency:** the ledger `idempotencyKey` unique constraint means a retried `POST /redemptions`
  with the same `Idempotency-Key` returns the existing DEBIT instead of double-spending
  ([05-api §1](../architecture/05-api-conventions.md#1-general-rules)).
- **No external I/O inside the transaction** — the PayPal call is **enqueued** to the `payouts` queue
  after commit ([03-backend §9.3](../architecture/03-backend-architecture.md#93-db-connection-pooling)).

### 7.3 Fulfilment & PayPal provider

- **Charity (`CHARITY`)** — immediate: record a receipt (`fulfillmentRef` = receipt id, via the
  charity partner integration in `metadata`), set status `COMPLETED`. No async wait.
- **PayPal (`PAYPAL`)** — enqueue the `payouts` BullMQ job
  ([03-backend §6.1](../architecture/03-backend-architecture.md#61-queues--processors)); the processor
  calls `PaymentProvider.createPayout({ email: paypalEmail, amountInr: pointsSpent / 100,
  idempotencyKey: redemption.id })`, stores the returned `payoutId` in `fulfillmentRef`, sets status
  `PROCESSING`, and relies on the **webhook** (or `getPayout` polling as backstop) to reach a terminal
  state. `PaymentProvider` is the injected `PAYPAL`/`PAYMENT_PROVIDER` abstraction
  ([03-backend §7](../architecture/03-backend-architecture.md#7-external-provider-abstraction)); the
  member's payout email comes from `paypal_accounts` ([04-database §4](../architecture/04-database-architecture.md),
  [07-security §3.1](../architecture/07-security-compliance.md#31-at-rest--application-layer-column-encryption)).

### 7.4 Webhook handler + refund via ADJUSTMENT

`WebhooksController` (`/webhooks/paypal`, [03-backend §1.2](../architecture/03-backend-architecture.md#12-appsapisrc-folder-tree))
verifies the signature, then delegates to `redemption.service`:

- **Succeeded** → `status = COMPLETED` (idempotent by payout id).
- **Failed / Denied** → `status = REJECTED` **and refund**: in one transaction, credit an
  `ADJUSTMENT` for `pointsSpent` so the member's balance is made whole, and set the redemption
  `REJECTED` with a note. This is a **new ledger row**, never an edit of the original DEBIT
  ([04-database §5 invariant 6](../architecture/04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6)):

```ts
await this.prisma.$transaction(async (tx) => {
  await this.points.award(tx, {
    userId: r.userId, action: 'ADJUSTMENT', points: r.pointsSpent,
    description: `Refund — PayPal payout failed (${r.id})`,
    refType: 'reward_redemption', refId: r.id,
    idempotencyKey: `refund:${r.id}`,        // idempotent: one refund per redemption
  });
  await tx.rewardRedemption.update({ where: { id: r.id }, data: { status: 'REJECTED', notes: reason } });
});
```

The `refund:{redemptionId}` idempotency key guarantees a duplicate webhook can't double-refund.

### 7.5 Admin guards & auditing

- Admin routes: `AdminGuard` + `@Roles(SUPER_ADMIN, ADMIN)`; `SUPPORT` gets read context only
  ([07-security §2.1/2.2](../architecture/07-security-compliance.md#21-roles)).
- **Ownership** on member routes: every `points`/`redemptions` query scoped by `userId =
  currentUser.id` in the service (IDOR defense, [07-security §2.3](../architecture/07-security-compliance.md#23-ownership-enforcement)).
- Redemption requests and every status change are **audit-logged** (`actorType`, `action`,
  `targetId`); the ledger itself is the immutable financial record
  ([07-security §6.1](../architecture/07-security-compliance.md#61-what-is-logged)).

### 7.6 Reconciliation reference

A **nightly reconciliation job** (`reconciliation` queue, `@Cron 0 2 * * *`) recomputes each user's
balance from the ledger and alerts on drift — the durable backstop that `points_balances` never
diverges from `SUM(credits) − SUM(debits)`
([03-backend §6.1/6.2](../architecture/03-backend-architecture.md#6-background-jobs--queues),
[04-database §5 invariant 7](../architecture/04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6)).
This module does **not** re-implement it; it relies on it.

---

## 8. Points / ledger rules (as they apply here)

The full invariants are [04-database §5](../architecture/04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6);
this module is the primary **debit** consumer, so the rules bind as follows:

1. **DEBIT = REDEMPTION.** A redemption writes exactly one `points_transactions` row
   `direction=DEBIT, action=REDEMPTION`, inside the same transaction as the `reward_redemptions` row.
2. **Balance check before debit.** `PointsService.spend()` reads the balance under lock; if
   `balance − pointsRequired < 0` it throws `422 UNPROCESSABLE` and nothing is written.
3. **No negative balance — ever.** The `balanceAfter < 0` guard is inside the transaction, so it holds
   even under concurrent redemptions (the second racer sees the first's committed balance and is
   rejected).
4. **Idempotency.** Redemption debits and refunds carry a stable `idempotencyKey`
   (`redeem:…` / `refund:{redemptionId}`); the unique constraint blocks double-spend / double-refund on
   retries and duplicate webhooks.
5. **Refunds are `ADJUSTMENT` credits.** A rejected/denied PayPal payout (or admin `REJECTED`/
   `CANCELLED`) refunds via a **new** `ADJUSTMENT` row — the original DEBIT is never mutated or deleted.
6. **Immutable ledger.** No update/delete of any `points_transactions` row; corrections are always new
   rows. History display trusts the row's `balanceAfter` snapshot rather than re-summing.
7. **Nightly reconciliation** re-derives balances from the ledger and alerts on drift (§7.6).

---

## 9. Reuse notes

- **Zero new ledger code.** All point movement reuses the shared
  [`PointsService.award/spend`](../architecture/03-backend-architecture.md#4-pointsservice--the-shared-ledger);
  this module never touches `points_transactions`/`points_balances` directly.
- **No new tables/enums** — reuses `PointsTransaction`, `PointsBalance`, `Reward`, `RewardRedemption`,
  `RewardType`, `RedemptionStatus` from [04-database §4](../architecture/04-database-architecture.md).
- **UI kit only** — `StatCard`, `Tabs`, `DataTable`, `RangeFilter`, `RewardCard`, `ConfirmModal`,
  `Badge`, `EmptyState`, `Skeleton`, `PointsPill`, `Alert` — all from
  [13-components](../design-system/13-components-library.md). No new component unless added there first.
- **Canonical patterns** — history uses the [DataTable/cursor pattern §5](../design-system/14-patterns.md#5-data-table-pattern-server-cursor-pagination),
  redeem uses the [ConfirmModal pattern §2a](../design-system/14-patterns.md#2a-confirm-an-action--confirmmodal),
  filtering uses the [RangeFilter pattern §9](../design-system/14-patterns.md#9-filter-pattern-rangefilter),
  points feedback uses [pattern §8](../design-system/14-patterns.md#8-points--reward-feedback-pattern).
- **Envelope/errors/pagination** reused verbatim from [05-api](../architecture/05-api-conventions.md) —
  no bespoke error codes; `422 UNPROCESSABLE` for insufficient balance, `404` unknown reward.
- **Provider + webhook + queue** infrastructure reused from
  [03-backend §6/§7](../architecture/03-backend-architecture.md#6-background-jobs--queues) (PayPal
  behind `PAYMENT_PROVIDER`, `payouts` queue, `/webhooks/*` idempotent handler).
- **Config constant** — INR conversion reads `POINTS_PER_INR` from config, never hard-coded.

---

## 10. Acceptance criteria

1. `GET /points/balance` returns the member's `balance`, `lifetimeEarned`, `lifetimeSpent`; the
   dashboard renders three `StatCard`s with points + derived INR.
2. `GET /points/transactions` is **cursor-paginated**, supports `from`/`to` date filtering, and each
   history row shows Date / Description / signed Points sourced from `balanceAfter`-bearing ledger rows.
3. Points History and Rewards History are the two `Tabs`; `RangeFilter` scopes the active tab.
4. `GET /rewards` returns only active catalogue items, sorted by `sortOrder`, each with points cost +
   derived INR; the seed catalogue (3× 4,500-pt charities + 90,000-pt PayPal) renders as `RewardCard`s.
5. `POST /redemptions` with sufficient balance debits **exactly once** via `PointsService.spend`,
   creates a `RewardRedemption` (PENDING) in the same transaction, and returns `201`.
6. `POST /redemptions` with `balance < pointsRequired` returns **`422 UNPROCESSABLE`** and performs
   **no** debit and **no** redemption row.
7. Concurrent redemptions cannot overspend (no negative balance); one succeeds, the other gets `422`.
8. Charity redemptions reach `COMPLETED` (immediate receipt); PayPal redemptions go `PENDING →
   PROCESSING`, and the **signature-verified webhook** flips to `COMPLETED` on success.
9. A **failed/denied** PayPal payout sets the redemption `REJECTED` **and** refunds `pointsSpent` via a
   new `ADJUSTMENT` credit (idempotent); the member's balance is made whole and both rows appear in
   history.
10. Retried redemption (same `Idempotency-Key`) and duplicate webhook deliveries are **idempotent** —
    no double-spend, no double-refund.
11. Admin (`ADMIN`+) can create / update / **deactivate** rewards and override redemption status;
    non-admins get `403`; deactivation never hard-deletes.
12. Members only ever see their own transactions/redemptions (ownership); redemption + status changes
    are audit-logged.
13. `balance == SUM(CREDIT points) − SUM(DEBIT points)` for every user; nightly reconciliation reports
    zero drift.
14. All endpoints conform to the envelope/error/pagination contract; UI uses only shared
    components/tokens ([DoD](../phases/00-roadmap.md#definition-of-done-every-phase)).

---

## 11. Tasks (ordered)

1. **DTOs/schemas** in `packages/types`: `PointsBalanceView`, `PointsTransactionView`,
   `RewardView`/`RewardAdminView`, `RedemptionView`, `RedeemInput`, `CreateRewardInput`,
   `UpdateRewardInput`, `UpdateRedemptionStatusInput`, history query params (`from`/`to`/`cursor`).
2. **Migration/seed check** — models already exist ([04-database §4](../architecture/04-database-architecture.md));
   ensure seed loads the 4 catalogue rewards ([04-database §7](../architecture/04-database-architecture.md#7-migrations--seeding)).
3. **`points.controller` + read methods** — `GET /points/balance`, `GET /points/transactions`
   (cursor + date filter, ownership-scoped).
4. **`rewards.service` + `rewards.controller`** — `GET /rewards`, `GET /rewards/:id` (active only).
5. **`redemption.service.redeem()`** — transactional `spend()` + `RewardRedemption` create +
   idempotency; `POST /redemptions`; `GET /redemptions` (cursor).
6. **Fulfilment** — charity immediate receipt; PayPal enqueue on the `payouts` queue; wire
   `PaymentProvider` (PayPal) createPayout/getPayout.
7. **PayPal webhook** — `/webhooks/paypal` signature verify → `COMPLETED` / `REJECTED`+refund
   (`ADJUSTMENT`), idempotent by payout id.
8. **Admin** — `GET/POST/PUT /admin/rewards`, `PUT /admin/redemptions/:id/status` (with refund on
   reject); `AdminGuard` + `@Roles`; audit logging.
9. **Frontend points** — `usePointsBalance`/`usePointsHistory`; dashboard `StatCard`s + `Tabs` +
   `DataTable` + `RangeFilter`; loading/empty/error states.
10. **Frontend rewards** — `RewardGrid`/`RewardCard`, `RedeemButton` + `ConfirmModal`, `useRedeem`
    (invalidate balance + redemptions), status `Badge` in Rewards History.
11. **Frontend admin** — rewards `DataTable` + `Modal` CRUD forms; redemption status view.
12. **Tests** (§12) + wire the nightly reconciliation reference; verify Definition of Done.

---

## 12. Test cases

Testing seams per [03-backend §10](../architecture/03-backend-architecture.md#10-testing-seams) /
[08-testing-strategy](../architecture/08-testing-strategy.md). The money path is the highest-risk area
([roadmap risk notes](../phases/00-roadmap.md#risk-notes)) — cover it exhaustively.

| # | Test | Type | Expectation |
|---|---|---|---|
| 1 | **Redeem success debits exactly once** | integration | one `DEBIT`/`REDEMPTION` row + one `PENDING` redemption in one tx; `balance` drops by `pointsRequired`; `lifetimeSpent` += `pointsRequired`; `201`. |
| 2 | **Insufficient balance blocked** | unit + e2e | `balance < pointsRequired` → `422 UNPROCESSABLE`; **no** ledger row, **no** redemption row written. |
| 3 | **Concurrent redeem cannot overspend** | integration (concurrency) | two simultaneous redemptions that together exceed balance → exactly one succeeds, the other `422`; final `balance ≥ 0`; only one `DEBIT`. |
| 4 | **Idempotent redeem** | integration | same `Idempotency-Key` replayed → returns the original redemption; single `DEBIT` (no double-spend). |
| 5 | **Charity fulfilment** | integration | `CHARITY` redemption reaches `COMPLETED` with a `fulfillmentRef` (receipt); no payout enqueued. |
| 6 | **PayPal payout enqueued + webhook completes** | integration | `PAYPAL` redemption → `PROCESSING` + `fulfillmentRef` (payout id); signature-verified `SUCCEEDED` webhook → `COMPLETED`. |
| 7 | **Rejected PayPal refunds via ADJUSTMENT** | integration | `FAILED`/`DENIED` webhook → status `REJECTED` + new `ADJUSTMENT` credit = `pointsSpent`; balance restored; original `DEBIT` untouched. |
| 8 | **Refund/webhook idempotency** | integration | duplicate `FAILED` webhook → single `ADJUSTMENT` (`refund:{id}` key); duplicate `SUCCEEDED` → single `COMPLETED`. |
| 9 | **Webhook signature required** | e2e | unsigned/invalid-signature webhook → rejected (no state change); valid → `200` ack. |
| 10 | **History pagination + `balanceAfter` correctness** | integration | cursor pages are stable, ordered `createdAt desc`, non-overlapping; each row's `balanceAfter` equals the running balance at that row. |
| 11 | **Date-range filter** | e2e | `?from=&to=` returns only in-range transactions; empty range → `EmptyState`. |
| 12 | **Balance == sum of ledger** | integration | after a mix of credits/debits/refunds, `points_balances.balance == SUM(CREDIT) − SUM(DEBIT)`; reconciliation reports zero drift. |
| 13 | **Ownership / IDOR** | e2e | member A cannot read member B's transactions/redemptions (scoped `404`/`403`). |
| 14 | **Admin authZ + reward lifecycle** | e2e | non-admin → `403` on `/admin/*`; admin create/update/deactivate works; deactivated reward hidden from `GET /rewards` but its past redemptions still resolve. |
| 15 | **Admin reject refunds** | integration | `PUT /admin/redemptions/:id/status {REJECTED}` on an already-debited redemption issues the `ADJUSTMENT` refund in one tx; illegal transition → `422`. |

---

### See also
- [00-project-overview](../00-project-overview.md) · [Full breakdown §4](../Influencer_Platform_Full_Breakdown.md)
- [03-backend-architecture §4/§6/§7](../architecture/03-backend-architecture.md) — `PointsService`, queues, providers
- [04-database-architecture §4/§5](../architecture/04-database-architecture.md) — models + ledger invariants
- [05-api-conventions](../architecture/05-api-conventions.md) · [06-frontend-architecture](../architecture/06-frontend-architecture.md) · [07-security-compliance](../architecture/07-security-compliance.md)
- [13-components-library](../design-system/13-components-library.md) · [14-patterns](../design-system/14-patterns.md) · [phases/00-roadmap](../phases/00-roadmap.md)

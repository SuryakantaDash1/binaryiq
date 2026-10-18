# Module 04 — Surveys (Phase 4)

Priority / Quick / Premium brand surveys, matched to a member's profile, with points credited on
completion. This is the **monetizable survey** layer, distinct from the 14 *profile* survey categories
(Phase 2) that feed the matching engine here.

This doc owns the **surveys feature**: listing by type, the profile-based matching engine, the
start→complete flow, points crediting, quota/expiry handling, and admin survey CRUD. It **references**
the backbones rather than restating them:

- Data model (`Survey`, `SurveyResponse`, `UserProfile`/`UserDemographics`/`UserAddress`) is authoritative in
  [../architecture/04-database-architecture.md](../architecture/04-database-architecture.md).
- Ledger invariants (one row per action, idempotency, in-transaction) are in
  [../architecture/04-database-architecture.md §5](../architecture/04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6)
  and the shared `PointsService` in [../architecture/03-backend-architecture.md §4](../architecture/03-backend-architecture.md#4-pointsservice--the-shared-ledger).
- HTTP envelope, error codes, auth, pagination, webhooks →
  [../architecture/05-api-conventions.md](../architecture/05-api-conventions.md).
- Backend module/layering rules → [../architecture/03-backend-architecture.md](../architecture/03-backend-architecture.md).
- Frontend App Router / data-fetching / forms → [../architecture/06-frontend-architecture.md](../architecture/06-frontend-architecture.md).
- Shared UI kit (`SurveyCard`, `Badge`, `Tabs`) → [../design-system/13-components-library.md](../design-system/13-components-library.md);
  patterns (list+card, empty state, feedback) → [../design-system/14-patterns.md](../design-system/14-patterns.md).
- Product/module map & the "maximize matches" nudge → [../00-project-overview.md](../00-project-overview.md)
  and [../BinaryIQ_Full_Breakdown.md §5](../BinaryIQ_Full_Breakdown.md).

---

## 1. Overview & goal

Members see a curated list of brand surveys they are eligible for, grouped into three types, take one,
and earn points on completion. The **quality of the match** depends on how much profile data the member
has supplied: the more of the 14 profile survey categories they complete, the richer the targeting and
the more (and better-paid) surveys surface. A member with **no** profile surveys completed sees only
**generic** (untargeted) surveys.

The three survey types (from [../BinaryIQ_Full_Breakdown.md §5.2](../BinaryIQ_Full_Breakdown.md)):

| Type | `SurveyType` | Description | Points | Badge tone (see [../design-system/11-color-system.md](../design-system/11-color-system.md)) |
|---|---|---|---|---|
| **Priority** | `PRIORITY` | Recommended, matched to the member's profile | Variable | **Magenta / pink** (`tone="PRIORITY"`) |
| **Quick** | `QUICK` | Short surveys for fast completion | Up to moderate | **Info blue** (`tone="QUICK"`) |
| **Premium** | `PREMIUM` | Longer, higher-value surveys | Up to **3,400 pts** | **Violet / purple** (`tone="PREMIUM"`) |

**Goal for the phase:** surveys live, matched, and crediting points reliably and idempotently — one
`SurveyResponse` per `(user, survey)`, one `SURVEY_COMPLETION` ledger row per completion, quota and
expiry respected, provider-completion callbacks verified.

### Delivery model (important nuance)

Actual survey *questions* are generally delivered by an **external provider** via `Survey.externalUrl`.
This module owns the **internal metadata** (title, type, points, quota, expiry, targeting) and the
**lifecycle** (matching → start → complete → credit); it does **not** build a survey-authoring/rendering
engine. Two completion paths are documented and both must be supported:

1. **Provider link + callback/redirect** — member is sent to the provider; on finish the provider
   redirects back (and/or posts a signed server-to-server callback) that drives completion + crediting.
2. **Simple internal renderer** (fallback / self-hosted short surveys) — the member clicks *Complete* in
   our UI and the completion endpoint credits directly. Used when a survey has no `externalUrl`.

---

## 2. Scope

### In scope

- **Survey listing by type** — matched surveys grouped Priority / Quick / Premium; excludes surveys the
  member has already completed, that are quota-full, expired, or inactive.
- **Profile-based matching engine** (`MatchingService`) — scores/filters `Survey.targeting` against the
  member's profile fields; falls back to generic surveys when no profile data exists.
- **Start flow** — records/uses a `SurveyResponse` in `status = started`, returns the provider URL (or
  the internal renderer payload).
- **Complete flow** — awards points via `PointsService`, sets `SurveyResponse.status = completed`,
  increments `Survey.completedCount`; supports both provider callback and internal completion.
- **Points crediting** — `SURVEY_COMPLETION`, idempotent per `(user, survey)`.
- **Quota & expiry handling** — hide/deny surveys at/over quota or past `expiresAt`.
- **Admin survey CRUD** — create/read/update/deactivate surveys and their targeting.

### Out of scope

- **A full survey-authoring engine** (question builder, branching logic, quotas per question). Surveys
  are delivered via the provider link or a *simple* internal renderer only.
- Provider-side quotas, screener logic, and reward reconciliation beyond our completion callback (the
  provider owns qualification/disqualification; we record the outcome it reports).
- Profile survey categories themselves (Phase 2 — [module-02](module-02-profile-account.md)); this module
  only *reads* the resulting profile/demographic/address data for matching.
- Notifications ("survey invite" emails/SMS) — owned by [module-07](module-07-notifications.md); this
  module emits the domain event, notifications module dispatches.

---

## 3. User flows

### 3.1 Happy path — matched → start → complete → earn

1. Member opens **Surveys** from the dashboard teaser or nav (`/surveys`).
2. Page shows three **Tabs** (Priority / Quick / Premium). Each tab renders a **`SurveyCard`** grid of
   eligible surveys, each card carrying its type **`Badge`** and points (`PointsPill`).
3. Member clicks a card → survey detail (`/surveys/[id]`), which shows title, type, points, estimated
   length, and a **Start** CTA.
4. **Start** → `POST /surveys/:id/start`. Server re-checks eligibility (active, not expired, quota not
   full, not already completed), creates/loads a `SurveyResponse` in `status = started`, and returns
   either the provider `externalUrl` (with a signed return token) or the internal renderer payload.
5. Member completes the questions (on the provider, or inline).
6. **Complete**:
   - *Provider path:* provider redirects back to `/surveys/:id/complete?...` and/or posts a signed
     server-to-server callback → `POST /surveys/:id/complete`. Server verifies signature, credits points,
     marks `completed`, increments `completedCount`.
   - *Internal path:* member submits → `POST /surveys/:id/complete` directly.
7. Member sees a celebratory **`+N pts` toast** ([../design-system/14-patterns.md §8](../design-system/14-patterns.md#8--points--reward-feedback-pattern));
   `PointsPill` balance updates; the completed survey disappears from the list.

### 3.2 Disqualified

The provider screens the member out mid-survey. The callback reports `status = disqualified`. We record
`SurveyResponse.status = disqualified`, **award 0 points**, do **not** increment `completedCount`, and
show an informational `Modal`/`Alert` ("You didn't qualify for this one — try another"). The survey is
then hidden for that member (a response row now exists for the pair).

### 3.3 Quota-full

Between listing and start, the survey hits `completedCount >= quota`. `POST /surveys/:id/start` (or
`/complete`) returns `422 UNPROCESSABLE` (`survey_full`); the UI shows an inline `Alert` and refreshes the
list (the survey drops off).

### 3.4 Expired / inactive

`expiresAt < now` or `isActive = false` → the survey is excluded from listings and any start/complete
attempt returns `422 UNPROCESSABLE` (`survey_expired`).

### 3.5 Empty state — profile-completion nudge

If matching returns **no** eligible surveys (common for members with little/no profile data), the page
renders a shared **`EmptyState`** that nudges profile completion, e.g. *"Complete your profile to unlock
more surveys"* with a CTA to `/account/about-you`. This is where we surface the "complete all 14
categories to maximize matches" guidance from [../BinaryIQ_Full_Breakdown.md §5.3](../BinaryIQ_Full_Breakdown.md).

---

## 4. Data model

Authoritative in [../architecture/04-database-architecture.md §4](../architecture/04-database-architecture.md#4-prisma-schema-authoritative)
— summarized here for this module. No new tables are introduced.

### `Survey` (metadata + targeting + lifecycle counters)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `title` | string | display title |
| `type` | `SurveyType` | `PRIORITY` \| `QUICK` \| `PREMIUM` |
| `pointsValue` | int | whole points awarded on completion |
| `quota` | int? | max completions; `null` = unlimited |
| `completedCount` | int | denormalized counter, incremented in-transaction on completion |
| `targeting` | JsonB? | matching criteria (see §6.2); `null`/empty = generic (matches everyone) |
| `externalUrl` | string? | provider survey link; `null` ⇒ use internal renderer |
| `isActive` | bool | admin on/off |
| `expiresAt` | timestamptz? | `null` = no expiry |
| `createdAt` / `updatedAt` | timestamptz | |

Indexed on `(isActive, type)` for the hot listing path.

### `SurveyResponse` (per-member lifecycle + credit record)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `userId` | uuid | member |
| `surveyId` | uuid | survey |
| `status` | string | **`started` \| `completed` \| `disqualified`** |
| `pointsAwarded` | int | points credited (0 for started/disqualified) |
| `completedAt` | timestamptz? | set on completion |
| `createdAt` | timestamptz | |

**`@@unique([userId, surveyId])`** — one response row per member per survey. This is the durable guard
that a member cannot complete (or be credited for) the same survey twice, and the reason a
disqualified/completed survey never re-appears in listings.

### Profile inputs consumed by matching (read-only here)

Owned by [module-02](module-02-profile-account.md); the matching engine reads:

- **`UserProfile`** — `gender`, `dobEnc` (→ derived age), `country`.
- **`UserDemographics`** — `educationLevel`, `employmentType`, `incomeBracket`, `householdSize`,
  `childrenCount`, `assets`.
- **`UserAddress`** — `city`, `pinCode`, `areaType` (regional targeting).
- **`ProfileSurveyResponse`** — presence/absence gates generic-only fallback; lifestyle/interest answers
  (JsonB) feed interest targeting. `dobEnc` is AES-encrypted; age is derived after decrypt in the service
  layer (never matched on ciphertext).

> **Presence rule:** if the member has **zero** `ProfileSurveyResponse` rows, matching returns only
> generic surveys (targeting empty/absent). See §6.3.

---

## 5. API contracts

All endpoints follow [../architecture/05-api-conventions.md](../architecture/05-api-conventions.md):
`/v1` prefix, `Bearer` JWT, the `{ data, error, meta }` envelope, canonical error codes. Member endpoints
enforce ownership in the service; admin endpoints sit under `/admin/*` behind `AdminGuard`.

### 5.1 Member endpoints

> **`GET /v1/surveys`** — list matched surveys, grouped by type
> - **Auth:** member
> - **Query:** none required (optionally `?type=PRIORITY|QUICK|PREMIUM` to fetch one group)
> - **200:** `{ data: { priority: SurveyCardDto[], quick: SurveyCardDto[], premium: SurveyCardDto[] } }`
> - **Behaviour:** returns only surveys that are **eligible** for the caller — matched by
>   `MatchingService`, **excludes** already-completed/disqualified (`SurveyResponse` exists),
>   quota-full (`completedCount >= quota`), expired (`expiresAt < now`), and inactive (`isActive = false`).
> - **Side effects:** none (read).

> **`GET /v1/surveys/:id`** — survey detail
> - **Auth:** member · **Path:** `id` (uuid)
> - **200:** `{ data: SurveyDetailDto }` (title, type, points, est. length, whether external)
> - **Errors:** `404 NOT_FOUND` unknown/ineligible survey.

> **`POST /v1/surveys/:id/start`** — begin a survey
> - **Auth:** member · **Path:** `id` (uuid) · **Body:** none
> - **200:** `{ data: { responseId, mode: 'external'|'internal', externalUrl?, returnToken?, renderer? } }`
>   — for `external`, `externalUrl` includes a signed `returnToken`; for `internal`, `renderer` carries the
>   simple question payload.
> - **Behaviour:** re-validates eligibility server-side; **upserts** a `SurveyResponse` in
>   `status = started` (idempotent — re-starting returns the existing started row).
> - **Errors:** `404 NOT_FOUND` · `409 CONFLICT` already completed (`already_completed`) ·
>   `422 UNPROCESSABLE` `survey_full` / `survey_expired` / `survey_inactive` · `400 VALIDATION_ERROR`.

> **`POST /v1/surveys/:id/complete`** — complete & credit
> - **Auth:** member **or** provider callback (see below) · **Path:** `id` (uuid)
> - **Body (internal):** `{ responseId }` (Zod: `CompleteSurveyInput`)
> - **Body/headers (provider callback):** provider payload + signature — `{ status, providerRef,
>   signature, timestamp }` (or HMAC in `X-Provider-Signature`), where `status ∈ started|completed|disqualified`.
> - **200:** `{ data: { status, pointsAwarded, balanceAfter } }`
> - **Behaviour (one transaction):** verify eligibility + (for callbacks) **verify signature**; on
>   `completed` → award `pointsValue` via `PointsService.award(tx, …)` with
>   `idempotencyKey = survey:{surveyId}:{userId}`, set `status = completed` + `completedAt`, increment
>   `Survey.completedCount` (guarded so it can't exceed `quota`). On `disqualified` → set status, award 0,
>   no counter change.
> - **Errors:** `401 UNAUTHENTICATED` bad/missing signature · `409 CONFLICT` `already_completed` ·
>   `422 UNPROCESSABLE` `survey_full` / `survey_expired` · `404 NOT_FOUND` · `400 VALIDATION_ERROR`.
> - **Side effects:** inserts/updates `survey_responses`, one `points_transactions` row
>   (`SURVEY_COMPLETION`), increments `completed_count`, refreshes the member's cached balance — all in a
>   single `prisma.$transaction`. Emits a `survey.completed` event (notifications/analytics).

> **Provider callback note.** The server-to-server callback path (provider → us) is documented in
> [../architecture/05-api-conventions.md §11](../architecture/05-api-conventions.md#11-webhooks--external-callbacks):
> it may arrive at `POST /v1/surveys/:id/complete` (member-scoped, signed) or, for pure webhooks, at
> `/v1/webhooks/{provider}` which resolves `(user, survey)` from the signed `returnToken`/`providerRef`
> and calls the same `SurveyCompletionService`. **Never trust the callback body without signature
> verification.** The redirect-only path (browser returns with a signed token) triggers the same
> completion service.

### 5.2 Admin endpoints (`/admin/*`, `AdminGuard`)

> **`GET /v1/admin/surveys`** — list all surveys (offset pagination, all statuses/types)
> - **Auth:** admin (`SUPER_ADMIN`/`ADMIN`) · **Query:** `?page=&pageSize=&type=&isActive=`
> - **200:** `{ data: AdminSurveyDto[], meta: { pagination } }`

> **`POST /v1/admin/surveys`** — create a survey
> - **Auth:** admin · **Body:** `{ title, type, pointsValue, quota?, targeting?, externalUrl?, expiresAt? }`
>   (Zod: `CreateSurveyInput`)
> - **201:** `{ data: AdminSurveyDto }`
> - **Validation:** `type ∈ SurveyType`; `pointsValue > 0`; `quota ≥ 1` when present; `targeting` matches
>   the targeting schema (§6.2); `expiresAt` in the future.

> **`PUT /v1/admin/surveys/:id`** — update / deactivate
> - **Auth:** admin · **Path:** `id` (uuid) · **Body:** partial `CreateSurveyInput` incl. `isActive`
> - **200:** `{ data: AdminSurveyDto }`
> - **Note:** `completedCount` is **not** admin-editable (integrity of the counter); deactivation is
>   `isActive = false` (soft), not delete, so `survey_responses` FKs remain valid.

DTOs live in `packages/types` and are shared by the API (`ZodValidationPipe`) and the frontend
(`zodResolver`) — no drift ([../architecture/05-api-conventions.md §5](../architecture/05-api-conventions.md#5-validation)).

---

## 6. Matching algorithm

The heart of Phase 4. It runs in **`MatchingService`** (backend), invoked by `SurveysService.listForUser`
on `GET /surveys` and re-checked in `start`/`complete`. It is a **filter + score** over candidate surveys
against the member's profile snapshot.

### 6.1 Where it runs

- **Listing:** `MatchingService.match(userId)` loads the member's profile snapshot once
  (`UserProfile` + `UserDemographics` + `UserAddress` + a `count` of `ProfileSurveyResponse`), pulls active,
  non-expired, not-yet-completed candidate surveys (`surveys` indexed on `(isActive, type)`, left-anti-join
  on `survey_responses` for this user), then evaluates targeting per candidate. Grouping by `type` happens
  after scoring.
- **Start/Complete:** the same **eligibility predicate** (active, not expired, quota not full, not already
  responded, matches targeting) is re-evaluated server-side so a stale client list can't bypass rules.

### 6.2 Targeting shape (`Survey.targeting`, JsonB)

Targeting is a set of **optional constraint groups**; a survey matches a member when **every present
group is satisfied** (AND across groups; OR within a group's allowed values). Absent/empty `targeting`
⇒ **generic** (matches everyone). Example:

```jsonc
{
  "age":        { "min": 18, "max": 34 },
  "gender":     ["FEMALE"],
  "education":  ["GRADUATE", "POST_GRADUATE"],
  "employment": ["SALARIED"],
  "income":     ["5L_10L", "10L_PLUS"],
  "region":     { "pinCodes": ["560001"], "cities": ["Bengaluru"], "areaType": ["URBAN"] },
  "interests":  ["TRAVEL", "TECHNOLOGY"]   // from lifestyle/profile-survey answers
}
```

### 6.3 Eligibility & scoring

For each candidate survey and the member's profile snapshot:

1. **Hard eligibility (boolean gate)** — must all pass or the survey is dropped:
   - `isActive = true`; `expiresAt` is null or in the future.
   - `quota` is null **or** `completedCount < quota`.
   - no existing `SurveyResponse` for `(userId, surveyId)` (completed/disqualified/started all exclude it
     from *new* matches; a `started` row is resumed via `start`, not re-matched as new).
   - **Targeting satisfied:** for each present group, the member's corresponding field is known **and**
     falls in the allowed set/range. A member missing a field required by a targeting group **fails** that
     group (can't confirm the match) — this is why more profile data unlocks more surveys.
2. **Generic fallback:** surveys with empty/absent `targeting` always pass the targeting check → they are
   the baseline set everyone sees. If the member has **zero** `ProfileSurveyResponse` rows, **only** these
   generic surveys survive (their demographic fields may be unknown, so targeted surveys can't confirm).
3. **Score (ordering, not gating):** eligible surveys are ranked so the best matches surface first within
   each type tab. A simple additive score: `+points weighting` (higher `pointsValue` ranks up),
   `+specificity` (more matched targeting groups = a stronger, more relevant match), and type priority
   (`PRIORITY` surfaced first on the dashboard teaser). Score affects **order only**; eligibility already
   decided inclusion.

### 6.4 Fallback summary

| Member state | Result |
|---|---|
| No profile surveys completed | **Generic surveys only** (targeted surveys can't confirm demographics) |
| Some categories completed | Generic **+** targeted surveys whose groups the known fields satisfy |
| All 14 categories completed | Widest match set (registration age/gender + About You education/employment/income + region + interests all available) — maximizes matches & earnings |

This directly implements [../BinaryIQ_Full_Breakdown.md §5.3](../BinaryIQ_Full_Breakdown.md):
age/gender from registration, education/employment/income from About You, location (PIN/city/area) for
regional, lifestyle/interests from profile surveys; generic-only when no profile surveys exist.

---

## 7. Frontend

Structure and rules per [../architecture/06-frontend-architecture.md](../architecture/06-frontend-architecture.md);
components per [../design-system/13-components-library.md](../design-system/13-components-library.md);
patterns per [../design-system/14-patterns.md](../design-system/14-patterns.md).

### 7.1 Routes

- `app/(app)/surveys/page.tsx` — **RSC** fetches the grouped, matched list on the server (server API
  client, session token) and renders the type tabs + grids.
- `app/(app)/surveys/[id]/page.tsx` — survey detail with the **Start** action (client island for the
  mutation + redirect).
- `app/admin/surveys/…` — admin CRUD (DataTable list + Modal forms), following the §1 form pattern.

### 7.2 Surveys page composition

- **`Tabs`** (from the kit) — one tab per type: **Priority**, **Quick**, **Premium**. Each tab renders a
  **`SurveyCard`** grid using the list+card pattern ([../design-system/14-patterns.md §6](../design-system/14-patterns.md#6--list--card-pattern)).
- **`SurveyCard`** — composes `Card` (header: title + type `Badge`; body: est. length/meta; footer:
  `PointsPill` + **Start** CTA linking to `/surveys/[id]`).
- **Type `Badge` tones** map to the color system ([../design-system/11-color-system.md](../design-system/11-color-system.md) §2)
  — the only sanctioned accents:
  - **Priority → `Badge tone="PRIORITY"` = magenta/pink**
  - **Quick → `Badge tone="QUICK"` = info blue**
  - **Premium → `Badge tone="PREMIUM"` = violet/purple**
  Never introduce new hues; badges also carry a text label (never color-only) for a11y.
- **Empty state** — when a tab (or the whole page) has no eligible surveys, render **`EmptyState`** nudging
  profile completion with a CTA to `/account/about-you` ("Complete your profile to unlock more surveys").
- **Loading / error** — `loading.tsx` with card `Skeleton`s; `error.tsx` boundary → `Alert` with retry
  ([../design-system/14-patterns.md §3](../design-system/14-patterns.md#3--empty--loading--error-state-pattern)).

### 7.3 Start & completion-redirect handling

- **Start** is a TanStack Query mutation (`features/surveys/hooks/useStartSurvey`). On success:
  - `mode: 'external'` → `window.location.assign(externalUrl)` (provider hosts the questions); the
    `returnToken` in the URL lets the provider redirect back to `/surveys/:id/complete`.
  - `mode: 'internal'` → render the simple internal survey form (§1 form pattern) inline.
- **Completion redirect** — a return route (`/surveys/[id]/complete`, client) reads the signed token/query,
  calls `POST /surveys/:id/complete` (or the server has already processed the s2s callback), then:
  - on `completed` → invalidate `['surveys']` and `['account','balance']`, show `+N pts` **toast** +
    optional celebratory `Modal` ([../design-system/14-patterns.md §8](../design-system/14-patterns.md#8--points--reward-feedback-pattern));
  - on `disqualified` → informational `Modal`/`Alert`, no points;
  - on `survey_full`/`survey_expired` → inline `Alert`, refresh the list.
- After any awarding action, invalidate `['account','balance']` so the header `PointsPill` updates
  everywhere.

---

## 8. Backend

Module and layering per [../architecture/03-backend-architecture.md](../architecture/03-backend-architecture.md).
`SurveysModule` lives at `apps/api/src/modules/surveys/` and imports the shared **`PointsModule`**
(injects `PointsService`) and `PrismaModule`.

### 8.1 Providers

| Provider | Responsibility |
|---|---|
| `SurveysController` | thin: routes, auth/role decorators, DTO in/out. Delegates to services. |
| `SurveysService` | listing orchestration (calls `MatchingService`, groups by type), start (upsert `started` response with eligibility re-check), detail. |
| `MatchingService` | profile-based targeting/eligibility + scoring (§6); loads profile snapshot; generic fallback. |
| `SurveyCompletionService` | the completion transaction: eligibility guard → award points → mark completed → increment counter; provider-callback signature verification; idempotency. |
| (admin) `AdminController` composing `SurveysService` | admin CRUD ([../architecture/03 §1](../architecture/03-backend-architecture.md#1-module-structure)). |

### 8.2 Completion transaction (transactional points + quota + idempotency)

Mirrors the canonical `PollsService.vote` shape ([../architecture/03 §2.3](../architecture/03-backend-architecture.md#23-canonical-controller--service)).
All writes in **one** `prisma.$transaction`; points via `PointsService` inside the same `tx`:

```ts
// surveys/survey-completion.service.ts (sketch)
async complete(userId: string, surveyId: string, outcome: 'completed' | 'disqualified'): Promise<CompleteResult> {
  return this.prisma.$transaction(async (tx) => {
    const survey = await tx.survey.findUnique({ where: { id: surveyId } });
    if (!survey || !survey.isActive) throw new NotFoundException('survey');
    if (survey.expiresAt && survey.expiresAt < new Date())
      throw new UnprocessableException('survey_expired');            // 422

    // Idempotent per (user, survey): resolve/insert the response row first.
    const existing = await tx.surveyResponse.findUnique({
      where: { userId_surveyId: { userId, surveyId } },
    });
    if (existing?.status === 'completed') {
      throw new ConflictException('already_completed');               // 409 — no double credit
    }

    if (outcome === 'disqualified') {
      await tx.surveyResponse.upsert({
        where: { userId_surveyId: { userId, surveyId } },
        create: { userId, surveyId, status: 'disqualified', pointsAwarded: 0 },
        update: { status: 'disqualified', pointsAwarded: 0 },
      });
      return { status: 'disqualified', pointsAwarded: 0 };
    }

    // Quota guard — atomic conditional increment so completedCount can't exceed quota.
    if (survey.quota != null) {
      const bumped = await tx.survey.updateMany({
        where: { id: surveyId, completedCount: { lt: survey.quota } },
        data: { completedCount: { increment: 1 } },
      });
      if (bumped.count === 0) throw new UnprocessableException('survey_full'); // 422
    } else {
      await tx.survey.update({ where: { id: surveyId }, data: { completedCount: { increment: 1 } } });
    }

    await tx.surveyResponse.upsert({
      where: { userId_surveyId: { userId, surveyId } },
      create: { userId, surveyId, status: 'completed', pointsAwarded: survey.pointsValue, completedAt: new Date() },
      update: { status: 'completed', pointsAwarded: survey.pointsValue, completedAt: new Date() },
    });

    // EVERY point movement goes through PointsService, in the SAME tx, idempotent by key.
    const txn = await this.points.award(tx, {
      userId, action: 'SURVEY_COMPLETION', points: survey.pointsValue,
      refType: 'survey', refId: surveyId,
      idempotencyKey: `survey:${surveyId}:${userId}`,
      description: `Survey completion: ${survey.title}`,
    });

    return { status: 'completed', pointsAwarded: survey.pointsValue, balanceAfter: txn.balanceAfter };
  });
}
```

Notes:
- The **`@@unique([userId, surveyId])`** constraint plus the `already_completed` check make double
  completion impossible; the `PointsService` `idempotencyKey` is the second line of defence against a
  double credit (a retried callback returns the existing ledger row, never a new one — see
  [../architecture/03 §4](../architecture/03-backend-architecture.md#4-pointsservice--the-shared-ledger)).
- The **conditional `updateMany`** on `completedCount` is the atomic quota guard: concurrent completions
  race on the row and only those keeping `completedCount < quota` succeed; the loser gets `survey_full`.
- **No external I/O inside the transaction** ([../architecture/03 §9.3](../architecture/03-backend-architecture.md#9-health-checks-graceful-shutdown-db-pooling)):
  signature verification and any provider round-trip happen *before* the `$transaction`; the
  `survey.completed` notification event is enqueued *after* commit.

### 8.3 Provider callback verification

- The provider is configured with a **shared secret**; callbacks carry an HMAC signature over
  `(surveyId, userId|returnToken, status, timestamp)`. `SurveyCompletionService.verifyCallback` recomputes
  the HMAC and rejects mismatches / stale timestamps with `401 UNAUTHENTICATED` **before** any DB work.
- The signed **`returnToken`** issued at `start` binds the callback to a specific `(user, survey, response)`
  so a provider callback can't credit an arbitrary member. Verification and idempotency together make the
  callback safe to retry.

---

## 9. Points / ledger rules (this module)

Per [../architecture/04-database-architecture.md §5](../architecture/04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6):

- **Action:** `SURVEY_COMPLETION` (CREDIT), `points = Survey.pointsValue`, `refType = 'survey'`,
  `refId = surveyId`.
- **Idempotent per `(user, survey)`** via `idempotencyKey = survey:{surveyId}:{userId}` — a retried
  redirect or callback returns the existing transaction; **no double credit**.
- **In-transaction:** the ledger row is written in the **same** `$transaction` as the `SurveyResponse`
  update and the `completedCount` increment; if any step fails, the credit rolls back.
- **Quota guard:** points are only awarded when the atomic `completedCount < quota` increment succeeds;
  over-quota completions never credit.
- **No credit on disqualified** and **no credit on start** — only `status = completed` awards points.
- Ledger rows are **never edited/deleted**; a mistaken credit is corrected with a new `ADJUSTMENT` row
  (admin), never by mutating the survey row.

---

## 10. Reuse notes

- **`PointsService`** (shared `PointsModule`) — never write `points_transactions`/`points_balances`
  directly. Same gateway as auth bonus, profile surveys, polls, games, redemptions.
- **UI kit** — `Tabs`, `SurveyCard`, `Card`, `Badge`, `PointsPill`, `EmptyState`, `Skeleton`, `Alert`,
  `Modal`, `Toast` from `@binaryiq/ui`. No bespoke cards/badges/modals.
- **Patterns** — list+card (§6), empty/loading/error (§3), points feedback (§8), and the §1 form pattern
  (admin CRUD + internal renderer) from [../design-system/14-patterns.md](../design-system/14-patterns.md).
- **API envelope / error codes / auth / webhooks** — [../architecture/05-api-conventions.md](../architecture/05-api-conventions.md);
  the completion callback reuses the webhook signature-verification convention (§11 there).
- **Profile data** — read via [module-02](module-02-profile-account.md)'s models; matching never
  re-collects profile data.
- **DTOs/Zod schemas** — `packages/types`, shared client+server.

---

## 11. Acceptance criteria

- [ ] `GET /surveys` returns **only eligible** surveys for the caller, grouped into `priority`/`quick`/
      `premium`; excludes already-completed/disqualified, quota-full, expired, and inactive surveys.
- [ ] A member with **no** completed profile surveys sees **only generic** surveys.
- [ ] Completing more profile categories increases the number/relevance of matched surveys.
- [ ] `POST /surveys/:id/start` creates/returns a `started` `SurveyResponse` and the provider URL (or
      internal renderer); re-starting is idempotent.
- [ ] `POST /surveys/:id/complete` awards `pointsValue` **exactly once** per `(user, survey)`, writes one
      `SURVEY_COMPLETION` ledger row, sets `completed` + `completedAt`, and increments `completedCount`,
      all in one transaction.
- [ ] Completing an at-quota survey is rejected (`422 survey_full`) and **never** credits or over-increments
      `completedCount`.
- [ ] Expired/inactive surveys are hidden and any start/complete returns `422 survey_expired`/`survey_inactive`.
- [ ] Disqualified outcomes record `status = disqualified`, award **0** points, and don't touch the counter.
- [ ] Provider callbacks are **signature-verified**; invalid/stale signatures → `401` with no DB writes.
- [ ] Badge tones render Priority = magenta, Quick = info blue, Premium = violet; empty state nudges profile
      completion.
- [ ] Admin can create/update/deactivate surveys and their `targeting`; `completedCount` is not editable.

---

## 12. Tasks (ordered)

1. **DTOs & schemas** — add `SurveyCardDto`, `SurveyDetailDto`, `CreateSurveyInput`, `CompleteSurveyInput`,
   `MatchedSurveysDto`, and the `targeting` schema to `packages/types`.
2. **SurveysModule scaffold** — module, controller, `SurveysService`, `MatchingService`,
   `SurveyCompletionService`; import `PointsModule` + `PrismaModule`.
3. **MatchingService** — profile snapshot loader (decrypt DOB → age), targeting evaluator (hard gate),
   generic fallback, scoring/ordering; unit-tested against fixture profiles.
4. **Listing** — `SurveysService.listForUser` → group by type, exclude responded/full/expired/inactive
   (anti-join on `survey_responses`); `GET /surveys` + `GET /surveys/:id`.
5. **Start flow** — eligibility re-check + `started` upsert; issue signed `returnToken`; `POST /surveys/:id/start`.
6. **Completion flow** — `SurveyCompletionService.complete` transaction (award + status + atomic quota
   increment + idempotency); `POST /surveys/:id/complete` for internal path.
7. **Provider callback** — signature verification + `returnToken` binding; wire redirect + s2s callback to
   the same completion service; emit `survey.completed` event post-commit.
8. **Admin CRUD** — `GET/POST/PUT /admin/surveys` behind `AdminGuard`; targeting validation.
9. **Frontend surveys page** — RSC list, `Tabs` per type, `SurveyCard` grid, type `Badge` tones, empty
   state nudging profile completion; loading/error states.
10. **Frontend start + completion-redirect** — `useStartSurvey` mutation, external redirect vs internal
    renderer, completion return route, points-feedback toast/modal, cache invalidation.
11. **Seed/admin data** — a few generic + targeted surveys per type (incl. a ≤3,400-pt Premium) for QA.
12. **Tests** — unit (matching, completion), integration (transaction rollback, quota race, idempotency),
    e2e (envelope, auth, error codes, callback signature) — see §13 and
    [../architecture/08-testing-strategy.md](../architecture/08-testing-strategy.md).

---

## 13. Test cases

**Matching**
- Member with a full profile → matching returns **only eligible** surveys (targeting satisfied); a survey
  whose `age`/`gender`/`income` group the member fails is excluded.
- Member with **zero** `ProfileSurveyResponse` rows → **generic-only** (no targeted survey appears).
- Adding a profile category the survey targets makes a previously-hidden targeted survey appear.
- A survey with empty/absent `targeting` appears for everyone (generic baseline).
- Already-completed/disqualified surveys never re-appear; a `started` survey is resumable but not re-listed
  as new.

**Quota**
- Quota prevents over-completion: with `quota = N` and `completedCount = N`, `start`/`complete` →
  `422 survey_full`; `completedCount` stays `N`.
- Concurrent completions on the last slot: exactly one succeeds and credits; the other → `422 survey_full`
  (atomic conditional increment).

**Expiry / active**
- `expiresAt` in the past → survey hidden from listing; `complete` → `422 survey_expired`.
- `isActive = false` → hidden; start/complete rejected.

**Completion & ledger**
- Completion **awards once**: one `SURVEY_COMPLETION` ledger row, `pointsAwarded = pointsValue`,
  `SurveyResponse.status = completed`, `completedCount + 1`.
- Retried completion/callback with the same `idempotencyKey` → **no second credit** (existing row returned);
  duplicate response insert → `409 already_completed`.
- Transaction rollback: if the response upsert/counter increment fails, the point credit is **not** written.
- Disqualified outcome → `status = disqualified`, 0 points, counter unchanged.

**Provider callback**
- Valid HMAC signature + fresh timestamp → completion proceeds.
- **Invalid/tampered signature → `401`**, zero DB writes.
- Stale timestamp / replayed callback for an already-completed survey → rejected/idempotent (no double
  credit).
- `returnToken` bound to a different `(user, survey)` cannot credit the wrong member.

**API/UX**
- `GET /surveys` response is grouped by type and conforms to the envelope; badges render the correct tones.
- Empty match set renders the profile-completion `EmptyState` with the About You CTA.

---

## Related documents

- [../00-project-overview.md](../00-project-overview.md) — module map, points/INR constant.
- [../BinaryIQ_Full_Breakdown.md](../BinaryIQ_Full_Breakdown.md) — §5.2 types, §5.3 matching.
- [../architecture/03-backend-architecture.md](../architecture/03-backend-architecture.md) — modules, layering, `PointsService`.
- [../architecture/04-database-architecture.md](../architecture/04-database-architecture.md) — `Survey`/`SurveyResponse`, ledger rules.
- [../architecture/05-api-conventions.md](../architecture/05-api-conventions.md) — envelope, errors, auth, webhooks.
- [../architecture/06-frontend-architecture.md](../architecture/06-frontend-architecture.md) — App Router, data fetching, forms.
- [../design-system/13-components-library.md](../design-system/13-components-library.md) — `SurveyCard`, `Badge`, `Tabs`.
- [../design-system/14-patterns.md](../design-system/14-patterns.md) — list+card, states, points feedback.
- [module-02-profile-account.md](module-02-profile-account.md) — profile data consumed by matching.
</content>
</invoke>

# Module 02 — Profile Surveys & Account ⭐

**Phase 2** ([roadmap](../phases/00-roadmap.md)). Depends on Phase 1 (a registered, email-verified
user with a JWT session and 500 welcome points).

This module delivers the **14 data-driven profile-survey categories** and the **account-management
tabs** (Profile / Email / Password / PayPal / About You). It is the first place a member enriches
their profile after registration; that profile later drives survey matching
([module-04](module-04-surveys.md)).

This doc follows the standard 12-section module template. It **references** the architecture and
design backbone rather than restating it:

- Data model (authoritative) → [04-database-architecture](../architecture/04-database-architecture.md)
  (`ProfileSurveyCategory`, `ProfileSurveyResponse`, `UserProfile`, `UserAddress`,
  `UserDemographics`, `PaypalAccount`, `AuthToken`).
- Backend structure, `PointsService`, transactions → [03-backend-architecture](../architecture/03-backend-architecture.md).
- HTTP envelope, error codes, auth, pagination → [05-api-conventions](../architecture/05-api-conventions.md).
- Frontend App Router, forms, data fetching → [06-frontend-architecture](../architecture/06-frontend-architecture.md).
- PII encryption, email re-verification, ownership → [07-security-compliance](../architecture/07-security-compliance.md).
- UI kit + patterns → [13-components-library](../design-system/13-components-library.md),
  [14-patterns](../design-system/14-patterns.md).

---

## 1. Overview & goal

**Goal:** let a member (a) complete any of the 14 **profile-survey categories** — each a form whose
questions are defined by a JSONB schema stored on `ProfileSurveyCategory.schema` — to earn points
(100 per category, **200 for Social Activities**); and (b) manage their account across five tabs
(Profile, Email, Password, PayPal, About You).

Two capabilities, one module because they share the same identity tables and the same data-driven
form machinery:

- **Profile surveys** — 14 categories, seeded once. Completing a category writes exactly **one**
  `ProfileSurveyResponse` (unique per `user + category`) and awards that category's points via the
  shared `PointsService` in the **same transaction**. **About You** is completed first, immediately
  after registration/verification, and is also surfaced as an account tab so its extended fields
  (address, education, employment, household) can be edited later.
- **Account tabs** — CRUD over `UserProfile` (photo, first name, surname, DOB, gender), email
  (change with re-verification), password (current + new + confirm), PayPal (link payout email),
  and the extended About You profile (`UserAddress` + `UserDemographics`).

**Why it matters:** profile completeness is the input to survey targeting
([Full Breakdown §5.3](../Influencer_Platform_Full_Breakdown.md), consumed in
[module-04](module-04-surveys.md)); PII correctness and encryption are a compliance obligation
([07 §3](../architecture/07-security-compliance.md)); the points awards must be exactly-once and
auditable ([04 §5](../architecture/04-database-architecture.md)).

**Definition of Done:** the Phase-2 row of the
[roadmap DoD](../phases/00-roadmap.md#definition-of-done-every-phase) plus the Phase-2 security
checklist ([07 §11](../architecture/07-security-compliance.md#11-security-checklist-per-phase-ties-to-definition-of-done)):
`_enc` encryption on DOB/phone/address/income at write, ownership scoping on every account route,
rectification audit-logged, validation on every field.

---

## 2. Scope

### In scope

- Seeding the **14 profile-survey categories** with their JSONB question schemas, points values, and
  sort order (via `packages/db/prisma/seed.ts` — [04 §7](../architecture/04-database-architecture.md#7-migrations--seeding)).
- **Listing** categories with per-user completion status and a completion progress indicator.
- **Fetching** a single category's question schema.
- **Submitting** a category response → validate answers against the schema, persist one
  `ProfileSurveyResponse`, award points transactionally, idempotent per `user+category`.
- **Account tabs**: GET/PUT profile, POST profile photo (upload/change/delete), PUT email (triggers
  `EMAIL_CHANGE` re-verification), PUT password (current + new + confirm), PUT PayPal, GET/PUT About
  You (address + demographics).
- The reusable **`SurveyForm`** renderer that turns a category's JSON schema into a form using the
  shared `FormField` components.
- PII **encryption** on write / decryption on read for `dob_enc`, `phone_enc`, `line1_enc`, and
  income; audit-logging of every rectification.

### Out of scope (owned elsewhere)

- The `PointsService` ledger implementation and invariants — Phase 0/3
  ([03 §4](../architecture/03-backend-architecture.md#4-pointsservice--the-shared-ledger),
  [04 §5](../architecture/04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6)).
  This module **calls** it; it does not implement it.
- Points **dashboard**, history views, rewards catalogue, redemption — [module-03](module-03-points-rewards.md).
- **Survey matching** that consumes this profile data — [module-04](module-04-surveys.md).
- Auth/JWT, registration, login, password-**reset** (forgotten-password) flow — [module-01](module-01-auth-registration.md).
  (Password **change** while logged in *is* in this module.)
- The upload transport itself (`POST /v1/uploads`, MIME/magic-byte/size/virus-scan) — a shared
  service defined in [07 §4.6](../architecture/07-security-compliance.md#46-file-upload-validation);
  this module consumes it and stores the returned URL.
- Notification sends (the email-change / photo-updated emails are enqueued via the
  notifications service — [module-07](module-07-notifications.md)).
- Admin authoring of category schemas — a future admin surface; categories are seed-driven for now.

---

## 3. User flows

### 3.1 Complete a profile category → earn points

1. Member opens **Profile** (or lands on **About You** right after email verification —
   [module-01 flow](module-01-auth-registration.md)).
2. The category list shows each of the 14 categories with a status: **Not started / Completed**, its
   points value, and an overall **completion progress** ring (`x / 14` categories).
3. Member picks a category → the client fetches the category's **schema** and the reusable
   `SurveyForm` renders the questions (radios, selects, multi-selects, number, text — driven by the
   schema; §7).
4. Member fills the form and submits. RHF validates client-side against the Zod schema derived from
   the category schema.
5. API validates the answers against the stored `schema`, creates one `ProfileSurveyResponse`, and —
   in the **same transaction** — awards the category's points via `PointsService`.
6. On success: the `PointsPill` in the header animates `+100` (`+200` for Social Activities), a
   celebratory toast fires ([14 §8](../design-system/14-patterns.md#8--points--reward-feedback-pattern)),
   the category flips to **Completed**, and the progress ring advances.
7. **Re-submitting the same category** is blocked: the API returns `409 CONFLICT`
   (`already_completed`) and **no second credit** is written (idempotent — §9). The UI shows the
   category as read-only/Completed rather than a submit form.

### 3.2 Edit each account tab

A single **Account** page hosts a `Tabs` shell ([13 §5](../design-system/13-components-library.md),
[06 §1 route tree](../architecture/06-frontend-architecture.md#1-app-router-folder-structure)):

- **Profile** — edit first name, surname, DOB, gender; upload/change/delete photo (§3.3). Save →
  `PUT /account/profile`, success toast, `isDirty` resets.
- **Email** — change registered email → re-verification flow (§3.4).
- **Password** — current + new + confirm → `PUT /account/password`; on success, session may be
  re-issued and a "password changed" notification sent.
- **PayPal** — enter payout PayPal email; the UI shows the standing warning to add the platform's
  own email to the linked PayPal account so payouts aren't rejected.
- **About You** — the extended profile: address line, city, PIN, education, employment, household
  (`UserAddress` + `UserDemographics`). This is the editable form of the first profile survey.

Each tab is the canonical **form pattern** ([14 §1](../design-system/14-patterns.md#1-form-pattern-the-canonical-form)):
one Zod schema shared with the API, field errors mapped from `VALIDATION_ERROR.details[]`, form-level
errors (`CONFLICT`, `UNPROCESSABLE`) as an inline `Alert`.

### 3.3 Photo upload (with crop)

1. Member clicks the `Avatar` / "Change photo" in the Profile tab → `FileUpload`
   ([13 §3](../design-system/13-components-library.md)) opens with **crop + preview**.
2. The cropped image is sent to the shared **`POST /v1/uploads`** endpoint (multipart) which
   validates MIME + magic bytes, caps size (≤ 5 MB), randomizes the filename, virus-scans, and
   returns a signed CDN URL ([07 §4.6](../architecture/07-security-compliance.md#46-file-upload-validation)).
3. The client calls `POST /account/profile/photo` with the returned URL; the service stores it on
   `user_profiles.photo_url` and returns the updated profile.
4. **Delete** photo → `DELETE /account/profile/photo` clears `photo_url`; the `Avatar` falls back to
   initials. A `ConfirmModal` guards the delete ([14 §2a](../design-system/14-patterns.md#2a-confirm-an-action--confirmmodal)).

### 3.4 Email change with re-verification

1. Member enters a new email in the **Email** tab → `PUT /account/email`.
2. The service validates uniqueness (new email not taken → else `409 CONFLICT`), then creates an
   `AuthToken` of type **`EMAIL_CHANGE`** whose `payload` carries the **pending new email**, with a
   24-hour expiry. The current email is **not** changed yet.
3. A verification email is enqueued to the **new** address ("confirm your new email"). The account
   still logs in with the **old** email until confirmed.
4. Member clicks the link → `POST /account/email/verify` (or the tokened GET landing) validates the
   token (unused, unexpired, type `EMAIL_CHANGE`), swaps `users.email` to the pending value, marks
   the token `used_at`, and audit-logs the change ([07 §6](../architecture/07-security-compliance.md#6-audit-logging)).
5. UI confirms via the email-change `Modal` pattern
   ([14 §2b](../design-system/14-patterns.md#2b-informational--result-modals--modal)).

> Re-verification is mandatory: an email change never takes effect on the `PUT` alone — it only
> commits when the token minted to the **new** address is consumed. This prevents account takeover
> via an unverified address.

---

## 4. Data model

Authoritative schema lives in [04-database §4](../architecture/04-database-architecture.md#4-prisma-schema-authoritative).
This module uses these models (no new tables):

| Model | Role in this module | Key points |
|---|---|---|
| `ProfileSurveyCategory` | The 14 seeded categories | `key` (`about_you`…), `name`, `pointsValue`, `sortOrder`, **`schema` (JSONB question definitions)**, `isActive` |
| `ProfileSurveyResponse` | One completion per category per user | `responses` (JSONB answers), `pointsAwarded`, **`@@unique([userId, categoryId])`** |
| `UserProfile` | Profile tab | `firstName`, `surname`, **`dobEnc`**, `gender`, `photoUrl`, `country` |
| `UserAddress` | About You tab | **`line1Enc`**, `city`, `pinCode`, `areaType` — PIN is single-source (spec gap #3) |
| `UserDemographics` | About You tab | `educationLevel`, `employmentType`, `incomeBracket` (encrypted at app layer), `householdSize`, `childrenCount`, `chiefWageEarner`, `assets` (JSONB) |
| `PaypalAccount` | PayPal tab | `paypalEmail`, `verifiedAt` |
| `AuthToken` | Email change | `tokenType = EMAIL_CHANGE`, `payload` = `{ newEmail }`, `expiresAt` (24h), `usedAt` |
| `PointsTransaction` / `PointsBalance` | Points award | written **only** via `PointsService` ([04 §5](../architecture/04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6)) |

### 4.1 The 14 seeded categories

Seeded in `packages/db/prisma/seed.ts`. All award **100 pts** except **Social Activities = 200 pts**.

| # | `key` | Name | Points | Data collected (schema drives the questions) |
|---|---|---|---|---|
| 1 | `about_you` | About You | 100 | Address, city, PIN, education level, employment type |
| 2 | `home_family` | Home and Family | 100 | Household size, children count, living-area type |
| 3 | `employment` | Employment | 100 | Job type, income bracket, chief-wage-earner |
| 4 | `finance` | Finance | 100 | Yearly/monthly income, assets owned |
| 5 | `health` | Health | 100 | Health habits, conditions, fitness level |
| 6 | `personal_care` | Personal Care | 100 | Product usage & brand preferences |
| 7 | `lifestyle` | Lifestyle | 100 | Hobbies, interests, outdoor activities |
| 8 | `travel` | Travel | 100 | Frequency, destinations, modes |
| 9 | `shopping` | Shopping | 100 | Habits, channels, spend levels |
| 10 | `media` | Media | 100 | TV, radio, streaming patterns |
| 11 | `technology` | Technology | 100 | Devices, internet usage, apps |
| 12 | `automotive` | Automotive | 100 | Vehicle ownership, driving habits |
| 13 | `video_games` | Video Games | 100 | Platforms, genres, spend |
| 14 | `social_activities` | Social Activities | **200** | Social-media usage, community involvement |

Some answers (e.g. About You's address/education/employment, Finance's income) map onto the
canonical identity tables (`UserAddress`, `UserDemographics`) so survey matching can read structured
fields; the full raw answer set is also stored in `ProfileSurveyResponse.responses`. Structured
income and address fields are written via the encryption service (§8).

### 4.2 Category `schema` JSONB shape

The `schema` column is a small, versioned question-definition document. Illustrative shape (the
renderer and the server validator both read it):

```jsonc
{
  "version": 1,
  "questions": [
    { "key": "education_level", "type": "select", "label": "Highest education", "required": true,
      "options": [ { "value": "secondary", "label": "Secondary" },
                   { "value": "graduate",  "label": "Graduate" },
                   { "value": "postgrad",  "label": "Post-graduate" } ] },
    { "key": "employment_type", "type": "radio", "label": "Employment", "required": true,
      "options": [ { "value": "salaried", "label": "Salaried" },
                   { "value": "self",     "label": "Self-employed" },
                   { "value": "student",  "label": "Student" } ] },
    { "key": "household_size", "type": "number", "label": "People in household", "min": 1, "max": 20 },
    { "key": "interests", "type": "multiselect", "label": "Interests",
      "options": [ /* … */ ], "maxSelections": 5 }
  ]
}
```

Supported `type`s map 1:1 to shared form controls: `text`, `number`, `select`, `radio`,
`multiselect`, `checkbox`, `date` → `Input`, `Select`/`RadioGroup`, `MultiSelect`/`CheckboxGroup`,
`DatePicker` ([13 §3](../design-system/13-components-library.md)). A category schema change is a new
seed/migration, never a code change to the renderer.

### 4.3 PII & encryption

Per [07 §3.1](../architecture/07-security-compliance.md#31-at-rest--application-layer-column-encryption):
`dob_enc` (`user_profiles`), `phone_enc` (`users`), `line1_enc` (`user_addresses`), and income
(`user_demographics.income_bracket`) are AES-256-GCM encrypted **in the app layer before write** and
decrypted on read by the account service. `city` and `pin_code` are kept **plaintext** deliberately
for coarse geo survey targeting ([07 §3.1 note](../architecture/07-security-compliance.md#31-at-rest--application-layer-column-encryption)).
`_enc` columns are not indexable/searchable in plaintext ([04 §1](../architecture/04-database-architecture.md#1-principles)).

---

## 5. API contracts

All endpoints follow [05-api-conventions](../architecture/05-api-conventions.md): `/v1` prefix,
`Bearer` JWT (member), the `data`/`error`/`meta` envelope, canonical error codes, and
service-layer ownership scoping. Only the **shape** unique to this module is given below.

### 5.1 Profile surveys (`/profile-surveys/*`)

> **`GET /v1/profile-surveys`** — list categories with this user's completion status
> - **Auth:** member
> - **200:** `{ data: { categories: ProfileCategorySummary[], completed: number, total: 14, points: { earned, remaining } } }`
>   where `ProfileCategorySummary = { id, key, name, pointsValue, sortOrder, completed: boolean, completedAt?: string }`
> - **Errors:** `401 UNAUTHENTICATED`
> - **Side effects:** none (read). Completion is a `LEFT JOIN` of categories against this user's
>   `profile_survey_responses`.

> **`GET /v1/profile-surveys/:key`** — get one category's question schema (+ this user's answers if done)
> - **Auth:** member
> - **Path:** `key` (e.g. `about_you`, `social_activities`)
> - **200:** `{ data: { id, key, name, pointsValue, completed, schema, responses?: object } }`
> - **Errors:** `404 NOT_FOUND` unknown/inactive category · `401 UNAUTHENTICATED`

> **`POST /v1/profile-surveys/:key/responses`** — submit a category (awards points)
> - **Auth:** member
> - **Path:** `key`
> - **Body:** `{ answers: Record<string, unknown> }` (Zod: `SubmitCategoryResponseInput`; server also
>   validates `answers` against the stored `schema`)
> - **Idempotency:** natural — `@@unique([userId, categoryId])`; optional `Idempotency-Key` header
>   maps to the ledger key
> - **201:** `{ data: { responseId, pointsAwarded, balance } }`
> - **Errors:** `409 CONFLICT` (`already_completed`) · `400 VALIDATION_ERROR` (answers don't satisfy
>   schema; `details[]` lists the offending question keys) · `404 NOT_FOUND` unknown category ·
>   `422 UNPROCESSABLE` inactive category
> - **Side effects:** inserts one `profile_survey_responses` row; maps structured answers onto
>   `user_addresses`/`user_demographics` where applicable (encrypting PII); **awards `pointsValue`
>   via `PointsService.award()` in the same transaction** (`action: 'PROFILE_SURVEY'`,
>   `idempotencyKey: profile_survey:{userId}:{categoryId}`); refreshes `PointsBalance`.

### 5.2 Account (`/account/*`)

> **`GET /v1/account/profile`** — current profile
> - **Auth:** member · **200:** `{ data: { firstName, surname, dob, gender, photoUrl, country } }`
>   (DOB decrypted for the owner) · **Errors:** `401`

> **`PUT /v1/account/profile`** — update profile
> - **Auth:** member · **Body:** `{ firstName, surname, dob, gender }` (Zod: `UpdateProfileInput`)
> - **200:** `{ data: <profile> }` · **Errors:** `400 VALIDATION_ERROR` · `401`
> - **Side effects:** re-encrypts `dob_enc` on write; **audit-logged** (rectification, [07 §6](../architecture/07-security-compliance.md#6-audit-logging)).

> **`POST /v1/account/profile/photo`** — set/replace photo
> - **Auth:** member · **Body:** `{ url }` (the signed URL returned by `POST /v1/uploads`)
> - **200:** `{ data: { photoUrl } }` · **Errors:** `400 VALIDATION_ERROR` (bad/untrusted URL) · `401`
>
> **`DELETE /v1/account/profile/photo`** — remove photo
> - **Auth:** member · **200:** `{ data: { photoUrl: null } }` · **Errors:** `401`

> **`PUT /v1/account/email`** — request an email change (triggers re-verification)
> - **Auth:** member · **Body:** `{ email }` (Zod: `ChangeEmailInput`)
> - **200:** `{ data: { pending: true, email } }` (the change is **not** applied yet)
> - **Errors:** `409 CONFLICT` email already in use · `400 VALIDATION_ERROR` · `401`
> - **Side effects:** creates `AuthToken{ tokenType: EMAIL_CHANGE, payload:{ newEmail }, expiresAt:+24h }`;
>   enqueues a verification email to the **new** address. Current email unchanged.
>
> **`POST /v1/account/email/verify`** — confirm the new email
> - **Auth:** member (or tokened public landing that resolves the user from the token)
> - **Body:** `{ token }`
> - **200:** `{ data: { email } }` (now switched)
> - **Errors:** `404 NOT_FOUND`/`422 UNPROCESSABLE` invalid/expired/used token · `409 CONFLICT` if the
>   target email was taken in the interim
> - **Side effects:** sets `users.email`, marks token `used_at`, audit-logs `email.change`.

> **`PUT /v1/account/password`** — change password while logged in
> - **Auth:** member · **Body:** `{ currentPassword, newPassword, confirmPassword }` (Zod:
>   `ChangePasswordInput`; `newPassword === confirmPassword`, complexity policy)
> - **200:** `{ data: { ok: true } }`
> - **Errors:** `422 UNPROCESSABLE` (`current_password_incorrect`) · `400 VALIDATION_ERROR`
>   (mismatch/weak) · `401`
> - **Side effects:** verifies `currentPassword` with bcrypt constant-time compare, re-hashes new
>   password (bcrypt-12), audit-logs `password.change`; optionally revokes other refresh sessions.

> **`PUT /v1/account/paypal`** — link/update payout PayPal email
> - **Auth:** member · **Body:** `{ paypalEmail }` (Zod: `UpdatePaypalInput`)
> - **200:** `{ data: { paypalEmail, verifiedAt } }` · **Errors:** `400 VALIDATION_ERROR` · `401`
> - **Side effects:** upserts `paypal_accounts`; audit-logged (financial identifier, [07 §3.1](../architecture/07-security-compliance.md#31-at-rest--application-layer-column-encryption)).
>   Response carries the "add the platform email to your PayPal" advisory copy flag for the UI.

> **`GET /v1/account/about-you`** — extended profile
> - **Auth:** member · **200:** `{ data: { address:{ line1, city, pinCode, areaType }, demographics:{ educationLevel, employmentType, incomeBracket, householdSize, childrenCount, chiefWageEarner, assets } } }`
>   (`line1`, income decrypted for owner) · **Errors:** `401`
>
> **`PUT /v1/account/about-you`** — update extended profile
> - **Auth:** member · **Body:** `UpdateAboutYouInput` (address + demographics)
> - **200:** `{ data: <about-you> }` · **Errors:** `400 VALIDATION_ERROR` · `401`
> - **Side effects:** upserts `user_addresses` + `user_demographics`, encrypting `line1_enc` and
>   income; audit-logged. Does **not** re-award the About You points (that is the one-time category
>   submission — §9).

---

## 6. Frontend

Structure per [06-frontend-architecture](../architecture/06-frontend-architecture.md); routes under
`app/(app)/account/*` already exist in the route tree
([06 §1](../architecture/06-frontend-architecture.md#1-app-router-folder-structure)).

### 6.1 Account page (Tabs)

- `app/(app)/account/layout.tsx` renders the account **`Tabs`** shell ([13 §5](../design-system/13-components-library.md));
  each child route (`profile`, `email`, `password`, `paypal`, `about-you`) is a tab panel.
- Each panel is a **thin RSC** that server-fetches its initial data via the server API client
  ([06 §3.1](../architecture/06-frontend-architecture.md#31-server-side-fetch-in-rsc-initial-data))
  and mounts a client **form island** for editing.
- Forms follow the canonical **form pattern** ([14 §1](../design-system/14-patterns.md#1-form-pattern-the-canonical-form)):
  `useForm(zodResolver(schema))` with the **same Zod schema from `@influencer/types`** the API
  validates with; `VALIDATION_ERROR.details[]` mapped onto fields; `CONFLICT`/`UNPROCESSABLE` shown
  as an inline `Alert` ([14 §4](../design-system/14-patterns.md#4-toast-vs-inline-alert-feedback-pattern)).
- `features/account/` holds `ProfileForm`, `EmailForm`, `PasswordForm`, `PaypalForm`, `AboutYouForm`,
  plus TanStack Query hooks (`useUpdateProfile`, `useChangeEmail`, …). `EmailForm` is exactly the
  worked example in [06 §5](../architecture/06-frontend-architecture.md#5-forms-rhf--zod-one-schema-everywhere).

### 6.2 Data-driven `SurveyForm` renderer (the reuse centrepiece)

A single client component renders **any** category from its JSON `schema`:

```tsx
// apps/web/features/profile-surveys/components/SurveyForm.tsx
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField, Input, Select, RadioGroup, MultiSelect, Button } from '@influencer/ui';
import { schemaToZod, type CategorySchema } from '@influencer/types';

const CONTROL = { text: Input, number: Input, select: Select, radio: RadioGroup,
                  multiselect: MultiSelect } as const;

export function SurveyForm({ schema, defaults, onSubmit, submitting }: {
  schema: CategorySchema; defaults?: Record<string, unknown>;
  onSubmit: (answers: Record<string, unknown>) => Promise<void>; submitting: boolean;
}) {
  const zod = schemaToZod(schema);                 // build a Zod schema from the category JSON
  const form = useForm({ resolver: zodResolver(zod), defaultValues: defaults, mode: 'onBlur' });

  return (
    <Form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      {schema.questions.map((q) => {
        const Control = CONTROL[q.type];
        return (
          <FormField key={q.key} label={q.label} required={q.required}
                     error={form.formState.errors[q.key]?.message as string}>
            <Control {...form.register(q.key)} options={(q as any).options} />
          </FormField>
        );
      })}
      <Button type="submit" variant="primary" loading={submitting}>Submit &amp; earn points</Button>
    </Form>
  );
}
```

- **`schemaToZod(schema)`** lives in `@influencer/types` so the **same** derivation is available to
  the API validator — no client/server drift ([05 §5](../architecture/05-api-conventions.md#5-validation)).
- Controls are the shared `FormField` + input set only ([13 §3](../design-system/13-components-library.md));
  the renderer never ships bespoke inputs.
- **This renderer is reused conceptually by [module-04](module-04-surveys.md)** for taking surveys
  driven by their own question schema (§10).

### 6.3 Profile completion progress indicator

- The Profile category list is a **card/list** grid ([14 §6](../design-system/14-patterns.md#6-list--card-pattern))
  of category `Card`s, each showing `Badge` (Completed) + `PointsPill` (its value) + a CTA.
- Overall completion uses **`ProgressRing`/`ProgressBar`** ([13 §5](../design-system/13-components-library.md))
  bound to `completed / 14` from `GET /profile-surveys`.
- Loading/empty/error via the shared **state pattern** ([14 §3](../design-system/14-patterns.md#3-empty--loading--error-state-pattern))
  — `Skeleton`, `EmptyState`, `Alert` + Retry.

### 6.4 Photo upload with crop

- The Profile tab uses **`FileUpload`** (crop + preview → returns URL,
  [13 §3](../design-system/13-components-library.md)); the returned signed URL is passed to
  `POST /account/profile/photo`. `Avatar` shows the photo with an initials fallback.
- Delete is a **`ConfirmModal`** ([14 §2a](../design-system/14-patterns.md#2a-confirm-an-action--confirmmodal)).

### 6.5 Points feedback

On a successful category submission, invalidate `['account','balance']` so the header `PointsPill`
updates everywhere, and fire the celebratory `+N` toast
([14 §8](../design-system/14-patterns.md#8--points--reward-feedback-pattern)); Social Activities shows
`+200`.

---

## 7. Backend

Structure per [03-backend-architecture](../architecture/03-backend-architecture.md). Two feature
modules, both already stubbed in the folder tree
([03 §1.2](../architecture/03-backend-architecture.md#12-appsapisrc-folder-tree)) under
`modules/account/`:

- **`AccountModule`** — `account.controller.ts` + `account.service.ts` (profile, email, password,
  paypal, about-you). Imports `PointsModule`? No — account edits don't award points; it imports the
  **encryption service** and the **notifications** producer (for email-change / password-changed
  mails) and `ProvidersModule` indirectly.
- **`ProfileSurveysModule`** (`profile-survey.controller.ts` + `profile-survey.service.ts`) — imports
  **`PointsModule`** to credit category completions, plus the encryption service to persist
  structured PII answers.

### 7.1 Layering & rules

Controllers stay **thin**; services own **business logic + transaction boundaries + ownership**
([03 §2](../architecture/03-backend-architecture.md#2-layering)). Every query is scoped by
`userId = currentUser.id` — a member can only read/mutate their own rows
([07 §2.3](../architecture/07-security-compliance.md#23-ownership-enforcement)).

### 7.2 Transactional points award on category submit

The submit is the one place this module touches the ledger. It composes the domain write **and** the
point credit into a **single `prisma.$transaction`**, with `PointsService.award()` receiving that
`tx` ([03 §2.3](../architecture/03-backend-architecture.md#23-canonical-controller--service),
[03 §4](../architecture/03-backend-architecture.md#4-pointsservice--the-shared-ledger)):

```ts
// profile-survey.service.ts (sketch)
async submit(userId: string, key: string, answers: Record<string, unknown>) {
  const category = await this.prisma.profileSurveyCategory.findUnique({ where: { key } });
  if (!category || !category.isActive) throw new NotFoundException('category');
  this.validateAgainstSchema(category.schema, answers);          // else ValidationException (400)

  return this.prisma.$transaction(async (tx) => {
    try {
      const resp = await tx.profileSurveyResponse.create({
        data: { userId, categoryId: category.id, responses: answers, pointsAwarded: category.pointsValue },
      });
      await this.mapStructuredAnswers(tx, userId, category.key, answers); // upsert address/demographics (encrypt PII)
      await this.points.award(tx, {                                        // SAME transaction
        userId, action: 'PROFILE_SURVEY', points: category.pointsValue,
        refType: 'profile_survey', refId: category.id,
        idempotencyKey: `profile_survey:${userId}:${category.id}`,
        description: `Profile survey: ${category.name}`,
      });
      return { responseId: resp.id, pointsAwarded: category.pointsValue };
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('already_completed'); // 409, no double-credit
      throw e;
    }
  });
}
```

Because `@@unique([userId, categoryId])` and the ledger's unique `idempotencyKey` both guard the
write, a re-submit or a raced retry **cannot** create a second credit — the domain write conflicts
first, and even if it didn't, the ledger key would ([03 §4.2](../architecture/03-backend-architecture.md#42-usage-contract),
[04 §5](../architecture/04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6)).
If the point credit throws, the response row rolls back with it (invariant #1).

### 7.3 Encryption-service usage

The account/profile services call the shared **encryption service** (AES-256-GCM,
[07 §3](../architecture/07-security-compliance.md#3-encryption)) to encrypt `dob`, `phone`, address
`line1`, and income **before** persisting to `_enc` columns, and to decrypt them on read for the
owner. `city`/`pin_code` are stored plaintext for targeting. Nothing PII is logged
([03 §3.5](../architecture/03-backend-architecture.md#35-logging-pino), [07 §6](../architecture/07-security-compliance.md#6-audit-logging)).

### 7.4 Email-change token flow

`AccountService` reuses the **`AuthToken`** table with `tokenType = EMAIL_CHANGE` and
`payload = { newEmail }`:

1. `PUT /account/email` → uniqueness check → create token (24h) → enqueue verification email to the
   new address via the notifications producer ([module-07](module-07-notifications.md)). Old email
   stays active.
2. `POST /account/email/verify` → load token by value, assert `type === EMAIL_CHANGE`, not used, not
   expired → in one transaction set `users.email = payload.newEmail`, set `usedAt`, audit-log.
3. The `TokenService` from [module-01](module-01-auth-registration.md) generates/validates tokens;
   the nightly `purge-expired-tokens` maintenance job
   ([03 §6.2](../architecture/03-backend-architecture.md#62-scheduled-jobs-cron)) cleans up.

### 7.5 Category seeding

`packages/db/prisma/seed.ts` seeds the 14 categories (keys, names, points, sort order, and each
`schema`) — [04 §7](../architecture/04-database-architecture.md#7-migrations--seeding). Seeding is
idempotent (`upsert` by `key`) so re-running never duplicates categories.

---

## 8. Points / ledger rules

- **Amounts:** each category awards `pointsValue` — **100** for 13 categories, **200** for Social
  Activities. Values live in the seed (`ProfileSurveyCategory.pointsValue`), never hard-coded in
  service logic, so product can retune without a code change.
- **Action:** credits use `PointsAction.PROFILE_SURVEY`
  ([04 enum](../architecture/04-database-architecture.md#4-prisma-schema-authoritative)).
- **One transaction:** the `ProfileSurveyResponse` insert and the `points_transactions` credit share
  one `$transaction`; roll back together (ledger invariant #1).
- **Idempotency:** `idempotencyKey = profile_survey:{userId}:{categoryId}` on the ledger row **plus**
  `@@unique([userId, categoryId])` on the response ⇒ **exactly-once** credit per user per category.
  A retry/duplicate returns the existing transaction (no double-credit —
  [03 §4](../architecture/03-backend-architecture.md#4-pointsservice--the-shared-ledger)).
- **Balance:** `PointsBalance` (cache) is updated in the same transaction; the header `PointsPill`
  reflects it after invalidation (§6.5).
- **No spend here:** this module only **credits**. Debits/redemptions are [module-03](module-03-points-rewards.md).
- **Account edits never award points:** editing the Profile/Email/Password/PayPal/About You tabs does
  **not** touch the ledger; only the one-time **category submission** does. (Editing About You after
  its category was completed does not re-credit.)

---

## 9. Reuse notes

- **`SurveyForm` renderer** — the data-driven JSON-schema → `FormField` renderer (§6.2) is the
  centrepiece reuse. [module-04](module-04-surveys.md) reuses the **same concept** to render
  brand-survey questions from their own schema, and the **same `schemaToZod`** helper in
  `@influencer/types` for client+server validation.
- **`FormField` / `Tabs` / `FileUpload` / `Avatar` / `ProgressRing`** — all from `packages/ui`
  ([13](../design-system/13-components-library.md)); no bespoke inputs, tabs, upload widgets, or
  modals are created here.
- **Form / Modal / State patterns** — every tab and the category form use the canonical patterns
  ([14 §1/§2/§3](../design-system/14-patterns.md)); nothing invents a new recipe.
- **`PointsService`** — reused as-is; this module is a *caller*, never a re-implementer
  ([03 §4](../architecture/03-backend-architecture.md#4-pointsservice--the-shared-ledger)).
- **`AuthToken` + `TokenService`** — the email-change flow reuses the same token table/service as
  registration and password reset ([module-01](module-01-auth-registration.md)), with a distinct
  `EMAIL_CHANGE` type.
- **Encryption service** — the shared AES-256-GCM service ([07 §3](../architecture/07-security-compliance.md#3-encryption)),
  reused by every module that stores PII.
- **`POST /v1/uploads`** — the shared upload transport ([07 §4.6](../architecture/07-security-compliance.md#46-file-upload-validation))
  is reused for the profile photo; this module only stores the returned URL.

---

## 10. Acceptance criteria

1. The 14 categories are seeded with correct `key`, `name`, `pointsValue` (100 × 13, **200** for
   Social Activities), `sortOrder`, and a valid `schema`.
2. `GET /profile-surveys` returns all categories with accurate per-user completion status and a
   `completed / 14` count.
3. `GET /profile-surveys/:key` returns the category schema (and prior answers if completed).
4. Submitting a category persists exactly one `ProfileSurveyResponse` and credits its points via
   `PointsService` in the same transaction; the balance and `PointsPill` update.
5. **Re-submitting a completed category returns `409 CONFLICT` and writes no second credit** (verify
   the ledger has exactly one `PROFILE_SURVEY` row for that `user+category`).
6. Submitting answers that violate the category schema returns `400 VALIDATION_ERROR` with the
   offending question keys in `details[]`.
7. Account tabs: `GET/PUT profile`, photo `POST/DELETE`, `PUT email`, `POST email/verify`,
   `PUT password`, `PUT paypal`, `GET/PUT about-you` all work, are member-owned, and follow the
   envelope/error contract.
8. **Email change requires re-verification**: `PUT /account/email` does not change `users.email`; the
   email only switches after the `EMAIL_CHANGE` token minted to the new address is consumed.
9. **Password change requires the correct current password**: a wrong `currentPassword` returns
   `422 UNPROCESSABLE` and does not change the hash; mismatched confirm returns `400`.
10. **PII is stored encrypted**: `dob_enc`, `phone_enc`, `line1_enc`, and income are ciphertext at
    rest and decrypt correctly for the owner; `city`/`pin_code` remain plaintext for targeting.
11. Every profile/address/demographics/PayPal/email change is **audit-logged**; no PII in logs.
12. Photo upload enforces the shared upload validation (type/size/scan) and shows crop + preview; the
    `Avatar` falls back to initials after delete.
13. The Profile page shows a completion progress indicator bound to `completed / 14`.
14. UI uses only shared components/tokens/patterns; no one-off modals/inputs/colors
    ([roadmap DoD](../phases/00-roadmap.md#definition-of-done-every-phase)).

---

## 11. Tasks (ordered)

1. **Seed** the 14 `ProfileSurveyCategory` rows (keys, names, points 100/200, sort order, JSON
   schemas) via idempotent `upsert` in `seed.ts`; migration reviewed
   ([04 §7](../architecture/04-database-architecture.md#7-migrations--seeding)).
2. **Types**: add Zod DTOs to `@influencer/types` — `CategorySchema`, `SubmitCategoryResponseInput`,
   `UpdateProfileInput`, `ChangeEmailInput`, `ChangePasswordInput`, `UpdatePaypalInput`,
   `UpdateAboutYouInput`, and the **`schemaToZod`** helper (shared client + server).
3. **`ProfileSurveysModule`**: controller + service; implement list (join completion), get-schema,
   and the transactional submit-with-points (§7.2). Wire `PointsModule` + encryption service.
4. **`AccountModule`**: controller + service for profile GET/PUT, photo POST/DELETE, about-you
   GET/PUT, paypal PUT — with encryption on `_enc` writes and audit-logging.
5. **Email-change flow**: `PUT /account/email` (token mint + notify new address) and
   `POST /account/email/verify` (commit swap); reuse `AuthToken`/`TokenService`.
6. **Password-change**: `PUT /account/password` (bcrypt verify current, re-hash, audit, optional
   session revoke).
7. **Frontend `SurveyForm`** renderer + `schemaToZod`; profile category list + `ProgressRing`;
   category submit island with points toast.
8. **Frontend account Tabs**: `ProfileForm`, `EmailForm`, `PasswordForm`, `PaypalForm`,
   `AboutYouForm` under `features/account/` with TanStack Query hooks; photo `FileUpload` + crop and
   delete `ConfirmModal`.
9. **Wire notifications** for email-change and password-changed messages (producer only; transport
   is [module-07](module-07-notifications.md)).
10. **Tests** (§12): unit (points idempotency, schema validation, current-password check), integration
    (transaction rollback, encryption round-trip), e2e (envelope/status/ownership).
11. **Security checklist** ([07 §11 Phase 2](../architecture/07-security-compliance.md#11-security-checklist-per-phase-ties-to-definition-of-done))
    and **DoD** sign-off; deploy to staging + smoke test.

---

## 12. Test cases

Coverage targets/tooling per [08-testing-strategy](../architecture/08-testing-strategy.md).

### Unit

- **Each category awards its correct points once** — submitting `about_you` credits 100;
  `social_activities` credits **200**; the `PointsService.award` call uses
  `action: 'PROFILE_SURVEY'` and `idempotencyKey: profile_survey:{userId}:{categoryId}`.
- **Re-submit blocked / no double-credit** — a second submit of the same category throws
  `ConflictException` (`409`), and the ledger still holds exactly **one** credit for that
  `user+category` (assert via a fake `tx` returning the existing row on unique violation).
- **Schema validation** — answers missing a `required` question, or out of `min/max`/`maxSelections`,
  raise `ValidationException` (`400`) with the offending keys.
- **Current-password check** — wrong `currentPassword` → `UnprocessableException`
  (`current_password_incorrect`); the hash is unchanged. Mismatched confirm → `400`.
- **Email-change mint** — `PUT /account/email` creates an `EMAIL_CHANGE` token with
  `payload.newEmail` and does **not** mutate `users.email`.

### Integration (real Postgres + Redis, testcontainers)

- **Transactional rollback** — force the point credit to fail after the response insert; assert the
  `ProfileSurveyResponse` is **not** persisted (both roll back — invariant #1).
- **Idempotency under concurrency** — two concurrent submits of the same category: exactly one
  response row and one ledger credit; the other resolves to `409` / the existing transaction.
- **PII stored encrypted** — after `PUT /account/profile` and `PUT /account/about-you`, the raw
  `dob_enc`/`phone_enc`/`line1_enc`/income columns are ciphertext (not the plaintext value), and a
  read as the owner returns the correct decrypted values; `city`/`pin_code` remain plaintext.
- **Email change requires re-verification** — after `PUT /account/email`, login still uses the old
  email; after `POST /account/email/verify` with the token, `users.email` is the new value and the
  token is `used_at`; an expired/used token → `422`/`404`.

### e2e (Supertest)

- All endpoints return the standard envelope and correct status codes
  ([05](../architecture/05-api-conventions.md)); another user cannot read/mutate a member's
  profile/responses (ownership → `403`/`404`).
- `GET /profile-surveys` reflects completion progress after a successful submit.
- Password change, email-change request+verify, and paypal update each produce an `audit_logs` entry;
  no PII appears in logs.

---

## Related documents

- [00-project-overview](../00-project-overview.md) — module map, points/INR constant, spec gaps.
- [Influencer_Platform_Full_Breakdown](../Influencer_Platform_Full_Breakdown.md) — §2.3 account tabs,
  §5.1 the 14 categories, §4.2 points table.
- [03-backend-architecture](../architecture/03-backend-architecture.md) — modules, `PointsService`, transactions.
- [04-database-architecture](../architecture/04-database-architecture.md) — models + ledger rules.
- [05-api-conventions](../architecture/05-api-conventions.md) — envelope, errors, auth, pagination.
- [06-frontend-architecture](../architecture/06-frontend-architecture.md) — App Router, forms, data fetching.
- [07-security-compliance](../architecture/07-security-compliance.md) — PII encryption, email re-verify, audit.
- [13-components-library](../design-system/13-components-library.md) · [14-patterns](../design-system/14-patterns.md) — UI kit + patterns.
- [module-01](module-01-auth-registration.md) · [module-03](module-03-points-rewards.md) · [module-04](module-04-surveys.md).

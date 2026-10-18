# Module 01 — Auth & Registration

**Phase 1.** Two-step signup, branded email verification (+500 welcome points on verify), login
(JWT RS256 + refresh), logout, forgot/reset password, token refresh.

This doc describes *what this module builds* and *which* screens, endpoints, and rows exist. It does
**not** restate the backbone — it references it:

- HTTP envelope, status codes, canonical error codes, rate limits →
  [../architecture/05-api-conventions.md](../architecture/05-api-conventions.md).
- Prisma models + ledger invariants →
  [../architecture/04-database-architecture.md](../architecture/04-database-architecture.md).
- Module/service layering, `PointsService`, provider abstraction, guards →
  [../architecture/03-backend-architecture.md](../architecture/03-backend-architecture.md).
- App Router structure, forms/wizard pattern, typed API client →
  [../architecture/06-frontend-architecture.md](../architecture/06-frontend-architecture.md).
- bcrypt-12, RS256, lockout, cookie flags, audit, consent →
  [../architecture/07-security-compliance.md](../architecture/07-security-compliance.md).
- UI kit + patterns →
  [../design-system/13-components-library.md](../design-system/13-components-library.md) ·
  [../design-system/14-patterns.md](../design-system/14-patterns.md).
- Source spec (§2 flow, §9 security) →
  [../BinaryIQ_Full_Breakdown.md](../BinaryIQ_Full_Breakdown.md).
- Build order / definition-of-done → [../phases/00-roadmap.md](../phases/00-roadmap.md).

---

## 1. Overview & goal

Auth & Registration is the front door. It turns an anonymous visitor into a **verified member** with a
credited **+500 welcome bonus**, and provides the session machinery (login, refresh, logout, password
recovery) every other module depends on.

**Goal:** frictionless, secure two-step registration where the account is *created* at Step 2 but only
becomes *verified and rewarded* when the user clicks the email confirmation link. The 500-point
`REGISTRATION_BONUS` is awarded **on verify**, through the shared `PointsService`, inside one atomic,
**idempotent** transaction — re-clicking the link never double-credits.

The registration flow is the reference implementation of the
[multi-step wizard pattern](../design-system/14-patterns.md#7-multi-step-flow-pattern-wizard) and the
[canonical form pattern](../design-system/14-patterns.md#1-form-pattern-the-canonical-form).

**Decisions of record** ([00-overview §7](../00-project-overview.md#7-resolved-spec-gaps-decisions-of-record)):
verification *completes* registration (+500); **About You is Phase 2**, the first profile survey (+100),
not part of the auth transaction. Step-1 `PIN Code` is the same postal code the About You tab later
edits — single source on `user_addresses.pin_code`.

## 2. Scope

**In scope**
- Two-step registration wizard (Step 1 identity, Step 2 credentials) with a Redis draft across steps.
- Username auto-suggestion (backend suggests, user can override; live uniqueness feedback).
- SendGrid branded verification email (UUID token, 24 h expiry, pink "Confirm your registration" button).
- Email verification endpoint → mark verified + award 500 `REGISTRATION_BONUS` (idempotent).
- Login (email + password), logout, token refresh.
- Forgot-password (email token link) and reset-password.
- Security controls for this phase: bcrypt cost 12, RS256 access (15 min) + refresh rotation, account
  lockout (5 fails ⇒ 30 min), auth rate limit 10/min, consent capture at signup, audit logging of auth
  events (see [07 §11 Phase 1](../architecture/07-security-compliance.md#11-security-checklist-per-phase-ties-to-definition-of-done)).

**Out of scope (owned elsewhere)**
- **About You** profile survey and the +100 credit → [module-02](module-02-profile-account.md).
- Account tabs (Profile / Email change / Password change / PayPal) → [module-02](module-02-profile-account.md).
  This module *creates* the `User`, `UserProfile`, `UserAddress` rows; editing them post-verify is Phase 2.
- Points dashboard, rewards, redemption → [module-03](module-03-points-rewards.md). This module only
  *emits* the 500-point ledger row via `PointsService`.
- Notification preferences / channels; the verification + reset emails here are sent directly through the
  `EMAIL_PROVIDER` (transactional, not preference-gated) → [module-07](module-07-notifications.md).
- MFA (identity model is MFA-ready but MFA is off in this release —
  [07 §1.6](../architecture/07-security-compliance.md#16-mfa-ready-note)).
- Admin auth (`/admin/*`, `AdminGuard`) — separate audience, handled with the admin module.

## 3. User flows

Screens live in the `(auth)` route group (public, centred-card shell) —
[06 §1](../architecture/06-frontend-architecture.md#1-app-router-folder-structure). Exact copy and
redirects below are load-bearing (from spec §2.1).

### 3.1 Register → verify → land (happy path)

1. **Step 1 — Identity** (`/register`, wizard step 1). Fields: **Country**, **First Name**, **Surname**,
   **Date of Birth**, **Gender**. Client-validates its slice; on **Continue** the accumulated values are
   persisted to the registration draft (`POST /auth/register/step1` → `reg:draft:{sessionId}`, Redis, 1 h)
   and the wizard advances. A `ProgressBar` shows "Step 1 of 2".
2. **Step 2 — Credentials** (`/register`, wizard step 2). Fields: **Email**, **Password**, **PIN Code**,
   **Username** (auto-suggested), **Mobile Number** (optional). Username is prefilled from a
   server suggestion and shows live availability. On **Create account**:
   `POST /auth/register/step2` merges Step-1 draft + Step-2 body, checks email/username uniqueness, hashes
   the password (bcrypt 12), creates `User` + `UserProfile` + `UserAddress` (unverified), writes consent
   rows, issues a UUID `EMAIL_VERIFICATION` `AuthToken` (24 h), and enqueues the branded SendGrid email.
   The draft is cleared.
3. **Verification sent** (`/verify` — the "check your inbox" state). The page shows the exact copy:
   > **We have sent you an activation email on [email]**

   with a "Resend email" affordance (rate-limited) and no auto-advance.
4. **Email** — branded HTML template: platform logo, body text explaining the **500 welcome bonus
   points**, and a **pink "Confirm your registration"** button linking to
   `…/emailvalidated?token=<uuid>`.
5. **Confirm click** → `GET /auth/verify-email?token=…`. Server validates the token (exists, correct type,
   unused, not expired), and in **one transaction**: marks `users.is_verified = true`, consumes the token
   (`used_at`), and awards **500 `REGISTRATION_BONUS`** via `PointsService.award(...)` with
   `idempotencyKey = registration_bonus:{userId}` (§8). Re-clicking the same (already-used) link is a
   **no-op success** — verified stays verified, no second credit.
6. **Redirect** → **About You** (Phase 2 first profile survey), signed in, with a celebratory `+500 pts`
   toast ([14 §8](../design-system/14-patterns.md#8-points--reward-feedback-pattern)). Per
   [06 §8](../architecture/06-frontend-architecture.md#8-auth-on-the-client) verify-email success lands
   the authenticated member in the app shell.

> Frontend note: the `emailvalidated?token=` link opens the `/verify` page in "confirming…" mode, which
> calls `GET /auth/verify-email` and then routes to `/account/about-you`. Expired/invalid tokens render an
> `Alert` with a "Resend verification email" action, never a dead end
> ([14 §3](../design-system/14-patterns.md#3-empty--loading--error-state-pattern)).

### 3.2 Login

1. `/login` — Email + Password form.
2. `POST /auth/login`. On success: issues an RS256 **access token (15 min)**, sets the rotating
   **refresh cookie** (`HttpOnly; Secure; SameSite=Strict; Path=/v1/auth`), resets `failed_logins`,
   updates `last_login_at`, audit-logs `user.login`.
3. Redirect to `callbackUrl` or `/dashboard`.
4. **Failure paths:** bad credentials → `401 UNAUTHENTICATED` (generic "Invalid email or password",
   no enumeration), increment `failed_logins`, audit `user.login.failed`. **5th consecutive fail** sets
   `locked_until = now()+30m`; while locked, login returns `403 FORBIDDEN` with a generic message
   (audit `user.login.locked`). **Unverified** account → `403 FORBIDDEN` with a "verify your email first"
   affordance to resend. See [07 §1.5](../architecture/07-security-compliance.md#15-account-lockout).

### 3.3 Forgot / reset password

1. `/forgot-password` — single Email field → `POST /auth/forgot-password`.
2. Server responds **200 regardless** (no account enumeration). If the email maps to a real, active user,
   it issues a `PASSWORD_RESET` `AuthToken` (short expiry) and sends the reset-link email.
3. Page copy: "If an account exists for that email, we've sent a password reset link."
4. Email link → `/reset-password?token=…`. Form: New password + Confirm.
5. `POST /auth/reset-password` validates the token (unused, unexpired), sets the new bcrypt-12 hash,
   consumes the token, **revokes all refresh sessions** for that user (force re-login everywhere), audits
   `password.reset`.
6. Redirect to `/login` with a "Password updated — sign in" toast.

### 3.4 Refresh & logout (session lifecycle)

- **Refresh:** on a `401 UNAUTHENTICATED` (expired access), the client calls `POST /auth/refresh` using
  the httpOnly cookie. Server verifies + **rotates** the refresh `jti` (reuse of a rotated-out token →
  whole session family revoked + audited), returns a fresh access token. A second `401` signs the user
  out ([06 §8](../architecture/06-frontend-architecture.md#8-auth-on-the-client),
  [07 §1.2](../architecture/07-security-compliance.md#12-jwt--rs256-access--refresh-flow)).
- **Logout:** `POST /auth/logout` revokes the current refresh `jti`, clears the cookie, audits
  `user.logout`, returns the user to `(marketing)` `/`.

## 4. Data model

Authoritative schema in
[04-database §4](../architecture/04-database-architecture.md#4-prisma-schema-authoritative). This module
**writes** the following (no schema changes — all these models are created in Phase 0):

| Model | When written | By |
|---|---|---|
| `User` | Step 2 (create, `is_verified=false`); verify (set `is_verified=true`); login (`last_login_at`, `failed_logins`, `locked_until`) | `AuthService` |
| `UserProfile` | Step 2 — `firstName`, `surname`, `dobEnc` (AES-256-GCM), `gender`, `country` from Step-1 draft | `AuthService` |
| `UserAddress` | Step 2 — `pinCode` (single source; About You edits it later, spec gap #3) | `AuthService` |
| `AuthToken` | Step 2 (`EMAIL_VERIFICATION`, 24 h); forgot-password (`PASSWORD_RESET`); consumed on verify/reset (`usedAt`) | `TokenService`/`AuthService` |
| `PointsTransaction` | **Verify only** — one `CREDIT` / `REGISTRATION_BONUS` row, `points=500`, `idempotencyKey='registration_bonus:{userId}'` | `PointsService.award` |
| `PointsBalance` | Verify only — upserted/updated in the same tx as the bonus (O(1) balance) | `PointsService` |
| `ConsentLog` | Step 2 — `terms` + `privacy` (and `marketing` if opted in), with `ip`/`ua` ([07 §7](../architecture/07-security-compliance.md#7-consent--privacy)) | `AuthService` |
| `AuditLog` | login / login.failed / login.locked / logout / token.refresh / password.reset | audit middleware / service |

**Encrypted-on-write** ([07 §3.1](../architecture/07-security-compliance.md#31-at-rest--application-layer-column-encryption)):
`user_profiles.dob_enc`, `users.phone_enc` (optional mobile). `pin_code` and `country` are plaintext
(needed for coarse survey targeting). Password is bcrypt digest only — never a reversible column.

**Redis (not Postgres)** ([04 §6](../architecture/04-database-architecture.md#6-redis-usage-not-postgres-but-part-of-the-data-layer)):
`reg:draft:{sessionId}` holds in-progress Step-1 → Step-2 data (TTL 1 h); the refresh allowlist keyed by
`jti` lives under `session:{sessionId}`; `ratelimit:{scope}:{ip}` backs the 10/min auth limit.

## 5. API contracts

All under `/v1/auth/*`, **public** (`@Public()`), auth-rate-limited **10 req/min per IP**
([05 §7–§8](../architecture/05-api-conventions.md#7-auth--authorization-patterns)). All requests/responses
use the standard envelope and canonical error codes
([05 §2, §4](../architecture/05-api-conventions.md#2-response-envelope-always)). DTOs are **Zod schemas in
`packages/types`** (`@binaryiq/types`), shared verbatim by API and frontend. Auth schemas use **strict**
parsing (unknown fields rejected, [07 §4.1](../architecture/07-security-compliance.md#41-input-validation-zod)).

---

> **`POST /v1/auth/register/step1`** — save Step-1 identity to the registration draft
> - **Auth:** public
> - **Body** (`RegisterStep1Schema`): `{ country: string, firstName: string, surname: string, dob: string (ISO date, ≥18y), gender: Gender }`
> - **200:** `{ data: { sessionId: string } }` — client stores `sessionId` (returned; also set as a short-lived draft cookie) to carry into Step 2.
> - **Errors:** `400 VALIDATION_ERROR` (missing field, underage DOB, bad enum).
> - **Side effects:** writes `reg:draft:{sessionId}` in Redis (TTL 1 h). No DB write, no user created yet.

> **`POST /v1/auth/register/step2`** — complete registration, create user, send verification email
> - **Auth:** public
> - **Body** (`RegisterStep2Schema`): `{ sessionId: string, email: string(email), password: string(policy), pinCode: string, username: string, mobile?: string }`
> - **201:** `{ data: { email: string, verificationSent: true } }` — the `/verify` page renders "We have sent you an activation email on [email]".
> - **Errors:** `409 CONFLICT` email already registered · `409 CONFLICT` username taken · `400 VALIDATION_ERROR` weak password / bad email / missing PIN · `422 UNPROCESSABLE` draft expired/missing (`sessionId` not in Redis → restart Step 1).
> - **Side effects (one `$transaction`):** merges Step-1 draft; bcrypt-12 hashes password; creates `User` (`is_verified=false`) + `UserProfile` (`dob_enc`) + `UserAddress` (`pinCode`) + optional `phone_enc`; writes `ConsentLog` rows; creates `AuthToken(EMAIL_VERIFICATION, 24h)`. **After commit** enqueues the SendGrid branded email (no provider I/O inside the DB tx — [03 §9.3](../architecture/03-backend-architecture.md#93-db-connection-pooling)). Clears the Redis draft. **No points yet.**

> **`GET /v1/auth/verify-email?token=<uuid>`** — verify email, award 500, complete registration
> - **Auth:** public
> - **Query:** `token` (uuid) — from the `emailvalidated?token=` link.
> - **200:** `{ data: { verified: true, pointsAwarded: 500, next: '/account/about-you' } }`. Server (or the `/verify` page) then signs the user in and redirects to **About You**.
> - **Errors:** `404 NOT_FOUND` unknown token · `422 UNPROCESSABLE` expired (>24 h) or wrong type · `400 VALIDATION_ERROR` malformed token. Already-used token (already verified) → **200 no-op success** (idempotent; not an error).
> - **Side effects (one `$transaction`):** set `users.is_verified=true`; set `auth_tokens.used_at`; **`PointsService.award({ userId, action:'REGISTRATION_BONUS', points:500, refType:'user', refId:userId, idempotencyKey:'registration_bonus:'+userId, description:'Welcome bonus' })`** → one `points_transactions` row + `points_balances` update, in the **same** tx. Idempotency key makes double-verify safe (§8).

> **`POST /v1/auth/login`** — email + password → access token + refresh cookie
> - **Auth:** public
> - **Body** (`LoginSchema`): `{ email: string(email), password: string }`
> - **200:** `{ data: { accessToken: string, user: { id, username, email } } }` + `Set-Cookie` refresh (HttpOnly/Secure/SameSite=Strict, Path `/v1/auth`).
> - **Errors:** `401 UNAUTHENTICATED` invalid credentials (generic, no enumeration) · `403 FORBIDDEN` account locked (`locked_until > now`) · `403 FORBIDDEN` email not verified · `400 VALIDATION_ERROR`.
> - **Side effects:** on success reset `failed_logins`, set `last_login_at`, mint access + rotating refresh, audit `user.login`. On failure increment `failed_logins`; at 5 → set `locked_until=now()+30m`, audit `user.login.locked`; else audit `user.login.failed`.

> **`POST /v1/auth/logout`** — end session
> - **Auth:** public (reads the refresh cookie); typically called with a valid session.
> - **Body:** none.
> - **200:** `{ data: { success: true } }` + cleared refresh cookie.
> - **Side effects:** revoke current refresh `jti` (Redis allowlist), audit `user.logout`.

> **`POST /v1/auth/forgot-password`** — request a reset link
> - **Auth:** public
> - **Body** (`ForgotPasswordSchema`): `{ email: string(email) }`
> - **200 (always):** `{ data: { requested: true } }` — identical response whether or not the email exists (**no enumeration**).
> - **Errors:** `400 VALIDATION_ERROR` (malformed email) · `429 RATE_LIMITED`.
> - **Side effects:** if a real active user, create `AuthToken(PASSWORD_RESET)` and enqueue reset email (after commit). Otherwise no-op.

> **`POST /v1/auth/reset-password`** — set a new password using the token
> - **Auth:** public
> - **Body** (`ResetPasswordSchema`): `{ token: string(uuid), password: string(policy) }`
> - **200:** `{ data: { reset: true } }`
> - **Errors:** `404 NOT_FOUND` unknown token · `422 UNPROCESSABLE` expired/used token · `400 VALIDATION_ERROR` weak password.
> - **Side effects (one tx):** bcrypt-12 hash new password; set `auth_tokens.used_at`; **revoke all refresh sessions** for the user; audit `password.reset`.

> **`POST /v1/auth/refresh`** — rotate refresh, mint a new access token
> - **Auth:** public (authenticates via the httpOnly refresh cookie, not `Bearer`).
> - **Body:** none.
> - **200:** `{ data: { accessToken: string } }` + rotated refresh cookie.
> - **Errors:** `401 UNAUTHENTICATED` missing/invalid/expired refresh. **Reuse of a rotated-out token → revoke the whole session family** (theft detection, [07 §1.2](../architecture/07-security-compliance.md#12-jwt--rs256-access--refresh-flow)) and audit.
> - **Side effects:** rotate `jti` in the Redis allowlist; audit `token.refresh`.

**Username suggestion.** Suggestion + availability is served through the register flow (see §6); it is a
lightweight helper (e.g. `GET /v1/auth/username-available?u=` or a `suggestedUsername` field returned by
Step 1), also public and rate-limited. Uniqueness is ultimately enforced by the `users.username` DB
unique constraint at Step 2 (`409 CONFLICT`), so the check is UX, not the security boundary.

## 6. Frontend

Route group `(auth)` (centred card shell) — [06 §1](../architecture/06-frontend-architecture.md#1-app-router-folder-structure).
All forms are the [canonical form pattern](../design-system/14-patterns.md#1-form-pattern-the-canonical-form)
(RHF + `zodResolver` over the **same `@binaryiq/types` schema** the API validates), submitting through
the typed API client which unwraps the envelope
([06 §3.3](../architecture/06-frontend-architecture.md#33-the-typed-api-client-wrapper-envelope-aware)).
Feature code lives under `apps/web/features/auth/` and composes **`@binaryiq/ui` only**.

**Pages**

| Route | Component | Notes |
|---|---|---|
| `/register` | `RegisterWizard` | 2-step [wizard pattern](../design-system/14-patterns.md#7-multi-step-flow-pattern-wizard); one `useForm`, per-step `trigger`, draft persistence, `ProgressBar` "Step N of 2". |
| `/verify` | `VerifyPage` | Two modes: "email sent" (shows the activation-email copy + resend) and "confirming" (reads `?token=`, calls `verify-email`, then redirects). |
| `/login` | `LoginForm` | Email + password; maps `401` → form `Alert` (generic), `403` locked / unverified → actionable `Alert`. |
| `/forgot-password` | `ForgotPasswordForm` | Single email field; always-success copy. |
| `/reset-password` | `ResetPasswordForm` | Reads `?token=`; new + confirm password with match rule. |

**Wizard step fields**
- **Step 1 (Identity):** `Select` Country · `Input` First Name · `Input` Surname · `DatePicker` DOB
  (≥18 rule in schema) · `RadioGroup` Gender.
- **Step 2 (Credentials):** `Input type=email` Email · `Input type=password` Password (show/hide toggle,
  strength/policy hint) · `Input` PIN Code · **Username** `Input` (auto-suggest, see below) ·
  `PhoneInput` Mobile (optional).

**Username auto-suggest UX**
- On entering Step 2, prefill Username with a server suggestion (derived from first name + surname, e.g.
  `soubhagya.k`, `soubhagya.k1`). Debounced availability check as the user edits shows an inline
  `FormField` hint: green "available" / red "taken, try `<suggestion>`". The check is advisory; the
  authoritative uniqueness verdict is the Step-2 `409 CONFLICT`, mapped back onto the username field via
  `setError` ([14 §1](../design-system/14-patterns.md#1-form-pattern-the-canonical-form)).

**Validation & error mapping**
- Client-side: Zod resolver populates field errors before submit (email format, password policy, DOB age,
  required fields, password-confirm match on reset).
- Server-side: `VALIDATION_ERROR.details[]` → `setError(field)`; `409 CONFLICT` (email/username) → field
  `Alert`/`setError`; `403`/`422` (locked, unverified, draft-expired, token-expired) → form-level inline
  `Alert` with the right recovery action (resend, restart, sign in) — never a vanishing toast
  ([14 §4](../design-system/14-patterns.md#4-toast-vs-inline-alert-feedback-pattern)).
- Success feedback: verify → `+500 pts` celebratory toast + `PointsPill` bump; reset → "Password updated"
  toast.

**Reused kit components:** `Form`/`FormField`, `Input`, `Select`, `RadioGroup`, `DatePicker`,
`PhoneInput`, `PinInput` (used if the reset link is ever swapped for an OTP code entry),
`Button` (primary = magenta; the email's pink CTA mirrors this token), `Modal`/`ConfirmModal` (logout
confirm), `ProgressBar`, `Alert`, `Toast`, `Skeleton`, `EmptyState`. No new UI components are introduced
by this module.

**Session wiring:** NextAuth `SessionProvider` in the root layout; middleware protects `(app)`/`admin`
and bounces unauthenticated users to `/login?callbackUrl=…`; access-token refresh via `POST /auth/refresh`
before expiry ([06 §8](../architecture/06-frontend-architecture.md#8-auth-on-the-client)).

## 7. Backend

`AuthModule` under `apps/api/src/modules/auth/`
([03 §1.2](../architecture/03-backend-architecture.md#12-appsapisrc-folder-tree)). Thin controller →
service owns logic + transactions ([03 §2](../architecture/03-backend-architecture.md#2-layering)).

- **`auth.controller.ts`** — the 8 public routes above, each `@Public()`, decorated with the auth
  throttle. Reads DTOs (validated by the global `ZodValidationPipe`) + cookie; delegates to `AuthService`;
  returns plain DTOs (envelope added by the global interceptor).
- **`auth.service.ts`** — registration (draft merge, uniqueness, user/profile/address create, consent),
  verification (+ points award), login (credential check, lockout, session issue), forgot/reset,
  logout. Owns all `prisma.$transaction` boundaries.
- **`token.service.ts`** — RS256 sign/verify of access + refresh (`kid`, `jti`), refresh **rotation** and
  reuse detection against the Redis allowlist, and `AuthToken` (verification/reset) create/consume with
  expiry checks.
- **Guards/decorators (shared, from `common/`):** `@Public()` opts these routes out of the global
  `AuthGuard`; the rest of the app is default-deny
  ([03 §3.6](../architecture/03-backend-architecture.md#36-auth-authguard-rolesguard-currentuser)).

**Password hashing** — `bcrypt` **cost 12** (constant-time compare); transparent re-hash on login if the
cost factor is later raised ([07 §1.1](../architecture/07-security-compliance.md#11-password-hashing)).
Password policy enforced by Zod at the boundary; rejected input never reaches the hasher.

**Token generation/validation** — RS256 access **15 min**, refresh **7 days sliding**, httpOnly cookie
scoped to `/v1/auth`; every token header carries `kid` for overlapping-key rotation
([07 §1.2–§1.4](../architecture/07-security-compliance.md#12-jwt--rs256-access--refresh-flow)).
`EMAIL_VERIFICATION` token = random UUID, 24 h; `PASSWORD_RESET` short-lived; both single-use (`used_at`),
purged by the nightly `maintenance` queue
([03 §6.2](../architecture/03-backend-architecture.md#62-scheduled-jobs-cron)).

**Lockout logic** — `failed_logins` counter + `locked_until` on `users`; 5 consecutive fails ⇒ 30-min
lock; reset on any success; layered under the 10/min IP rate limit
([07 §1.5](../architecture/07-security-compliance.md#15-account-lockout)).

**SendGrid email via the provider interface** — `AuthService` never touches the SendGrid SDK. It enqueues
through the notifications path / calls the injected `EMAIL_PROVIDER`
([03 §7](../architecture/03-backend-architecture.md#7-external-provider-abstraction)) with a
`templateId` (branded verification / password-reset templates) and `data` (`{ email, confirmUrl }`). The
concrete `SendGridProvider` binds in production; `NoopEmailProvider` in dev/test. Email send happens
**after** the DB transaction commits (no external I/O inside `$transaction`).

**Redis draft** — `RedisService` stores `reg:draft:{sessionId}` (JSON of Step-1 + partial Step-2 data,
TTL 1 h) between steps; Step 2 reads and deletes it. Refresh allowlist + rate-limit counters also live in
Redis ([04 §6](../architecture/04-database-architecture.md#6-redis-usage-not-postgres-but-part-of-the-data-layer)).

**Consent + audit** — Step 2 writes `terms`/`privacy` (and optional `marketing`) `consent_logs` with
`ip`/`ua`; auth events audit-logged per [07 §6.1](../architecture/07-security-compliance.md#61-what-is-logged).

## 8. Points / ledger rules

The **only** point movement this module makes is the **+500 `REGISTRATION_BONUS` on email verification**,
awarded through the shared `PointsService` — never by writing `points_transactions`/`points_balances`
directly ([03 §4](../architecture/03-backend-architecture.md#4-pointsservice--the-shared-ledger),
[04 §5](../architecture/04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6)).

- **Action:** `REGISTRATION_BONUS`, `direction=CREDIT`, `points=500`, `refType='user'`, `refId=userId`,
  `description='Welcome bonus'`.
- **Atomicity:** the award runs in the **same `$transaction`** as the `is_verified=true` + token-consume
  writes. If any part fails, none commits — a user is never marked verified without the credit, and never
  credited without being verified.
- **Idempotency (no double-credit on double verify):** `idempotencyKey = 'registration_bonus:{userId}'`.
  The `points_transactions.idempotency_key` unique constraint plus `PointsService.move()`'s
  short-circuit means a second `GET /auth/verify-email` (user re-clicks the link, or the email client
  pre-fetches it) returns the existing row and credits **nothing** — the endpoint is a no-op success. This
  is the module-1 instance of the platform-wide idempotency invariant
  ([04 §5 invariant 5](../architecture/04-database-architecture.md#5-points-ledger-rules-critical--reused-by-modules-1-3-5-6)).
- **Balance:** `points_balances` (cache) is updated in the same tx, so the header `PointsPill` reads 500
  immediately after verify.
- Not this module: the +100 About You credit (Phase 2) and any spend/redemption (Phase 3).

## 9. Reuse notes

- **`PointsService`** (Phase-0/shared) for the 500-pt award — no bespoke ledger code.
- **`EMAIL_PROVIDER`** interface + `SendGridProvider` for verification/reset emails — swappable/mockable.
- **`TokenService`** RS256 + refresh rotation reused by every authenticated request across the app.
- **Global** `AuthGuard`/`RolesGuard`, `ZodValidationPipe`, response interceptor, exception filter,
  request-id + audit middleware — all Phase 0; this module only adds `@Public()` routes and DTOs.
- **UI kit + patterns:** wizard, form, modal, alert/toast, and points-feedback patterns are all reused
  as-is; **no new shared component** is added
  ([13 §10](../design-system/13-components-library.md#10-rules)).
- **Shared Zod schemas** in `packages/types` (`RegisterStep1Schema`, `RegisterStep2Schema`, `LoginSchema`,
  `ForgotPasswordSchema`, `ResetPasswordSchema`, `Gender`) are the single source for client + server.
- **`user_addresses.pin_code`** captured here is *the same* postal code About You edits — no duplicate
  field (spec gap #3).

## 10. Acceptance criteria

1. A visitor can complete Step 1 → Step 2; a refresh mid-flow does not lose data (draft rehydrates from
   Redis within its 1 h TTL).
2. Submitting Step 2 creates a `User` with `is_verified=false`, `UserProfile` (with `dob_enc` encrypted),
   `UserAddress` (with `pinCode`), consent rows, and a 24 h `EMAIL_VERIFICATION` token; **no**
   `points_transactions` row exists yet.
3. The `/verify` page shows exactly **"We have sent you an activation email on [email]"**.
4. The verification email is branded (logo, 500-bonus copy) with a **pink "Confirm your registration"**
   button linking to `…/emailvalidated?token=<uuid>`.
5. Clicking a valid, unexpired token marks the user verified, awards **exactly 500** points via a single
   `REGISTRATION_BONUS` ledger row, updates the balance cache, and redirects to **About You** signed in.
6. Clicking the **same link twice** (or an already-verified user's link) leaves the balance at 500 —
   **no second credit** — and returns success.
7. An expired (>24 h) or unknown token yields a clear error state with a resend action; no crediting.
8. Passwords are stored only as **bcrypt cost-12** digests; plaintext never persisted, logged, or returned.
9. Login issues an RS256 access token (**15 min**) and sets a rotating refresh cookie
   (`HttpOnly; Secure; SameSite=Strict; Path=/v1/auth`).
10. **5 consecutive failed logins** lock the account for **30 minutes** (`403`, generic message);
    a successful login resets the counter.
11. `/auth/*` endpoints are limited to **10 req/min per IP** (`429` + `Retry-After`).
12. `forgot-password` returns an identical 200 whether or not the email exists (no enumeration);
    `reset-password` sets a new hash, consumes the token, and revokes existing refresh sessions.
13. `refresh` rotates the refresh token; presenting a rotated-out token revokes the session family and is
    audit-logged.
14. Login/logout/failed-login/lockout/refresh/password-reset are written to `audit_logs`; consent
    (`terms`,`privacy`) is captured at signup.
15. Duplicate email or username at Step 2 returns `409 CONFLICT` and surfaces on the correct field.

## 11. Tasks (ordered, PR-sized)

1. **Shared schemas** — add `RegisterStep1Schema`, `RegisterStep2Schema`, `LoginSchema`,
   `ForgotPasswordSchema`, `ResetPasswordSchema` (+ inferred types) to `packages/types`; register them in
   the DTO↔schema registry.
2. **`TokenService`** — RS256 access/refresh sign+verify (`kid`,`jti`), refresh rotation + reuse detection
   in Redis; `AuthToken` create/consume with expiry (verification 24 h, reset short). Unit tests.
3. **Email templates + provider wiring** — branded SendGrid verification + reset templates; `templateId`s
   in config; send via `EMAIL_PROVIDER` (Noop in dev/test). Confirm-URL builder for `emailvalidated?token=`.
4. **Registration backend** — `POST /register/step1` (Redis draft) + `POST /register/step2` (uniqueness,
   bcrypt-12, create User/Profile/Address, consent, verification token, enqueue email). Integration tests
   incl. draft-expiry `422` and duplicate-email `409`.
5. **Verify + points** — `GET /verify-email` in one `$transaction`: verify + consume token +
   `PointsService.award(500, idempotencyKey='registration_bonus:{userId}')`. Integration test for
   **no double-credit** on repeat calls and expired-token handling.
6. **Login / lockout** — `POST /login`, lockout counter + `locked_until`, session issue, unverified/locked
   `403`s, audit events.
7. **Logout / refresh** — `POST /logout` (revoke jti), `POST /refresh` (rotate + reuse detection).
8. **Forgot / reset** — `POST /forgot-password` (no-enumeration 200 + token) + `POST /reset-password`
   (new hash, consume, revoke sessions, audit).
9. **Username suggestion helper** — server suggestion + availability check endpoint/field.
10. **Frontend `(auth)` pages** — `RegisterWizard` (2-step, draft persistence, username auto-suggest),
    `VerifyPage`, `LoginForm`, `ForgotPasswordForm`, `ResetPasswordForm`; error mapping per §6.
11. **NextAuth + middleware wiring** — session provider, protected-route middleware, refresh-and-retry on
    401, verify-success redirect to About You with +500 toast.
12. **e2e + security checks** — Supertest across the full flow; verify rate-limit 10/min, lockout,
    envelope/error-code conformance; Phase-1 security definition-of-done
    ([07 §11](../architecture/07-security-compliance.md#11-security-checklist-per-phase-ties-to-definition-of-done)).

## 12. Test cases

**Registration (happy path)**
- `step1` valid → `200` + `sessionId`; `reg:draft:{sessionId}` present in Redis.
- `step2` valid with the `sessionId` → `201`; `User(is_verified=false)` + `UserProfile(dob_enc set)` +
  `UserAddress(pinCode)` + consent rows exist; verification `AuthToken` (24 h) created; email enqueued;
  **no** `points_transactions` row; draft key deleted.

**Duplicate email → 409**
- `step2` with an email already on a `User` → `409 CONFLICT`; no new user created; frontend maps it to the
  email field. (Same assertion for a taken **username**.)

**Verify (happy path)**
- `GET /verify-email?token=<valid>` → `200 { verified:true, pointsAwarded:500, next:'/account/about-you' }`;
  `users.is_verified=true`; `auth_tokens.used_at` set; exactly one `REGISTRATION_BONUS` row (`points=500`,
  `idempotencyKey='registration_bonus:{userId}'`); `points_balances.balance=500`.

**No double-credit on double verify**
- Call `GET /verify-email` twice with the same token (and a concurrent-race variant): second call returns
  success, **still exactly one** ledger row, balance **still 500**; `PointsService.move` idempotency
  short-circuit / unique-constraint path exercised.

**Expired / invalid token**
- Token older than 24 h → `422 UNPROCESSABLE`, not verified, no credit. Unknown token → `404 NOT_FOUND`.
  Malformed token → `400 VALIDATION_ERROR`.

**Login + lockout**
- Correct creds on a verified account → `200` access token + refresh cookie with correct flags;
  `failed_logins` reset; `last_login_at` set; `user.login` audited.
- 4 wrong attempts then a correct one → succeeds (counter reset).
- 5 wrong attempts → `403 FORBIDDEN`, `locked_until≈now+30m`, `user.login.locked` audited; a 6th attempt
  **even with correct password** stays `403` until the lock expires.
- Unverified account login → `403` with resend affordance.

**Rate limit**
- 11 auth requests within a minute from one IP → the 11th is `429 RATE_LIMITED` with `Retry-After`.

**Refresh / logout**
- Valid refresh cookie → `200` new access token, rotated refresh; reusing the **old** refresh token →
  `401` + session-family revoked + audited.
- `logout` → refresh `jti` revoked, cookie cleared, `user.logout` audited; a subsequent refresh with the
  cleared token → `401`.

**Forgot / reset flow**
- `forgot-password` for a **non-existent** email → `200` identical body, **no** token created, no email.
- `forgot-password` for a real user → `200`, `PASSWORD_RESET` token created, reset email enqueued.
- `reset-password` with a valid token → `200`; new bcrypt hash stored; token `used_at` set; all refresh
  sessions revoked; `password.reset` audited; old password no longer authenticates, new one does.
- `reset-password` with an expired/used token → `422 UNPROCESSABLE`; password unchanged.

**Security invariants**
- `users.password_hash` is a bcrypt-12 digest; the plaintext password never appears in responses or logs
  (pino redaction). `dob_enc` round-trips through AES-256-GCM (tampered ciphertext fails decrypt).

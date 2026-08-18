# 07 — Security & Compliance ⭐

The security backbone for the **Influencer Platform**. This is the authoritative doc for how we
authenticate, authorize, encrypt, validate, rate-limit, audit, and comply. Module docs and the other
architecture docs **reference** the mechanisms here rather than redefining them. If a module changes a
security control, it is amended here first.

Read alongside:
[00-project-overview](../00-project-overview.md) ·
[04-database-architecture](04-database-architecture.md) (encrypted `_enc` columns, `consent_logs`,
`audit_logs`) ·
[05-api-conventions](05-api-conventions.md) (auth, rate limiting, error codes) ·
[Influencer_Platform_Full_Breakdown §9](../Influencer_Platform_Full_Breakdown.md) (source security spec) ·
[phases/00-roadmap](../phases/00-roadmap.md) (definition-of-done).

Stack context: **Next.js** frontend, **NestJS** API (`apps/api`), **PostgreSQL 15 + Prisma**, **Redis**.
Security is a **cross-cutting concern present from Phase 0** and hardened/signed-off in Phase 9 — it is
not bolted on at the end (see [roadmap §"Cross-cutting concerns"](../phases/00-roadmap.md)).

---

## 1. Authentication

### 1.1 Password hashing

- **Algorithm:** `bcrypt`, **cost factor 12** (work factor tuned so a single hash is ≥ ~250 ms on prod
  hardware; re-evaluated annually as CPUs get faster).
- Passwords are **never** stored, logged, or returned in plaintext. Only the bcrypt digest lives in
  `users.password_hash` / `admins.password_hash` (see
  [04-database §4](04-database-architecture.md)).
- Comparison uses bcrypt's constant-time `compare` (no early-exit timing leak).
- Password policy enforced by Zod at the boundary (min length, complexity); rejected inputs never reach
  the hasher.
- If the configured cost factor increases later, hashes are **transparently upgraded on next successful
  login** (verify with old cost → re-hash with new cost).

### 1.2 JWT — RS256 access + refresh flow

| Token | Signing | Lifetime | Stored | Carries |
|---|---|---|---|---|
| **Access token** | RS256 (asymmetric) | **15 min** | In-memory on client (`Authorization: Bearer`) | `sub` (userId), `role`, `type=access`, `iat`, `exp`, `jti`, `kid` |
| **Refresh token** | RS256 (asymmetric) | 7 days (sliding) | **httpOnly, Secure, SameSite=Strict** cookie | `sub`, `type=refresh`, `jti`, `exp`, `kid` |

- **RS256 (asymmetric):** the API signs with a **private key**; verifiers use the **public key**. The
  private key never leaves the API service. This lets other services (or edge middleware) verify tokens
  without holding signing material.
- **Flow:**
  1. `POST /v1/auth/login` → validates credentials → issues access (15 min) + sets refresh cookie.
  2. Client calls APIs with `Authorization: Bearer <access>`.
  3. On `401 UNAUTHENTICATED` (expired access) → `POST /v1/auth/refresh` uses the refresh cookie to mint
     a new access token (and rotates the refresh token — see below).
  4. `POST /v1/auth/logout` → revokes the refresh `jti` and clears the cookie.
- **Refresh token rotation + reuse detection:** each refresh issues a new refresh `jti` and invalidates
  the previous one (tracked in Redis `session:{sessionId}` / a refresh allowlist keyed by `jti`).
  Presenting an already-used (rotated-out) refresh token is treated as theft → the whole session family
  is revoked and the event is audit-logged.
- The `05-api-conventions` contract (`Authorization: Bearer`, RS256, 15-min expiry, refresh cookie) is
  the same contract encoded here — this doc is its normative source.

### 1.3 Signing-key management & rotation

- Keys live as **PEM material in secrets** (env `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY`, or KMS-backed —
  see [§10 Secrets management](#10-secrets-management-dependencies-headers-incident-response)).
- Every token header carries a **`kid`**; the verifier selects the matching public key from a small
  published key set. This enables **overlapping-key rotation**: publish new key → sign with new key →
  keep old public key valid until all old tokens expire → retire old key.
- Rotation cadence: **every 90 days** and immediately on suspected compromise.

### 1.4 Session / refresh cookie flags

| Flag | Value | Why |
|---|---|---|
| `HttpOnly` | `true` | JS cannot read the refresh token → mitigates XSS token theft |
| `Secure` | `true` | Cookie only sent over HTTPS/TLS |
| `SameSite` | `Strict` | Blocks cross-site sending → CSRF defense for the refresh endpoint |
| `Path` | `/v1/auth` | Cookie scoped to auth routes only |
| `Max-Age` | refresh lifetime | Expiry aligned with token `exp` |

### 1.5 Account lockout

- **5 consecutive failed logins ⇒ 30-minute lockout** on that account.
- Backed by `users.failed_logins` (counter) and `users.locked_until` (timestamp) — see
  [04-database §4](04-database-architecture.md). Counter resets to 0 on any successful login.
- While `locked_until > now()`, login returns `403 FORBIDDEN` with a generic message (no
  account-enumeration hint). Lockout events are **audit-logged** (`user.login.locked`).
- Layered with the **10 req/min auth rate limit** ([§5](#5-rate-limiting--abuse-prevention)) so
  distributed brute force is throttled at the IP layer before it exhausts the per-account counter.

### 1.6 MFA-ready note

The identity model is **MFA-ready**: the OTP infrastructure already exists (`otp:{phone}` in Redis, 5-min
TTL — [04-database §6](04-database-architecture.md)) and the login flow is a discrete step that can
insert a second-factor challenge (TOTP or SMS/email OTP) before issuing tokens. MFA is **not** enabled in
the initial release but requires **no schema change** to turn on (add a `mfa_enabled` flag + `mfa_secret_enc`
column). Admin accounts (`admins`) are the first candidates for mandatory MFA.

---

## 2. Authorization

### 2.1 Roles

| Principal | Roles | Where |
|---|---|---|
| **Member** | (implicit member) | authenticated `users` |
| **Admin** | `AdminRole` enum: `SUPER_ADMIN`, `ADMIN`, `SUPPORT`, `DPO` | `admins.role` |

- **`SUPER_ADMIN`** — full control incl. admin management and config.
- **`ADMIN`** — content ops: create/deactivate polls, games, surveys, rewards.
- **`SUPPORT`** — support tickets and read-only member context; no config/PII export.
- **`DPO`** (Data Protection Officer) — privacy operations: consent/audit review, data-subject-rights
  fulfilment (export/erasure). This is the CERT-In/DPDP point-of-contact role
  ([§9](#9-compliance-matrix)).

### 2.2 Guard strategy

- Members: every non-public endpoint requires a valid access token (NestJS `JwtAuthGuard`); a
  `@CurrentUser()` decorator injects the principal (see
  [05-api §7](05-api-conventions.md#7-auth--authorization-patterns)).
- Admin endpoints: prefixed `/admin/...`, protected by `AdminGuard` + a `@Roles(...)` decorator checked
  by a `RolesGuard`. A `SUPPORT` admin hitting an `ADMIN`-only route gets `403 FORBIDDEN`.
- Public endpoints (login, register, verify-email, forgot/reset password) are explicitly opted out via
  a `@Public()` decorator — **default-deny**: anything not marked public requires auth.

### 2.3 Ownership enforcement

- A member may only read/mutate **their own** resources. Ownership is enforced in the **service layer**
  (not controllers): queries are always scoped by `userId = currentUser.id`; a mismatch returns
  `403 FORBIDDEN` (or `404 NOT_FOUND` where existence itself is sensitive).
- IDs are non-sequential **UUIDs** ([04-database §1](04-database-architecture.md)), so resource IDs are
  not guessable — but IDOR protection **never** relies on that; the ownership scope is the real control.
- Admin overrides (e.g. `SUPPORT` reading a member's tickets) are gated by role **and** written to
  `audit_logs` with `actorType='admin'`.

---

## 3. Encryption

### 3.1 At rest — application-layer column encryption

Sensitive PII is encrypted **in the application layer with AES-256-GCM before write** and decrypted on
read by an authorized service. Ciphertext (nonce ‖ ciphertext ‖ auth-tag, base64) is stored in `_enc`
columns, which are **not indexable/searchable in plaintext** (see
[04-database §1](04-database-architecture.md)).

| Column | Table | Data | Rationale |
|---|---|---|---|
| `phone_enc` | `users` | Phone number | Direct identifier / contact PII |
| `dob_enc` | `user_profiles` | Date of birth | Sensitive demographic; re-identification risk |
| `line1_enc` | `user_addresses` | Address line 1 | Location PII |
| `income_bracket` *(encrypted at app layer)* | `user_demographics` | Income | Financial/sensitive personal data |

> **AES-256-GCM** is authenticated encryption: it provides confidentiality **and** integrity — a tampered
> ciphertext fails the auth-tag check on decrypt and is rejected. Each value uses a **unique random 96-bit
> nonce**; nonces are never reused under a given key.

Notes:
- `pin_code` and `city` are kept plaintext for survey targeting/matching
  ([04-database §4 `Survey.targeting`](04-database-architecture.md)); they are lower-sensitivity and
  needed for coarse geo matching. DOB, phone, exact address line, and income are the high-sensitivity set.
- `paypal_accounts.paypal_email` is a financial identifier — treated as sensitive; access is restricted
  and audited even though it is not `_enc` (it must round-trip to PayPal for payouts).

### 3.2 Key management & envelope encryption

- **Key hierarchy (envelope encryption):** a **KMS-held root/Key-Encryption-Key (KEK)** wraps a
  **Data-Encryption-Key (DEK)**. Application encrypts PII with the DEK; the DEK is stored **wrapped** and
  unwrapped in memory at boot. The KEK never leaves the KMS/HSM.
- **Dev/local:** DEK supplied via `ENCRYPTION_KEY` env (32-byte, base64). **Staging/prod:** KMS-backed
  (AWS KMS / GCP KMS / equivalent) — see [§10](#10-secrets-management-dependencies-headers-incident-response).
- **Key rotation:** DEK carries a **key version/`kid`**; ciphertext is prefixed with the version so old and
  new data coexist. Rotation = introduce new DEK version → encrypt new writes with it → background
  re-encrypt job migrates old rows → retire old DEK.
- **Separation of duties:** the encryption key is a distinct secret from `DATABASE_URL` and JWT keys, so a
  DB dump alone (without the key) does not expose PII.

### 3.3 In transit

- **TLS 1.3** for all traffic (client↔edge, edge↔API, API↔DB, API↔Redis). Older protocols (TLS ≤1.1,
  SSLv3) and weak ciphers are disabled. HTTPS-only ([05-api §1](05-api-conventions.md#1-general-rules)).
- **HSTS:** `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` — forces HTTPS,
  eliminates protocol-downgrade / SSL-strip.
- Auto-renewing certificates (ACME/Let's Encrypt or managed certs); no expired-cert windows.

### 3.4 Backups

- **Database backups are AES-256 encrypted at rest**; backup storage buckets enforce
  encryption-at-rest + access logging.
- Backups are subject to the same retention/erasure obligations — see
  [§8 Data subject rights](#8-data-subject-rights).

---

## 4. Input & output security

### 4.1 Input validation (Zod)

- **Single source of truth:** Zod schemas in `packages/types` define every request/response DTO; the API
  enforces them via a `ZodValidationPipe`, and the Next.js frontend uses the **same** schemas in React
  Hook Form — no drift ([05-api §5](05-api-conventions.md#5-validation)).
- All input validated **at the boundary**; services assume valid input. Failures →
  `400 VALIDATION_ERROR` with `details[]`.
- Unknown fields are stripped (forward-compat), **except** on auth/security-sensitive schemas where we use
  strict parsing.

### 4.2 SQL injection prevention

- **Prisma parameterized queries only.** Prisma binds parameters — user input is never concatenated into
  SQL. Raw SQL (`$queryRaw`) is avoided; where unavoidable it uses the **tagged-template parameterized**
  form (`$queryRaw` with `${}` bindings), never string interpolation. Reviewed in PR.

### 4.3 Output encoding & XSS

- React escapes output by default; `dangerouslySetInnerHTML` is banned except for vetted, sanitized
  content (DOMPurify).
- **Content-Security-Policy** header set (default-deny, allowlist scripts/styles/connect):
  ```
  Content-Security-Policy:
    default-src 'self';
    script-src 'self';
    style-src 'self';
    img-src 'self' data: https:;
    connect-src 'self' https://api.*.influencerplatform.app;
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
    object-src 'none'
  ```
- API responses are JSON with `Content-Type: application/json; charset=utf-8`; the error envelope
  **never leaks internals** ([05-api §3](05-api-conventions.md#3-http-status-codes)).

### 4.4 CSRF strategy

- The primary API auth is a **`Bearer` access token in a header** (not an ambient cookie), which is
  inherently CSRF-resistant for API calls.
- The **refresh cookie** (the one ambient credential) is `SameSite=Strict` + `HttpOnly` + `Secure` and
  scoped to `/v1/auth`. For any cookie-authenticated, state-changing request we additionally apply the
  **double-submit CSRF token** pattern: a CSRF token issued to the client is echoed in an
  `X-CSRF-Token` header and validated server-side.
- CORS is a **strict allowlist** (see below), so browsers block disallowed cross-origin callers.

### 4.5 CORS

- **Allowlist only** — the app origins (Next.js web app per env) are explicitly permitted; wildcard
  origins are never used. Credentialed requests allowed only for allowlisted origins.
- Allowed methods/headers are enumerated; preflight cached briefly.

### 4.6 File-upload validation

Uploads go to a dedicated `/v1/uploads` endpoint (multipart) that returns a URL
([05-api §1](05-api-conventions.md#1-general-rules)):

- **Type:** allowlist by MIME **and** magic-byte sniffing (not just extension) — e.g. profile photos
  `image/jpeg|png|webp` only.
- **Size:** hard cap (e.g. profile photo ≤ 5 MB) enforced at the gateway and app.
- **Filename:** randomized server-side (UUID); original name never used on disk/URL.
- **Storage:** object storage (private bucket) served via signed URLs / CDN; uploads never executed.
- **Virus scan:** files are scanned (ClamAV / provider malware scan) before becoming publicly
  retrievable; failures are quarantined and audit-logged.

---

## 5. Rate limiting & abuse prevention

### 5.1 Limits

| Scope | Limit | Key | Response |
|---|---|---|---|
| **General API** | **100 req/min** | per IP | `429 RATE_LIMITED` + `Retry-After` |
| **Auth endpoints** (`/auth/*`) | **10 req/min** | per IP | `429 RATE_LIMITED` + `Retry-After` |
| **Uploads** | tighter (e.g. 10/min) | per user | `429 RATE_LIMITED` |
| **Webhooks** | provider-specific | per provider + signature | rejected if unsigned |

- Backed by Redis counters (`ratelimit:{scope}:{ip|user}` — [04-database §6](04-database-architecture.md)).
- `429` includes `Retry-After` (seconds) and the `RATE_LIMITED` code
  ([05-api §8](05-api-conventions.md#8-rate-limiting)).

### 5.2 Per-endpoint sensitive-action controls (defense-in-depth)

Rate limiting is **defense-in-depth**, not the primary control for money-adjacent actions. Business
invariants are the real guardrail:

| Action | Primary control | Backstop |
|---|---|---|
| **Spin** (`/games/*`) | Redis daily lock `spin:daily:{userId}` (one/day) | `game_plays` unique `(userId, gameId, playDate)` |
| **Vote** (`/polls/:id/vote`) | one-vote rule | `poll_votes` unique `(pollId, userId)` |
| **Redeem** (`/redemptions`) | balance check + points ledger transaction | ledger `idempotencyKey` unique (no double-spend) |
| **Register** | email uniqueness + email verification | rate limit + optional CAPTCHA |

All of these run inside the atomic points-ledger transaction ([04-database §5](04-database-architecture.md)),
so retries/races cannot double-credit or double-spend.

### 5.3 Bot & abuse mitigation

- CAPTCHA (e.g. hCaptcha/Turnstile) on registration and password-reset request when abuse signals fire.
- `Idempotency-Key` header on retriable mutations maps to the ledger key
  ([05-api §1](05-api-conventions.md#1-general-rules)).
- Anomaly signals (burst failures, many accounts per IP, impossible-travel logins) raise alerts and can
  trigger step-up challenges. Disposable-email domains blocked at registration.

---

## 6. Audit logging

### 6.1 What is logged

Audit logging is **middleware from Phase 0** — every mutating admin/user action is recorded
([roadmap §Cross-cutting](../phases/00-roadmap.md)). Logged events include:

- **Auth:** `user.login`, `user.login.failed`, `user.login.locked`, `user.logout`, `token.refresh`,
  `password.reset`.
- **Data changes:** profile/address/demographics/PayPal create/update, email change, consent changes.
- **Admin actions:** poll/survey/game/reward create/deactivate, ticket handling, config changes, any PII
  access/export by staff.
- **Points & redemptions:** redemption requests and fulfilment status changes (the ledger itself is the
  immutable financial record — [04-database §5](04-database-architecture.md)).
- **Security events:** lockouts, refresh-token reuse detection, rate-limit trips (aggregated).

Audit entries capture **who / what / when / where**: `actorType`, `actorId`, `action`, `targetType`,
`targetId`, `ipAddress`, `userAgent`, and `metadata`. Correlate with request logs via `requestId`
([05-api §12](05-api-conventions.md#12-observability)). PII is **not** written into `metadata` in
plaintext.

### 6.2 Retention (CERT-In) & integrity

- **Audit logs retained ≥ 180 days** rolling (CERT-In 2022 mandate). Logs are append-only, shipped to
  tamper-evident/WORM storage, and time-stamped against **NTP-synced** servers (CERT-In).
- Deletion of a user (DPDP erasure) does **not** delete audit rows required for compliance; audit rows
  reference `actorId` and are retained per the legal retention obligation
  ([§8](#8-data-subject-rights)).

### 6.3 `audit_logs` schema

From [04-database §4](04-database-architecture.md) (authoritative):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `actor_type` | text | `user` \| `admin` \| `system` |
| `actor_id` | uuid? | null for anonymous/system |
| `action` | text | `'user.login'`, `'poll.create'`, ... |
| `target_type` | text? | entity affected |
| `target_id` | uuid? | affected row |
| `ip_address` | text? | source IP |
| `user_agent` | text? | client UA |
| `metadata` | jsonb? | non-PII context |
| `created_at` | timestamptz | NTP-synced |

Indexed on `(actor_type, actor_id)` and `(action, created_at)`.

---

## 7. Consent & privacy

### 7.1 `consent_logs` usage

Every consent grant/withdrawal writes a row to `consent_logs`
([04-database §4](04-database-architecture.md)):

| Column | Notes |
|---|---|
| `consent_type` | `terms` \| `privacy` \| `marketing` \| `cookies` |
| `consent_version` | version string of the doc/policy consented to |
| `granted` | `true` (grant) / `false` (withdrawal) |
| `ip_address`, `user_agent` | proof-of-consent context |
| `created_at` | timestamp |

- Consent is captured at registration (terms + privacy) and per-purpose thereafter (marketing,
  notifications). **Withdrawal is a new row** (`granted=false`) — history is preserved, never overwritten,
  giving an auditable consent trail (DPDP/GDPR).
- Marketing notifications are gated on an active `marketing` consent **and**
  `notification_preferences` toggles ([04-database §4](04-database-architecture.md)).

### 7.2 Consent versions

- Policy documents are versioned. When the privacy policy/terms change materially, users are
  **re-prompted** and a new `consent_version` is recorded — so we can always prove *which version* a user
  agreed to and when.

### 7.3 Cookie consent

- A cookie-consent banner records the choice as a `cookies` consent row. Non-essential cookies/trackers
  do not load until consent is granted. Essential (auth/session) cookies are exempt and disclosed.

### 7.4 Data minimization

- Collect only what a purpose requires; the 14 profile-survey categories are **optional** and incentivized,
  not mandatory. Sensitive fields (DOB, phone, address, income) are encrypted
  ([§3](#3-encryption)) and access-scoped. Logs and analytics avoid raw PII.

---

## 8. Data subject rights

Fulfilment is owned by the **DPO** role ([§2.1](#21-roles)); requests are audit-logged.

| Right | How implemented |
|---|---|
| **Access / portability** | `GET /v1/account/export` — assembles the user's data (profile, addresses, demographics, points history, responses, votes, plays, consents) with PII **decrypted** into a **machine-readable JSON** (and CSV) bundle, delivered via a time-limited signed download. Satisfies GDPR data portability + DPDP access. |
| **Rectification** | Account tabs (Profile/Email/Password/PayPal/About You) let users correct their data; changes are validated (Zod), re-encrypted where applicable, and audit-logged. |
| **Erasure ("right to be forgotten")** | Two-stage: (1) **soft delete** — `users.deleted_at` set ([04-database §4](04-database-architecture.md)); account disabled immediately, PII access blocked, from-then-on excluded from processing. (2) **hard purge job** — a scheduled job crypto-shreds/nullifies `_enc` PII and removes/anonymizes child rows after the legal grace/retention window, keeping only what law requires (financial ledger anonymized, audit rows retained). |
| **Withdraw consent** | New `consent_logs` row (`granted=false`); downstream processing (e.g. marketing) stops. |
| **Object / restrict** | Notification preferences + consent toggles; support/DPO can flag an account as restricted. |

Notes:
- **Soft delete vs. purge:** soft delete is immediate and reversible within the grace window; purge is
  irreversible. The **append-only points ledger** and **audit logs** are retained/anonymized rather than
  deleted, because financial integrity and the 180-day audit obligation override erasure for those
  specific records (documented lawful exemption).
- Backups: purge requests are tracked so restored backups re-apply the erasure (backups are not
  indefinitely retained; rotation window documented in [§10](#10-secrets-management-dependencies-headers-incident-response)).

---

## 9. Compliance matrix

| Standard | Requirement | How met | Owner |
|---|---|---|---|
| **DPDP Act 2023** | Consent-based processing | `consent_logs` with versions + withdrawal ([§7](#7-consent--privacy)) | DPO |
| **DPDP Act 2023** | Data-principal rights (access/correction/erasure) | Export + rectification + soft-delete/purge ([§8](#8-data-subject-rights)) | DPO |
| **DPDP Act 2023** | Security safeguards for PII | AES-256-GCM at rest, TLS 1.3 in transit, bcrypt-12 ([§1](#1-authentication),[§3](#3-encryption)) | Security Eng |
| **DPDP Act 2023** | Breach notification | Incident runbook + notification workflow ([§10](#10-secrets-management-dependencies-headers-incident-response)) | DPO + Security |
| **CERT-In 2022** | Logs retained **180 days** | `audit_logs` 180-day rolling WORM retention ([§6](#6-audit-logging)) | Security Eng |
| **CERT-In 2022** | **NTP time sync** | Servers NTP-synced; audit timestamps traceable ([§6.2](#62-retention-cert-in--integrity)) | DevOps |
| **CERT-In 2022** | **6-hour breach reporting** | Report to CERT-In within 6 h of detection ([§10](#10-secrets-management-dependencies-headers-incident-response)) | DPO + Security |
| **CERT-In 2022** | Registered **POC** | Named security POC / DPO on file | DPO |
| **SSL / TLS** | HTTPS enforced + HSTS | TLS 1.3, HSTS preload, auto-renewing certs ([§3.3](#33-in-transit)) | DevOps |
| **GDPR (EU-ready)** | Consent management | Purpose-based consent + cookie consent ([§7](#7-consent--privacy)) | DPO |
| **GDPR (EU-ready)** | Data portability | `/account/export` machine-readable bundle ([§8](#8-data-subject-rights)) | DPO |
| **GDPR (EU-ready)** | Right to erasure | Soft delete + purge job ([§8](#8-data-subject-rights)) | DPO |
| **GDPR (EU-ready)** | Processor agreements | DPAs with SendGrid/Twilio/FCM/PayPal | Legal + DPO |

---

## 10. Secrets management, dependencies, headers, incident response

### 10.1 Secrets management

- No secrets in code or git. Local: `.env` (gitignored). Staging/prod: a **secrets manager** (AWS Secrets
  Manager / GCP Secret Manager / Doppler) injects at deploy.
- Managed secrets: `DATABASE_URL`/`DIRECT_URL`, `ENCRYPTION_KEY`/KMS refs, `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY`,
  Redis creds, provider keys (SendGrid/Twilio/FCM/PayPal), CSRF secret.
- Rotation on cadence and on employee offboarding / suspected compromise. Encryption key, DB creds, and
  JWT keys are **separate** secrets (separation of duties, [§3.2](#32-key-management--envelope-encryption)).

### 10.2 Dependency & code scanning

- **SCA:** `npm audit` + Dependabot/Renovate in CI; high/critical vulns block merge.
- **SAST + secret scanning:** static analysis and secret-scanning (e.g. gitleaks) on every PR.
- **Lockfiles** committed; reproducible installs.
- **Pen-test cadence:** third-party penetration test **before initial launch** and **annually**
  thereafter (plus after any major architectural change). Findings tracked to closure.

### 10.3 Security headers (set on all responses)

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `Content-Security-Policy` | see [§4.3](#43-output-encoding--xss) |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` (plus CSP `frame-ancestors 'none'`) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | minimal (deny camera/mic/geolocation unless needed) |
| `Cache-Control` | `no-store` on authenticated/PII responses |

### 10.4 Incident & breach response

1. **Detect** — alerting on anomalies, failed-login/lockout spikes, refresh-token reuse, WAF/rate-limit
   trips, dependency CVE alerts.
2. **Triage & contain** — assess scope; revoke keys/sessions (rotate JWT + encryption keys if implicated),
   isolate affected services.
3. **Report (CERT-In)** — notify **CERT-In within 6 hours** of becoming aware of a reportable incident,
   via the registered POC. Notify affected data principals per DPDP; GDPR 72-hour supervisory-authority
   notification where EU users are impacted.
4. **Eradicate & recover** — patch, restore from encrypted backups if needed, verify integrity.
5. **Post-incident** — RCA, corrective actions, update this doc and runbooks. All steps audit-logged.

- **Backup retention window:** encrypted backups retained per policy (e.g. 30 days rolling) — long enough
  for recovery, short enough that erasure obligations remain tractable ([§8](#8-data-subject-rights)).

---

## 11. Security checklist per phase (ties to Definition of Done)

Each phase's [Definition of Done](../phases/00-roadmap.md) item #6 ("Security checklist for the phase
satisfied") expands to the phase-specific items below. Security is applied continuously; **Phase 9** is
the audit/hardening/sign-off pass, not the first consideration.

| Phase | Security definition-of-done items |
|---|---|
| **0 — Foundation** | Auth scaffold with `JwtAuthGuard` + default-deny; audit-log middleware live; secrets in secrets manager; TLS/HSTS + security headers configured; CORS allowlist; Zod pipe wired; Prisma-only DB access. |
| **1 — Auth & Registration** | bcrypt-12 hashing; RS256 access/refresh + rotation; refresh cookie flags (HttpOnly/Secure/SameSite); lockout (5⇒30m); auth rate limit 10/min; consent captured at signup; login/logout/reset audit-logged. |
| **2 — Profile & Account** | `_enc` encryption for DOB/phone/address/income on write; ownership scoping on all account routes; rectification audit-logged; input validation on every profile field. |
| **3 — Points & Rewards** | Redemption balance + ledger `idempotencyKey` (no double-spend); ownership on transactions/redemptions; redemption events audited. |
| **4 — Surveys** | Ownership on responses; quota/expiry business checks; targeting uses non-sensitive fields only. |
| **5 — Polls** | One-vote enforcement (`poll_votes` unique); vote inside ledger transaction; validation on `optionIds`. |
| **6 — Games** | Server-side weighted outcome (never client-trusted); Redis daily lock + DB unique; spin credit idempotent. |
| **7 — Notifications** | Consent + preference gating; provider webhooks signature-verified; no PII in logs; provider keys in secrets. |
| **8 — Chatbot (Luna)** | Ticket ownership; output sanitized (no XSS via bot content); PII not echoed. |
| **9 — Security & Launch** | Full audit/hardening pass: pen-test complete & remediated; 180-day audit retention + NTP verified; erasure/export flows tested; breach runbook + CERT-In POC registered; dependency scan clean; DPDP/CERT-In/GDPR compliance matrix ([§9](#9-compliance-matrix)) signed off. |

---

### Cross-references

- Data model, `_enc` columns, `consent_logs`, `audit_logs`: [04-database-architecture](04-database-architecture.md)
- Auth header, error codes, rate limits, CORS/validation contract: [05-api-conventions](05-api-conventions.md)
- Source security spec: [Influencer_Platform_Full_Breakdown §9](../Influencer_Platform_Full_Breakdown.md)
- Phase gates / definition-of-done: [phases/00-roadmap](../phases/00-roadmap.md)

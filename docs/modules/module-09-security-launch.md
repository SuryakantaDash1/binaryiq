# Module 09 — Security & Launch

**Phase 9 · Weeks 11 · Depends on: all prior phases (0–8)**

The production-readiness, compliance sign-off, and launch-hardening pass. This module **introduces no
new user feature**; it *verifies, completes, tests, and signs off* everything already specified in the
authoritative security backbone, [07-security-compliance](../architecture/07-security-compliance.md).
Where 07 defines *how* a control works, this module defines the *task to prove it is live in
production, the evidence captured, and the owner accountable*.

Read alongside:
[00-project-overview §2 "Compliance-first"](../00-project-overview.md) ·
[Influencer_Platform_Full_Breakdown §9](../Influencer_Platform_Full_Breakdown.md) (source security spec) ·
[07-security-compliance](../architecture/07-security-compliance.md) ⭐ (**the doc this module executes**) ·
[04-database-architecture](../architecture/04-database-architecture.md) (`consent_logs`, `audit_logs`, `_enc` columns, `deletedAt`) ·
[05-api-conventions](../architecture/05-api-conventions.md) (envelope, error codes, auth) ·
[08-testing-strategy](../architecture/08-testing-strategy.md) (how we prove it) ·
[09-devops-cicd](../architecture/09-devops-cicd.md) (backups, retention, secrets, DR) ·
[phases/00-roadmap §"Definition of Done"](../phases/00-roadmap.md).

> **Framing.** 07 is the *specification*. This module is the *execution + audit checklist*. Every
> statement here should map to a control in 07; if a hardening step here reveals a gap in 07, **07 is
> amended first** and this module re-verifies against it. Nothing in this module redefines a mechanism —
> it confirms the mechanism exists, is enforced in production, and has evidence.

---

## 1. Overview & goal

**Goal:** reach **M4 — production-ready, compliant, launch sign-off**
([roadmap Milestones](../phases/00-roadmap.md)). Concretely:

1. **Production readiness** — a full security audit against
   [07](../architecture/07-security-compliance.md) confirms every control (auth, authZ, encryption,
   validation, rate limiting, audit, headers) is enforced in the production environment, not just coded.
2. **Regulatory compliance sign-off** — a signed [compliance matrix](#8-compliance-execution) covering
   **India DPDP Act 2023**, **CERT-In 2022**, **SSL/TLS**, and **GDPR-ready** posture, each row backed by
   verifiable evidence and an accountable owner.
3. **Data-subject-rights machinery complete** — export (portability), erasure (soft-delete + purge job),
   rectification, and consent withdrawal all work end-to-end and are audit-logged.
4. **Launch gate** — a comprehensive, testable [acceptance checklist](#10-acceptance-criteria) that must
   be green, plus the security Definition-of-Done for **all prior phases**
   ([07 §11](../architecture/07-security-compliance.md)) confirmed green.

This is the **audit/hardening/sign-off pass**, not the first time security is considered — security is a
cross-cutting concern present from Phase 0 ([roadmap §Cross-cutting](../phases/00-roadmap.md)).

---

## 2. Scope

### In scope

- **Full security audit vs [07](../architecture/07-security-compliance.md)** — line-by-line verification
  that each control is live in production; findings tracked to closure.
- **Complete audit-logging coverage audit** — confirm **every mutating** user/admin action writes an
  `audit_logs` row (100% coverage of state-changing endpoints), with correct `who/what/when/where`.
- **Consent management** — consent capture/withdrawal UI + `consent_logs` writes with `version` + `ip` +
  `userAgent`; cookie-consent banner gating non-essential trackers.
- **Data-subject-rights endpoints** — export (portability), erasure request (soft delete), rectification,
  and the **erasure purge job** (BullMQ) that crypto-shreds/nullifies `_enc` PII after the grace window.
- **Encryption verification** — confirm bcrypt-12, AES-256-GCM on all `_enc` columns, TLS 1.3 in transit,
  RS256 JWT; verify ciphertext is unreadable at rest and keys are separated from `DATABASE_URL`.
- **Rate limiting + security headers verification** — 100/min general, 10/min auth enforced; CSP, HSTS,
  and the full header set present on all responses.
- **Third-party penetration test + remediation** — pre-launch pen-test; findings tracked to closure.
- **Trust badges** — SSL/compliance badges in the footer.
- **Breach response runbook** — the CERT-In 6-hour reporting workflow, POC/DPO registered, NTP sync,
  cert auto-renew verified.
- **Backups / DR drill** — restore-test the encrypted backups; verify audit/consent tables covered.
- **Registrations** — DPDP data-fiduciary / DPBI registration and CERT-In POC on file.

### Out of scope

- **Any net-new product feature.** No new earning mechanic, no new content type, no new user journey
  beyond privacy/rights self-service.
- **Redefining security mechanisms** — those live in [07](../architecture/07-security-compliance.md);
  this module only verifies/hardens them.
- **New schema** — no data-model change is expected (see [§4](#4-data-model)); the columns needed
  (`consent_logs`, `audit_logs`, `deletedAt`, `_enc`) already exist. This module *verifies* the schema.
- **MFA rollout** — the model is MFA-ready ([07 §1.6](../architecture/07-security-compliance.md)) but MFA
  is not enabled in the initial release.

---

## 3. User / actor flows

Actors: **Member** (data principal), **DPO** (Data Protection Officer — privacy ops / CERT-In POC),
**Admin** (audit review where role permits), **System** (BullMQ purge job, cert renewer).

### 3.1 Data export (access / portability)

1. Member → Account → Privacy → **"Download my data"**.
2. Web calls `GET /v1/account/data-export`. API assembles the member's full dataset — profile, addresses,
   demographics, points history, survey/poll/game activity, consents — **decrypting `_enc` PII** into a
   machine-readable **JSON (+CSV)** bundle.
3. Bundle delivered via a **time-limited signed download URL** (not inline). Request is **audit-logged**
   (`account.data_export`).

### 3.2 Account deletion / erasure (soft delete → purge)

1. Member → Account → Privacy → **"Delete my account"** → `ConfirmModal` (irreversible-after-grace copy;
   requires re-typing confirmation).
2. `DELETE /v1/account` → **stage 1 soft delete**: set `users.deletedAt = now()`, disable the account
   immediately, revoke sessions/refresh tokens, block PII access, exclude from all processing. Audit-logged
   (`account.erasure_requested`).
3. **Stage 2 purge (System / BullMQ):** after the legal grace/retention window, the scheduled purge job
   crypto-shreds/nullifies `_enc` PII and anonymizes/removes child rows — **keeping** the append-only
   points ledger (anonymized) and the `audit_logs` rows required by the 180-day CERT-In obligation.
   Audit-logged (`account.erasure_purged`).
4. Backups: the purge is tracked so a restored backup re-applies erasure
   ([07 §8](../architecture/07-security-compliance.md)).

### 3.3 Consent capture / withdrawal

1. **Capture:** at registration (terms + privacy), at cookie banner (cookies), and per-purpose thereafter
   (marketing) — each writes a `consent_logs` row with `consentType`, `consentVersion`, `granted=true`,
   `ipAddress`, `userAgent`.
2. **Withdrawal:** member toggles a purpose off → a **new** `consent_logs` row with `granted=false`
   (history preserved, never overwritten). Downstream processing (e.g. marketing sends) stops immediately.
3. **Re-prompt:** on a material policy version change, the member is re-prompted and a new
   `consentVersion` is recorded.

### 3.4 Admin / DPO audit review

1. DPO/authorized admin → Admin → **Audit Logs**.
2. `GET /v1/admin/audit-logs` with filters (`actorType`, `action`, date range, `targetId`) and cursor
   pagination. Read-only; any staff access to member context is itself audit-logged.
3. DPO reviews consent state via `GET /v1/admin/consents` (per-user consent history for DSAR fulfilment).

---

## 4. Data model

**No schema change is expected in this phase.** Every table/column needed already exists in
[04-database-architecture §4](../architecture/04-database-architecture.md). This module's data-model work
is **verification**, not migration.

| Model / column | Purpose in this phase | Verify |
|---|---|---|
| `consent_logs` (`consentType`, `consentVersion`, `granted`, `ipAddress`, `userAgent`, `createdAt`) | Auditable consent trail; withdrawal = new row | Every grant/withdraw writes a row; **history never overwritten**; version + ip captured. Index `(userId, consentType)` present. |
| `audit_logs` (`actorType`, `actorId`, `action`, `targetType`, `targetId`, `ipAddress`, `userAgent`, `metadata`, `createdAt`) | Who/what/when/where for every mutating action | Append-only; **no PII in `metadata`**; indexes `(actorType, actorId)` and `(action, createdAt)`; `createdAt` NTP-synced. |
| `users.deletedAt` (`deleted_at timestamptz?`) | Stage-1 soft delete (DPDP erasure) | Setting it disables the account and excludes it from all queries (global soft-delete filter). Reversible within grace window. |
| `_enc` columns — `users.phoneEnc`, `user_profiles.dobEnc`, `user_addresses.line1Enc`, `user_demographics.incomeBracket` (app-encrypted) | AES-256-GCM PII at rest | Ciphertext (nonce‖ct‖tag, base64) unreadable in a raw DB dump; decrypts only via the encryption service with the key. |
| `points_transactions` (append-only ledger) | Financial record retained through erasure | Purge **anonymizes**, never deletes — lawful exemption ([07 §8](../architecture/07-security-compliance.md)). |
| `admins.role` (`SUPER_ADMIN`/`ADMIN`/`SUPPORT`/`DPO`) | Gate audit/consent/DSAR endpoints | `DPO` role fulfils rights; `SUPPORT` cannot export PII. |

**Retention:** `audit_logs` and `consent_logs` retained **≥ 180 days** rolling (CERT-In 2022), append-only,
covered by encrypted backups ([09 §8, §10](../architecture/09-devops-cicd.md)). DPDP erasure of a user does
**not** delete these compliance rows.

---

## 5. API contracts

All endpoints follow the [05-api-conventions](../architecture/05-api-conventions.md) envelope
(`{ data, error, meta }`), error codes, `Bearer` auth, and pagination. Base: `/v1`. Every endpoint below
is **audit-logged**.

> **`GET /v1/account/data-export`** — data portability / access request
> - **Auth:** member (self only)
> - **Query:** `format?=json|csv` (default `json`; bundle always includes both)
> - **200:** `{ data: { downloadUrl, expiresAt } }` — time-limited signed URL to a bundle of profile,
>   addresses, demographics, points history, survey/poll/game activity, consents, with PII **decrypted**.
> - **Errors:** `401 UNAUTHENTICATED` · `429 RATE_LIMITED` (tight per-user limit — abuse guard)
> - **Side effects:** generates bundle; writes `audit_logs` `account.data_export`.

> **`DELETE /v1/account`** — erasure request (right to be forgotten, stage 1)
> - **Auth:** member (self only)
> - **Body:** `{ confirm: "DELETE" }` (Zod: `AccountErasureInput`, strict)
> - **200:** `{ data: { status: "SOFT_DELETED", purgeEligibleAt } }`
> - **Errors:** `400 VALIDATION_ERROR` (confirm mismatch) · `401 UNAUTHENTICATED`
> - **Side effects:** sets `users.deletedAt`, disables account, revokes sessions + refresh tokens,
>   enqueues BullMQ purge for after the grace window; writes `audit_logs` `account.erasure_requested`.

> **`POST /v1/consents`** — grant or withdraw a consent
> - **Auth:** member (self); cookie-consent grant may be pre-auth for the `cookies` type
> - **Body:** `{ consentType: "terms"|"privacy"|"marketing"|"cookies", consentVersion: string, granted: boolean }`
>   (Zod: `ConsentInput`)
> - **201:** `{ data: ConsentLog }` — the newly appended row (withdrawal = new `granted:false` row)
> - **Errors:** `400 VALIDATION_ERROR` · `401 UNAUTHENTICATED` (for non-cookie types)
> - **Side effects:** inserts `consent_logs` (captures `ipAddress`, `userAgent` server-side); withdrawing
>   `marketing` immediately suppresses marketing sends; writes `audit_logs` `consent.change`.

> **`GET /v1/consents`** — current consent state + history for the member
> - **Auth:** member (self only)
> - **200:** `{ data: { current: {type→granted}, history: ConsentLog[] } }`
> - **Errors:** `401 UNAUTHENTICATED`

> **`GET /v1/admin/audit-logs`** — audit review (admin)
> - **Auth:** admin — `SUPER_ADMIN` | `DPO` (read); `AdminGuard` + `@Roles`
> - **Query:** `actorType?`, `actorId?`, `action?`, `targetType?`, `targetId?`, `from?`, `to?`,
>   `limit?≤100`, `cursor?`
> - **200:** `{ data: AuditLog[], meta.pagination.nextCursor }`
> - **Errors:** `401 UNAUTHENTICATED` · `403 FORBIDDEN` (wrong role) · `400 VALIDATION_ERROR`

> **`GET /v1/admin/consents`** — consent oversight for DSAR fulfilment (admin)
> - **Auth:** admin — `DPO` (and `SUPER_ADMIN`)
> - **Query:** `userId?`, `consentType?`, `from?`, `to?`, `limit?≤100`, `cursor?`
> - **200:** `{ data: ConsentLog[], meta.pagination.nextCursor }`
> - **Errors:** `401 UNAUTHENTICATED` · `403 FORBIDDEN`

> **Rectification** reuses the existing account tabs from
> [module-02](module-02-profile-account.md) (`PATCH /v1/account/*`) — corrections are Zod-validated,
> re-encrypted where applicable, and audit-logged. No new endpoint needed; verified here.

---

## 6. Frontend

All UI uses shared components/tokens ([13-components](../design-system/13-components-library.md),
[11-color](../design-system/11-color-system.md)) — no one-off modals or colors.

- **Privacy / consent centre** (Account → Privacy): purpose-based consent toggles (marketing,
  notifications) that call `POST /v1/consents` and reflect current state from `GET /v1/consents`.
- **Cookie-consent banner:** on first visit, records the choice as a `cookies` consent row.
  **Non-essential cookies/trackers do not load until consent is granted**; essential (auth/session)
  cookies are exempt and disclosed.
- **Notification / marketing consent:** integrates with notification preferences
  ([module-07](module-07-notifications.md)) — marketing sends require an active `marketing` consent **and**
  the channel preference on.
- **"Download my data":** button → calls `GET /v1/account/data-export` → shows progress → surfaces the
  signed download link.
- **"Delete my account":** button → **`ConfirmModal`** with irreversible-after-grace copy and a
  type-to-confirm field → `DELETE /v1/account` → signs the user out.
- **Trust badges (footer):** SSL/HTTPS-secured and DPDP/compliance badges rendered from the shared footer
  component, reinforcing the security posture to members.
- **Admin audit view:** filterable, cursor-paginated table backed by `GET /v1/admin/audit-logs`
  (DPO/super-admin only); consent oversight table backed by `GET /v1/admin/consents`.

---

## 7. Backend

- **Audit-logging middleware coverage audit.** The audit interceptor/middleware exists from Phase 0
  ([07 §6](../architecture/07-security-compliance.md)). This phase **audits its coverage**: enumerate every
  mutating endpoint (all `POST`/`PATCH`/`PUT`/`DELETE` and admin actions) and assert each emits an
  `audit_logs` row with correct `actorType/actorId/action/targetType/targetId/ipAddress/userAgent` and
  **no plaintext PII** in `metadata`. Gaps are remediated to reach **100%** coverage.
- **`DataRightsModule`** (owned by DPO role) —
  - **Export service:** assembles + decrypts the full user dataset into JSON/CSV, writes to private object
    storage, returns a signed URL.
  - **Erasure service:** stage-1 soft delete (`deletedAt`, session revoke) + enqueues the purge job.
  - **Rectification:** delegates to existing account services; verifies re-encryption + audit.
- **Erasure purge job (BullMQ).** A scheduled worker that, after the grace window, crypto-shreds/nullifies
  `_enc` PII, anonymizes/removes child rows, **anonymizes** the points ledger, and **retains** audit rows.
  Idempotent; every purge audit-logged. Purge requests tracked so restored backups re-apply erasure.
- **Consent service.** Append-only writes to `consent_logs` (grant/withdraw = new row), captures ip/UA
  server-side, exposes current-state + history; withdrawing `marketing` flips the suppression check used by
  [module-07](module-07-notifications.md).
- **Security-header middleware.** Verify the global middleware sets the full header set on **all**
  responses: `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, and `Cache-Control: no-store` on
  authenticated/PII responses ([07 §10.3](../architecture/07-security-compliance.md)).
- **Encryption service verification.** Confirm every `_enc` column round-trips through the AES-256-GCM
  encryption service (unique 96-bit nonce per value, auth-tag verified on read, key-version prefix), that
  the DEK is KMS-wrapped in staging/prod and separate from `DATABASE_URL`/JWT keys, and that a raw DB dump
  yields only ciphertext.
- **Global soft-delete filter.** Confirm all member queries exclude `deletedAt IS NOT NULL` so a
  soft-deleted account is invisible platform-wide immediately.

---

## 8. Compliance execution

Each requirement maps to a concrete task, verification evidence, an owner, and a status. This is the
signed matrix for launch. It executes [07 §9](../architecture/07-security-compliance.md).

| Standard | Requirement | Concrete task | Verification evidence | Owner | Status |
|---|---|---|---|---|---|
| **DPDP 2023** | Consent-based processing | Ship consent centre + cookie banner; `consent_logs` writes w/ version+ip | Test: withdrawal appends `granted=false` row; marketing suppressed; screenshots + `consent_logs` query | DPO | ☐ |
| **DPDP 2023** | Data-principal rights (access) | `GET /account/data-export` returns full decrypted bundle | Downloaded bundle diffed against DB for a seeded user | DPO | ☐ |
| **DPDP 2023** | Data-principal rights (erasure) | `DELETE /account` soft delete + BullMQ purge | e2e: account disabled immediately; post-purge `_enc` = null, ledger anonymized, audit retained | DPO | ☐ |
| **DPDP 2023** | Data-principal rights (correction) | Account-tab rectification re-encrypts + audits | Integration test: edit DOB → new ciphertext + `audit_logs` row | DPO | ☐ |
| **DPDP 2023** | Security safeguards for PII | Verify bcrypt-12, AES-256-GCM, TLS 1.3 | Encryption verification report ([§7](#7-backend)); raw dump shows ciphertext only | Security Eng | ☐ |
| **DPDP 2023** | Breach notification | Publish [breach runbook](#81-breach-response-runbook); notify principals workflow | Runbook doc + tabletop drill record | DPO + Security | ☐ |
| **DPDP 2023** | Data-fiduciary / DPBI registration | Register data fiduciary; name DPO | Registration reference on file | DPO + Legal | ☐ |
| **CERT-In 2022** | Logs retained **180 days** | Confirm `audit_logs` 180-day rolling retention + backup coverage | Retention config + backup manifest; oldest-row age check | Security Eng | ☐ |
| **CERT-In 2022** | **NTP time sync** | Enable NTP on all servers | NTP status output; audit `createdAt` traceable to synced clock | DevOps | ☐ |
| **CERT-In 2022** | **6-hour breach reporting** | Runbook step reports to CERT-In within 6h via POC | Runbook §; drill timestamped ≤ 6h | DPO + Security | ☐ |
| **CERT-In 2022** | Registered **POC** | File named security POC / DPO with CERT-In | POC acknowledgement on file | DPO | ☐ |
| **SSL / TLS** | HTTPS + HSTS + auto-renew | Enforce TLS 1.3, HSTS preload, ACME auto-renew | SSL Labs A+ report; HSTS header present; cert expiry monitor + renewal log | DevOps | ☐ |
| **GDPR-ready** | Consent management | Purpose-based + cookie consent (same as DPDP) | Consent centre tests | DPO | ☐ |
| **GDPR-ready** | Data portability | `/account/data-export` machine-readable bundle | Bundle validates against schema (JSON+CSV) | DPO | ☐ |
| **GDPR-ready** | Right to erasure | Soft delete + purge (same as DPDP) | Erasure e2e | DPO | ☐ |
| **GDPR-ready** | Processor agreements (DPA) | Sign DPAs with SendGrid/Twilio/FCM/WhatsApp/PayPal | Countersigned DPAs on file | Legal + DPO | ☐ |

### 8.1 Breach-response runbook

Executes [07 §10.4](../architecture/07-security-compliance.md). The **6-hour CERT-In clock** starts at
*awareness* of a reportable incident.

1. **Detect** — alerts on failed-login/lockout spikes, refresh-token reuse, rate-limit/WAF trips,
   dependency CVEs, Sentry anomalies ([09 §8](../architecture/09-devops-cicd.md)).
2. **Triage & contain** (target: within 1h) — assess scope; revoke sessions; **rotate JWT + encryption
   keys** if implicated (versioned keys keep old data decryptable); isolate affected services.
3. **Report — CERT-In within 6 hours** of awareness, via the **registered POC/DPO**. Notify affected data
   principals per DPDP; GDPR 72-hour supervisory-authority notification where EU users are impacted.
4. **Eradicate & recover** — patch; restore from **encrypted backups** if needed
   ([09 §10 DR](../architecture/09-devops-cicd.md)); verify integrity; **reconcile the points ledger**.
5. **Post-incident** — RCA, corrective actions, update runbook + [07](../architecture/07-security-compliance.md).
   All steps audit-logged.

### 8.2 Time sync & certificate automation

- **NTP sync:** all servers NTP-synced so `audit_logs.createdAt` timestamps are traceable/tamper-evident
  (CERT-In). Verified via server NTP status.
- **Cert auto-renew:** ACME/managed certificates auto-renew with monitoring; **no expired-cert window**.
  Expiry alert wired; renewal logged.

---

## 9. Reuse notes

- **No new mechanisms.** Every control is defined in
  [07-security-compliance](../architecture/07-security-compliance.md); this module reuses and verifies it.
- **Audit middleware** — reuse the Phase-0 interceptor; only add coverage where the audit finds gaps.
- **Envelope, errors, auth, pagination** — the new endpoints reuse
  [05-api-conventions](../architecture/05-api-conventions.md) verbatim; no bespoke response shapes.
- **Encryption service** — reuse the existing AES-256-GCM service from
  [module-02](module-02-profile-account.md); do not write a second crypto path.
- **Consent gating** — reuse the marketing-suppression check consumed by
  [module-07](module-07-notifications.md); consent withdrawal flips the same flag.
- **Soft delete** — `users.deletedAt` already exists ([04 §4](../architecture/04-database-architecture.md));
  reuse the global soft-delete query filter.
- **BullMQ** — reuse the existing queue/worker infra used by notifications for the purge job.
- **Backups/DR** — reuse the [09](../architecture/09-devops-cicd.md) backup + quarterly restore-drill
  process; this phase runs the drill, it does not build a new one.
- **UI** — reuse `ConfirmModal`, form inputs, footer, and admin table from the design system; no new
  components.

---

## 10. Acceptance criteria

The launch/security checklist. **Every item is testable and must be green** before sign-off (M4).

**Encryption & transport**
- [ ] Password hashing is **bcrypt cost-factor 12**; no plaintext password stored/logged/returned.
- [ ] All `_enc` columns (`phoneEnc`, `dobEnc`, `line1Enc`, income) are **AES-256-GCM**; a raw DB dump
      shows **ciphertext only** (unreadable at rest).
- [ ] Encryption key is a **separate secret** from `DATABASE_URL`/JWT keys; KMS-wrapped in staging/prod.
- [ ] **TLS 1.3** enforced end-to-end; older protocols/weak ciphers disabled; **HSTS** header present
      (`max-age=63072000; includeSubDomains; preload`).
- [ ] Certificates **auto-renew**; expiry monitored; no expired-cert window.
- [ ] JWTs are **RS256**; access 15-min, refresh cookie `HttpOnly`/`Secure`/`SameSite=Strict`.

**Audit & consent**
- [ ] **100% of mutating actions** (user + admin) write an `audit_logs` row with correct
      who/what/when/where and **no plaintext PII** in `metadata`.
- [ ] `audit_logs` + `consent_logs` retention **≥ 180 days**, append-only, backup-covered; servers
      **NTP-synced**.
- [ ] Consent grant/withdraw writes a `consent_logs` row with **`consentVersion` + `ipAddress`**;
      withdrawal is a **new row** (history never overwritten).
- [ ] Cookie banner blocks **non-essential trackers until consent**; essential cookies disclosed.

**Data-subject rights**
- [ ] **Export** returns the member's **complete** data (all listed entities) with PII decrypted, as
      JSON+CSV via a time-limited signed link.
- [ ] **Erasure** works end-to-end: soft delete disables the account immediately; the **purge job**
      nullifies `_enc` PII, anonymizes the ledger, and **retains** audit rows.
- [ ] **Rectification** re-encrypts and audit-logs corrections.
- [ ] Withdrawing **marketing** consent suppresses marketing sends.

**Access control & abuse**
- [ ] Rate limits enforced: **100/min general, 10/min auth**; `429 RATE_LIMITED` + `Retry-After`.
- [ ] Account lockout: **5 failed logins ⇒ 30-min lockout**, audit-logged.
- [ ] Unauthorized access to `/admin/audit-logs` / `/admin/consents` returns **403** (role-gated).
- [ ] Ownership enforced: a member cannot export/delete/read another member's data.
- [ ] **CORS allowlist** only; **CSRF** double-submit on cookie-auth state changes.

**Headers & hardening**
- [ ] All responses carry **CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy,
      Permissions-Policy**; `Cache-Control: no-store` on authenticated/PII responses.
- [ ] **Zod validation** at every boundary; **Prisma parameterized** queries only (no raw string SQL).

**Ops & compliance**
- [ ] Third-party **pen-test complete**; all findings **remediated** (or risk-accepted with owner+date).
- [ ] Dependency/secret scan (SCA/SAST/gitleaks) **clean**; high/critical block merge.
- [ ] **Backups restore-tested** (quarterly drill): restore + migrate + smoke + ledger integrity verified.
- [ ] **DPDP/CERT-In registrations** filed (data fiduciary/DPBI, CERT-In POC); **DPAs** signed with all
      processors.
- [ ] **Breach runbook** published; **6-hour CERT-In** reporting drilled.
- [ ] **[Compliance matrix §8](#8-compliance-execution) signed off** (all rows green, owners assigned).
- [ ] **All prior phases' security checklists** ([07 §11](../architecture/07-security-compliance.md)) are
      green.

---

## 11. Tasks (ordered)

1. **Kickoff audit.** Walk [07](../architecture/07-security-compliance.md) top-to-bottom against
   production; log every gap as a tracked finding with owner.
2. **Verify encryption.** Confirm bcrypt-12, AES-256-GCM on all `_enc` columns, TLS 1.3, RS256; produce the
   raw-dump-is-ciphertext evidence; confirm key separation + KMS wrap.
3. **Verify headers + CORS + CSRF + rate limits.** Assert the full header set, allowlist CORS, double-submit
   CSRF, and 100/10-per-min limits are live; capture evidence.
4. **Audit-logging coverage sweep.** Enumerate all mutating endpoints; add missing audit emissions to reach
   100%; assert no PII in `metadata`.
5. **Build `DataRightsModule`.** Export service (assemble+decrypt+signed URL); erasure service (soft delete
   + session revoke + enqueue).
6. **Build erasure purge job (BullMQ).** Crypto-shred `_enc`, anonymize child rows + ledger, retain audit;
   make idempotent; audit-log.
7. **Consent service + UI.** Append-only writes with version/ip; consent centre + cookie banner; wire
   marketing suppression.
8. **Admin audit/consent views.** `GET /admin/audit-logs` + `GET /admin/consents` with filters, pagination,
   role gating; frontend tables.
9. **Trust badges** in the footer.
10. **NTP sync + cert auto-renew.** Enable/verify NTP; confirm ACME renewal + expiry monitoring.
11. **Backups / DR drill.** Run a restore drill; verify audit/consent coverage + ledger integrity.
12. **Penetration test.** Commission third-party pen-test; triage + remediate; re-test.
13. **Dependency/secret scan.** Ensure SCA/SAST/gitleaks clean; resolve high/critical.
14. **Breach runbook + registrations.** Publish runbook; run a tabletop drill; file DPDP/DPBI + CERT-In POC;
    sign DPAs.
15. **Sign-off.** Fill the [compliance matrix §8](#8-compliance-execution); confirm all prior-phase security
    checklists green; obtain M4 launch sign-off.

---

## 12. Test cases

Per [08-testing-strategy](../architecture/08-testing-strategy.md): logic at unit, constraints/DB at
integration (Testcontainers Postgres), journeys at e2e (Playwright); providers mocked at the interface.

| # | Test | Layer | Assert |
|---|---|---|---|
| T1 | **Erasure purges PII** | integration | After soft delete + running the purge job, all `_enc` columns for the user are null/shredded, child rows anonymized/removed, ledger **anonymized (not deleted)**, `audit_logs` rows **retained**. |
| T2 | **Export returns all user data** | integration + e2e | `GET /account/data-export` bundle contains every entity (profile/addresses/demographics/points/surveys/polls/games/consents) with PII **decrypted**; JSON+CSV validate against schema; delivered via signed URL. |
| T3 | **Unauthorized audit access blocked** | integration | Member token → `/admin/audit-logs` = **403**; `SUPPORT` role = **403**; `DPO`/`SUPER_ADMIN` = 200. |
| T4 | **Security headers present** | integration (Supertest) | Every response carries CSP, HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy; PII responses carry `Cache-Control: no-store`. |
| T5 | **Rate limit returns 429** | integration | Exceeding 100/min (general) and 10/min (auth) yields **429 `RATE_LIMITED`** with `Retry-After`. |
| T6 | **Encrypted columns unreadable at rest** | integration | Read the raw stored value of an `_enc` column directly (bypassing the service); assert it is **not** the plaintext (base64 nonce‖ct‖tag) and decrypts only via the encryption service. |
| T7 | **Consent withdrawal suppresses marketing** | unit + integration | Withdraw `marketing` → new `consent_logs` `granted=false` row; a subsequent marketing dispatch produces **zero** provider calls (asserted on the interface fake) and no `notifications` row. |
| T8 | **Consent logged with version + ip** | integration | `POST /consents` writes a row with the sent `consentVersion` and the request `ipAddress`/`userAgent` captured server-side. |
| T9 | **Soft delete hides account immediately** | integration | After `DELETE /account`, the user's sessions/refresh tokens are revoked and all member queries exclude the account (global soft-delete filter). |
| T10 | **Audit coverage** | integration | A representative mutating action on each domain writes an `audit_logs` row with correct `action`/`actorId`/`targetId` and **no plaintext PII** in `metadata`. |
| T11 | **Erasure keeps compliance rows** | integration | Post-purge, the user's `audit_logs` and ledger-derived financial rows still exist (anonymized), satisfying the 180-day/financial exemption. |
| T12 | **Backup restore drill** | ops/manual | Restore latest encrypted backup into a throwaway env; migrate; smoke; verify `audit_logs`/`consent_logs` present and `balance == Σ ledger`. |

---

### Cross-references

- **Authoritative security spec (this module executes it):** [07-security-compliance](../architecture/07-security-compliance.md)
- **Schema — `consent_logs`, `audit_logs`, `_enc`, `deletedAt`:** [04-database-architecture](../architecture/04-database-architecture.md)
- **API envelope / errors / auth:** [05-api-conventions](../architecture/05-api-conventions.md)
- **Test layering & gates:** [08-testing-strategy](../architecture/08-testing-strategy.md)
- **Backups, retention, secrets, DR:** [09-devops-cicd](../architecture/09-devops-cicd.md)
- **Source security spec:** [Influencer_Platform_Full_Breakdown §9](../Influencer_Platform_Full_Breakdown.md)
- **Phase gates / Definition of Done / M4:** [phases/00-roadmap](../phases/00-roadmap.md)
</content>
</invoke>

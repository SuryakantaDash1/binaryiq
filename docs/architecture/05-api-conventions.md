# 05 — API Conventions ⭐

The contract every endpoint follows. Module docs specify *which* endpoints exist and their DTOs; the
**shape, envelope, errors, auth, and pagination rules live here** and are not repeated per module.

Base URL: `https://api.<env>.influencerplatform.app/v1` — served by the NestJS app (`apps/api`).
The Next.js frontend calls the API via a typed client generated from `packages/types`.

---

## 1. General rules

- **REST + JSON.** Resource-oriented paths, plural nouns: `/polls`, `/surveys`, `/rewards`.
- **Versioning** in the path: `/v1/...`. Breaking changes → `/v2`.
- **HTTPS only.** TLS 1.3. HSTS enforced.
- **Auth** via `Authorization: Bearer <accessToken>` (JWT, RS256, 15-min expiry). Refresh via
  `POST /v1/auth/refresh` (refresh token in httpOnly secure cookie). See
  [07-security-compliance.md](07-security-compliance.md).
- **Content type** `application/json; charset=utf-8`. File uploads use multipart to a dedicated
  `/uploads` endpoint that returns a URL.
- **Idempotency**: mutating endpoints that can be safely retried accept an `Idempotency-Key` header;
  the server maps it to the ledger `idempotencyKey` where relevant.
- **Time** is ISO-8601 UTC (`2026-08-13T10:00:00Z`). Never send local time.
- **IDs** are UUIDv4 strings.
- **Points** are integers; INR value is computed client-side (`points / 100`), never sent as money.

## 2. Response envelope (always)

Every response — success or error — uses the same top-level shape:

```jsonc
// success
{
  "data": { /* resource or list */ },
  "error": null,
  "meta": { "requestId": "req_...", "timestamp": "2026-08-13T10:00:00Z" }
}
```
```jsonc
// list with pagination
{
  "data": [ /* items */ ],
  "error": null,
  "meta": {
    "requestId": "req_...",
    "pagination": { "nextCursor": "eyJpZCI6...", "hasMore": true, "limit": 20 }
  }
}
```
```jsonc
// error
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "email must be a valid email",
    "details": [ { "field": "email", "issue": "invalid_format" } ]
  },
  "meta": { "requestId": "req_...", "timestamp": "..." }
}
```

Implemented once via a NestJS **global response interceptor** (wraps `data`) and a **global exception
filter** (formats `error`). Controllers return plain DTOs; they never build the envelope themselves.

## 3. HTTP status codes

| Code | Use |
|---|---|
| 200 | Successful GET/PUT/PATCH |
| 201 | Resource created (POST) |
| 204 | Success, no body (rare; prefer 200 with `data`) |
| 400 | Validation error (`VALIDATION_ERROR`) |
| 401 | Missing/invalid/expired token (`UNAUTHENTICATED`) |
| 403 | Authenticated but not allowed (`FORBIDDEN`) |
| 404 | Resource not found (`NOT_FOUND`) |
| 409 | Conflict — duplicate vote, already spun, email taken (`CONFLICT`) |
| 422 | Semantically invalid (e.g. insufficient points) (`UNPROCESSABLE`) |
| 429 | Rate limited (`RATE_LIMITED`) — includes `Retry-After` |
| 500 | Unexpected (`INTERNAL_ERROR`) — never leaks internals |

## 4. Canonical error codes

| `error.code` | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Zod/DTO validation failed; `details[]` lists fields |
| `UNAUTHENTICATED` | 401 | No/invalid session |
| `FORBIDDEN` | 403 | Role/ownership check failed |
| `NOT_FOUND` | 404 | Unknown id |
| `CONFLICT` | 409 | Uniqueness/state conflict (already voted, already spun, email exists) |
| `UNPROCESSABLE` | 422 | Business rule (insufficient balance, survey full/expired) |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server fault |

Domain-specific sub-cases are expressed via `message` + `details`, not new top-level codes, so clients
switch on a small stable set.

## 5. Validation

- **Single source of truth**: Zod schemas in `packages/types` define request/response DTOs. The API uses
  them via a `ZodValidationPipe`; the frontend uses the *same* schemas in React Hook Form. No drift.
- All input validated at the boundary; services assume valid input.
- Unknown fields are stripped, not rejected (forward-compat), except where strictness matters (auth).

## 6. Pagination, filtering, sorting

- **Cursor pagination** for large/append-only lists (points history, notifications, votes):
  `GET /points/transactions?limit=20&cursor=<opaque>`. Response `meta.pagination.nextCursor`.
- **Offset pagination** allowed for small admin tables: `?page=1&pageSize=20`.
- **Filtering** via explicit query params (`?status=active&type=PREMIUM`), never raw SQL-ish strings.
- **Sorting** via `?sort=createdAt&order=desc` from an allow-list per endpoint.
- Default `limit` = 20, max = 100.

## 7. Auth & authorization patterns

- Public endpoints: registration, login, verify-email, forgot/reset password.
- Member endpoints: everything under authenticated `Bearer` token; ownership enforced (a user can only
  read/mutate their own resources).
- Admin endpoints: prefixed `/admin/...`, protected by an `AdminGuard` + role check
  (`SUPER_ADMIN`/`ADMIN`/`SUPPORT`/`DPO`).
- Guards + a `@CurrentUser()` decorator inject the authenticated principal. Ownership checks live in
  services, not controllers.

## 8. Rate limiting

- Global: 100 req/min per IP. Auth endpoints: 10 req/min per IP.
- Sensitive actions (spin, vote, redeem) additionally guarded by business rules (daily lock, one-vote,
  balance) so rate limiting is defense-in-depth, not the primary control.
- 429 responses include `Retry-After` (seconds) and `RATE_LIMITED` code.

## 9. Standard endpoint catalogue (index; details in module docs)

| Area | Prefix | Module doc |
|---|---|---|
| Auth | `/auth/*` | [module-01](../modules/module-01-auth-registration.md) |
| Account & profile | `/account/*`, `/profile-surveys/*` | [module-02](../modules/module-02-profile-account.md) |
| Points & rewards | `/points/*`, `/rewards/*`, `/redemptions/*` | [module-03](../modules/module-03-points-rewards.md) |
| Surveys | `/surveys/*` | [module-04](../modules/module-04-surveys.md) |
| Polls | `/polls/*` | [module-05](../modules/module-05-polls.md) |
| Games | `/games/*` | [module-06](../modules/module-06-games.md) |
| Notifications | `/notifications/*`, `/notification-preferences/*` | [module-07](../modules/module-07-notifications.md) |
| Support/Chatbot | `/support/*`, `/chatbot/*` | [module-08](../modules/module-08-chatbot-luna.md) |
| Admin | `/admin/*` | respective module docs |

## 10. Example: a mutating endpoint spec (template)

Module docs describe endpoints in this exact format:

> **`POST /v1/polls/:id/vote`** — cast a vote
> - **Auth:** member
> - **Path:** `id` (uuid)
> - **Body:** `{ optionIds: string[] }` (Zod: `VoteInput`)
> - **200:** `{ data: PollResult }` (percentages, user's choice, points awarded)
> - **Errors:** `409 CONFLICT` already voted · `422 UNPROCESSABLE` poll expired/inactive ·
>   `404 NOT_FOUND` unknown poll · `400 VALIDATION_ERROR`
> - **Side effects:** inserts `poll_votes`, increments counters, awards 15 pts via `PointsService`
>   (one transaction), decrements homepage unvoted count.

## 11. Webhooks & external callbacks

- SendGrid (email events), Twilio (delivery/OTP), PayPal (payout status) post to
  `/v1/webhooks/{provider}`. Verified by signature; processed idempotently; update `notifications` /
  `reward_redemptions` accordingly. Never trust webhook body without signature verification.

## 12. Observability

- Every request gets a `requestId` (returned in `meta`) and is structured-logged.
- Correlate logs, audit entries, and errors by `requestId`. See
  [09-devops-cicd.md](09-devops-cicd.md).

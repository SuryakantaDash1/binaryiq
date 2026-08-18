# Module 07 — Notifications ⭐

**Phase 7** · Week 9 · Depends on: Phase 1 (auth hooks; minimal verification email scaffolded in
Phase 0/1). See [phases/00-roadmap.md](../phases/00-roadmap.md).

This is the module doc for the **cross-cutting notification service**: a unified, preference-aware,
multi-channel dispatch pipeline plus an in-app notification center. It builds on the backbone rather
than restating it:

- Data model (Notification / NotificationPreference / PushToken, enums) →
  [architecture/04-database-architecture.md §4](../architecture/04-database-architecture.md#4-prisma-schema-authoritative).
  The Prisma schema there is authoritative; this doc references it.
- Provider interfaces, `ProvidersModule`, BullMQ queues, the `NotificationProcessor` →
  [architecture/03-backend-architecture.md §6–§7](../architecture/03-backend-architecture.md#6-background-jobs--queues).
- HTTP envelope, error codes, auth, cursor pagination, webhooks →
  [architecture/05-api-conventions.md](../architecture/05-api-conventions.md).
- Frontend rendering, TanStack Query, forms, states →
  [architecture/06-frontend-architecture.md](../architecture/06-frontend-architecture.md).
- Shared components (`Switch`, `NotificationBell`, `DataTable`, `EmptyState`, `Tabs`) →
  [design-system/13-components-library.md](../design-system/13-components-library.md);
  patterns → [design-system/14-patterns.md](../design-system/14-patterns.md).
- Product spec facts → [Influencer_Platform_Full_Breakdown.md §3](../Influencer_Platform_Full_Breakdown.md).

---

## 1. Overview & goal

The platform touches members across four channels — **Email (SendGrid)**, **Push (Firebase FCM)**,
**SMS (Twilio)**, and **WhatsApp (Twilio WhatsApp API)**. Today these are ad-hoc: Phase 0/1 scaffolded
just enough email to send the registration verification link. Phase 7 turns that into **one
preference-aware notification service**.

**Goal:** a single entry point — `NotificationService.send(userId, type, payload)` — that every
feature calls when it wants to notify a user. The service resolves which channels the user has enabled
for that `NotificationType`, records a `Notification` row per enabled channel, and enqueues async
per-channel jobs. Workers call the provider behind its interface, record delivery status, retry on
failure, and reconcile final status from provider webhooks. Members manage their preferences in
**Account → Notifications** (a matrix of `Switch` toggles: `NotificationType` × channel) and read
in-app messages via the **`NotificationBell`** with an unread count and dropdown.

Two invariants define the module:

1. **Every send respects preferences.** A channel toggled OFF for a type is suppressed — no row is
   enqueued for that channel. This is enforced centrally in the dispatch service, not per caller.
2. **Sending is async, retryable, and observable.** Provider I/O never runs inside a request or a DB
   transaction; it runs in BullMQ workers with backoff, and every `Notification` row carries a status
   through its lifecycle.

---

## 2. Scope

### 2.1 In scope

- **Provider integrations for all 4 channels** wired behind the interface tokens from
  [03-backend §7](../architecture/03-backend-architecture.md#7-external-provider-abstraction):
  `EMAIL_PROVIDER` (SendGrid), `SMS_PROVIDER` (Twilio), `PUSH_PROVIDER` (FCM), and a new
  `WHATSAPP_PROVIDER` (Twilio WhatsApp API).
- **Preference management** — API (`GET`/`PUT /notification-preferences`) + the Account Notifications
  UI (per-`NotificationType` × channel toggle matrix).
- **Dispatch service** — `NotificationService.send()` that resolves enabled channels from preferences,
  writes `Notification` rows, and enqueues per-channel jobs.
- **Queue-based async sending with retries** — one BullMQ `notifications` queue, per-channel jobs,
  exponential backoff, dead-letter on exhaustion.
- **Delivery status via webhooks** — `/webhooks/sendgrid`, `/webhooks/twilio`, `/webhooks/fcm` update
  `Notification.status` idempotently (`SENT → DELIVERED`/`FAILED`).
- **In-app notification center** — `NotificationBell` (unread count + dropdown), a list endpoint
  (cursor-paginated), mark-one-read, mark-all-read.
- **Push token registration** — `POST /push-tokens` so the browser/device FCM token is stored for
  push targeting.
- **Template management** — a small registry mapping `(NotificationType, channel)` → provider template
  id / body builder, so copy is not scattered across callers.

### 2.2 Out of scope

- **Building the providers themselves.** SendGrid, Twilio, and FCM are third parties; we integrate
  their SDKs behind interfaces, we do not build a mail server / SMS gateway / push service.
- **Authoring the marketing content / campaigns** (a campaign tool). Phase 7 delivers transactional +
  preference-gated notifications; bulk marketing sends are a later concern.
- **In-app real-time websockets/SSE.** The bell polls via TanStack Query (unread count). A push/WS
  live channel can be layered later without changing the data model.
- **The points ledger, redemption payouts, and PayPal webhook** — those belong to
  [module-03](module-03-points-rewards.md); this module only *notifies* about points/reward events.
- **Auth email content mechanics** (verification token generation) — owned by
  [module-01](module-01-auth-registration.md); Phase 7 just routes those emails through the unified
  service.

---

## 3. User flows

### 3.1 Manage notification preferences

1. Member opens **Account → Notifications** (`/account/notifications`).
2. The page loads the preference matrix: rows = `NotificationType` categories (grouped for readability,
   e.g. *Survey Invitations*, *Offers & News*), columns = the four channels.
3. Each cell is a `Switch`. Example seeded state — **Survey Invitations**: Email ON, Push OFF, SMS ON,
   WhatsApp OFF; **Offers & News**: Email ON, Push ON (SMS/WhatsApp OFF).
4. Toggling a `Switch` optimistically flips the cell and fires a `PUT /notification-preferences` upsert
   for that `(type, channel)`; on error it rolls back and shows a toast.
5. Effect is immediate: the next `send()` for that type reads the updated preference and suppresses any
   OFF channel.

### 3.2 Receive and read in-app notifications

1. A domain event fires (survey invite, points update, reward update, …). `NotificationService.send()`
   writes a `Notification` row for each enabled channel; the **in-app** record is what the bell reads.
2. The `NotificationBell` in the `Header` shows an **unread count** badge (polled).
3. Member clicks the bell → a dropdown lists recent notifications (title, message, relative time,
   unread dot). Empty → `EmptyState` ("You're all caught up").
4. Clicking an item marks it read (`POST /notifications/:id/read`), decrements the count, and (if it has
   a deep link in `metadata`) navigates to the target (e.g. the survey).
5. "Mark all as read" calls `POST /notifications/read-all`; the badge clears.
6. The full history (beyond the dropdown) is a cursor-paginated list ("Load more").

### 3.3 Push token registration

1. On first authenticated load in a push-capable browser, the client requests notification permission
   (only when the member has Push ON for at least one type, or opts in).
2. On grant, the FCM SDK yields a device token; the client `POST /push-tokens` `{ token, platform }`.
3. The server upserts the token against the user (unique on `token`), so future push jobs target every
   active token for that user.
4. Stale/unregistered tokens reported back by FCM (via the fcm webhook / send response) are pruned so
   push jobs don't fan out to dead tokens.

---

## 4. Data model

All models are defined authoritatively in
[04-database §4](../architecture/04-database-architecture.md#4-prisma-schema-authoritative); the enums
`NotificationChannel`, `NotificationType`, and `NotificationStatus` already exist in the schema. This
module **consumes** them — no new tables are required beyond what the schema already declares.

### 4.1 Enums (existing)

```prisma
enum NotificationChannel { EMAIL PUSH SMS WHATSAPP }

enum NotificationType {
  REGISTRATION SURVEY_INVITE SURVEY_REMINDER POINTS_UPDATE GAME_REMINDER
  REWARD_UPDATE PASSWORD_RESET OFFERS_NEWS
}

enum NotificationStatus { QUEUED SENT DELIVERED FAILED READ }
```

### 4.2 Models (existing — referenced, not redefined)

- **`Notification`** — one row per `(user, channel, type)` send. Columns: `channel`, `type`, `title?`,
  `message`, `status` (default `QUEUED`), `sentAt?`, `readAt?`, `metadata` (Json — deep link, provider
  message id, dedupe key), `createdAt`. Indexed `@@index([userId, createdAt])` (bell/history reads) and
  `@@index([status])` (webhook lookups / ops).
- **`NotificationPreference`** — per-user, per-type channel booleans: `email`, `push`, `sms`,
  `whatsapp`. **`@@unique([userId, type])`** — exactly one preference row per user per type; the
  dispatch service and the `PUT` endpoint both upsert on this key.
- **`PushToken`** — `token @unique`, `platform` (`web | android | ios`), `userId`. Indexed by
  `userId` for push fan-out.

### 4.3 Notification status lifecycle

A `Notification` row moves through:

```
QUEUED ──(worker picks job)──▶ SENT ──(provider webhook: delivered)──▶ DELIVERED
   │                             │
   │                             └────(provider webhook: bounce/undeliverable)──▶ FAILED
   │
   └──(all BullMQ attempts exhausted, provider call kept throwing)──▶ FAILED

READ ── in-app only: set when the member opens/marks the notification (readAt set)
```

- `QUEUED` — row written by `send()`, job enqueued, not yet processed.
- `SENT` — worker successfully handed the message to the provider (has a `providerMessageId`); `sentAt`
  set. For **in-app**-style reads the bell shows anything not yet `READ`.
- `DELIVERED` — provider webhook confirms delivery (email delivered, SMS/WhatsApp delivered, push
  accepted). Terminal-success.
- `FAILED` — either the provider webhook reported a hard failure/bounce, or every BullMQ attempt was
  exhausted. Terminal-failure; surfaced to ops, never retried silently after dead-letter.
- `READ` — **in-app only**: set by `POST /notifications/:id/read` / `read-all`; sets `readAt`. Read
  state is orthogonal to delivery state but shares the enum (a message the user reads in the bell is
  marked `READ`).

> **Preference-suppressed channels produce no row.** If SMS is OFF for `SURVEY_INVITE`, there is no
> `Notification(channel=SMS)` row at all — suppression happens before any row/job is created (§5).

### 4.4 Preference defaults & seeding

`packages/db/prisma/seed.ts` (and a lazy upsert on first read) ensures every user has a
`NotificationPreference` row per `NotificationType`. Schema defaults: `email=true`, `push=true`,
`sms=false`, `whatsapp=false`. Transactional/security types (`REGISTRATION`, `PASSWORD_RESET`) are
treated as **always-on email** by policy (see §5.4) regardless of the stored row, so a member can never
toggle themselves out of a password-reset email.

---

## 5. Dispatch architecture ⭐

This is the heart of the module. The design goal: **callers stay ignorant of channels, providers,
templates, and preferences.** They say *"notify this user about this thing"* and the service does the
rest.

### 5.1 The single entry point

```ts
// modules/notifications/notifications.service.ts
interface NotifyPayload {
  title?: string;
  message: string;                       // rendered/plain body for in-app + fallback
  data?: Record<string, string>;         // template + deep-link vars (surveyId, points, url ...)
  dedupeKey?: string;                     // optional idempotency for the whole send
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.NOTIFICATIONS) private readonly queue: Queue,
  ) {}

  /** THE entry point. Every feature calls this; nobody enqueues channel jobs directly. */
  async send(userId: string, type: NotificationType, payload: NotifyPayload): Promise<void> {
    const channels = await this.resolveEnabledChannels(userId, type);   // §5.2 (respects prefs)
    if (channels.length === 0) return;                                   // fully suppressed

    for (const channel of channels) {
      // 1) record intent (QUEUED). One row per enabled channel.
      const notification = await this.prisma.notification.create({
        data: {
          userId, channel, type,
          title: payload.title,
          message: payload.message,
          status: 'QUEUED',
          metadata: { ...payload.data, dedupeKey: payload.dedupeKey },
        },
      });
      // 2) enqueue the per-channel job (retryable, async)
      await this.queue.add(
        JOBS.SEND_NOTIFICATION,
        { notificationId: notification.id, channel } satisfies SendNotificationJob,
        {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
          jobId: payload.dedupeKey ? `${payload.dedupeKey}:${channel}` : undefined, // dedupe
        },
      );
    }
  }
}
```

### 5.2 Resolving enabled channels (preference gate)

```ts
private async resolveEnabledChannels(
  userId: string,
  type: NotificationType,
): Promise<NotificationChannel[]> {
  // Always-on transactional/security types bypass the toggle (§5.4).
  if (ALWAYS_ON.has(type)) return ['EMAIL'];

  const pref = await this.prisma.notificationPreference.upsert({
    where: { userId_type: { userId, type } },
    create: { userId, type },   // schema defaults: email/push ON, sms/whatsapp OFF
    update: {},
  });

  const channels: NotificationChannel[] = [];
  if (pref.email)    channels.push('EMAIL');
  if (pref.push)     channels.push('PUSH');
  if (pref.sms)      channels.push('SMS');
  if (pref.whatsapp) channels.push('WHATSAPP');

  // Only offer a channel we can actually deliver on (has address/token).
  return channels.filter((c) => this.canDeliver(c, userId));
}
```

The preference read is the **only** place suppression happens. A channel that is OFF never becomes a
row and never becomes a job — so §12 test "send suppressed when channel OFF" asserts *zero* rows for
that channel, not a `FAILED` row.

### 5.3 Per-channel worker → provider interface

One BullMQ queue (`notifications`), one processor. The processor loads the row, dispatches through the
matching provider interface, then records status. Provider errors bubble so BullMQ retries; the row is
only marked `FAILED` once attempts are exhausted (matches the sketch in
[03-backend §6.1](../architecture/03-backend-architecture.md#61-queues--processors)).

```ts
// modules/notifications/notification.processor.ts
@Processor(QUEUES.NOTIFICATIONS)
export class NotificationProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: TemplateRegistry,
    @Inject(EMAIL_PROVIDER)    private readonly email: EmailProvider,
    @Inject(SMS_PROVIDER)      private readonly sms: SmsProvider,
    @Inject(PUSH_PROVIDER)     private readonly push: PushProvider,
    @Inject(WHATSAPP_PROVIDER) private readonly whatsapp: WhatsAppProvider,
  ) { super(); }

  async process(job: Job<SendNotificationJob>): Promise<void> {
    const { notificationId, channel } = job.data;
    const n = await this.prisma.notification.findUniqueOrThrow({ where: { id: notificationId } });
    if (n.status !== 'QUEUED') return;   // idempotent: a retry after SENT does nothing

    try {
      const providerMessageId = await this.dispatch(channel, n);         // provider call (§5.5)
      await this.prisma.notification.update({
        where: { id: n.id },
        data: { status: 'SENT', sentAt: new Date(),
                metadata: { ...(n.metadata as object), providerMessageId } },
      });
    } catch (err) {
      const lastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      if (lastAttempt) {
        await this.prisma.notification.update({ where: { id: n.id }, data: { status: 'FAILED' } });
      }
      throw err;   // let BullMQ apply exponential backoff / dead-letter
    }
  }

  private dispatch(channel: NotificationChannel, n: Notification): Promise<string> {
    switch (channel) {
      case 'EMAIL':    return this.sendEmail(n);
      case 'SMS':      return this.sendSms(n);
      case 'PUSH':     return this.sendPush(n);
      case 'WHATSAPP': return this.sendWhatsApp(n);
    }
  }
}
```

### 5.4 Always-on transactional policy

`REGISTRATION` and `PASSWORD_RESET` are **security/transactional** — a member must not be able to
suppress them. `resolveEnabledChannels` short-circuits these to email regardless of the stored
preference. The Account UI renders these rows as read-only (or omits them), so the toggle matrix only
governs marketing/engagement types (`SURVEY_INVITE`, `SURVEY_REMINDER`, `POINTS_UPDATE`,
`GAME_REMINDER`, `REWARD_UPDATE`, `OFFERS_NEWS`). This matches the spec's channel map (registration &
password reset are email; the rest are toggleable).

### 5.5 Providers & the new WhatsApp interface

`EMAIL_PROVIDER`, `SMS_PROVIDER`, `PUSH_PROVIDER` already exist
([03-backend §7.1](../architecture/03-backend-architecture.md#7-external-provider-abstraction)). Phase 7
adds `WHATSAPP_PROVIDER`, following the same shape (Twilio WhatsApp uses templated messages):

```ts
// providers/whatsapp/whatsapp-provider.interface.ts
export const WHATSAPP_PROVIDER = Symbol('WHATSAPP_PROVIDER');
export interface WhatsAppProvider {
  send(msg: { to: string; templateId: string; data: Record<string, string> })
    : Promise<{ providerMessageId: string }>;
}
// providers/whatsapp/twilio-whatsapp.provider.ts — concrete (Twilio WhatsApp API)
// providers/whatsapp/noop-whatsapp.provider.ts  — dev/test double
```

Per-channel dispatch resolves recipients + template from the `TemplateRegistry` (§9.4):

- **Email** → `email.send({ to: user.email, templateId, data })` (SendGrid dynamic template).
- **SMS** → `sms.send({ to: user.phone, body })` (Twilio; body rendered from template).
- **Push** → `push.send({ tokens: user.pushTokens, title, body, data })` (FCM; fan-out to all tokens).
- **WhatsApp** → `whatsapp.send({ to: user.phone, templateId, data })` (Twilio WhatsApp).

Recipient PII (email/phone) is decrypted at dispatch time from the encrypted user columns
([04-database §1](../architecture/04-database-architecture.md#1-principles),
[07-security-compliance](../architecture/07-security-compliance.md)); it is **never** stored on the
`Notification` row.

### 5.6 Webhook status reconciliation (idempotent)

Providers call back asynchronously with delivery results. The webhook controller
([05-api §11](../architecture/05-api-conventions.md#11-webhooks--external-callbacks)) verifies the
signature, then maps the provider event → a `Notification` by `providerMessageId` and advances status:

```ts
// webhooks: /webhooks/sendgrid | /webhooks/twilio | /webhooks/fcm
async function applyDeliveryEvent(providerMessageId: string, event: 'delivered' | 'failed') {
  const n = await prisma.notification.findFirst({
    where: { metadata: { path: ['providerMessageId'], equals: providerMessageId } },
  });
  if (!n) return;                                    // unknown id — ignore (idempotent)
  const next = event === 'delivered' ? 'DELIVERED' : 'FAILED';
  // idempotent + monotonic: only advance from SENT; never regress DELIVERED/READ
  if (n.status === 'SENT') {
    await prisma.notification.update({ where: { id: n.id }, data: { status: next } });
  }
}
```

**Idempotency guarantees:** (1) the same webhook delivered twice is a no-op because we only transition
from `SENT`; (2) an unknown/duplicate `providerMessageId` is ignored; (3) status never regresses
(`DELIVERED`/`READ` are terminal for the delivery axis). Signature verification is mandatory — never
trust the body.

### 5.7 Why async + no I/O in transactions

Provider calls are network I/O and can be slow/flaky; running them inline would block requests and hold
DB locks. So `send()` only writes rows + enqueues (fast, inside no long lock), and all provider I/O
happens in the worker with retry/backoff — consistent with
[03-backend §9.3](../architecture/03-backend-architecture.md#93-db-connection-pooling) ("no external
I/O inside a `$transaction`; enqueue and run after commit").

---

## 6. API contracts

All endpoints follow [05-api-conventions](../architecture/05-api-conventions.md): base `/v1`, the
`{ data, error, meta }` envelope, `Bearer` auth, canonical error codes, cursor pagination. DTOs are
Zod schemas in `packages/types`.

### 6.1 Preferences

> **`GET /v1/notification-preferences`** — read the member's full preference matrix
> - **Auth:** member
> - **200:** `{ data: NotificationPreference[] }` — one entry per `NotificationType` (lazily
>   upserted to defaults if missing), each `{ type, email, push, sms, whatsapp }`.
> - **Errors:** `401 UNAUTHENTICATED`

> **`PUT /v1/notification-preferences`** — upsert one or more preferences
> - **Auth:** member
> - **Body:** `{ type: NotificationType, email?: boolean, push?: boolean, sms?: boolean, whatsapp?: boolean }`
>   (or an array of these) — Zod: `UpdateNotificationPreferenceInput`.
> - **200:** `{ data: NotificationPreference }` (or `[]`) — the upserted row(s).
> - **Behaviour:** upsert on `@@unique([userId, type])`; partial updates leave unspecified channels
>   unchanged. Always-on types (`REGISTRATION`, `PASSWORD_RESET`) reject channel-off attempts →
>   `422 UNPROCESSABLE` (or are simply not exposed).
> - **Errors:** `400 VALIDATION_ERROR` (unknown type/channel) · `401 UNAUTHENTICATED` ·
>   `422 UNPROCESSABLE` (attempt to disable an always-on channel)

### 6.2 In-app notification center

> **`GET /v1/notifications`** — list the member's in-app notifications (cursor-paginated)
> - **Auth:** member
> - **Query:** `?limit=20&cursor=<opaque>&unread=true?` (filter to unread for the bell dropdown)
> - **200:** `{ data: Notification[], meta.pagination: { nextCursor, hasMore, limit } }` — newest
>   first (`userId, createdAt` index). Each item `{ id, type, title, message, status, readAt, metadata, createdAt }`.
> - **Errors:** `401 UNAUTHENTICATED`

> **`GET /v1/notifications/unread-count`** — badge count for the `NotificationBell`
> - **Auth:** member
> - **200:** `{ data: { count: number } }` — count of the member's rows where `readAt IS NULL`
>   (in-app-visible channels).
> - **Errors:** `401 UNAUTHENTICATED`

> **`POST /v1/notifications/:id/read`** — mark one notification read
> - **Auth:** member · **Path:** `id` (uuid)
> - **200:** `{ data: Notification }` — sets `readAt=now()`, `status=READ` (idempotent if already read).
> - **Side effects:** decrements unread count.
> - **Errors:** `404 NOT_FOUND` (not the caller's row — ownership checked in service) ·
>   `401 UNAUTHENTICATED`

> **`POST /v1/notifications/read-all`** — mark all unread read
> - **Auth:** member
> - **200:** `{ data: { updated: number } }` — sets `readAt` on all the member's unread rows.
> - **Errors:** `401 UNAUTHENTICATED`

### 6.3 Push tokens

> **`POST /v1/push-tokens`** — register/refresh an FCM token for this member/device
> - **Auth:** member
> - **Body:** `{ token: string, platform: 'web' | 'android' | 'ios' }` — Zod: `RegisterPushTokenInput`.
> - **201:** `{ data: PushToken }` — upsert on `token @unique` (re-registers to the current user if the
>   token moved devices/accounts).
> - **Errors:** `400 VALIDATION_ERROR` · `401 UNAUTHENTICATED`

> **`DELETE /v1/push-tokens/:token`** — deregister on logout / permission revoke *(optional)*
> - **Auth:** member · **204/200** · removes the token so push fan-out stops.

### 6.4 Provider webhooks (public, signature-verified)

Per [05-api §11](../architecture/05-api-conventions.md#11-webhooks--external-callbacks) — `@Public()`,
verified by provider signature, processed idempotently (§5.6). Handlers live in the shared
`webhooks/` module ([03-backend §1.2](../architecture/03-backend-architecture.md#12-appsrcapisrc-folder-tree)).

> **`POST /v1/webhooks/sendgrid`** — SendGrid event webhook (delivered, bounce, dropped, spamreport).
> - **Auth:** none (verified via SendGrid Event Webhook signature) · **200** always (ack) ·
>   maps `sg_message_id` → `Notification`, advances `SENT → DELIVERED`/`FAILED`.

> **`POST /v1/webhooks/twilio`** — Twilio SMS + WhatsApp status callback (`MessageStatus`:
> delivered/undelivered/failed).
> - **Auth:** none (verified via `X-Twilio-Signature`) · **200** always · maps `MessageSid` →
>   `Notification`, advances status. Shared by SMS and WhatsApp (both Twilio).

> **`POST /v1/webhooks/fcm`** — FCM delivery receipts / token-invalidation feedback.
> - **Auth:** none (verified) · **200** always · advances push status and **prunes** unregistered
>   tokens (`NotRegistered`/`InvalidRegistration`) from `push_tokens`.

---

## 7. Frontend

Consumes `@influencer/ui` only ([13-components](../design-system/13-components-library.md)) and the
patterns in [14-patterns](../design-system/14-patterns.md). Nothing here ships a one-off toggle, table,
or empty state.

### 7.1 Account → Notifications tab

- **Location:** `app/(app)/account/notifications/page.tsx`, inside the account `Tabs` shell
  ([06-frontend §1](../architecture/06-frontend-architecture.md#1-app-router-folder-structure)).
- **Layout:** a **preference matrix** — rows are `NotificationType` categories (labelled, grouped:
  *Survey Invitations*, *Survey Reminders*, *Points Updates*, *Game Reminders*, *Reward Updates*,
  *Offers & News*), columns are the four channels. Each cell is the shared **`Switch`**
  ([13 §3](../design-system/13-components-library.md)). On mobile the matrix collapses to per-category
  cards, each with four labelled `Switch` rows.
- **Data:** RSC-fetch initial matrix via `GET /notification-preferences`; a client island owns the
  toggles with TanStack Query. Toggling a `Switch` does an **optimistic** `PUT /notification-preferences`
  for that `(type, channel)`, rolling back + `toast.error` on failure (per
  [14 §4](../design-system/14-patterns.md#4-toast-vs-inline-alert-feedback-pattern)).
- **Always-on rows** (`REGISTRATION`, `PASSWORD_RESET`) render disabled with a tooltip
  ("Required for account security") or are omitted (§5.4).
- **States:** `Skeleton` matrix while loading; `Alert` + Retry on load error
  ([14 §3](../design-system/14-patterns.md#3-empty--loading--error-state-pattern)). There is no true
  "empty" state — every user has a full matrix (lazily seeded).

### 7.2 NotificationBell (in-app center)

- **Location:** the shared **`NotificationBell`** in `Header`
  ([13 §7](../design-system/13-components-library.md)) — icon + unread-count badge + dropdown list.
- **Unread count:** a TanStack Query on `GET /notifications/unread-count` with a modest
  `refetchInterval` (polling; a WS channel can replace this later). The badge hides at zero.
- **Dropdown list:** `GET /notifications?unread=true&limit=…` — each item shows `title`, `message`,
  relative time, and an unread dot. Clicking an item → `POST /notifications/:id/read` (optimistic
  decrement) and, if `metadata.url` is present, navigates to the deep link.
- **Mark all read:** a header action in the dropdown → `POST /notifications/read-all`, then invalidate
  `['notifications','unread-count']` and the list query.
- **Empty state:** shared **`EmptyState`** ("You're all caught up — no new notifications")
  ([13 §5](../design-system/13-components-library.md)).
- **Full history** (optional link from the dropdown) uses the `DataTable` + cursor pagination pattern
  ([14 §5](../design-system/14-patterns.md#5-data-table-pattern-server-cursor-pagination)) with a
  "Load more" bound to `meta.pagination.nextCursor`.

### 7.3 Push permission prompt

- A small client component requests browser notification permission (gated on the member having Push ON
  and not previously denied), retrieves the FCM token, and `POST /push-tokens`. It respects
  `prefers-reduced-motion` and never blocks the UI. Handled as a lightweight `next/dynamic` island so
  the FCM SDK isn't in the initial bundle.

### 7.4 Query keys & invalidation

`['notifications','unread-count']`, `['notifications','list', filters]`,
`['notification-preferences']`. A successful read/read-all invalidates the count + list; a preference
`PUT` invalidates `['notification-preferences']`. No remote data is copied into Zustand — TanStack
Query is the cache ([06-frontend §4](../architecture/06-frontend-architecture.md#4-state-management)).

---

## 8. Backend

Structure follows [03-backend §1](../architecture/03-backend-architecture.md#1-module-structure).

### 8.1 `NotificationsModule`

- **`notifications.controller.ts`** — thin controllers for `/notifications/*` and
  `/notification-preferences/*` and `/push-tokens/*`; delegate to services, return DTOs (envelope added
  by the global interceptor). Ownership (this notification/preference is the caller's) is enforced in
  the service, not the controller
  ([03-backend §3.7](../architecture/03-backend-architecture.md#37-ownership-checks)).
- **`notifications.service.ts`** — the **dispatch service** (§5): `send()`, `resolveEnabledChannels()`,
  read/read-all, unread-count.
- **`preferences.service.ts`** — read + upsert on `@@unique([userId, type])`; enforces always-on policy.
- **`push-token.service.ts`** — upsert/prune tokens.
- **`notification.processor.ts`** — the BullMQ `@Processor(QUEUES.NOTIFICATIONS)` worker (§5.3).
- **`template.registry.ts`** — `(type, channel) → templateId | bodyBuilder` (§9.4).

`NotificationsModule` **exports `NotificationsService`** so every feature module (Auth, Account,
Surveys, Points/Rewards, Games) imports it to call `send()` — the same shared-provider pattern as
`PointsService` ([03-backend §1.1](../architecture/03-backend-architecture.md#11-design-rules)). No
feature enqueues channel jobs directly.

### 8.2 Callers (who triggers what)

| Domain event | `NotificationType` | Typical enabled channels | Emitted by |
|---|---|---|---|
| Email verification link | `REGISTRATION` | Email (always-on) | [module-01](module-01-auth-registration.md) |
| Password reset link | `PASSWORD_RESET` | Email (always-on) | [module-01](module-01-auth-registration.md) |
| New matched survey | `SURVEY_INVITE` | Email / SMS / WhatsApp (per prefs) | [module-04](module-04-surveys.md) |
| Survey about to close | `SURVEY_REMINDER` | Push (per prefs) | [module-04](module-04-surveys.md) |
| Points credited | `POINTS_UPDATE` | Push (per prefs) | [module-03](module-03-points-rewards.md) |
| Daily game available | `GAME_REMINDER` | Push (per prefs) | [module-06](module-06-games.md) |
| Redemption/payout status | `REWARD_UPDATE` | Email / WhatsApp (per prefs) | [module-03](module-03-points-rewards.md) |
| Marketing / news | `OFFERS_NEWS` | Email / Push (per prefs) | Admin / campaigns |

### 8.3 Queues, workers, providers

- **Queue:** the shared `notifications` BullMQ queue from
  [03-backend §6.1](../architecture/03-backend-architecture.md#61-queues--processors) — exponential
  backoff, 5 attempts, dead-letter on exhaust. `QUEUES.NOTIFICATIONS` / `JOBS.SEND_NOTIFICATION` live in
  `queue/queue.constants.ts`.
- **Providers:** bound in `ProvidersModule` (`@Global`) — `SendGridProvider`, `TwilioProvider` (SMS),
  `FcmProvider`, and the new `TwilioWhatsAppProvider`; dev/test bind `Noop*` doubles so no network I/O in
  tests ([03-backend §7.2](../architecture/03-backend-architecture.md#72-binding-swap-by-env)).
- **Scheduled sends** (survey reminders, game reminders) originate from
  `SchedulerService` `@Cron` handlers that enqueue → which call `send()`; the cron stays thin
  ([03-backend §6.2](../architecture/03-backend-architecture.md#62-scheduled-jobs-cron)).

### 8.4 Webhook handlers (idempotent)

The shared `webhooks/` controller ([03-backend §1.2](../architecture/03-backend-architecture.md#12-appsrcapisrc-folder-tree))
hosts `/webhooks/sendgrid|twilio|fcm`. Each: (1) verifies signature, (2) parses the provider event
batch, (3) calls `NotificationsService.applyDeliveryEvent(providerMessageId, event)` which is
idempotent + monotonic (§5.6), (4) for FCM, prunes dead tokens. Always returns `200` to stop provider
retries once accepted; failures are logged with the `requestId`.

### 8.5 Template management

`TemplateRegistry` maps `(NotificationType, channel)` → a SendGrid/WhatsApp `templateId` (for templated
channels) or a `bodyBuilder(payload.data)` (SMS/push plain text + in-app `message`). Copy lives in one
place (i18n-ready per [06-frontend §10](../architecture/06-frontend-architecture.md#10-accessibility-responsive-i18n-readiness-page-states)),
so callers pass structured `data`, not rendered strings. This keeps templates swappable without
touching callers.

---

## 9. Reuse notes

- **Provider interface pattern** — reuses the exact abstraction from
  [03-backend §7](../architecture/03-backend-architecture.md#7-external-provider-abstraction):
  `EMAIL_PROVIDER`, `SMS_PROVIDER`, `PUSH_PROVIDER` already exist; Phase 7 only adds `WHATSAPP_PROVIDER`
  in the same shape (token + interface + concrete + noop). Callers depend on interfaces, so providers
  stay swappable/mockable (the launch risk in [roadmap risk notes](../phases/00-roadmap.md#risk-notes)).
- **Shared service export pattern** — `NotificationsService` is exported and injected like
  `PointsService`; features never re-implement dispatch.
- **BullMQ queue + processor** — reuses the `notifications` queue and processor skeleton already
  sketched in [03-backend §6.1](../architecture/03-backend-architecture.md#61-queues--processors).
- **Webhook convention** — reuses [05-api §11](../architecture/05-api-conventions.md#11-webhooks--external-callbacks)
  (signature-verified, idempotent) shared with the PayPal payout webhook in
  [module-03](module-03-points-rewards.md).
- **UI kit** — **`Switch`** (preference toggles), **`NotificationBell`** (unread + dropdown),
  **`DataTable`** (history), **`EmptyState`** (caught-up), **`Tabs`** (account shell), **`Toast`**/
  **`Alert`** (feedback) — all from [13-components](../design-system/13-components-library.md); no new
  primitives. Patterns: form/optimistic-toggle, empty/loading/error, toast-vs-alert, cursor DataTable
  ([14-patterns](../design-system/14-patterns.md) §1/§3/§4/§5).
- **Cursor pagination + envelope** — reuses [05-api §2/§6](../architecture/05-api-conventions.md#2-response-envelope-always)
  exactly for the notifications list.

---

## 10. Acceptance criteria

1. A member can view and toggle notification preferences per `NotificationType` × channel in
   **Account → Notifications**; changes persist via `PUT /notification-preferences` (upsert on
   `[userId, type]`) and take effect immediately.
2. `NotificationService.send(userId, type, payload)` is the single dispatch entry point; every feature
   uses it and no feature enqueues channel jobs directly.
3. **Preference gate:** a channel toggled OFF for a type is fully suppressed — no `Notification` row and
   no job are created for that channel.
4. **Enabled channels enqueue:** each enabled channel produces exactly one `Notification` row
   (`QUEUED`) and one BullMQ job.
5. Workers dispatch through the correct provider interface (Email/SMS/Push/WhatsApp); on success the row
   is `SENT` with a `providerMessageId` and `sentAt`.
6. **Retries:** a transient provider failure is retried with exponential backoff (5 attempts); the row
   is marked `FAILED` only after attempts are exhausted (dead-letter), never on the first failure.
7. **Webhooks** (`sendgrid`/`twilio`/`fcm`) are signature-verified and advance status
   `SENT → DELIVERED`/`FAILED` idempotently and monotonically (duplicate/unknown events are no-ops;
   `DELIVERED`/`READ` never regress).
8. In-app center: `NotificationBell` shows an accurate **unread count**; opening/marking an item
   (`/read`, `/read-all`) sets `readAt`/`READ` and decrements the count.
9. Push token registration (`POST /push-tokens`) stores/upserts the FCM token; dead tokens reported by
   FCM are pruned.
10. `REGISTRATION` and `PASSWORD_RESET` emails send regardless of preferences (always-on), and cannot be
    toggled off.
11. All endpoints conform to [05-api-conventions](../architecture/05-api-conventions.md) (envelope,
    error codes, `Bearer` auth, ownership, cursor pagination); UI uses only shared components/tokens.
12. No provider I/O runs inside a request handler or a DB transaction — all sending is async via the
    queue.

---

## 11. Tasks (ordered)

1. **Schema check + migration** — confirm `Notification`, `NotificationPreference`, `PushToken` and the
   three enums exist in `packages/db/prisma/schema.prisma`; add any missing index; seed default
   preference rows / lazy-upsert helper. Update `seed.ts`.
2. **Types** — add Zod DTOs to `packages/types`: `UpdateNotificationPreferenceInput`,
   `NotificationDTO`, `RegisterPushTokenInput`, list/query params, unread-count response.
3. **WhatsApp provider** — add `WHATSAPP_PROVIDER` token + interface + `TwilioWhatsAppProvider` +
   `NoopWhatsAppProvider`; bind in `ProvidersModule`; add `TWILIO_WHATSAPP_FROM` (+ existing Twilio
   creds) to the env schema.
4. **TemplateRegistry** — map `(type, channel)` → SendGrid/WhatsApp template ids and SMS/push body
   builders; move the Phase-1 verification/reset copy into it.
5. **`NotificationsModule`** — `NotificationsService.send()` + `resolveEnabledChannels()` (preference
   gate + always-on policy) + read/read-all/unread-count; export the service.
6. **BullMQ processor** — `NotificationProcessor` (per-channel dispatch, status transitions, retry →
   FAILED on exhaust) on the shared `notifications` queue.
7. **Preferences + push-token endpoints** — controllers/services for
   `GET`/`PUT /notification-preferences`, `POST`/`DELETE /push-tokens`.
8. **In-app center endpoints** — `GET /notifications` (cursor), `GET /notifications/unread-count`,
   `POST /notifications/:id/read`, `POST /notifications/read-all` (ownership-scoped).
9. **Webhooks** — `/webhooks/sendgrid|twilio|fcm` with signature verification + idempotent monotonic
   `applyDeliveryEvent`; FCM dead-token pruning.
10. **Wire callers** — route the Phase-1 verification/reset emails through `send()`; add
    `SURVEY_INVITE`/`SURVEY_REMINDER`/`POINTS_UPDATE`/`GAME_REMINDER`/`REWARD_UPDATE`/`OFFERS_NEWS`
    emissions from modules 3/4/6 and admin.
11. **Frontend — Account Notifications** — matrix of `Switch` toggles with optimistic `PUT`; always-on
    rows disabled; skeleton/error states.
12. **Frontend — NotificationBell** — unread-count polling, dropdown list, mark-read/read-all, empty
    state; push permission + `POST /push-tokens` island.
13. **Tests** (§12) — unit (dispatch/gate/retry/webhook idempotency), integration (queue + status),
    e2e (envelope/auth/pagination), frontend (toggle + bell).
14. **Docs & staging** — update this doc with any build decisions; deploy to staging and smoke-test each
    channel with the noop/dev providers, then real sandboxes.

---

## 12. Test cases

Seams per [08-testing-strategy](../architecture/08-testing-strategy.md): DI-injected `PrismaService`,
provider tokens (noop doubles), and a fake `Queue`.

### 12.1 Unit — dispatch service

- **Suppressed when channel OFF** — prefs `SURVEY_INVITE` = {Email ON, Push OFF, SMS ON, WhatsApp OFF};
  `send(user, SURVEY_INVITE, …)` creates rows/jobs **only** for Email + SMS. Assert **zero** rows and
  **zero** jobs for Push and WhatsApp.
- **Enabled channels enqueued** — for the above, assert exactly one `Notification(QUEUED)` and one
  `SEND_NOTIFICATION` job per enabled channel, with the correct `notificationId`/`channel` payload.
- **All-off ⇒ no-op** — every channel OFF for a (non-always-on) type ⇒ `send()` creates nothing and
  returns.
- **Always-on override** — `PASSWORD_RESET` with an email-OFF preference row still enqueues an email;
  `PUT` attempting to disable it → `422 UNPROCESSABLE`.
- **Preference upsert** — `PUT /notification-preferences` for a new `(userId, type)` inserts; a second
  call updates only the specified channels (unique `[userId, type]` respected; partial update preserves
  others).
- **Deliverability filter** — Push enabled but the user has no `push_tokens` ⇒ Push channel skipped.

### 12.2 Unit / integration — worker & providers

- **Success ⇒ SENT** — worker with a noop provider marks the row `SENT` + sets `sentAt` +
  `providerMessageId`.
- **Retry on provider failure** — provider throws on attempts 1–2, succeeds on 3 ⇒ row ends `SENT`;
  assert `attemptsMade` progression and that the row is **not** `FAILED` mid-retry.
- **Exhaustion ⇒ FAILED** — provider always throws ⇒ after 5 attempts the row is `FAILED` and the job is
  dead-lettered.
- **Idempotent processing** — re-running `process(job)` on a row already `SENT` is a no-op (no second
  provider call).

### 12.3 Integration — webhooks

- **Webhook updates status idempotently** — a `delivered` event for a `SENT` row → `DELIVERED`;
  replaying the same event keeps it `DELIVERED` (no error, no regression).
- **Monotonic** — a late `delivered` after `READ`, or a `failed` after `DELIVERED`, does not regress
  status.
- **Unknown id** — an event for an unknown `providerMessageId` is a no-op, returns `200`.
- **Signature required** — an unsigned/invalid-signature webhook is rejected and no row changes.
- **FCM token pruning** — a `NotRegistered` feedback event removes the matching `push_tokens` row.

### 12.4 e2e / frontend

- **In-app unread count** — after two sends to a user, `GET /notifications/unread-count` = 2; after
  `POST /notifications/:id/read` = 1; after `read-all` = 0.
- **Ownership** — `POST /notifications/:id/read` for another user's row → `404 NOT_FOUND`.
- **Cursor pagination** — `GET /notifications?limit=1` returns `meta.pagination.nextCursor`; following it
  returns the next page, newest-first.
- **Preferences UI** — toggling a `Switch` optimistically flips the cell and issues the `PUT`; on a
  simulated API error it rolls back and shows a toast.
- **Bell UI** — the badge shows the unread count, the dropdown lists items with unread dots, clicking an
  item marks it read (optimistic decrement), and the `EmptyState` renders when there are none.

---

## Related documents

- [Influencer_Platform_Full_Breakdown.md §3](../Influencer_Platform_Full_Breakdown.md) — notification spec.
- [architecture/03-backend-architecture.md](../architecture/03-backend-architecture.md) — providers, queues, processor.
- [architecture/04-database-architecture.md](../architecture/04-database-architecture.md) — Notification / preference / token schema.
- [architecture/05-api-conventions.md](../architecture/05-api-conventions.md) — envelope, errors, pagination, webhooks.
- [architecture/06-frontend-architecture.md](../architecture/06-frontend-architecture.md) — rendering, state, forms.
- [design-system/13-components-library.md](../design-system/13-components-library.md) — Switch, NotificationBell, DataTable, EmptyState.
- [design-system/14-patterns.md](../design-system/14-patterns.md) — form/toggle, states, toast/alert, data table.
- [phases/00-roadmap.md](../phases/00-roadmap.md) — phase order & definition of done.

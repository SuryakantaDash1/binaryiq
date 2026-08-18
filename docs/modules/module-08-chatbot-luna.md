# Module 08 — Chatbot (Luna)

> **Phase 8** · Week 10 · Depends on **7 — Notifications** (admin + DPO alerts ride the notifications
> transport). See [phases/00-roadmap.md](../phases/00-roadmap.md).
>
> Deliverable: *Luna* — a virtual-assistant widget on every authenticated page. Predefined FAQ
> **decision-tree** flows per topic, an **escalation** path that raises a **support ticket**, an
> in-widget conversation, and an admin ticket dashboard with status management. Tickets notify the
> admin queue and, for privacy-relevant issue types, the **DPO/GRO**.

This doc specifies *what* Module 8 builds and its contracts. It **references, never duplicates**, the
architecture and design backbones:

- Data model (authoritative): [04-database-architecture.md](../architecture/04-database-architecture.md)
  — `SupportTicket`, `SupportTicketMessage`, `TicketIssueType`, `TicketStatus`, `Admin`, `AdminRole`.
- Backend structure & layering: [03-backend-architecture.md](../architecture/03-backend-architecture.md)
  — `SupportModule` + `ChatbotModule` live under `modules/support/`.
- HTTP contract (envelope, errors, auth, pagination): [05-api-conventions.md](../architecture/05-api-conventions.md).
- Frontend structure (RSC/client, TanStack Query, typed client): [06-frontend-architecture.md](../architecture/06-frontend-architecture.md).
- Security & compliance (DPO/GRO routing, ownership, XSS, audit): [07-security-compliance.md](../architecture/07-security-compliance.md).
- UI kit & patterns: [13-components-library.md](../design-system/13-components-library.md) (`ChatWidget`,
  `Modal`, `Button`, `DataTable`, `Badge`) · [14-patterns.md](../design-system/14-patterns.md).
- Product spec source: [Influencer_Platform_Full_Breakdown.md §8](../Influencer_Platform_Full_Breakdown.md).
- Notifications this module reuses: [module-07-notifications.md](module-07-notifications.md).

---

## 1. Overview & goal

**Luna** is the platform's self-service support assistant. It reduces support load by answering the
most common questions inline through **predefined topic flows**, and — when it can't resolve an issue
— **escalates cleanly into a tracked support ticket** that lands in the admin dashboard (and, where
privacy-relevant, the DPO/GRO inbox).

**Goal:** every authenticated user, on any page, can (a) open Luna, (b) pick a topic and be walked
through a guided Q&A, and (c) either self-resolve or raise a support ticket in one tap — with the
whole conversation captured on the ticket for the admin.

### 1.1 Rule-based by design (not an LLM)

Per [spec §8.2](../Influencer_Platform_Full_Breakdown.md), Luna is a **rule-based / decision-tree FAQ
bot**. Topics are **predefined trees of nodes** (a message plus a set of option buttons); the user
navigates by clicking options. There is **no LLM / NLP** in this release: the bot never free-text
generates, never calls a model, and its answers are deterministic and reviewable. This makes Luna:

- **Deterministic & auditable** — every answer is authored content; no hallucination risk, no PII
  leaking into a third-party model.
- **Cheap & offline-safe** — no per-message inference cost or provider dependency.
- **Compliance-friendly** — nothing the user types is sent to an external model (see
  [§9](#9-security--compliance-notes)).

> **Future enhancement (out of scope now):** an optional LLM upgrade path is noted in
> [§2.2](#22-out-of-scope) — the flow-node contract and ticket escalation are designed so an NLP layer
> could later be slotted **in front of** the decision tree (intent detection → route to a flow) without
> reworking tickets or the widget.

---

## 2. Scope

### 2.1 In scope

- **Floating `ChatWidget`** — an emoji/avatar button pinned on **all authenticated pages** (the `(app)`
  route group), opening a chat **panel**.
- **Predefined flow / decision-tree engine** — topics defined as JSON node trees served by the API;
  the widget renders nodes and their option buttons.
- **FAQ answers per topic** — the five spec topics: Login Problems, Survey Problems, Survey Payment,
  Rewards Delivery, Unsubscribe.
- **Escalation to a support ticket** — the "raise a ticket" branch creates a `SupportTicket`
  (`status = OPEN`) with the correct `TicketIssueType`, captures the conversation as
  `SupportTicketMessage` rows, and confirms in-widget.
- **In-widget conversation** — bot/user messages rendered in the panel; a user may reply on an open
  ticket and see admin replies.
- **Admin ticket dashboard** — list, filter, open, reply, and manage status/assignment
  (`OPEN → PENDING → RESOLVED → CLOSED`).
- **Notifications on escalation** — a new ticket notifies the **admin queue** and, for privacy-relevant
  issue types, emails the **DPO/GRO** — via the [NotificationsModule](module-07-notifications.md).
- **Audit logging** — ticket creation, status changes, assignment, and any admin access to a member's
  ticket are written to `audit_logs` ([07-security §6](../architecture/07-security-compliance.md#6-audit-logging)).

### 2.2 Out of scope

- **Full LLM / NLP understanding** — free-text intent detection, generative answers, sentiment,
  multilingual translation. **Noted as a future enhancement:** an NLP intent-router could later sit in
  front of the existing decision-tree flows and reuse the same ticket escalation unchanged.
- **Live human chat / real-time agent presence** — tickets are asynchronous, not a live-chat SLA
  system. (The message model supports async admin replies; presence/typing indicators are not built.)
- **Knowledge-base CMS** — flows are config (see [§5](#5-flow-engine)); a rich editorial CMS for FAQ
  content is not in this phase.
- **Multichannel bot** (WhatsApp/Slack bot surfaces) — Luna is a web widget only. (Notifications about
  tickets may still fan out over channels per [module-07](module-07-notifications.md).)

---

## 3. User & admin flows

### 3.1 Member: open Luna → topic → guided Q&A → resolve or escalate

```
[any authed page]
   │  taps floating Luna button (ChatWidget)
   ▼
Panel opens → greeting + topic menu (5 topics)
   │  picks a topic (e.g. "Survey Payment")
   ▼
Bot renders flow node: message + option buttons
   │  navigates the decision tree by tapping options
   ▼
Leaf/answer node → bot shows the FAQ answer
   ▼
Escalation prompt (shown after each answer):
   ┌───────────────────────────────────────────────┐
   │ [✓] "You have answered my query, thank you."   │ → resolve → thank-you → panel can close
   │ [!] "I did not get a response. Let us raise a  │ → escalate
   │     support ticket."                           │
   └───────────────────────────────────────────────┘
```

- **Resolve path:** bot marks the flow resolved (no ticket), shows a thank-you, offers "Back to topics".
  Nothing is written except (optionally) an anonymous flow-completion metric.
- **Escalate path:** the bot confirms the issue type (derived from the topic), the widget calls
  `POST /support/tickets` with the topic's `issueType` and the conversation transcript. On success the
  bot shows a **ticket confirmation** ("Ticket #… raised — we'll get back to you") and the ticket now
  appears under the user's tickets.

### 3.2 Special case — Unsubscribe topic (no ticket)

The **Unsubscribe** topic is a **routing flow, not an escalation**. Its answer nodes deep-link the user
to the **Unsubscribe / account tab** (notification preferences / delete-account flow), *not* a ticket.
"How do I unsubscribe / delete my account?" ends in a CTA button that navigates to the relevant account
page. A ticket is only created if the user explicitly still escalates (issue type falls back to
`UNSUBSCRIBE`), but the default terminal action is **navigate, don't ticket**. See test case
[T-04](#11-test-cases).

### 3.3 Member: continue an existing ticket

- The user can view their raised tickets (`GET /support/tickets`), open one
  (`GET /support/tickets/:id`), and post a follow-up message
  (`POST /support/tickets/:id/messages`, `senderType = user`).
- Admin replies (`senderType = admin`) appear in the same thread; the widget/ticket view polls or
  refetches via TanStack Query.

### 3.4 Admin: triage & resolve a ticket

```
Admin dashboard → /admin/support  (DataTable of tickets)
   │  filters by status / issueType / assignee; opens a row
   ▼
Ticket detail: user context + full transcript (bot + user messages)
   │  replies (POST admin message) · assigns · changes status
   ▼
Status lifecycle:  OPEN ──▶ PENDING ──▶ RESOLVED ──▶ CLOSED
```

- **OPEN** — just escalated, unassigned/untriaged.
- **PENDING** — admin is working it / awaiting user reply.
- **RESOLVED** — admin believes it's fixed (user can reopen by replying → back to PENDING, policy).
- **CLOSED** — terminal; archived.

Every status change and admin access is **audit-logged** with `actorType='admin'`
([07-security §2.3, §6](../architecture/07-security-compliance.md#23-ownership-enforcement)).

---

## 4. Data model

Authoritative schema lives in
[04-database-architecture.md §4](../architecture/04-database-architecture.md#4-prisma-schema-authoritative).
This module **uses** (does not redefine) these models:

| Model / enum | Role in Module 8 |
|---|---|
| `SupportTicket` | one row per escalation: `userId`, `issueType`, `subject?`, `status` (default `OPEN`), `createdAt`, `updatedAt`. |
| `SupportTicketMessage` | conversation lines on a ticket: `ticketId`, `senderType` (`user` \| `bot` \| `admin`), `message`, `createdAt`. |
| `TicketIssueType` (enum) | `LOGIN`, `SURVEY`, `SURVEY_PAYMENT`, `REWARDS`, `UNSUBSCRIBE`, `OTHER`. |
| `TicketStatus` (enum) | `OPEN`, `PENDING`, `RESOLVED`, `CLOSED`. |
| `Admin` / `AdminRole` | staff accounts; roles `SUPER_ADMIN`, `ADMIN`, `SUPPORT`, `DPO` handle tickets. |
| `Notification` | escalation alerts to admin/DPO (via NotificationsModule). |
| `AuditLog` | ticket create / status change / assignment / staff access. |

### 4.1 Topic → issue type mapping

The spec's five flow topics map to `TicketIssueType` as follows (the flow config carries this so the
frontend never hard-codes it):

| Flow topic | `issueType` | Escalates? | DPO/GRO routed? |
|---|---|---|---|
| Login Problems | `LOGIN` | Yes — raise ticket if unresolved | No |
| Survey Problems | `SURVEY` | Yes — raise ticket if unresolved | No |
| Survey Payment | `SURVEY_PAYMENT` | Yes — raise ticket | No |
| Rewards Delivery | `REWARDS` | Yes — raise ticket | No |
| Unsubscribe | `UNSUBSCRIBE` | **No** — route to Unsubscribe tab (ticket only if user still forces it) | **Yes** (privacy/erasure) |
| *(fallback)* | `OTHER` | Yes | No |

> **Why DPO on `UNSUBSCRIBE`:** unsubscribe / account-deletion touches consent withdrawal and the
> right-to-erasure — a **data-subject-rights** matter owned by the **DPO** role
> ([07-security §2.1, §8](../architecture/07-security-compliance.md#21-roles)). If such a request does
> get ticketed, the DPO must be notified. Which issue types route to the DPO is **config**
> (`dpoRouted: TicketIssueType[]`), not hard-coded, so the compliance owner can extend it (e.g. add
> `OTHER` when it carries a privacy request).

### 4.2 Status lifecycle & invariants

- New escalation → **`OPEN`** (schema default). Only an admin transitions state forward.
- Allowed transitions: `OPEN→PENDING`, `PENDING→RESOLVED`, `RESOLVED→CLOSED`, plus reopen
  `RESOLVED→PENDING` (user reply) and `PENDING→OPEN` is not used. Illegal transitions →
  `422 UNPROCESSABLE`.
- A ticket is **owned by the creating user**; members may only read/append to **their own** tickets
  (ownership enforced in the service, [07-security §2.3](../architecture/07-security-compliance.md#23-ownership-enforcement)).
- Messages are **append-only** (never edited/deleted from the API); the transcript is the record.

---

## 5. Flow engine

The decision-tree engine is the heart of the module. It is intentionally **data-driven** so topics can
be edited/extended without shipping code.

### 5.1 What a flow is

A **flow** is one topic (e.g. "Survey Payment"). It is a tree of **nodes**. Each node has:

- a `message` the bot says, and
- either a set of **`options`** (buttons that jump to a `next` node), or a terminal marker
  (`resolution` — a self-serve answer, or `escalate` — offer to raise a ticket), or an `action`
  (e.g. navigate to a tab, as Unsubscribe does).

After any **answer/leaf** node, the engine appends the standard **escalation prompt** (the two spec
buttons) unless the node opts out (`suppressEscalation`, used by Unsubscribe's navigate action).

### 5.2 Config shape (JSON)

Flows are authored as JSON validated by a Zod schema in `packages/types` (`ChatbotFlowSchema`). Shape:

```jsonc
// one topic
{
  "topic": "SURVEY_PAYMENT",           // maps to TicketIssueType
  "issueType": "SURVEY_PAYMENT",
  "title": "Survey Payment",
  "icon": "coins",
  "escalable": true,                    // does this topic offer ticket escalation?
  "dpoRouted": false,                   // notify DPO on escalation?
  "entryNodeId": "root",
  "nodes": {
    "root": {
      "id": "root",
      "message": "What's the problem with your survey reward?",
      "options": [
        { "label": "Points not credited", "next": "not_credited" },
        { "label": "Wrong amount credited", "next": "wrong_amount" }
      ]
    },
    "not_credited": {
      "id": "not_credited",
      "message": "Rewards can take up to 24h to post after a survey completes. If it's been longer, we can look into it.",
      "resolution": true                 // leaf answer → engine appends escalation prompt
    },
    "wrong_amount": {
      "id": "wrong_amount",
      "message": "The points shown before you start a survey are the guaranteed amount. If the credit differs, raise a ticket and we'll reconcile it.",
      "escalate": true
    }
  }
}
```

The standard **escalation prompt** appended after resolution/escalate leaves is *not* re-authored per
node — it is the fixed pair:

```jsonc
[
  { "label": "You have answered my query, thank you", "action": "resolve" },
  { "label": "I did not get a response. Let us raise a support ticket.", "action": "escalate" }
]
```

The **Unsubscribe** flow's terminal node uses a **navigate action** instead of escalation:

```jsonc
"how_to_unsubscribe": {
  "id": "how_to_unsubscribe",
  "message": "You can manage subscriptions or delete your account from your account settings.",
  "action": { "type": "navigate", "href": "/account/notifications" },
  "suppressEscalation": true            // route to tab, do NOT default to a ticket
}
```

### 5.3 Where flows are stored

- **Source of truth:** a versioned JSON file bundled with the API
  (`apps/api/src/modules/support/flows/*.json`), validated at boot against `ChatbotFlowSchema` (fail
  fast on malformed config, matching the [config-validation stance](../architecture/03-backend-architecture.md#5-configuration)).
- Served read-only by `GET /chatbot/flows` (and `/chatbot/flows/:topic`). Because it's static content,
  responses are cacheable (`Cache-Control` public, short TTL) and require **auth** (member) but no
  ownership.
- **Extensibility:** adding/editing a topic = editing JSON + adding a `TicketIssueType` value if a new
  category is needed (schema change in [04-database](../architecture/04-database-architecture.md), which
  owns enums). No widget code changes — the renderer is generic over nodes.
- **Future LLM path:** the same flow JSON can be indexed/embedded so an intent-router picks the entry
  node from free text; the tree + escalation stay as-is.

### 5.4 Engine responsibilities (client vs server)

- **Server** (`ChatbotService`): serve validated flow definitions; own the `issueType`/`dpoRouted`
  mapping. The server never trusts a client-supplied `issueType` on escalation — it derives it from the
  topic in the flow config.
- **Client** (`ChatWidget` flow renderer): hold the current node id + accumulated transcript; render the
  message and option buttons; on `resolve` show thank-you; on `escalate` call the ticket API; on
  `navigate` route via `next/link`.

---

## 6. API contracts

All endpoints follow [05-api-conventions.md](../architecture/05-api-conventions.md): `/v1` prefix,
`Bearer` JWT, the success/error **envelope**, canonical error codes, and cursor/offset pagination.
Prefixes: **`/chatbot/*`** (flow definitions) and **`/support/*`** (member tickets); admin under
**`/admin/support/*`**.

### 6.1 Chatbot flows (member)

> **`GET /v1/chatbot/flows`** — list all topic flow definitions
> - **Auth:** member
> - **200:** `{ data: ChatbotFlow[] }` — each flow = `{ topic, issueType, title, icon, escalable, entryNodeId, nodes }`
> - **Errors:** `401 UNAUTHENTICATED`
> - **Notes:** static config; cacheable; no PII, no ownership.

> **`GET /v1/chatbot/flows/:topic`** — one topic's flow tree
> - **Auth:** member
> - **Path:** `topic` (enum: `LOGIN|SURVEY|SURVEY_PAYMENT|REWARDS|UNSUBSCRIBE`)
> - **200:** `{ data: ChatbotFlow }`
> - **Errors:** `404 NOT_FOUND` unknown topic · `401 UNAUTHENTICATED`

### 6.2 Support tickets (member)

> **`POST /v1/support/tickets`** — escalate from Luna into a ticket
> - **Auth:** member
> - **Body:** `CreateTicketInput` (Zod, `packages/types`):
>   ```jsonc
>   {
>     "topic": "SURVEY_PAYMENT",           // topic key; server derives issueType from flow config
>     "subject": "Points not credited",     // optional, defaults from topic title
>     "transcript": [                        // the in-widget conversation to seed messages
>       { "senderType": "bot",  "message": "What's the problem with your survey reward?" },
>       { "senderType": "user", "message": "Points not credited" },
>       { "senderType": "bot",  "message": "Rewards can take up to 24h…" }
>     ],
>     "message": "Completed survey X 3 days ago, still no points"  // the user's escalation message
>   }
>   ```
> - **201:** `{ data: SupportTicket }` (with `status: "OPEN"`, `issueType` server-derived, message count)
> - **Errors:** `400 VALIDATION_ERROR` · `422 UNPROCESSABLE` topic not escalable (e.g. Unsubscribe when
>   `suppressEscalation`) · `401 UNAUTHENTICATED`
> - **Side effects (one transaction):** create `support_tickets` (`status=OPEN`, `userId=currentUser`,
>   `issueType` from config); insert the `transcript` + final `message` as `support_ticket_messages`
>   (`senderType` per line, plus the escalating `user` message); **then, after commit**, enqueue
>   **admin notification** and, if `dpoRouted`, **DPO/GRO email** via NotificationsModule; write
>   `audit_logs` (`support.ticket.create`). Provider calls are **not** inside the DB transaction
>   ([03-backend §9.3](../architecture/03-backend-architecture.md#93-db-connection-pooling)).

> **`GET /v1/support/tickets`** — the current user's tickets
> - **Auth:** member (ownership scoped to `currentUser.id`)
> - **Query:** `?status=OPEN&limit=20&cursor=…` (cursor pagination, [05-api §6](../architecture/05-api-conventions.md#6-pagination-filtering-sorting))
> - **200:** `{ data: SupportTicketSummary[], meta.pagination }`
> - **Errors:** `401 UNAUTHENTICATED`

> **`GET /v1/support/tickets/:id`** — one ticket + full transcript
> - **Auth:** member; **ownership enforced in service** (a member sees only their own → else `404 NOT_FOUND`)
> - **Path:** `id` (uuid)
> - **200:** `{ data: SupportTicket & { messages: SupportTicketMessage[] } }`
> - **Errors:** `404 NOT_FOUND` unknown / not caller's · `401 UNAUTHENTICATED`

> **`POST /v1/support/tickets/:id/messages`** — user reply on an open ticket
> - **Auth:** member; ownership enforced
> - **Path:** `id` (uuid)
> - **Body:** `{ message: string }` (Zod `PostTicketMessageInput`; server forces `senderType='user'`)
> - **201:** `{ data: SupportTicketMessage }`
> - **Errors:** `404 NOT_FOUND` not caller's · `422 UNPROCESSABLE` ticket `CLOSED` (no new messages) ·
>   `400 VALIDATION_ERROR`
> - **Side effects:** append message; if ticket was `RESOLVED`, reopen to `PENDING` (policy); notify
>   assigned admin; `updatedAt` bumped.

### 6.3 Support admin (staff)

Prefixed `/admin/support/*`, protected by `AdminGuard` + `@Roles(SUPPORT, ADMIN, SUPER_ADMIN, DPO)`
([05-api §7](../architecture/05-api-conventions.md#7-auth--authorization-patterns),
[07-security §2](../architecture/07-security-compliance.md#2-authorization)).

> **`GET /v1/admin/support/tickets`** — triage list (all users)
> - **Auth:** admin (`SUPPORT`+); `DPO` may filter to privacy-routed issue types
> - **Query:** `?status=&issueType=&assigneeId=&userId=&page=1&pageSize=20&sort=createdAt&order=desc`
>   (offset pagination allowed for admin tables, [05-api §6](../architecture/05-api-conventions.md#6-pagination-filtering-sorting))
> - **200:** `{ data: AdminTicketRow[], meta.pagination }`
> - **Side effects:** staff access to member support context is **audit-logged**.

> **`GET /v1/admin/support/tickets/:id`** — full ticket + transcript + user context
> - **Auth:** admin
> - **200:** `{ data: SupportTicket & { messages, user: { id, email, username } } }`
> - **Side effects:** `audit_logs` (`admin.ticket.view`).

> **`PUT /v1/admin/support/tickets/:id`** — status / assignment
> - **Auth:** admin
> - **Body:** `UpdateTicketInput` `{ status?: TicketStatus, assigneeAdminId?: string }`
> - **200:** `{ data: SupportTicket }`
> - **Errors:** `422 UNPROCESSABLE` illegal status transition · `404 NOT_FOUND` · `400 VALIDATION_ERROR`
> - **Side effects:** `audit_logs` (`admin.ticket.status_change` / `admin.ticket.assign`); optional
>   member notification on `RESOLVED`.

> **`POST /v1/admin/support/tickets/:id/messages`** — admin reply
> - **Auth:** admin
> - **Body:** `{ message: string }` (server forces `senderType='admin'`)
> - **201:** `{ data: SupportTicketMessage }`
> - **Side effects:** append message; notify the ticket's **member** (their chosen channels via
>   NotificationsModule); bump `updatedAt`; `audit_logs`.

---

## 7. Frontend

Consumes `@influencer/ui` only ([06-frontend §6](../architecture/06-frontend-architecture.md#6-component-reuse-strategy));
no bespoke modals/buttons/tables.

### 7.1 `ChatWidget` (member, all authed pages)

- The **floating button + panel** is the shared `ChatWidget`
  ([13-components §8](../design-system/13-components-library.md#8-feature-specific-shared-components-still-in-packagesui-or-appsweb-components)).
  Mounted **once** in the `(app)` route-group layout (`app/(app)/layout.tsx`) so it appears on every
  authenticated page (dashboard, surveys, polls, games, rewards, account). It is **not** on
  `(marketing)`/`(auth)` routes.
- It is a **client island**, `next/dynamic`-imported with `ssr: false` + a `Skeleton` fallback so it
  never bloats the server render ([06-frontend §9](../architecture/06-frontend-architecture.md#9-routing-code-splitting-image-optimization)).
- **Flow renderer** — a generic component that, given the current node, renders the bot `message` and a
  column of `Button`s for `options`. Selecting an option advances the node id (client state) and appends
  to the local transcript. Answer/leaf nodes append the two **escalation buttons**; the Unsubscribe
  navigate node renders a `LinkButton` to the account tab instead.
- **Escalation** — the "raise a ticket" button calls `POST /support/tickets` (TanStack Query mutation
  via the typed client) with the topic + transcript + the user's message. On success → **ticket
  confirmation** state (ticket id + reassuring copy + "View my tickets").
- **State & data:** flow definitions fetched via `GET /chatbot/flows` (TanStack Query, cached — static);
  conversation state is component-local (`useState`/reducer), not global. Mutations follow the
  [form/feedback patterns](../design-system/14-patterns.md) — success toast, errors mapped from the
  envelope.
- **Existing-ticket view** — from the panel, "My tickets" opens a list (`GET /support/tickets`) and a
  thread view (`GET /support/tickets/:id`) with a small reply `Form`
  (`POST /support/tickets/:id/messages`). Uses the §3 empty/loading/error pattern.

### 7.2 Admin ticket UI (`/admin/support`)

- **List** — the shared `DataTable`
  ([13-components §5](../design-system/13-components-library.md#5-data-display),
  [14-patterns §5](../design-system/14-patterns.md#5-data-table-pattern-server-cursor-pagination)) with
  columns: user, `issueType` (`Badge`), `status` (`Badge` with tone per status), assignee, updated,
  message count. Filters (`status`, `issueType`, `assignee`) are explicit query params bound to the
  TanStack query key ([14-patterns §9](../design-system/14-patterns.md#9-filter-pattern-rangefilter)).
- **Detail** — transcript rendered as a message thread (bot/user/admin styled distinctly), a reply
  `Form`, a status `Select`, and an assignee `Select`. Status change confirmation uses `ConfirmModal`
  for terminal transitions (`RESOLVED`/`CLOSED`).
- **Status `Badge` mapping:** `OPEN`→info, `PENDING`→warning, `RESOLVED`→success, `CLOSED`→muted
  (text + tone, never color-only — [06-frontend §10](../architecture/06-frontend-architecture.md#10-accessibility-responsive-i18n-readiness-page-states)).

### 7.3 Accessibility

- `ChatWidget` is keyboard-operable: the launcher is a labelled `IconButton`; the panel is a
  focus-managed dialog surface; option buttons are real `<button>`s in reading order; new bot messages
  announce via an `aria-live="polite"` region. Bot content is **rendered as text (escaped)** — never
  `dangerouslySetInnerHTML` — so authored flow content cannot inject markup ([§9](#9-security--compliance-notes)).

---

## 8. Backend

Structure per [03-backend-architecture.md §1](../architecture/03-backend-architecture.md#1-module-structure);
lives under `apps/api/src/modules/support/`.

### 8.1 Modules & services

- **`ChatbotModule`** (`chatbot.controller.ts` + `chatbot.service.ts`) — serves validated flow
  definitions from bundled JSON; owns the topic→`issueType`/`dpoRouted` mapping. Read-only, stateless.
- **`SupportModule`** (`support.controller.ts`, admin controller, `support.service.ts`) — ticket CRUD,
  message append, status/assignment, ownership checks, escalation orchestration. Imports
  **`NotificationsModule`** (admin + DPO alerts) and uses `PrismaService` + the audit logger.
- Controllers are **thin**; all business logic (ownership, transitions, transcript persistence,
  escalation) is in `SupportService`
  ([03-backend §2](../architecture/03-backend-architecture.md#2-layering)).

### 8.2 Escalation (the critical path)

`SupportService.createTicket()`:

1. Resolve the flow for `topic` from `ChatbotService`; **derive `issueType` and `dpoRouted` from
   config** (ignore any client-supplied issue type). If the topic is not `escalable` (e.g. Unsubscribe
   with `suppressEscalation`), throw `UnprocessableException('topic_not_escalable')` → `422`.
2. In **one `prisma.$transaction`**: create the `SupportTicket` (`status=OPEN`, `userId`), then insert
   the `transcript` lines + the user's escalation `message` as `SupportTicketMessage` rows with correct
   `senderType`.
3. **After commit** (no provider I/O inside the DB transaction —
   [03-backend §9.3](../architecture/03-backend-architecture.md#93-db-connection-pooling)): enqueue via
   **NotificationsModule** (a) an **admin/support-queue** notification, and (b) if `dpoRouted`, a
   **DPO/GRO email**. Sends are retryable BullMQ jobs
   ([03-backend §6](../architecture/03-backend-architecture.md#6-background-jobs--queues)).
4. Write `audit_logs` (`support.ticket.create`, `actorType='user'`).

```ts
// support.service.ts — escalation (shape; see 03-backend §2.3 for the canonical pattern)
async createTicket(userId: string, dto: CreateTicketInput): Promise<SupportTicket> {
  const flow = this.chatbot.getFlow(dto.topic);                 // config = source of truth
  if (!flow.escalable) throw new UnprocessableException('topic_not_escalable'); // 422

  const ticket = await this.prisma.$transaction(async (tx) => {
    const t = await tx.supportTicket.create({
      data: { userId, issueType: flow.issueType, subject: dto.subject ?? flow.title, status: 'OPEN' },
    });
    await tx.supportTicketMessage.createMany({
      data: [
        ...dto.transcript.map((m) => ({ ticketId: t.id, senderType: m.senderType, message: m.message })),
        { ticketId: t.id, senderType: 'user', message: dto.message },
      ],
    });
    return t;
  });

  // side effects AFTER commit — retryable, never inside the DB transaction
  await this.notifications.notifyAdminQueue({ type: 'SUPPORT_TICKET', ticketId: ticket.id });
  if (flow.dpoRouted) await this.notifications.notifyDpo({ ticketId: ticket.id, issueType: flow.issueType });
  await this.audit.log({ actorType: 'user', actorId: userId, action: 'support.ticket.create', targetType: 'ticket', targetId: ticket.id });
  return ticket;
}
```

### 8.3 Status transitions & ownership

- `updateTicket()` (admin) validates the transition against the allowed set
  ([§4.2](#42-status-lifecycle--invariants)); illegal → `422`. Records `audit_logs`.
- Member reads/appends are **scoped by `userId`** in the service (IDOR-proof — never trust the path id
  alone; [07-security §2.3](../architecture/07-security-compliance.md#23-ownership-enforcement)).
- Admin overrides (reading another user's ticket) are gated by role **and** audit-logged with
  `actorType='admin'`.

### 8.4 Notifications integration

Escalation and admin replies use **NotificationsModule** ([module-07](module-07-notifications.md)) — this
module does **not** talk to email/SMS providers directly:

- **Admin queue alert** on new ticket (in-app/admin channel).
- **DPO/GRO email** when `dpoRouted` (Unsubscribe / privacy issue types) — the DPO is the
  DPDP/CERT-In point-of-contact role ([07-security §2.1, §9](../architecture/07-security-compliance.md#21-roles)).
- **Member notification** on admin reply / `RESOLVED`, respecting the member's channel preferences.

---

## 9. Security & compliance notes

Ties to [07-security-compliance.md §11 (Phase 8 checklist)](../architecture/07-security-compliance.md#11-security-checklist-per-phase-ties-to-definition-of-done):

- **Ticket ownership** — members read/append only their own tickets; enforced in the service, not the
  controller/guard.
- **XSS-safe bot content** — flow messages and transcript are rendered as **escaped text** (no
  `dangerouslySetInnerHTML`); CSP is default-deny ([07-security §4.3](../architecture/07-security-compliance.md#43-output-encoding--xss)).
- **PII not echoed** — Luna does not surface a user's PII in bot answers; the transcript stored on a
  ticket is user-authored support context, and audit `metadata` never carries raw PII.
- **No third-party model** — because Luna is rule-based, no user message is sent to an external LLM;
  nothing to add to processor agreements for this feature.
- **DPO/GRO routing** — privacy-relevant escalations (`UNSUBSCRIBE`, and any config-added types) notify
  the **DPO** role, aligning support with data-subject-rights fulfilment
  ([07-security §8](../architecture/07-security-compliance.md#8-data-subject-rights)).
- **Audit** — ticket create, status change, assignment, and staff access to member tickets are all
  written to `audit_logs`.
- **Rate limiting** — ticket creation and message posting are covered by the general 100 req/min limit
  ([07-security §5](../architecture/07-security-compliance.md#5-rate-limiting--abuse-prevention)); the
  primary anti-spam control is that flows gate escalation behind a guided path.

---

## 10. Acceptance criteria

1. The `ChatWidget` floating button renders on **every authenticated page** and on **no**
   marketing/auth page; opening it shows the greeting + the five topics.
2. `GET /chatbot/flows` returns all five topic trees; each topic returns a valid tree navigable by
   option buttons; unknown topic → `404`.
3. After any answer node, the two escalation buttons appear (except Unsubscribe navigate nodes).
4. "You have answered my query, thank you" resolves the flow and creates **no** ticket.
5. "I did not get a response. Let us raise a support ticket." creates a `SupportTicket` with
   `status=OPEN` and the **correct `issueType`** for the topic, and persists the conversation as
   `SupportTicketMessage` rows (bot/user senders).
6. The `issueType` is **server-derived from flow config**; a client cannot spoof it.
7. The **Unsubscribe** topic routes the user to the Unsubscribe/account tab and does **not** create a
   ticket by default.
8. Ticket escalation fires an **admin-queue notification**; `UNSUBSCRIBE` (and any config-flagged type)
   additionally emails the **DPO/GRO** — both via NotificationsModule, after DB commit.
9. A member can list their tickets, open one, and reply; they **cannot** read another user's ticket
   (`404`).
10. An admin can list/filter tickets, open a ticket with full transcript, reply, assign, and move
    status through `OPEN→PENDING→RESOLVED→CLOSED`; illegal transitions → `422`.
11. Ticket create, status change, assignment, and admin access are **audit-logged**.
12. All endpoints conform to the envelope/error/auth/pagination conventions; all UI uses shared
    components/tokens (no one-off modal/table/button).

---

## 11. Tasks (ordered)

1. **Enums & schema** — confirm `TicketIssueType`, `TicketStatus`, `SupportTicket`,
   `SupportTicketMessage` exist in [04-database](../architecture/04-database-architecture.md); add
   `assigneeAdminId?` to `SupportTicket` if assignment is tracked (migration + review).
2. **Flow config + schema** — author the five topic JSON flows under
   `apps/api/src/modules/support/flows/`; define `ChatbotFlowSchema` + `CreateTicketInput` /
   `PostTicketMessageInput` / `UpdateTicketInput` in `packages/types`; validate flows at boot.
3. **`ChatbotModule`** — controller + service for `GET /chatbot/flows` and `/:topic`; topic→issueType /
   dpoRouted mapping.
4. **`SupportModule` (member)** — `createTicket` (escalation, single transaction + post-commit
   notifications + audit), list/get/append with ownership scoping.
5. **Notifications wiring** — `notifyAdminQueue`, `notifyDpo`, member reply notification via
   [NotificationsModule](module-07-notifications.md).
6. **Admin support controller** — list/filter, get + user context, `PUT` status/assign (transition
   guard), admin message; role-gated + audit-logged.
7. **`ChatWidget` frontend** — mount in `(app)` layout (dynamic, `ssr:false`); build the generic flow
   renderer, escalation buttons, Unsubscribe navigate action, ticket-confirmation state.
8. **Member ticket views** — "My tickets" list + thread + reply form (empty/loading/error pattern).
9. **Admin ticket UI** — `DataTable` list with filters + `Badge` statuses; detail thread + reply +
   status/assignee `Select` + `ConfirmModal` on terminal transitions.
10. **Audit + security pass** — verify ownership, XSS-safe rendering, audit entries, Phase 8 security
    checklist.
11. **Tests** — unit/integration/e2e per [§12](#12-test-cases); wire into CI.
12. **Seed (optional)** — a couple of sample tickets for admin-UI development.

---

## 12. Test cases

| # | Area | Test | Expected |
|---|---|---|---|
| T-01 | Flows | `GET /chatbot/flows` authenticated | 200, five topic trees, each with a valid `entryNodeId` + nodes |
| T-02 | Flows | `GET /chatbot/flows/:topic` for each of the 5 topics | 200, that topic's tree; unknown topic → `404` |
| T-03 | Flow render | Navigate a topic's options in the widget | reaches an answer node; escalation buttons appear |
| T-04 | Unsubscribe | Complete the Unsubscribe flow | routes to the Unsubscribe/account tab; **no** ticket created |
| T-05 | Escalate | Click "raise a support ticket" on Survey Payment | `SupportTicket` created `status=OPEN`, `issueType=SURVEY_PAYMENT` |
| T-06 | Issue type per topic | Escalate from Login / Survey / Rewards | tickets carry `LOGIN` / `SURVEY` / `REWARDS` respectively |
| T-07 | Server-derived type | `POST /support/tickets` with a spoofed/mismatched issue type in body | server ignores it; `issueType` derived from `topic` config |
| T-08 | Transcript | Escalate after a multi-step conversation | `support_ticket_messages` rows created with `bot`/`user` sender types in order |
| T-09 | Resolve | Click "you have answered my query" | flow resolved; **zero** tickets created |
| T-10 | Ownership | User B `GET /support/tickets/:id` for User A's ticket | `404 NOT_FOUND` |
| T-11 | Member reply | `POST /support/tickets/:id/messages` on own ticket | 201, message appended `senderType=user` |
| T-12 | Closed ticket | Member replies to a `CLOSED` ticket | `422 UNPROCESSABLE` |
| T-13 | Admin resolve | Admin `PUT` status `OPEN→PENDING→RESOLVED→CLOSED` | each 200; ticket ends `CLOSED` |
| T-14 | Illegal transition | Admin `PUT` status `OPEN→CLOSED` (skipping) | `422 UNPROCESSABLE` |
| T-15 | Admin reply | Admin posts a message | 201 `senderType=admin`; member notified |
| T-16 | Admin auth | `SUPPORT`-less member hits `/admin/support/tickets` | `403 FORBIDDEN` |
| T-17 | DPO notify | Escalate a `dpoRouted` issue type (Unsubscribe forced, or config type) | DPO/GRO email fired via NotificationsModule |
| T-18 | Non-DPO | Escalate `SURVEY_PAYMENT` | admin-queue notified; **no** DPO email |
| T-19 | Widget presence | Load dashboard/surveys/polls/games/rewards/account | Luna button present on all; absent on `(marketing)`/`(auth)` |
| T-20 | Audit | Create ticket, change status, admin view | `audit_logs` rows: `support.ticket.create`, `admin.ticket.status_change`, `admin.ticket.view` |
| T-21 | XSS | Flow/transcript content with markup | rendered escaped; no HTML injection |
| T-22 | Envelope | Any endpoint success/error | conforms to `data`/`error`/`meta`; canonical error codes |

---

## Related documents

- [04-database-architecture.md](../architecture/04-database-architecture.md) — `SupportTicket`,
  `SupportTicketMessage`, `TicketIssueType`, `TicketStatus`, `Admin` (authoritative schema).
- [03-backend-architecture.md](../architecture/03-backend-architecture.md) — module structure, layering,
  transactions, queues.
- [05-api-conventions.md](../architecture/05-api-conventions.md) — envelope, error codes, auth, pagination.
- [06-frontend-architecture.md](../architecture/06-frontend-architecture.md) — RSC/client, typed client,
  route groups.
- [07-security-compliance.md](../architecture/07-security-compliance.md) — ownership, XSS, audit, DPO
  role, Phase 8 checklist.
- [13-components-library.md](../design-system/13-components-library.md) — `ChatWidget`, `Modal`,
  `Button`, `DataTable`, `Badge`.
- [14-patterns.md](../design-system/14-patterns.md) — form / modal / data-table / feedback patterns.
- [module-07-notifications.md](module-07-notifications.md) — admin + DPO notification transport.
- [Influencer_Platform_Full_Breakdown.md §8](../Influencer_Platform_Full_Breakdown.md) — source spec.

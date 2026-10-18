# Phase Roadmap

The build order, phase → module mapping, dependencies, and definition-of-done. Each phase ships a
working, testable increment. One module doc per phase (see `modules/`).

Reference product spec: [BinaryIQ_Full_Breakdown.md](../BinaryIQ_Full_Breakdown.md).
Architecture backbone: [04-database](../architecture/04-database-architecture.md),
[05-api](../architecture/05-api-conventions.md). Design backbone:
[11-color](../design-system/11-color-system.md), [13-components](../design-system/13-components-library.md).

---

## Phase → module → deliverable

| Phase | Weeks | Module doc | Deliverable | Depends on |
|---|---|---|---|---|
| **0 — Foundation** | 1–2 | [module-00](../modules/module-00-foundation.md) | Turborepo monorepo, tooling, design-system + base UI kit, Prisma DB + Identity/Points tables, auth scaffold, CI/CD, app shell | — |
| **1 — Auth & Registration** | 3 | [module-01](../modules/module-01-auth-registration.md) | 2-step signup, email verification (+500 pts), login/JWT, password reset | 0 |
| **2 — Profile & Account** | 4 | [module-02](../modules/module-02-profile-account.md) | 14 profile-survey categories (+100/200), account tabs (Profile/Email/Password/PayPal/About You) | 1 |
| **3 — Points & Rewards** | 5 | [module-03](../modules/module-03-points-rewards.md) | Points dashboard, transaction history, rewards catalogue, redemption | 1 (ledger from 0) |
| **4 — Surveys** | 6 | [module-04](../modules/module-04-surveys.md) | Priority/Quick/Premium listings, profile-based matching, completion crediting | 2, 3 |
| **5 — Polls** | 7 | [module-05](../modules/module-05-polls.md) | Sponsored polls, vote-once flow, live results, +15 pts | 3 |
| **6 — Games** | 8 | [module-06](../modules/module-06-games.md) | Daily Spin-the-Wheel, server-side weighted outcome, Redis daily lock, animation | 3 |
| **7 — Notifications** | 9 | [module-07](../modules/module-07-notifications.md) | Email/Push/SMS/WhatsApp channels + per-category preferences | 1 (hooks across all) |
| **8 — Chatbot (Luna)** | 10 | [module-08](../modules/module-08-chatbot-luna.md) | FAQ flows, escalation → support tickets, admin ticket view | 7 |
| **9 — Security & Launch** | 11 | [module-09](../modules/module-09-security-launch.md) | Encryption, audit logs, rate limiting, DPDP/CERT-In/GDPR hardening, launch readiness | all |

> Notifications (Phase 7) is built as a **cross-cutting service** early-scaffolded in Phase 0/1 (so
> registration email works), then fully expanded in Phase 7. Security (Phase 9) is applied continuously
> from Phase 0; Phase 9 is the audit/hardening/sign-off pass, not the first time security is considered.

## Cross-cutting concerns (present from Phase 0)

- **Points ledger** (`PointsService`) — defined in Phase 0, consumed by 1/3/5/6. See
  [04-database §5](../architecture/04-database-architecture.md).
- **Design system / UI kit** — Phase 0; every later phase consumes, never forks it.
- **Auth guards & API envelope** — Phase 0/1; all later endpoints follow
  [05-api-conventions](../architecture/05-api-conventions.md).
- **Notifications transport** — minimal email in Phase 1 (verification), full channels in Phase 7.
- **Audit logging** — middleware from Phase 0; every mutating admin/user action recorded.

## Definition of Done (every phase)

A phase is done when:
1. All acceptance criteria in its module doc pass.
2. Unit + integration tests green; coverage meets targets in
   [08-testing-strategy](../architecture/08-testing-strategy.md); key e2e flows pass.
3. Endpoints conform to [05-api-conventions](../architecture/05-api-conventions.md) (envelope, errors,
   auth, pagination).
4. UI uses only shared components/tokens ([13-components](../design-system/13-components-library.md),
   [11-color](../design-system/11-color-system.md)); no one-off colors or duplicate modals/inputs.
5. Prisma migration reviewed & applied; seed updated if needed.
6. Security checklist for the phase satisfied (authZ/ownership, validation, rate limits, audit).
7. Docs updated (module doc reflects any decisions made during build).
8. Deployed to staging and smoke-tested.

## Milestones

- **M1 (end Phase 1):** a user can register, verify email, log in, and has 500 points.
- **M2 (end Phase 3):** full earn-and-redeem loop works (profile → points → rewards).
- **M3 (end Phase 6):** all engagement mechanics live (surveys, polls, games).
- **M4 (end Phase 9):** production-ready, compliant, launch sign-off.

## Environments

`local` → `staging` → `production`. Migrations promoted with the app. See
[09-devops-cicd](../architecture/09-devops-cicd.md).

## Risk notes

- **Points integrity** is the highest-risk area — ledger transaction rules are non-negotiable (module 3).
- **Daily spin fairness/anti-abuse** — server-side outcome + Redis lock + DB unique (module 6).
- **PII compliance** — encryption + consent logging must be right before launch (module 9).
- **Provider dependencies** (SendGrid/Twilio/FCM/PayPal) — abstract behind interfaces so they're
  swappable and mockable (module 7).

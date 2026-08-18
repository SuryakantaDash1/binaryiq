# Influencer Platform — Documentation

A survey / polls / games / rewards community web app (Toluna-style). Users register, complete
profile surveys, take surveys/polls, play the daily Spin-the-Wheel, earn **points**, and redeem
them for real-world rewards.

**Stack:** Turborepo monorepo · Next.js 14 (App Router, TS) · NestJS (TS) · PostgreSQL 15 + Prisma ·
Redis · shared design system. Full rationale in [architecture/02-tech-stack.md](architecture/02-tech-stack.md).

---

## How to read these docs (recommended order)

### 1. Start here
- [00-project-overview.md](00-project-overview.md) — vision, scope, glossary, module map, resolved spec gaps
- [phases/00-roadmap.md](phases/00-roadmap.md) — phase → module build order & milestones

### 2. Architecture (the "how it's built" backbone)
- [architecture/01-system-architecture.md](architecture/01-system-architecture.md) — monorepo, services, request lifecycle
- [architecture/02-tech-stack.md](architecture/02-tech-stack.md) — every technology + why
- [architecture/03-backend-architecture.md](architecture/03-backend-architecture.md) — NestJS structure, layering, errors, jobs
- [architecture/04-database-architecture.md](architecture/04-database-architecture.md) — **full Prisma schema, ERD, points ledger** ⭐
- [architecture/05-api-conventions.md](architecture/05-api-conventions.md) — **REST standards, response envelope, DTOs** ⭐
- [architecture/06-frontend-architecture.md](architecture/06-frontend-architecture.md) — Next.js structure, data fetching, reuse
- [architecture/07-security-compliance.md](architecture/07-security-compliance.md) — auth, encryption, DPDP/CERT-In/GDPR
- [architecture/08-testing-strategy.md](architecture/08-testing-strategy.md) — unit/integration/e2e, coverage gates
- [architecture/09-devops-cicd.md](architecture/09-devops-cicd.md) — environments, CI/CD, deploys

### 3. Design system (the "how it looks" backbone)
- [design-system/10-design-principles.md](design-system/10-design-principles.md) — UX principles, a11y, responsive
- [design-system/11-color-system.md](design-system/11-color-system.md) — **magenta brand token scale + semantic** ⭐
- [design-system/12-typography.md](design-system/12-typography.md) — type scale, font stack
- [design-system/13-components-library.md](design-system/13-components-library.md) — **reusable component catalogue** ⭐
- [design-system/14-patterns.md](design-system/14-patterns.md) — modal / form-field / empty-loading-error patterns

### 4. Standards
- [standards/15-coding-standards.md](standards/15-coding-standards.md) — TS config, lint, naming, conventions
- [standards/16-git-workflow.md](standards/16-git-workflow.md) — branching, PRs, review checklist

### 5. Modules (full-detail, one per build phase)
| Phase | Module | Doc |
|---|---|---|
| 0 | Foundation | [modules/module-00-foundation.md](modules/module-00-foundation.md) |
| 1 | Auth & Registration | [modules/module-01-auth-registration.md](modules/module-01-auth-registration.md) |
| 2 | Profile Surveys & Account | [modules/module-02-profile-account.md](modules/module-02-profile-account.md) |
| 3 | Points & Rewards | [modules/module-03-points-rewards.md](modules/module-03-points-rewards.md) |
| 4 | Surveys | [modules/module-04-surveys.md](modules/module-04-surveys.md) |
| 5 | Polls | [modules/module-05-polls.md](modules/module-05-polls.md) |
| 6 | Games (Spin the Wheel) | [modules/module-06-games.md](modules/module-06-games.md) |
| 7 | Notifications | [modules/module-07-notifications.md](modules/module-07-notifications.md) |
| 8 | Chatbot (Luna) | [modules/module-08-chatbot-luna.md](modules/module-08-chatbot-luna.md) |
| 9 | Security & Launch | [modules/module-09-security-launch.md](modules/module-09-security-launch.md) |

---

## Source-of-truth spec
The original product spec lives alongside these docs and remains authoritative for product intent:
- [Influencer_Platform_Full_Breakdown.md](Influencer_Platform_Full_Breakdown.md)
- `influencer_platform_v2.docx`

These engineering docs translate that spec into an implementable architecture. Where the spec was
ambiguous, decisions are recorded in [00-project-overview.md](00-project-overview.md) §"Resolved spec gaps".

⭐ = referenced by most module docs; keep these authoritative and avoid duplicating their content elsewhere.

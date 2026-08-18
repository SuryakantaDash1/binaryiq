# 00 — Project Overview

## 1. Vision

The **Influencer Platform** is a consumer engagement and market-research community. Members create a
profile, answer surveys, vote on sponsored polls, and play a daily game — earning **points** that
convert to real-world value (charity donations and PayPal cash). The business value is twofold:
brands get high-quality opinion data; members get rewarded for their time.

**Conversion rate:** `100 points = ₹1.00 (INR)`. This is the single monetary constant; it lives in
config, never hard-coded per-feature.

## 2. Product goals

- Frictionless two-step registration with verified email and an instant 500-point welcome reward.
- A profile that gets richer over time (14 survey categories) and drives better survey matching.
- A trustworthy, auditable **points ledger** — every credit/debit is traceable.
- Daily engagement hooks: polls and the Spin-the-Wheel game.
- Multi-channel notifications (Email / Push / SMS / WhatsApp) with user-controlled preferences.
- Compliance-first: India DPDP Act 2023, CERT-In 2022, GDPR-ready.

## 3. Non-goals (initial release)

- Native mobile apps (responsive web only; PWA optional later).
- Contests module (see Resolved spec gaps §7).
- In-house survey authoring engine beyond what modules 4/5 define.
- Real-money wallet beyond PayPal payout + charity redemptions.

## 4. Module map (build modules)

The spec's module numbering is normalized here to match the actual build order. Each maps to one
phase and one module doc.

| # | Module | What it delivers | Points |
|---|---|---|---|
| 0 | Foundation | Monorepo, tooling, design system, base UI kit, DB, auth scaffold, CI/CD | — |
| 1 | Auth & Registration | 2-step signup, email verification, login/JWT, password reset | +500 on verify |
| 2 | Profile Surveys & Account | 14 profile categories, account tabs (Profile/Email/Password/PayPal/About You) | +100–200 per category |
| 3 | Points & Rewards | Ledger, dashboard, rewards catalogue, redemption | variable |
| 4 | Surveys | Priority / Quick / Premium surveys + profile-based matching | up to 3,400 |
| 5 | Polls | Sponsored single/multi-choice polls, vote-once, live results | +15 per vote |
| 6 | Games | Daily Spin-the-Wheel, server-side weighted outcome, Redis daily lock | 0–1,000 per spin |
| 7 | Notifications | Email/Push/SMS/WhatsApp channels + per-category preferences | — |
| 8 | Chatbot (Luna) | FAQ flows + support-ticket escalation | — |
| 9 | Security & Launch | Encryption, audit, compliance hardening, launch readiness | — |

## 5. Personas

- **Member** — registers, completes profile, earns and redeems points.
- **Admin** — creates/deactivates polls, games, surveys, rewards; handles support tickets; reads audit logs.
- **System** — automated jobs: notification sends, daily reset, token cleanup, ledger reconciliation.

## 6. Glossary

| Term | Meaning |
|---|---|
| Points | The reward currency. Source of truth = append-only `points_transactions`. |
| Balance | Derived from the ledger (sum of credits − debits). Never edited directly. |
| Profile survey | One of 14 demographic categories (About You, Health, Travel, …). |
| Survey | A monetizable brand survey: Priority, Quick, or Premium. |
| Poll | A short sponsored single/multi-choice opinion vote (15 pts). |
| Spin | One play of the daily Spin-the-Wheel game (one per user per day). |
| Redemption | Spending points on a reward (charity or PayPal). |
| Ledger | The `points_transactions` table — immutable financial record. |

## 7. Resolved spec gaps (decisions of record)

These clarify ambiguities in the source spec. See it flagged in
[Influencer_Platform_Full_Breakdown.md](Influencer_Platform_Full_Breakdown.md) §13.

1. **Contests** — listed once in the spec's summary table (as module 8) with no section, schema, or
   endpoints. **Decision: out of scope / deferred.** Not built in this release. Data model leaves room
   (activity types are extensible) so it can be added later without migration pain.
2. **Rewards mid-tier gap** — spec jumps from ₹45 charity items (4,500 pts) to a ₹900 PayPal payout
   (90,000 pts). **Decision: rewards catalogue is fully data-driven** (`rewards` table), so product can
   add mid-tier items (merchandise, vouchers) without code changes.
3. **"PIN Code" duplication** — appears in Step-1 registration and again in About You.
   **Decision: it is the same postal code.** Captured once on the user's address; the registration step
   collects it, the About You tab edits it. No duplicate storage.
4. **Points expiry** — spec is silent. **Decision: no expiry by default**, implemented as a configurable
   policy flag so an expiry window can be enabled later.
5. **Spin range** — spec says "40–1000" but includes a 0-pt "better luck" segment.
   **Decision: documented range is 0–1,000**, 8 weighted segments summing to probability 1.0.
6. **Module numbering** — spec body and summary disagreed. **Decision: use the normalized map in §4.**
7. **Registration flow** — 5 rows but described as "4-stage"; stage 5 (About You) is really the first
   profile survey. **Decision:** verification completes registration (+500); About You is the first
   Phase-2 profile survey (+100), not part of the auth transaction.

## 8. Success metrics (for reference)

- Registration → email-verified conversion rate.
- Profile completion rate (categories completed per active user).
- DAU driven by polls + daily spin.
- Redemption rate and payout success rate.
- Notification opt-in rates per channel.

## 9. Where to go next

Read [phases/00-roadmap.md](phases/00-roadmap.md) for the build sequence, then the architecture
backbone (`architecture/04` and `05`) and the design backbone (`design-system/11` and `13`) before
opening any module doc.

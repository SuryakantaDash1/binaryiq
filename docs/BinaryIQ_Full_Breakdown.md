# BinaryIQ — Complete Technical Specification (v2.0)

*Full content breakdown — every section of the source document restated in full. Source: 23-page docx, May 2026, Confidential.*

---

## 1. Project Overview

### 1.1 Introduction

The BinaryIQ is a survey, polls, games, and rewards community web application. Users register, build profiles, participate in surveys/polls/games, earn points, and redeem them for real-world rewards.

### 1.2 Platform Modules Summary

| # | Module | Description | Points Earned |
|---|---|---|---|
| 1 | Authentication & Registration | Two-step registration with email verification flow | 500 on registration |
| 2 | Notification System | Email, Push, SMS, WhatsApp channel preferences | — |
| 3 | Points & Rewards | Points ledger, history, redemption catalogue | Variable per action |
| 4 | Profile Surveys | 14 demographic survey categories | 100–200 per category |
| 5 | Surveys | Priority, Quick, Premium survey types | Up to 3,400 per survey |
| 6 | Polls | Sponsored polls — vote and earn points | 15 per vote |
| 7 | Games | Daily Spin the Wheel game — free, once per day | Up to 1,000 per spin |
| 8 | Contests | Community contests and challenges | Variable |
| 9 | Chatbot (Luna) | Virtual assistant with FAQ flows and ticket escalation | — |

> Note: item 8, "Contests," appears only in this summary table — it has no dedicated section, schema, or endpoints anywhere else in the document.

### 1.3 Tech Stack Summary

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 14 (React) | SSR, routing, UI — fast and SEO-friendly |
| Backend | Node.js via Next.js API Routes | REST API, business logic, middleware |
| Database | PostgreSQL 15 + Prisma ORM | Relational data, GDPR compliance, type-safe queries |
| Cache | Redis (Upstash) | Session storage, OTP, rate limiting, daily spin tracking |
| Auth | NextAuth.js + JWT | Secure session management, refresh tokens |
| Email | SendGrid | Transactional email — verification, surveys, rewards |
| SMS + WhatsApp | Twilio | Survey invitations, OTP verification |
| Push | Firebase FCM | Real-time push notifications |
| File Storage | AWS S3 / Cloudinary | Profile photo uploads |
| Deployment | Vercel + Railway | Frontend + DB hosting, CI/CD auto-deploy |

---

## 2. Module 1 — Authentication & Registration

### 2.1 Complete Registration Flow (Step by Step)

The registration process has a specific 4-stage flow (the document lists 5 rows total, including the profile-survey step):

| Stage | What Happens | Technical Action |
|---|---|---|
| Stage 1 — Step 1 Form | User fills: Country, First Name, Surname, Date of Birth, Gender | Validate fields client-side with Zod; store in session state |
| Stage 2 — Step 2 Form | User fills: Email, Password, PIN Code, Username (auto-suggested), Mobile Number (optional) | Validate email uniqueness; hash password with bcrypt; store all in session |
| Stage 3 — Registration Email Sent | After clicking Register, system sends a verification email with a unique token link. Page shows: "We have sent you an activation email on [email]" | Generate UUID token; store in DB with 24hr expiry; send email via SendGrid with branded template |
| Stage 4 — Email Verification Click | User clicks "Confirm your registration" button in email. Redirects to emailvalidated?token=... page | Validate token from DB; mark email as verified; award 500 welcome points; redirect to About You profile survey |
| Stage 5 — About You Profile Survey | User lands on Thank You page + About You survey. Completing it awards 100 bonus points | Store profile survey responses; credit 100 points; redirect to main dashboard |

> *NOTE: The registration email uses a branded HTML template with the platform logo, a pink 'Confirm your registration' button, and text explaining the 500 welcome bonus points.*

### 2.2 Email Verification Token — Database Schema

| Column | Type | Description |
|---|---|---|
| id | UUID PRIMARY KEY | Unique token record |
| user_id | UUID REFERENCES users | Which user the token belongs to |
| token | VARCHAR(255) UNIQUE | Secure random UUID token |
| token_type | VARCHAR(50) | Type: email_verification, password_reset |
| expires_at | TIMESTAMPTZ | Token expiry — 24 hours from creation |
| used_at | TIMESTAMPTZ NULLABLE | Set when token is consumed |
| created_at | TIMESTAMPTZ | Creation timestamp |

### 2.3 Account Management Tabs

| Tab | Fields / Features |
|---|---|
| Profile | Profile photo (upload/change/delete), First name, Surname, Date of birth, Gender |
| Email | Change registered email address with re-verification |
| Password | Change password — requires current password + new password confirmation |
| PayPal | Link PayPal account email for reward payout — warning shown to add our payout email to PayPal |
| About You | Extended profile: address, city, PIN code, education, employment, household details |

### 2.4 Auth API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/auth/register/step1 | Save Step 1 data (name, DOB, gender) to session |
| POST | /api/auth/register/step2 | Complete registration — create user, send verification email |
| GET | /api/auth/verify-email?token= | Verify email token, award 500 points, redirect to About You |
| POST | /api/auth/login | Login with email + password, return JWT + refresh token |
| POST | /api/auth/logout | Invalidate session |
| POST | /api/auth/forgot-password | Send password reset email with OTP link |
| POST | /api/auth/reset-password | Reset password using valid token |
| POST | /api/auth/refresh | Refresh expired access token |

---

## 3. Module 2 — Notification System

### 3.1 Notification Channels

| Channel | Provider | Notification Types | Toggle in Settings? |
|---|---|---|---|
| Email | SendGrid | Registration, survey invites, rewards, password reset | Yes |
| Push | Firebase FCM | Survey reminders, points updates, game reminders | Yes |
| SMS | Twilio | Survey invitations, OTP verification | Yes |
| WhatsApp | Twilio WhatsApp API | Survey invitations, reward updates | Yes |

### 3.2 Notification Settings Page

Users access notification preferences via Account > Notifications tab. They can toggle each channel ON/OFF per notification category:

- Survey Invitations — Email ON, Push OFF, SMS ON, WhatsApp OFF (user's choice)
- Offers & News — Email ON, Push ON toggles
- All preferences stored per user in notification_preferences table
- All sends respect user preferences — suppressed if channel toggled OFF

---

## 4. Module 3 — Points & Rewards System

### 4.1 Points Conversion Rate

**100 Points = INR 1.00 (Indian Rupee)**

### 4.2 Points Earning Table

| Action | Points | INR Value | Trigger |
|---|---|---|---|
| User Registration (on email verify) | 500 pts | INR 5.00 | Automatic on email verification |
| Complete About You Profile Survey | 100 pts | INR 1.00 | On survey submission |
| Complete each Profile Survey Category | 100 pts | INR 1.00 | On each category submission |
| Social Activities Profile Survey | 200 pts | INR 2.00 | On submission (higher value) |
| Vote on a Sponsored Poll | 15 pts | INR 0.15 | On each poll vote |
| Spin the Wheel (Daily Game) | 40–1000 pts | INR 0.40–10.00 | Random outcome on spin |
| Complete a Quick Survey | Variable | Variable | On survey completion |
| Complete a Premium Survey | Up to 3,400 pts | Up to INR 34.00 | On survey completion |
| Complete a Priority Survey | Variable | Variable | On survey completion |

### 4.3 Rewards Redemption Catalogue

| Reward | Points Required | Description |
|---|---|---|
| Offer 4 meals to kids (Africa) | 4,500 pts | Donate to fight malnutrition in Africa |
| Plant 1 tree in Madagascar | 4,500 pts | Reforestation charity contribution |
| Remove 100g plastic from ocean | 4,500 pts | Fight plastic pollution charity |
| PayPal Payout (USD) | 90,000 pts | Cash payout via PayPal to linked account |

### 4.4 Points Dashboard

- Current Balance — live points total
- Earned Points — total ever earned
- Spent Points — total redeemed
- Date Range Filter — filter transaction history by date range
- Points History tab — Date, Description, Points columns with all transactions
- Rewards History tab — Redemption records with status (Pending / Completed)

---

## 5. Modules 4 & 5 — Profile Surveys & Surveys

### 5.1 Profile Survey Categories (14 Categories)

| Category | Points | Data Collected |
|---|---|---|
| About You | 100 pts | Address, city, PIN, education level, employment type |
| Home and Family | 100 pts | Household size, children count, living area type |
| Employment | 100 pts | Job type, income bracket, chief wage earner details |
| Finance | 100 pts | Yearly income, monthly income, assets owned |
| Health | 100 pts | Health habits, medical conditions, fitness level |
| Personal Care | 100 pts | Personal care product usage and brand preferences |
| Lifestyle | 100 pts | Hobbies, interests, outdoor activities |
| Travel | 100 pts | Travel frequency, destination preferences, modes |
| Shopping | 100 pts | Shopping habits, preferred channels, spend levels |
| Media | 100 pts | TV, radio, streaming consumption patterns |
| Technology | 100 pts | Device ownership, internet usage, app preferences |
| Automotive | 100 pts | Vehicle ownership, driving habits |
| Video Games | 100 pts | Gaming platforms, genres, spend |
| Social Activities | 200 pts | Social media usage, community involvement |

### 5.2 Survey Types

| Type | Description | Points | Badge Color |
|---|---|---|---|
| Priority Surveys | Recommended surveys matched to user profile | Variable | Pink |
| Quick Surveys | Short surveys for fast completion on the go | Up to moderate | Blue |
| Premium Surveys | Longer, higher value surveys | Up to 3,400 pts | Purple |

### 5.3 Survey Matching Logic

Users are matched to surveys based on their profile survey data:

- Age and gender demographics from registration
- Education level, employment type, income bracket from About You survey
- Location (PIN code / city) for regional surveys
- Lifestyle and interest categories from profile surveys
- If a user has not completed profile surveys, only generic surveys are shown

> *NOTE: Encourage users to complete all 14 profile survey categories to maximize survey matches and earnings.*

---

## 6. Module 6 — Polls (Sponsored Polls)

### 6.1 What are Polls?

Polls are short sponsored opinion questions that users can answer to earn points. Unlike full surveys, polls are single or multi-question quick votes. They are sponsored by brands and companies seeking quick consumer opinions.

From the homepage, users see a Polls card showing: "0 of X voted — Your opinion matters! X polls are eager for your input." Users click Participate to go to the polls listing.

### 6.2 Poll Features

- Each poll shows: number of users already voted, the question text, answer options
- Question types: single-choice radio (Yes/No type) and multi-choice checkbox
- Vote button shows points reward: "Vote (15 Points)"
- After voting: results/percentage breakdown shown to the user
- User cannot vote on the same poll twice — one vote per poll per user
- Polls can have an expiry date set by the admin
- Poll counter on homepage updates live as user votes

### 6.3 Poll Examples from Platform

| Poll Question | Type | Options | Points |
|---|---|---|---|
| Do you think Westside brand is a 'Made in India' brand? | Single choice | Yes / No | 15 pts |
| How frequently do you listen to FM Radio? | Multi-choice | Everyday / 2-3 days/week / 1 day/week / Less frequently / Do not listen | 15 pts |
| Custom brand opinion polls | Single or multi | As defined by poll creator | 15 pts |

### 6.4 Poll Database Schema

| Table | Column | Type | Description |
|---|---|---|---|
| polls | id | UUID PK | Unique poll ID |
| polls | question | TEXT | The poll question text |
| polls | poll_type | VARCHAR(20) | single_choice or multi_choice |
| polls | points_reward | INTEGER | Points awarded per vote (default 15) |
| polls | sponsor_name | VARCHAR(200) | Brand/company sponsoring the poll |
| polls | total_votes | INTEGER | Running vote count (cached) |
| polls | expires_at | TIMESTAMPTZ | Poll expiry — NULL means no expiry |
| polls | is_active | BOOLEAN | Whether poll is currently accepting votes |
| poll_options | id | UUID PK | Unique option ID |
| poll_options | poll_id | UUID FK | Links to polls table |
| poll_options | option_text | VARCHAR(500) | The option label text |
| poll_options | vote_count | INTEGER | Running count for this option |
| poll_votes | id | UUID PK | Unique vote record |
| poll_votes | poll_id | UUID FK | Which poll was voted on |
| poll_votes | user_id | UUID FK | Which user voted |
| poll_votes | option_ids | UUID[] | Array of selected option IDs |
| poll_votes | voted_at | TIMESTAMPTZ | Timestamp of vote |
| poll_votes | points_awarded | INTEGER | Points credited for this vote |

### 6.5 Poll API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | /api/polls | List all active polls for current user (excludes already voted) |
| GET | /api/polls/:id | Get poll details, question, and options |
| POST | /api/polls/:id/vote | Submit vote — body: { option_ids: [] } |
| GET | /api/polls/:id/results | Get vote results/percentages after voting |
| GET | /api/polls/count | Get count of unvoted polls for homepage card |
| GET | /api/admin/polls | Admin: list all polls |
| POST | /api/admin/polls | Admin: create new poll |
| PUT | /api/admin/polls/:id | Admin: update poll or deactivate |

### 6.6 Poll Vote Flow

1. User navigates to Polls section from homepage card or navigation
2. Poll listing page shows all active polls with participant count
3. User selects a poll and sees the question with answer options
4. User selects answer (radio for single, checkbox for multi-choice)
5. User clicks 'Vote (15 Points)' button
6. System records vote in poll_votes table
7. System adds 15 points to user balance via points_transactions
8. Results page shown: percentage breakdown of all votes
9. Homepage poll card counter decrements by 1 (one fewer unvoted poll)

---

## 7. Module 7 — Games (Daily Spin the Wheel)

### 7.1 What is the Games Module?

The Games module provides fun interactive activities that reward users with points. The primary game is the Daily Spin the Wheel — a free daily game where users spin a wheel and land on a random points prize. This increases daily platform engagement and gives users a reason to return every day.

From the homepage, users see a Games card showing: "0 of 1 played — Calling all gamers! Check out our exciting new games!" Users click Participate to go to the games page.

### 7.2 Game: Daily Spin the Wheel

| Property | Details |
|---|---|
| Game Name | Spin the Daily Wheel |
| Game Type | Free game — no points required to play |
| Frequency | Once per day per user (resets at midnight) |
| Access | Games section — Participate button on homepage card |
| Wheel Segments | 8 segments with different point values |
| Animation | Wheel spins with CSS/JS animation and stops on random segment |
| Points Credited | Immediately credited to user account after spin |
| Daily Reset | Redis key expires at midnight — user can spin again next day |

### 7.3 Wheel Segments & Prizes

| Segment | Points Awarded | Probability | INR Value |
|---|---|---|---|
| Better luck next time! | 0 pts | 15% | INR 0.00 |
| 40 Points | 40 pts | 20% | INR 0.40 |
| 80 Points | 80 pts | 20% | INR 0.80 |
| 100 Points | 100 pts | 18% | INR 1.00 |
| 200 Points | 200 pts | 12% | INR 2.00 |
| 300 Points | 300 pts | 8% | INR 3.00 |
| 500 Points | 500 pts | 5% | INR 5.00 |
| 1000 Points | 1,000 pts | 2% | INR 10.00 |

> *NOTE: Probabilities are server-side weighted random — the wheel animation is purely visual. The outcome is determined server-side before the spin animation starts to prevent manipulation.*

### 7.4 Spin the Wheel — Technical Implementation

#### 7.4.1 Daily Spin Tracking with Redis

Redis is used to track daily spin state per user:

- Key format: spin:daily:{user_id} — stores outcome and expiry
- TTL (Time to Live): Set to expire at midnight (00:00) of the next day
- Before spin: check if key exists — if YES, user already spun today
- After spin: set key with outcome and TTL until midnight
- This prevents multiple spins per day without complex DB queries

#### 7.4.2 Server-Side Outcome Generation

The spin outcome is determined server-side using weighted random selection:

1. Client clicks Spin button — POST request sent to /api/games/spin
2. Server checks Redis for spin:daily:{user_id} — if exists return 'already spun'
3. Server generates weighted random outcome from probability table
4. Server stores outcome in Redis with midnight expiry
5. Server credits points to user account via points_transactions
6. Server returns outcome (segment index + points) to client
7. Client plays wheel animation stopping on the returned segment
8. Result overlay shown with points won

### 7.5 Games Database Schema

| Table | Column | Type | Description |
|---|---|---|---|
| games | id | UUID PK | Unique game ID |
| games | game_name | VARCHAR(200) | Game display name |
| games | game_type | VARCHAR(50) | spin_wheel, quiz, etc. |
| games | is_free | BOOLEAN | Free to play or costs points |
| games | is_active | BOOLEAN | Whether game is currently active |
| game_segments | id | UUID PK | Unique segment ID |
| game_segments | game_id | UUID FK | Links to games table |
| game_segments | label | VARCHAR(100) | Segment display text e.g. '100 Points' |
| game_segments | points_value | INTEGER | Points awarded — 0 for 'better luck' |
| game_segments | probability | DECIMAL(5,4) | Weighted probability (sum must equal 1.0) |
| game_segments | color | VARCHAR(7) | Hex color for wheel segment |
| game_plays | id | UUID PK | Unique play record |
| game_plays | game_id | UUID FK | Which game was played |
| game_plays | user_id | UUID FK | Which user played |
| game_plays | segment_id | UUID FK | Which segment was landed on |
| game_plays | points_won | INTEGER | Points awarded for this play |
| game_plays | played_at | TIMESTAMPTZ | Timestamp of play |
| game_plays | play_date | DATE | Date of play (for daily limit checks) |

### 7.6 Games API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | /api/games | List all available games with play status for today |
| GET | /api/games/:id | Get game details and segments |
| POST | /api/games/spin | Execute daily spin — returns outcome + points won |
| GET | /api/games/spin/status | Check if user has already spun today |
| GET | /api/games/history | User's game play history with points won |
| GET | /api/admin/games | Admin: list all games |
| POST | /api/admin/games | Admin: create new game |
| PUT | /api/admin/games/:id/segments | Admin: update wheel segments and probabilities |

### 7.7 Spin the Wheel — Full User Flow

1. User navigates to Games section from homepage card or navigation menu
2. Games page shows: 'Spin the Daily Wheel — Free game — Participate button'
3. User clicks Participate — taken to the wheel game page
4. Large animated wheel displayed with 8 colored segments showing point values
5. 'Spin the Wheel' button in center of wheel — click to begin
6. Button sends POST /api/games/spin to server
7. Server validates: user authenticated, not already spun today
8. Server generates weighted random outcome and stores in Redis
9. Server returns: { segment_index: 3, points_won: 100 }
10. Client animates wheel spinning for 3-4 seconds, decelerating to land on returned segment
11. Result overlay: 'Congratulations! You won 100 Points!' or 'Better luck tomorrow!'
12. Points immediately added to user balance — visible in header/dashboard
13. Next visit: Spin button replaced with 'Come back tomorrow to spin again!' message

### 7.8 Frontend Implementation Notes

- Wheel implemented as SVG or HTML Canvas with CSS transform: rotate() animation
- Each segment drawn as a pie slice with label text rotated along the arc
- Spin animation uses CSS cubic-bezier easing for realistic deceleration
- Final rotation angle calculated from returned segment index: angle = (360 / 8) * segment_index + random full rotations
- requestAnimationFrame used for smooth 60fps animation
- Confetti animation on winning non-zero segments using canvas-confetti library

---

## 8. Module 8 — Chatbot (Luna)

### 8.1 Chatbot Overview

Luna is the platform's virtual assistant chatbot. The widget appears as a floating emoji button on all pages. Users click to open a chat panel.

### 8.2 Predefined Flow Topics

| Flow Topic | Sample Questions Handled | Escalation? |
|---|---|---|
| Login Problems | Cannot log in, forgot password, account locked | Yes — raise ticket if unresolved |
| Survey Problems | Survey not loading, survey closed, disqualified | Yes — raise ticket if unresolved |
| Survey Payment | Points not credited, wrong amount | Yes — raise ticket |
| Rewards Delivery | PayPal payout not received, reward status | Yes — raise ticket |
| Unsubscribe | How to unsubscribe, delete account | Direct to Unsubscribe tab |

### 8.3 Escalation Path

- After each bot response: buttons shown — 'You have answered my query, thank you' OR 'I did not get a response. Let us raise a support ticket.'
- Support ticket creation stores: user_id, issue_type, message, created_at, status=open
- Ticket routed to admin dashboard and DPO/GRO email as required

---

## 9. Data Security & Compliance

### 9.1 Encryption

| Data | Method | Details |
|---|---|---|
| Passwords | bcrypt cost factor 12 | One-way hash — never stored plaintext |
| Sensitive PII (DOB, phone, address, income) | AES-256 column encryption | Encrypted at rest in PostgreSQL |
| Data in transit | TLS 1.3 HTTPS | All traffic encrypted end-to-end |
| Database backups | AES-256 at-rest | Encrypted backup files |
| JWT tokens | RS256 asymmetric signing | Short 15min expiry + refresh tokens |

### 9.2 Security Measures

- Rate limiting: 100 req/min general, 10 req/min on auth endpoints
- Account lockout: 5 failed logins = 30-minute lockout
- CORS: only whitelisted domains permitted
- Input validation with Zod schemas on all endpoints
- SQL injection prevention via Prisma parameterized queries
- XSS prevention via Content Security Policy headers
- CSRF tokens on all state-changing requests
- Audit logs: all login/logout, data changes, admin actions recorded

### 9.3 Compliance

| Law / Standard | Status | Key Requirements Met |
|---|---|---|
| India DPDP Act 2023 | Compliant | Consent logging, data rights endpoints, breach notification plan, DPBI registration |
| CERT-In 2022 | Compliant | 180-day audit logs, NTP sync, 6-hour breach reporting, POC registered |
| SSL / TLS | Compliant | HTTPS enforced, HSTS headers, auto-renewing certificate |
| GDPR (if EU users) | Ready | Consent management, DPA with vendors, data portability, right to erasure |

---

## 10. Complete Database Tables Reference

| Table Name | Purpose |
|---|---|
| users | Core identity: email, password_hash, username, phone, is_verified, created_at |
| user_profiles | Personal details: first_name, surname, DOB, gender, photo_url, country |
| user_addresses | Address, city, PIN code, area_type (urban/rural) |
| user_demographics | Education, employment, income, household size, assets, chief_wage_earner data |
| email_verification_tokens | Registration email tokens: token, expires_at, used_at |
| password_reset_tokens | Password reset tokens: token, expires_at, used_at |
| points_transactions | Points ledger: user_id, action_type, points, description, created_at |
| rewards | Rewards catalogue: name, description, points_required, image_url, is_active |
| rewards_redemptions | Redemptions: user_id, reward_id, points_spent, status, created_at |
| surveys | Survey metadata: title, type, points_value, quota, is_active, expires_at |
| survey_responses | Completions: user_id, survey_id, completed_at, points_awarded |
| profile_surveys | Profile survey categories: name, points_value, sort_order |
| profile_survey_responses | User answers: user_id, category_id, responses (JSONB), completed_at |
| polls | Poll metadata: question, poll_type, points_reward, sponsor, total_votes, expires_at |
| poll_options | Poll answer options: poll_id, option_text, vote_count |
| poll_votes | Vote records: poll_id, user_id, option_ids[], voted_at, points_awarded |
| games | Game metadata: game_name, game_type, is_free, is_active |
| game_segments | Wheel segments: game_id, label, points_value, probability, color |
| game_plays | Play records: game_id, user_id, segment_id, points_won, played_at, play_date |
| notifications | Notification history: user_id, channel, type, message, sent_at, read_at |
| notification_preferences | Per-user channel toggles: user_id, type, email, push, sms, whatsapp |
| consent_logs | GDPR/DPDP consent: user_id, consent_type, consent_version, ip, timestamp |
| support_tickets | Chatbot escalations: user_id, issue_type, message, status, created_at |
| audit_logs | Security audit: action, user_id, ip_address, user_agent, timestamp |

---

## 11. Development Timeline

| Phase | Week | Modules | Deliverable |
|---|---|---|---|
| Phase 1 — Foundation | Week 1–2 | Project setup, DB schema, Auth + Registration + Email verification flow | Working registration with email confirmation and 500 pts award |
| Phase 2 — Profile | Week 3 | Profile surveys (14 categories), About You, Account management tabs | Profile completion with 100 pts bonus |
| Phase 3 — Points | Week 4 | Points system, transaction history, rewards catalogue, redemption | Full points dashboard + rewards page |
| Phase 4 — Surveys | Week 5 | Survey listing (Priority/Quick/Premium), survey matching, completion tracking | Surveys live with point crediting |
| Phase 5 — Polls | Week 6 | Sponsored polls, vote flow, results display, 15pt reward | Polls module fully functional |
| Phase 6 — Games | Week 7 | Spin the Wheel, Redis daily tracking, weighted random, animation | Daily spin game live |
| Phase 7 — Notifications | Week 8 | Email, SMS, Push, WhatsApp channels + user preference settings | All 4 notification channels working |
| Phase 8 — Chatbot | Week 9 | Luna chatbot widget, FAQ flows, support ticket escalation | Chatbot live on all pages |
| Phase 9 — Security | Week 10 | GDPR/DPDP compliance, encryption, audit logs, trust badges, testing | Compliance complete — production ready |

---

## 12. Document Information

| Field | Details |
|---|---|
| Document Title | BinaryIQ — Complete Technical Specification Document |
| Version | 2.0 (Updated — Polls + Games modules added) |
| Date | May 2026 |
| Changes from v1.0 | Added: Module 6 (Polls), Module 7 (Games / Spin the Wheel), corrected registration flow (email verification step), updated DB tables, updated timeline |
| Tech Stack | Next.js 14, Node.js, PostgreSQL 15, Prisma, Redis, SendGrid, Twilio, Firebase FCM, AWS S3 |
| Compliance | India DPDP Act 2023, CERT-In 2022, GDPR-ready, SSL/TLS, AES-256 |
| Status | Draft — Confidential |

*— End of Document —*

---

## 13. Gaps / Inconsistencies Identified (my notes, not in the source)

- **Module numbering mismatch**: §1.2 lists Chatbot as module 9 and Contests as module 8; the body instead numbers Auth(2) → Notifications(3) → Points(4) → Surveys(5) → Polls(6) → Games(7) → Chatbot(8), and never gives Contests its own section, schema, or endpoints.
- **Rewards catalogue** jumps from three 4,500-pt charity donations straight to a 90,000-pt PayPal payout — no mid-tier cash or merchandise reward.
- **"PIN Code"** appears both as a Step 1 registration field (2.1) and again as an About You field (2.3/5.1) — likely the postal code reused, but worth confirming it isn't a duplicate.
- No stated policy on points expiry for dormant accounts.
- The source document itself has no embedded diagrams, wireframes, or screenshots — it is 23 pages of text and tables with a title page and generous whitespace between sections, not additional undocumented content.

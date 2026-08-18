# 04 — Database Architecture ⭐

PostgreSQL 15 + Prisma ORM. This is the **single source of truth for the data model**. Module docs
reference the models here rather than redefining them. If a module needs a schema change, it is added
here first.

---

## 1. Principles

- **One database, schema-per-concern via table prefixes** conceptually, but a single Prisma schema file
  (`packages/db/prisma/schema.prisma`). Split into `.prisma` includes only if it grows unwieldy.
- **UUID primary keys** (`@id @default(uuid()) @db.Uuid`) everywhere — no sequential IDs exposed.
- **snake_case** table & column names in the DB (`@@map` / `@map`), **camelCase** in Prisma/TS.
- **Timestamps**: every table has `created_at` and (where mutable) `updated_at` (`@default(now())`,
  `@updatedAt`). Use `timestamptz` (`@db.Timestamptz(6)`).
- **Soft delete** only where legally/UX required (users). Most tables hard-delete; audit trail lives in
  `audit_logs`.
- **Money/points are integers** (whole points). Never floats. INR display value is derived
  (`points / 100`) in the app layer, never stored.
- **Append-only ledger**: `points_transactions` is immutable — no updates/deletes. Balance is derived.
- **Referential integrity** enforced by FKs; cascade rules chosen explicitly per relation (see §4).
- **Encryption**: sensitive PII columns (DOB, phone, address lines, income) are encrypted at the
  application layer (AES-256-GCM) before write — stored as `bytes`/`text`. See
  [07-security-compliance.md](07-security-compliance.md). Encrypted columns are suffixed `_enc` and are
  **not** indexable/searchable in plaintext.
- **Enums** are Postgres enums via Prisma `enum` for closed sets; open/config sets use lookup tables.

## 2. Conventions quick reference

| Concern | Rule |
|---|---|
| PK | `id String @id @default(uuid()) @db.Uuid` |
| FK field | `<entity>Id String @db.Uuid` + relation |
| Timestamps | `createdAt`, `updatedAt` mapped to `created_at`, `updated_at` |
| Naming | Prisma model `PascalCase` singular → `@@map("snake_case_plural")` |
| Money | `Int` points; INR derived in app |
| JSON | `Json @db.JsonB` for flexible survey answers |
| Indexes | index every FK + every column used in a `where`/`orderBy` hot path |

---

## 3. Entity groups (ERD overview)

```
Identity            users ─1:1─ user_profiles
                    users ─1:1─ user_addresses
                    users ─1:1─ user_demographics
                    users ─1:n─ auth_tokens (email_verification | password_reset)
                    users ─1:1─ paypal_accounts

Points core         users ─1:n─ points_transactions      (append-only ledger)
                    users ─1:1─ points_balances          (cached derived balance)
                    rewards ─1:n─ reward_redemptions ─n:1─ users

Profile & surveys   profile_survey_categories ─1:n─ profile_survey_responses ─n:1─ users
                    surveys ─1:n─ survey_responses ─n:1─ users

Polls               polls ─1:n─ poll_options
                    polls ─1:n─ poll_votes ─n:1─ users

Games               games ─1:n─ game_segments
                    games ─1:n─ game_plays ─n:1─ users

Notifications       users ─1:n─ notifications
                    users ─1:n─ notification_preferences
                    users ─1:n─ push_tokens

Support             users ─1:n─ support_tickets ─1:n─ support_ticket_messages

Compliance          users ─1:n─ consent_logs
                    audit_logs (actor = user or admin)
                    admins (staff accounts)
```

Every points-earning event (register, profile survey, survey, poll vote, spin) writes **one row** to
`points_transactions` inside the same DB transaction as the action. That table is the financial truth;
`points_balances` is a performance cache reconciled by a nightly job.

---

## 4. Prisma schema (authoritative)

> This is the target schema. Modules may add fields, but the shape below is the contract. Splitting
> across phases: Phase 0 creates Identity + Points core + `admins` + `audit_logs`; later phases add
> their tables via migrations.

```prisma
// packages/db/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────
enum Gender            { MALE FEMALE OTHER PREFER_NOT_TO_SAY }
enum AuthTokenType     { EMAIL_VERIFICATION PASSWORD_RESET EMAIL_CHANGE }
enum PointsAction {
  REGISTRATION_BONUS PROFILE_SURVEY SURVEY_COMPLETION POLL_VOTE GAME_SPIN
  REDEMPTION ADJUSTMENT REFERRAL
}
enum PointsDirection   { CREDIT DEBIT }
enum RedemptionStatus  { PENDING PROCESSING COMPLETED REJECTED CANCELLED }
enum RewardType        { CHARITY PAYPAL VOUCHER MERCHANDISE }
enum SurveyType        { PRIORITY QUICK PREMIUM }
enum PollType          { SINGLE_CHOICE MULTI_CHOICE }
enum GameType          { SPIN_WHEEL QUIZ }
enum NotificationChannel { EMAIL PUSH SMS WHATSAPP }
enum NotificationType  {
  REGISTRATION SURVEY_INVITE SURVEY_REMINDER POINTS_UPDATE GAME_REMINDER
  REWARD_UPDATE PASSWORD_RESET OFFERS_NEWS
}
enum NotificationStatus { QUEUED SENT DELIVERED FAILED READ }
enum TicketStatus      { OPEN PENDING RESOLVED CLOSED }
enum TicketIssueType   { LOGIN SURVEY SURVEY_PAYMENT REWARDS UNSUBSCRIBE OTHER }
enum AdminRole         { SUPER_ADMIN ADMIN SUPPORT DPO }
enum AreaType          { URBAN RURAL SUBURBAN }

// ─────────────────────────────────────────────────────────────
// IDENTITY
// ─────────────────────────────────────────────────────────────
model User {
  id             String   @id @default(uuid()) @db.Uuid
  email          String   @unique
  passwordHash   String   @map("password_hash")
  username       String   @unique
  phoneEnc       String?  @map("phone_enc")          // AES-256, nullable
  isVerified     Boolean  @default(false) @map("is_verified")
  isActive       Boolean  @default(true) @map("is_active")
  lastLoginAt    DateTime? @map("last_login_at") @db.Timestamptz(6)
  failedLogins   Int      @default(0) @map("failed_logins")
  lockedUntil    DateTime? @map("locked_until") @db.Timestamptz(6)
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt      DateTime? @map("deleted_at") @db.Timestamptz(6)   // soft delete (DPDP erasure)

  profile        UserProfile?
  address        UserAddress?
  demographics   UserDemographics?
  paypalAccount  PaypalAccount?
  authTokens     AuthToken[]
  pointsTxns     PointsTransaction[]
  pointsBalance  PointsBalance?
  redemptions    RewardRedemption[]
  profileResponses ProfileSurveyResponse[]
  surveyResponses  SurveyResponse[]
  pollVotes      PollVote[]
  gamePlays      GamePlay[]
  notifications  Notification[]
  notifPrefs     NotificationPreference[]
  pushTokens     PushToken[]
  tickets        SupportTicket[]
  consentLogs    ConsentLog[]

  @@index([email])
  @@index([username])
  @@map("users")
}

model UserProfile {
  id         String   @id @default(uuid()) @db.Uuid
  userId     String   @unique @map("user_id") @db.Uuid
  firstName  String   @map("first_name")
  surname    String
  dobEnc     String   @map("dob_enc")        // AES-256
  gender     Gender
  photoUrl   String?  @map("photo_url")
  country    String
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("user_profiles")
}

model UserAddress {
  id         String   @id @default(uuid()) @db.Uuid
  userId     String   @unique @map("user_id") @db.Uuid
  line1Enc   String?  @map("line1_enc")
  city       String?
  pinCode    String?  @map("pin_code")       // postal/PIN — single source (see spec gap #3)
  areaType   AreaType? @map("area_type")
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("user_addresses")
}

model UserDemographics {
  id             String @id @default(uuid()) @db.Uuid
  userId         String @unique @map("user_id") @db.Uuid
  educationLevel String? @map("education_level")
  employmentType String? @map("employment_type")
  incomeBracket  String? @map("income_bracket")
  householdSize  Int?    @map("household_size")
  childrenCount  Int?    @map("children_count")
  chiefWageEarner Boolean? @map("chief_wage_earner")
  assets         Json?   @db.JsonB               // flexible list
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  user           User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("user_demographics")
}

model PaypalAccount {
  id         String   @id @default(uuid()) @db.Uuid
  userId     String   @unique @map("user_id") @db.Uuid
  paypalEmail String  @map("paypal_email")
  verifiedAt DateTime? @map("verified_at") @db.Timestamptz(6)
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("paypal_accounts")
}

model AuthToken {
  id         String   @id @default(uuid()) @db.Uuid
  userId     String   @map("user_id") @db.Uuid
  token      String   @unique
  tokenType  AuthTokenType @map("token_type")
  payload    Json?    @db.JsonB              // e.g. new email for EMAIL_CHANGE
  expiresAt  DateTime @map("expires_at") @db.Timestamptz(6)
  usedAt     DateTime? @map("used_at") @db.Timestamptz(6)
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, tokenType])
  @@index([expiresAt])
  @@map("auth_tokens")
}

// ─────────────────────────────────────────────────────────────
// POINTS CORE (see §5 for ledger rules)
// ─────────────────────────────────────────────────────────────
model PointsTransaction {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @map("user_id") @db.Uuid
  direction   PointsDirection
  action      PointsAction
  points      Int                                   // always positive; direction gives sign
  balanceAfter Int     @map("balance_after")        // snapshot for audit/history display
  description String
  refType     String?  @map("ref_type")             // 'survey' | 'poll' | 'game' | 'reward' ...
  refId       String?  @map("ref_id") @db.Uuid      // links to the source row
  idempotencyKey String? @unique @map("idempotency_key") // prevents double-credit
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, createdAt])
  @@index([refType, refId])
  @@map("points_transactions")
}

model PointsBalance {
  userId     String   @id @map("user_id") @db.Uuid
  balance    Int      @default(0)         // derived cache = SUM(credits) - SUM(debits)
  lifetimeEarned Int  @default(0) @map("lifetime_earned")
  lifetimeSpent  Int  @default(0) @map("lifetime_spent")
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("points_balances")
}

model Reward {
  id             String   @id @default(uuid()) @db.Uuid
  name           String
  description    String
  rewardType     RewardType @map("reward_type")
  pointsRequired Int      @map("points_required")
  imageUrl       String?  @map("image_url")
  metadata       Json?    @db.JsonB          // e.g. charity id, voucher provider
  stock          Int?                        // null = unlimited
  isActive       Boolean  @default(true) @map("is_active")
  sortOrder      Int      @default(0) @map("sort_order")
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  redemptions    RewardRedemption[]
  @@index([isActive, sortOrder])
  @@map("rewards")
}

model RewardRedemption {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @map("user_id") @db.Uuid
  rewardId    String   @map("reward_id") @db.Uuid
  pointsSpent Int      @map("points_spent")
  status      RedemptionStatus @default(PENDING)
  fulfillmentRef String? @map("fulfillment_ref")   // PayPal payout id, charity receipt
  notes       String?
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  reward      Reward   @relation(fields: [rewardId], references: [id])
  @@index([userId, createdAt])
  @@index([status])
  @@map("reward_redemptions")
}

// ─────────────────────────────────────────────────────────────
// PROFILE SURVEYS & SURVEYS
// ─────────────────────────────────────────────────────────────
model ProfileSurveyCategory {
  id          String   @id @default(uuid()) @db.Uuid
  key         String   @unique               // 'about_you', 'health', ...
  name        String
  pointsValue Int      @map("points_value")
  sortOrder   Int      @map("sort_order")
  schema      Json     @db.JsonB             // question definitions (data-driven form)
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  responses   ProfileSurveyResponse[]
  @@map("profile_survey_categories")
}

model ProfileSurveyResponse {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @map("user_id") @db.Uuid
  categoryId  String   @map("category_id") @db.Uuid
  responses   Json     @db.JsonB
  pointsAwarded Int    @map("points_awarded")
  completedAt DateTime @default(now()) @map("completed_at") @db.Timestamptz(6)
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  category    ProfileSurveyCategory @relation(fields: [categoryId], references: [id])
  @@unique([userId, categoryId])   // one completion per category per user
  @@map("profile_survey_responses")
}

model Survey {
  id          String   @id @default(uuid()) @db.Uuid
  title       String
  type        SurveyType
  pointsValue Int      @map("points_value")
  quota       Int?                              // max completions
  completedCount Int   @default(0) @map("completed_count")
  targeting   Json?    @db.JsonB                // matching criteria (age/gender/income/pin ...)
  externalUrl String?  @map("external_url")     // provider survey link
  isActive    Boolean  @default(true) @map("is_active")
  expiresAt   DateTime? @map("expires_at") @db.Timestamptz(6)
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  responses   SurveyResponse[]
  @@index([isActive, type])
  @@map("surveys")
}

model SurveyResponse {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @map("user_id") @db.Uuid
  surveyId    String   @map("survey_id") @db.Uuid
  status      String   @default("completed")  // started | completed | disqualified
  pointsAwarded Int    @map("points_awarded")
  completedAt DateTime? @map("completed_at") @db.Timestamptz(6)
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  survey      Survey   @relation(fields: [surveyId], references: [id])
  @@unique([userId, surveyId])
  @@index([userId])
  @@map("survey_responses")
}

// ─────────────────────────────────────────────────────────────
// POLLS
// ─────────────────────────────────────────────────────────────
model Poll {
  id           String   @id @default(uuid()) @db.Uuid
  question     String
  pollType     PollType @map("poll_type")
  pointsReward Int      @default(15) @map("points_reward")
  sponsorName  String?  @map("sponsor_name")
  totalVotes   Int      @default(0) @map("total_votes")
  isActive     Boolean  @default(true) @map("is_active")
  expiresAt    DateTime? @map("expires_at") @db.Timestamptz(6)
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  options      PollOption[]
  votes        PollVote[]
  @@index([isActive])
  @@map("polls")
}

model PollOption {
  id         String   @id @default(uuid()) @db.Uuid
  pollId     String   @map("poll_id") @db.Uuid
  optionText String   @map("option_text")
  voteCount  Int      @default(0) @map("vote_count")
  sortOrder  Int      @default(0) @map("sort_order")
  poll       Poll     @relation(fields: [pollId], references: [id], onDelete: Cascade)
  @@index([pollId])
  @@map("poll_options")
}

model PollVote {
  id            String   @id @default(uuid()) @db.Uuid
  pollId        String   @map("poll_id") @db.Uuid
  userId        String   @map("user_id") @db.Uuid
  optionIds     String[] @map("option_ids") @db.Uuid
  pointsAwarded Int      @map("points_awarded")
  votedAt       DateTime @default(now()) @map("voted_at") @db.Timestamptz(6)
  poll          Poll     @relation(fields: [pollId], references: [id], onDelete: Cascade)
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([pollId, userId])   // one vote per poll per user
  @@index([userId])
  @@map("poll_votes")
}

// ─────────────────────────────────────────────────────────────
// GAMES
// ─────────────────────────────────────────────────────────────
model Game {
  id        String   @id @default(uuid()) @db.Uuid
  gameName  String   @map("game_name")
  gameType  GameType @map("game_type")
  isFree    Boolean  @default(true) @map("is_free")
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  segments  GameSegment[]
  plays     GamePlay[]
  @@map("games")
}

model GameSegment {
  id          String   @id @default(uuid()) @db.Uuid
  gameId      String   @map("game_id") @db.Uuid
  label       String
  pointsValue Int      @map("points_value")
  probability Decimal  @db.Decimal(5, 4)      // sum per game must equal 1.0000
  color       String   @db.VarChar(7)
  sortOrder   Int      @default(0) @map("sort_order")
  game        Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  plays       GamePlay[]
  @@index([gameId])
  @@map("game_segments")
}

model GamePlay {
  id        String   @id @default(uuid()) @db.Uuid
  gameId    String   @map("game_id") @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  segmentId String   @map("segment_id") @db.Uuid
  pointsWon Int      @map("points_won")
  playedAt  DateTime @default(now()) @map("played_at") @db.Timestamptz(6)
  playDate  DateTime @map("play_date") @db.Date        // for daily-limit uniqueness
  game      Game     @relation(fields: [gameId], references: [id])
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  segment   GameSegment @relation(fields: [segmentId], references: [id])
  @@unique([userId, gameId, playDate])   // DB-level daily lock (Redis is the fast path)
  @@index([userId])
  @@map("game_plays")
}

// ─────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────
model Notification {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  channel   NotificationChannel
  type      NotificationType
  title     String?
  message   String
  status    NotificationStatus @default(QUEUED)
  sentAt    DateTime? @map("sent_at") @db.Timestamptz(6)
  readAt    DateTime? @map("read_at") @db.Timestamptz(6)
  metadata  Json?    @db.JsonB
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, createdAt])
  @@index([status])
  @@map("notifications")
}

model NotificationPreference {
  id       String   @id @default(uuid()) @db.Uuid
  userId   String   @map("user_id") @db.Uuid
  type     NotificationType
  email    Boolean  @default(true)
  push     Boolean  @default(true)
  sms      Boolean  @default(false)
  whatsapp Boolean  @default(false)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, type])
  @@map("notification_preferences")
}

model PushToken {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  token     String   @unique
  platform  String                              // web | android | ios
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@map("push_tokens")
}

// ─────────────────────────────────────────────────────────────
// SUPPORT / CHATBOT
// ─────────────────────────────────────────────────────────────
model SupportTicket {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  issueType TicketIssueType @map("issue_type")
  subject   String?
  status    TicketStatus @default(OPEN)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages  SupportTicketMessage[]
  @@index([userId])
  @@index([status])
  @@map("support_tickets")
}

model SupportTicketMessage {
  id        String   @id @default(uuid()) @db.Uuid
  ticketId  String   @map("ticket_id") @db.Uuid
  senderType String  @map("sender_type")        // user | bot | admin
  message   String
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  ticket    SupportTicket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  @@index([ticketId])
  @@map("support_ticket_messages")
}

// ─────────────────────────────────────────────────────────────
// STAFF & COMPLIANCE
// ─────────────────────────────────────────────────────────────
model Admin {
  id           String   @id @default(uuid()) @db.Uuid
  email        String   @unique
  passwordHash String   @map("password_hash")
  name         String
  role         AdminRole @default(ADMIN)
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  @@map("admins")
}

model ConsentLog {
  id             String   @id @default(uuid()) @db.Uuid
  userId         String   @map("user_id") @db.Uuid
  consentType    String   @map("consent_type")     // terms | privacy | marketing | cookies
  consentVersion String   @map("consent_version")
  granted        Boolean
  ipAddress      String?  @map("ip_address")
  userAgent      String?  @map("user_agent")
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, consentType])
  @@map("consent_logs")
}

model AuditLog {
  id         String   @id @default(uuid()) @db.Uuid
  actorType  String   @map("actor_type")           // user | admin | system
  actorId    String?  @map("actor_id") @db.Uuid
  action     String                                 // 'user.login', 'poll.create', ...
  targetType String?  @map("target_type")
  targetId   String?  @map("target_id") @db.Uuid
  ipAddress  String?  @map("ip_address")
  userAgent  String?  @map("user_agent")
  metadata   Json?    @db.JsonB
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  @@index([actorType, actorId])
  @@index([action, createdAt])
  @@map("audit_logs")
}
```

---

## 5. Points ledger rules (critical — reused by modules 1, 3, 5, 6)

The ledger is the platform's financial integrity guarantee. **All** point movements go through one
service: `PointsService.award(...)` / `PointsService.spend(...)`.

**Invariants**
1. Every earning/spending action inserts exactly one `points_transactions` row inside the **same Prisma
   `$transaction`** as the domain write (survey response, poll vote, redemption, etc.). If the domain
   write rolls back, so does the point credit.
2. `points` is stored positive; `direction` (CREDIT/DEBIT) carries the sign.
3. `balanceAfter` is computed within the transaction (read current balance `FOR UPDATE`, apply, write
   snapshot) so history rows are self-describing.
4. `points_balances` is updated in the same transaction (cache), giving O(1) balance reads.
5. **Idempotency**: actions that could be retried (spin, vote, survey submit, webhook-driven credits)
   pass an `idempotencyKey` (e.g. `spin:{userId}:{date}`); the unique constraint blocks double-credits.
6. Ledger rows are **never updated or deleted**. Corrections are new `ADJUSTMENT` rows.
7. A nightly reconciliation job recomputes each user's balance from the ledger and alerts on drift.

**Award pseudocode**
```ts
await prisma.$transaction(async (tx) => {
  const bal = await tx.pointsBalance.upsert({ where: { userId }, ... }); // locked read
  const newBalance = bal.balance + points;
  await tx.pointsTransaction.create({ data: {
    userId, direction: 'CREDIT', action, points, balanceAfter: newBalance,
    description, refType, refId, idempotencyKey,
  }});
  await tx.pointsBalance.update({ where: { userId },
    data: { balance: newBalance, lifetimeEarned: { increment: points } } });
});
```

## 6. Redis usage (not Postgres, but part of data layer)

| Key | Purpose | TTL |
|---|---|---|
| `session:{sessionId}` | NextAuth/JWT refresh session | sliding |
| `otp:{phone}` | SMS OTP | 5 min |
| `spin:daily:{userId}` | Daily spin lock + outcome | until next local midnight |
| `ratelimit:{scope}:{ip/user}` | Rate limiting counters | window |
| `reg:draft:{sessionId}` | In-progress 2-step registration data | 1 hr |

Redis is the **fast path** for the daily spin lock; `game_plays` unique constraint is the durable
backstop (§4). See [modules/module-06-games.md](../modules/module-06-games.md).

## 7. Migrations & seeding

- Prisma Migrate; one migration per PR, reviewed. Never edit an applied migration.
- **Seed data** (`packages/db/prisma/seed.ts`): 14 profile survey categories, the Spin-the-Wheel game
  + 8 segments (probabilities from spec), the initial rewards catalogue, and a super-admin.
- Env: `DATABASE_URL` (pooled, for app) + `DIRECT_URL` (for migrations) per Prisma + PgBouncer guidance.

## 8. Indexing & performance notes

- Every FK is indexed (Prisma does not auto-index FKs).
- Hot read paths indexed explicitly: `points_transactions(user_id, created_at)` for history,
  `notifications(user_id, created_at)`, `surveys(is_active, type)`, `polls(is_active)`.
- Vote/spin counters (`total_votes`, `vote_count`, `completed_count`) are denormalized counters updated
  in-transaction to avoid `COUNT(*)` on hot paths.
- Use cursor pagination on large lists (transactions, notifications) — see
  [05-api-conventions.md](05-api-conventions.md).

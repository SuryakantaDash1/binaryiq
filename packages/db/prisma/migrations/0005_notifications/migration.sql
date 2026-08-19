-- Module 07: Notifications, NotificationPreferences, PushTokens

CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'PUSH', 'SMS', 'WHATSAPP');
CREATE TYPE "NotificationType" AS ENUM ('REGISTRATION', 'SURVEY_INVITE', 'SURVEY_REMINDER', 'POINTS_UPDATE', 'GAME_REMINDER', 'REWARD_UPDATE', 'PASSWORD_RESET', 'OFFERS_NEWS');
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'READ');

CREATE TABLE "notifications" (
  "id"         UUID                   NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    UUID                   NOT NULL,
  "channel"    "NotificationChannel"  NOT NULL,
  "type"       "NotificationType"     NOT NULL,
  "title"      TEXT,
  "message"    TEXT                   NOT NULL,
  "status"     "NotificationStatus"   NOT NULL DEFAULT 'QUEUED',
  "sent_at"    TIMESTAMPTZ,
  "read_at"    TIMESTAMPTZ,
  "metadata"   JSONB,
  "created_at" TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

CREATE TABLE "notification_preferences" (
  "id"         UUID               NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    UUID               NOT NULL,
  "type"       "NotificationType" NOT NULL,
  "email"      BOOLEAN            NOT NULL DEFAULT TRUE,
  "push"       BOOLEAN            NOT NULL DEFAULT TRUE,
  "sms"        BOOLEAN            NOT NULL DEFAULT FALSE,
  "whatsapp"   BOOLEAN            NOT NULL DEFAULT FALSE,
  "updated_at" TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "notification_preferences_user_id_type_key" ON "notification_preferences"("user_id", "type");
CREATE INDEX "notification_preferences_user_id_idx" ON "notification_preferences"("user_id");

CREATE TABLE "push_tokens" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    UUID        NOT NULL,
  "token"      TEXT        NOT NULL,
  "platform"   TEXT        NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");
CREATE INDEX "push_tokens_user_id_idx" ON "push_tokens"("user_id");

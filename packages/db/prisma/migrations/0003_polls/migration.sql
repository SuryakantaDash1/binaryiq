-- Module 05: Polls (Phase 5)

CREATE TYPE "PollType" AS ENUM ('SINGLE_CHOICE', 'MULTI_CHOICE');

CREATE TABLE "polls" (
  "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
  "question"      TEXT        NOT NULL,
  "poll_type"     "PollType"  NOT NULL,
  "points_reward" INTEGER     NOT NULL DEFAULT 15,
  "sponsor_name"  TEXT,
  "total_votes"   INTEGER     NOT NULL DEFAULT 0,
  "is_active"     BOOLEAN     NOT NULL DEFAULT TRUE,
  "expires_at"    TIMESTAMPTZ,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "polls_is_active_idx" ON "polls"("is_active");

CREATE TABLE "poll_options" (
  "id"          UUID    NOT NULL DEFAULT gen_random_uuid(),
  "poll_id"     UUID    NOT NULL,
  "option_text" TEXT    NOT NULL,
  "vote_count"  INTEGER NOT NULL DEFAULT 0,
  "sort_order"  INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "poll_options_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE
);

CREATE INDEX "poll_options_poll_id_idx" ON "poll_options"("poll_id");

CREATE TABLE "poll_votes" (
  "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
  "poll_id"        UUID        NOT NULL,
  "user_id"        UUID        NOT NULL,
  "option_ids"     TEXT[]      NOT NULL,
  "points_awarded" INTEGER     NOT NULL,
  "voted_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "poll_votes_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id"),
  CONSTRAINT "poll_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "poll_votes_poll_id_user_id_key" ON "poll_votes"("poll_id", "user_id");
CREATE INDEX "poll_votes_user_id_idx" ON "poll_votes"("user_id");

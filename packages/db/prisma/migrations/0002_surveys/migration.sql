-- Module 04: Brand surveys (Phase 4)

CREATE TYPE "SurveyType" AS ENUM ('PRIORITY', 'QUICK', 'PREMIUM');

CREATE TABLE "surveys" (
  "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
  "title"           TEXT        NOT NULL,
  "description"     TEXT,
  "type"            "SurveyType" NOT NULL,
  "points_value"    INTEGER     NOT NULL,
  "estimated_mins"  INTEGER,
  "quota"           INTEGER,
  "completed_count" INTEGER     NOT NULL DEFAULT 0,
  "targeting"       JSONB,
  "external_url"    TEXT,
  "is_active"       BOOLEAN     NOT NULL DEFAULT TRUE,
  "expires_at"      TIMESTAMPTZ,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "surveys_is_active_type_idx" ON "surveys"("is_active", "type");

CREATE TABLE "survey_responses" (
  "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
  "user_id"        UUID        NOT NULL,
  "survey_id"      UUID        NOT NULL,
  "status"         TEXT        NOT NULL,
  "points_awarded" INTEGER     NOT NULL DEFAULT 0,
  "return_token"   TEXT UNIQUE,
  "completed_at"   TIMESTAMPTZ,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "survey_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "survey_responses_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id")
);

CREATE UNIQUE INDEX "survey_responses_user_id_survey_id_key" ON "survey_responses"("user_id", "survey_id");
CREATE INDEX "survey_responses_user_id_created_at_idx" ON "survey_responses"("user_id", "created_at");

CREATE TABLE "profile_survey_responses" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "responses" JSONB NOT NULL,
  "points_awarded" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "profile_survey_responses_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "profile_survey_responses" ADD CONSTRAINT "profile_survey_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_survey_responses" ADD CONSTRAINT "profile_survey_responses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "profile_survey_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "profile_survey_responses_user_id_category_id_key" ON "profile_survey_responses"("user_id", "category_id");
CREATE INDEX "profile_survey_responses_user_id_created_at_idx" ON "profile_survey_responses"("user_id", "created_at");

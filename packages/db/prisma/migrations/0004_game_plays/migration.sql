-- Module 06: GamePlay table (games and game_segments already created in Phase 0 seed)

CREATE TABLE "game_plays" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "user_id"     UUID        NOT NULL,
  "game_id"     UUID        NOT NULL,
  "segment_id"  UUID        NOT NULL,
  "points_won"  INTEGER     NOT NULL,
  "play_date"   DATE        NOT NULL,
  "played_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "game_plays_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "game_plays_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "game_plays_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id"),
  CONSTRAINT "game_plays_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "game_segments"("id")
);

CREATE UNIQUE INDEX "game_plays_user_id_game_id_play_date_key" ON "game_plays"("user_id", "game_id", "play_date");
CREATE INDEX "game_plays_user_id_played_at_idx" ON "game_plays"("user_id", "played_at");

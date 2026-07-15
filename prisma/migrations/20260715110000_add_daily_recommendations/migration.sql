CREATE TABLE "github_trend_recommendation_batch" (
  "id" CHAR(24) NOT NULL,
  "report_date" DATE NOT NULL,
  "source_scored_at" TIMESTAMPTZ(3) NOT NULL,
  "requested_count" INTEGER NOT NULL DEFAULT 10,
  "selected_count" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gtr_rec_batch_pk" PRIMARY KEY ("id")
);

CREATE TABLE "github_trend_recommendation_item" (
  "id" CHAR(24) NOT NULL,
  "batch_id" CHAR(24) NOT NULL,
  "repository_id" CHAR(24) NOT NULL,
  "position" INTEGER NOT NULL,
  "scored_at" TIMESTAMPTZ(3) NOT NULL,
  "trend_heat" DOUBLE PRECISION NOT NULL,
  "technical_substance" DOUBLE PRECISION NOT NULL,
  "manipulation_risk" DOUBLE PRECISION NOT NULL,
  "confidence" VARCHAR(16) NOT NULL,
  "classification" VARCHAR(48) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gtr_rec_item_pk" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gtr_rec_batch_date_uq" ON "github_trend_recommendation_batch"("report_date");
CREATE INDEX "gtr_rec_batch_created_idx" ON "github_trend_recommendation_batch"("created_at");
CREATE UNIQUE INDEX "gtr_rec_item_repo_uq" ON "github_trend_recommendation_item"("repository_id");
CREATE UNIQUE INDEX "gtr_rec_item_batch_pos_uq" ON "github_trend_recommendation_item"("batch_id", "position");
CREATE INDEX "gtr_rec_item_batch_idx" ON "github_trend_recommendation_item"("batch_id");
